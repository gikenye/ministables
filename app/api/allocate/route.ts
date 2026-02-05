import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  VAULT_ABI,
  GOAL_MANAGER_ABI,
  LEADERBOARD_ABI,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import { getContractCompliantTargetDate } from "@/lib/backend/utils";
import {
  createProvider,
  createBackendWallet,
  waitForTransactionReceipt,
  findEventInLogs,
  isValidAddress,
  formatAmountForDisplay,
} from "@/lib/backend/utils";
import type {
  AllocateRequest,
  AllocateResponse,
  ErrorResponse,
  VaultAsset,
} from "@/lib/backend/types";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import { GoalSyncService } from "@/lib/backend/services/goal-sync.service";
import { logger } from "@/lib/backend/logger";

export async function POST(
  request: NextRequest
): Promise<NextResponse<AllocateResponse | ErrorResponse>> {
  try {
    logger.info("💰 Allocate API called");
    logger.info("🌐 Request details", {
      method: request.method,
      url: request.url,
      contentType: request.headers.get('content-type'),
      timestamp: new Date().toISOString()
    });
    const body: AllocateRequest & {
      metaGoalId?: string;
      tokenSymbol?: string;
      chainId?: string | number;
      chain?: string;
    } = await request.json();
    logger.debug("📊 RAW Allocate request body", { body });
    const {
      asset,
      tokenSymbol,
      userAddress,
      amount,
      txHash,
      targetGoalId,
      metaGoalId,
      providerPayload,
      chainId,
      chain,
    } = body;
    // Handle both asset and tokenSymbol for backward compatibility
    const finalAsset = asset || tokenSymbol;
    const providerTxCode = (() => {
      if (!providerPayload || typeof providerPayload !== "object") {
        return undefined;
      }
      const payload = providerPayload as {
        transaction_code?: unknown;
        data?: { transaction_code?: unknown };
      };
      if (typeof payload.transaction_code === "string") {
        return payload.transaction_code;
      }
      if (typeof payload.data?.transaction_code === "string") {
        return payload.data.transaction_code;
      }
      return undefined;
    })();
    logger.debug("🔍 Extracted fields", {
      asset,
      tokenSymbol,
      finalAsset,
      userAddress,
      amount,
      txHash,
      providerTxCode,
      targetGoalId,
      targetGoalIdType: typeof targetGoalId,
      targetGoalIdValue: targetGoalId
    });

    // Validate required fields
    if (!finalAsset || !userAddress || !amount || !txHash || !providerPayload) {
      logger.error("❌ Missing required fields", {
        finalAsset,
        userAddress,
        amount,
        txHash,
        providerPayload,
      });
      return NextResponse.json(
        {
          error: "Missing required fields: asset/tokenSymbol, userAddress, amount, txHash, providerPayload",
        },
        { status: 400 }
      );
    }

    if (!providerTxCode) {
      logger.error("❌ Missing provider transaction code", { providerPayload });
      return NextResponse.json(
        {
          error: "Missing provider transaction code. providerPayload must include transaction_code",
        },
        { status: 400 }
      );
    }

    // Validate user address
    if (!isValidAddress(userAddress)) {
      logger.error("❌ Invalid userAddress", { userAddress });
      return NextResponse.json(
        { error: "Invalid userAddress" },
        { status: 400 }
      );
    }

    // Validate and normalize amount
    const normalizedAmount = amount.trim();
    if (!/^\d+$/.test(normalizedAmount)) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a non-negative raw integer string (e.g., '1000000'), no decimals or signs allowed" },
        { status: 400 }
      );
    }
    const amountNum = Number(normalizedAmount);
    if (!Number.isInteger(amountNum)) {
      return NextResponse.json(
        { error: "Invalid amount. Must be an integer value" },
        { status: 400 }
      );
    }
    
    logger.info("✅ Processing allocation for", {
      finalAsset,
      userAddress,
      amount: normalizedAmount,
      targetGoalId,
    });

    // Validate asset
    const chainParams = { chainId, chain };
    const vaults = getVaultsForChain(chainParams);
    const contracts = getContractsForChain(chainParams);
    const vaultConfig = vaults[finalAsset as keyof typeof vaults];
    if (!vaultConfig) {
      return NextResponse.json(
        {
          error: `Invalid asset. Supported assets: ${Object.keys(vaults).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Initialize provider and wallet
    const provider = createProvider(chainParams);
    const backendWallet = createBackendWallet(provider);

    // Wait for transaction receipt with timeout
    let receipt;
    try {
      receipt = await waitForTransactionReceipt(provider, txHash);
      if (!receipt) {
        logger.error("Transaction receipt not found after retries", { txHash });
        return NextResponse.json(
          { error: "Transaction not found on chain. Please verify the transaction hash and try again." },
          { status: 400 }
        );
      }
    } catch (error) {
      logger.error("Failed to get transaction receipt", {
        txHash,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Failed to fetch transaction. Please try again." },
        { status: 500 }
      );
    }

    logger.debug("Transaction receipt", { receipt });
    if (!receipt.status) {
      return NextResponse.json(
        { error: "Transaction failed on chain" },
        { status: 400 }
      );
    }

    // Verify transfer to vault
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    logger.debug("Looking for transfer topic", { transferTopic });
    logger.debug("Vault config", { vaultConfig });
    const vaultTransfer = receipt.logs.find((log: ethers.Log) => {
      logger.debug("Checking log", { address: log.address, topic: log.topics[0] });
      if (log.topics[0] !== transferTopic) return false;
      if (log.address.toLowerCase() !== vaultConfig.asset.toLowerCase())
        return false;
      const to = ethers.getAddress("0x" + log.topics[2].slice(26));
      logger.debug("Parsed to address", { to });
      return to.toLowerCase() === vaultConfig.address.toLowerCase();
    });
    logger.info("Vault transfer found", { found: !!vaultTransfer });

    if (!vaultTransfer) {
      return NextResponse.json(
        { error: "No transfer to vault found in transaction" },
        { status: 400 }
      );
    }

    const normalizedAmountBigInt = BigInt(normalizedAmount);
    const transferAmount = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint256"],
      vaultTransfer.data
    )[0] as bigint;
    if (transferAmount !== normalizedAmountBigInt) {
      logger.warn("Transfer amount mismatch", {
        txHash,
        userAddress,
        expected: normalizedAmountBigInt.toString(),
        actual: transferAmount.toString(),
      });
      return NextResponse.json(
        {
          error: "Transfer amount does not match requested amount",
          txHash,
          userAddress,
        },
        { status: 400 }
      );
    }

    const vault = new ethers.Contract(
      vaultConfig.address,
      VAULT_ABI,
      backendWallet
    );

    // Pre-checks using on-chain data as source of truth
    try {
      if (typeof vault.processedTxHashes === 'function') {
        const isProcessed = await vault.processedTxHashes(txHash);
        if (isProcessed) {
          logger.warn("⚠️ Transaction already processed", { txHash });
          return NextResponse.json(
            { error: "Transaction already processed" },
            { status: 400 }
          );
        }
      }

      if (typeof vault.depositCount === 'function' && typeof vault.MAX_DEPOSITS_PER_USER === 'function') {
        const depositCount = await vault.depositCount(userAddress);
        const maxDeposits = await vault.MAX_DEPOSITS_PER_USER();
        logger.info("📊 User deposit status", {
          depositCount: depositCount.toString(),
          maxDeposits: maxDeposits.toString(),
        });

        if (depositCount >= maxDeposits) {
          return NextResponse.json(
            { error: `User has reached maximum deposits (${maxDeposits.toString()})` },
            { status: 400 }
          );
        }
      }
    } catch (error) {
      logger.warn("Pre-check error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Allocate the onramp deposit from the vault and parse the on-chain event.
    let allocateTx, allocateReceipt;
    try {
      allocateTx = await vault.allocateOnrampDeposit(
        userAddress,
        normalizedAmountBigInt,
        txHash
      );
      allocateReceipt = await allocateTx.wait();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Already processed")) {
        logger.warn("⚠️ Transaction already processed", { txHash });
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 400 }
        );
      }
      throw error;
    }
    const onrampDepositEvent = findEventInLogs(
      allocateReceipt.logs,
      vault,
      "OnrampDeposit"
    );
    if (!onrampDepositEvent) {
      return NextResponse.json(
        { error: "Failed to parse onramp deposit event from allocation tx" },
        { status: 500 }
      );
    }

    const depositId = onrampDepositEvent.args.depositId.toString();
    const shares = onrampDepositEvent.args.shares.toString();

    // Handle goal attachment
    let attachedGoalId: bigint = BigInt(0);
    try {
      const goalManagerRead = new ethers.Contract(
        contracts.GOAL_MANAGER,
        GOAL_MANAGER_ABI,
        provider
      );
      const goalManagerWrite = new ethers.Contract(
        contracts.GOAL_MANAGER,
        GOAL_MANAGER_ABI,
        backendWallet
      );

      // Use target goal if specified, otherwise default to quicksave
    logger.debug("🎯 Goal selection logic", {
      hasTargetGoalId: !!targetGoalId,
      hasMetaGoalId: !!metaGoalId,
      targetGoalIdValue: targetGoalId,
      targetGoalIdType: typeof targetGoalId,
      willUseTargetGoal: !!targetGoalId || !!metaGoalId
    });
      
      // Handle meta-goal routing first
      if (metaGoalId && !targetGoalId) {
        try {
          const collection = await getMetaGoalsCollection();
          const metaGoal = await collection.findOne({ metaGoalId });
          
          if (metaGoal) {
            const onChainGoalId = metaGoal.onChainGoals[finalAsset as VaultAsset];
            if (onChainGoalId) {
              logger.info("🎯 Meta-goal resolved to on-chain goal", {
                metaGoalId,
                onChainGoalId,
                asset: finalAsset,
              });
              // Validate the resolved goal exists and matches vault
              const resolvedGoal = await goalManagerRead.goals(onChainGoalId);
              if (resolvedGoal.id.toString() !== "0" && 
                  resolvedGoal.vault.toLowerCase() === vaultConfig.address.toLowerCase()) {
                attachedGoalId = BigInt(onChainGoalId);
                logger.info("✅ Using meta-goal resolved target", { onChainGoalId });
              } else {
                logger.warn("❌ Meta-goal resolved goal invalid, falling back to quicksave", {
                  onChainGoalId,
                });
              }
            } else {
              logger.warn("❌ Meta-goal has no on-chain goal for asset, falling back to quicksave", {
                metaGoalId,
                asset: finalAsset,
              });
            }
          } else {
            logger.warn("❌ Meta-goal not found, falling back to quicksave", { metaGoalId });
          }
        } catch (error) {
          logger.warn("❌ Error resolving meta-goal", {
            metaGoalId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      if (targetGoalId && attachedGoalId === BigInt(0)) {
        // Validate that target goal exists and matches the current vault
        try {
          const targetGoal = await goalManagerRead.goals(targetGoalId);
          if (targetGoal.id.toString() === "0") {
            logger.warn("❌ Target goal does not exist, falling back to quicksave", {
              targetGoalId,
            });
          } else if (targetGoal.vault.toLowerCase() !== vaultConfig.address.toLowerCase()) {
            logger.warn("❌ Target goal vault mismatch, falling back to quicksave", {
              targetGoalId,
              expectedVault: vaultConfig.address,
              actualVault: targetGoal.vault,
            });
          } else {
            attachedGoalId = BigInt(targetGoalId);
            logger.info("✅ Using target goal", {
              targetGoalId,
              attachedGoalId: attachedGoalId.toString(),
            });
            
            // Lazy sync: ensure goal exists in database
            const syncService = new GoalSyncService(provider, contracts, vaults);
            await syncService.getGoalWithFallback(targetGoalId);
          }
        } catch (error) {
          logger.warn("❌ Error validating target goal", {
            targetGoalId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      
      if (attachedGoalId === BigInt(0)) {
        // Check if user has existing goals in other vaults that could be expanded
        try {
          const collection = await getMetaGoalsCollection();
          const userMetaGoals = await collection.find({ creatorAddress: userAddress.toLowerCase() }).toArray();
          if (userMetaGoals.length > 0) {
            // Find a meta-goal that doesn't have this asset yet
            const expandableGoal = userMetaGoals.find((mg: { onChainGoals: Record<string, string> }) => !mg.onChainGoals[finalAsset as VaultAsset]);
            if (expandableGoal) {
              // Auto-expand the goal to include this asset
              const targetAmountWei = ethers.parseUnits(expandableGoal.targetAmountUSD.toString(), vaultConfig.decimals);
              const parsedTargetDate = getContractCompliantTargetDate();
              
              const createTx = await goalManagerWrite.createGoalFor(
                userAddress,
                vaultConfig.address,
                targetAmountWei,
                parsedTargetDate,
                expandableGoal.name
              );
              
              const createReceipt = await createTx.wait();
              const goalEvent = findEventInLogs(createReceipt.logs, goalManagerWrite, "GoalCreated");
              
              if (goalEvent) {
                attachedGoalId = goalEvent.args.goalId;
                // Update meta-goal in database
                expandableGoal.onChainGoals[finalAsset as VaultAsset] = attachedGoalId.toString();
                await collection.updateOne(
                  { metaGoalId: expandableGoal.metaGoalId },
                  { $set: { onChainGoals: expandableGoal.onChainGoals, updatedAt: new Date().toISOString() } }
                );
                logger.info("✅ Auto-expanded meta-goal to include asset", {
                  metaGoalId: expandableGoal.metaGoalId,
                  asset: finalAsset,
                });
              }
            }
          }
        } catch (error) {
          logger.warn("Auto-expansion failed, falling back to quicksave", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        
        if (attachedGoalId === BigInt(0)) {
          // Get quicksave goal directly from contract
          attachedGoalId = await goalManagerRead.getQuicksaveGoal(
            vaultConfig.address,
            userAddress
          );

          if (attachedGoalId.toString() === "0") {
            // Create quicksave goal
            const createTx = await goalManagerWrite.createQuicksaveGoalFor(
              userAddress,
              vaultConfig.address
            );
            const createReceipt = await createTx.wait();

            const goalEvent = findEventInLogs(
              createReceipt.logs,
              goalManagerWrite,
              "GoalCreated"
            );
            if (goalEvent) {
              attachedGoalId = goalEvent.args.goalId;
            }
          }
          logger.info("✅ Using quicksave goal", {
            attachedGoalId: attachedGoalId.toString(),
          });
        }
      }
      
      logger.debug("🔗 Final goal attachment decision", {
        selectedGoalId: attachedGoalId.toString(),
        wasTargetGoalProvided: !!targetGoalId,
        originalTargetGoalId: targetGoalId
      });

      if (attachedGoalId !== BigInt(0)) {
        // Verify goal exists before attaching
        try {
          const goal = await goalManagerRead.goals(attachedGoalId);
          if (goal.id.toString() !== "0") {
            // Try to attach deposit
            try {
              const attachTx = await goalManagerWrite.attachDepositsOnBehalf(
                attachedGoalId,
                userAddress,
                [depositId]
              );
              await attachTx.wait();
              logger.info("✅ Successfully attached deposit to goal", {
                depositId,
                goalId: attachedGoalId.toString(),
                userAddress,
                wasTargetGoal: !!targetGoalId,
                originalTargetGoalId: targetGoalId
              });
            } catch (attachError) {
              const errorMsg = attachError instanceof Error ? attachError.message : String(attachError);
              if (errorMsg.includes("already unlocked") || errorMsg.includes("Not found")) {
                logger.warn("Cannot attach deposit", {
                  depositId,
                  error: errorMsg,
                });
              } else {
                throw attachError;
              }
            }
          } else {
            logger.warn("Goal not found, skipping attachment", {
              goalId: attachedGoalId.toString(),
            });
            attachedGoalId = BigInt(0);
          }
        } catch (goalError) {
          logger.warn("Goal validation failed", {
            goalId: attachedGoalId.toString(),
            error: goalError instanceof Error ? goalError.message : String(goalError),
          });
          attachedGoalId = BigInt(0);
        }
      }
    } catch (error) {
      logger.warn("Failed to handle goal attachment, skipping", {
        error: error instanceof Error ? error.message : String(error),
      });
      attachedGoalId = BigInt(0);
    }

    // Record score on leaderboard (non-blocking)
    try {
      const leaderboard = new ethers.Contract(
        contracts.LEADERBOARD,
        LEADERBOARD_ABI,
        backendWallet
      );
      const scoreTx = await leaderboard.recordDepositOnBehalf(
        userAddress,
        BigInt(normalizedAmount)
      );
      await scoreTx.wait();
      logger.info("✅ Leaderboard score recorded", { userAddress, amount: normalizedAmount });
    } catch (error) {
      logger.warn("Failed to record leaderboard score, continuing", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Check if meta-goal is completed
    let goalCompleted = false;
    let responseMetaGoalId: string | undefined;
    
    if (attachedGoalId !== BigInt(0)) {
      try {
        const collection = await getMetaGoalsCollection();
        const metaGoal = await collection.findOne({ [`onChainGoals.${finalAsset}`]: attachedGoalId.toString() });
        
        if (metaGoal) {
          responseMetaGoalId = metaGoal.metaGoalId;
          const goalManagerRead = new ethers.Contract(
            contracts.GOAL_MANAGER,
            GOAL_MANAGER_ABI,
            provider
          );
          let totalProgressUSD = 0;
          
          for (const [asset, goalId] of Object.entries(metaGoal.onChainGoals)) {
            const vaultCfg = vaults[asset as VaultAsset];
            const [totalValue] = await goalManagerRead.getGoalProgressFull(goalId);
            totalProgressUSD += parseFloat(formatAmountForDisplay(totalValue.toString(), vaultCfg.decimals));
          }
          
          const progressPercent = metaGoal.targetAmountUSD > 0 ? (totalProgressUSD / metaGoal.targetAmountUSD) * 100 : 0;
          goalCompleted = progressPercent >= 100;
        }
      } catch (error) {
        logger.warn("Failed to check goal completion", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Return successful response
    const response = {
      success: true,
      depositId,
      goalId: attachedGoalId.toString(),
      shares,
      formattedShares: formatAmountForDisplay(shares, vaultConfig.decimals, 4),
      allocationTxHash: txHash,
      goalCompleted,
      metaGoalId: responseMetaGoalId,
    };
    
    logger.info("📤 Allocate response data", { response });
    return NextResponse.json(response);
  } catch (error) {
    logger.error("❌ Allocation error", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestBody: request.body,
    });
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
