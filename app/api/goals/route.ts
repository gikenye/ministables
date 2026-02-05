import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import {
  createProvider,
  createBackendWallet,
  findEventInLogs,
  isValidAddress,
  getContractCompliantTargetDate,
  mapLimit,
} from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import { GoalSyncService } from "@/lib/backend/services/goal-sync.service";
import type {
  CreateMultiVaultGoalRequest,
  CreateMultiVaultGoalResponse,
  ErrorResponse,
  VaultAsset,
  MetaGoal,
  MetaGoalWithProgress,
} from "@/lib/backend/types";

export const dynamic = "force-dynamic";
const DEFAULT_RPC_CONCURRENCY = 3;
const RPC_CONCURRENCY_RAW = Number.parseInt(
  process.env.RPC_CONCURRENCY || String(DEFAULT_RPC_CONCURRENCY),
  10
);
const RPC_CONCURRENCY =
  Number.isFinite(RPC_CONCURRENCY_RAW) && RPC_CONCURRENCY_RAW > 0
    ? RPC_CONCURRENCY_RAW
    : DEFAULT_RPC_CONCURRENCY;

type ChainParams = {
  chainId?: string | number | null;
  chain?: string | null;
  vaultAddress?: string | null;
  contractAddress?: string | null;
};

function resolveChainContext(params: ChainParams) {
  const vaults = getVaultsForChain(params);
  const contracts = getContractsForChain(params);
  const provider = createProvider(params);
  return { vaults, contracts, provider };
}

// async function syncUserGoalsFromBlockchain(userAddress: string, goalManager: ethers.Contract, collection: Collection<MetaGoal>) {
//   const onChainGoals: Record<VaultAsset, string> = {} as Record<VaultAsset, string>;
//   let earliestCreatedAt = Date.now();
//   let hasAnyGoal = false;

//   for (const [asset, vaultConfig] of Object.entries(VAULTS)) {
//     try {
//       const goalId = await goalManager.getQuicksaveGoal(vaultConfig.address, userAddress);

//       if (goalId > BigInt(0)) {
//         hasAnyGoal = true;
//         const goal = await goalManager.goals(goalId);
//         if (goal.creator.toLowerCase() === userAddress.toLowerCase()) {
//           onChainGoals[asset as VaultAsset] = goalId.toString();
//           const createdAt = Number(goal.createdAt) * 1000;
//           if (createdAt < earliestCreatedAt) earliestCreatedAt = createdAt;
//         }
//       }
//     } catch (error) {
//       console.error(`Error syncing ${asset} goal:`, error);
//     }
//   }

//   if (hasAnyGoal) {
//     const provider = createProvider();
//     const backendWallet = createBackendWallet(provider);
//     const goalManagerWrite = new ethers.Contract(CONTRACTS.GOAL_MANAGER, GOAL_MANAGER_ABI, backendWallet);

//     for (const [asset, vaultConfig] of Object.entries(VAULTS)) {
//       if (!onChainGoals[asset as VaultAsset]) {
//         try {
//           const tx = await goalManagerWrite.createQuicksaveGoalFor(userAddress, vaultConfig.address);
//           const receipt = await tx.wait();
//           const goalEvent = findEventInLogs(receipt.logs, goalManagerWrite, "GoalCreated");
//           if (goalEvent) {
//             onChainGoals[asset as VaultAsset] = goalEvent.args.goalId.toString();
//           }
//         } catch (error) {
//           console.error(`Error creating ${asset} quicksave goal:`, error);
//         }
//       }
//     }

//     const existing = await collection.findOne({
//       creatorAddress: userAddress,
//       targetAmountUSD: 0,
//       name: "quicksave"
//     });

//     if (!existing) {
//       const metaGoalId = uuidv4();
//       const metaGoal: MetaGoal & { participants?: string[] } = {
//         metaGoalId,
//         name: "quicksave",
//         targetAmountUSD: 0,
//         targetDate: "",
//         creatorAddress: userAddress,
//         onChainGoals,
//         participants: [userAddress.toLowerCase()],
//         createdAt: new Date(earliestCreatedAt).toISOString(),
//         updatedAt: new Date().toISOString(),
//       };
//       await collection.insertOne(metaGoal as MetaGoal);
//     } else {
//       await collection.updateOne(
//         { metaGoalId: existing.metaGoalId },
//         { $set: { onChainGoals, updatedAt: new Date().toISOString() } }
//       );
//     }
//   }
// }

export async function GET(
  request: NextRequest
): Promise<NextResponse<MetaGoalWithProgress[] | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get("creatorAddress");
    const participantAddress = searchParams.get("participantAddress");
    const chainParams: ChainParams = {
      chainId: searchParams.get("chainId"),
      chain: searchParams.get("chain"),
    };

    if (creatorAddress && !isValidAddress(creatorAddress)) {
      return NextResponse.json(
        { error: "Invalid creator address" },
        { status: 400 }
      );
    }

    if (participantAddress && !isValidAddress(participantAddress)) {
      return NextResponse.json(
        { error: "Invalid participant address" },
        { status: 400 }
      );
    }

    if (!creatorAddress && !participantAddress) {
      return NextResponse.json(
        { error: "Either creatorAddress or participantAddress required" },
        { status: 400 }
      );
    }

    const { provider, contracts, vaults } = resolveChainContext(chainParams);
    const goalManager = new ethers.Contract(
      contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      provider
    );
    const collection = await getMetaGoalsCollection();

    if (creatorAddress) {
      const syncService = new GoalSyncService(provider, contracts, vaults);
      await syncService.syncUserGoals(creatorAddress);
    }

    let metaGoals: MetaGoal[];

    if (participantAddress) {
      const syncService = new GoalSyncService(provider, contracts, vaults);
      await syncService.syncUserGoals(participantAddress);
      const normalizedParticipant = participantAddress.toLowerCase();

      metaGoals = await collection
        .find({
          $or: [
            { participants: { $in: [normalizedParticipant] } },
            { invitedUsers: { $in: [normalizedParticipant] } },
          ],
        })
        .toArray();
    } else if (creatorAddress) {
      metaGoals = await collection
        .find({ creatorAddress: creatorAddress.toLowerCase() })
        .toArray();
    } else {
      metaGoals = [];
    }

    const supportedAssets = new Set(Object.keys(vaults));
    const filteredMetaGoals = metaGoals.filter((metaGoal) =>
      Object.keys(metaGoal.onChainGoals || {}).some((asset) =>
        supportedAssets.has(asset)
      )
    );

    const goalsWithProgress: (MetaGoalWithProgress | null)[] =
      await mapLimit(filteredMetaGoals, RPC_CONCURRENCY, async (metaGoal) => {
          const vaultProgress: Record<
            VaultAsset,
            {
              goalId: string;
              progressUSD: number;
              progressPercent: number;
              attachmentCount: number;
              balance: string;
            }
          > = {} as Record<
            VaultAsset,
            {
              goalId: string;
              progressUSD: number;
              progressPercent: number;
              attachmentCount: number;
              balance: string;
            }
          >;

          let totalProgressUSD = 0;

          const onChainEntries = Object.entries(metaGoal.onChainGoals || {});
          const knownEntries = onChainEntries.filter(([asset]) =>
            supportedAssets.has(asset)
          );
          const hasUnknownAssets = onChainEntries.length > knownEntries.length;

          if (knownEntries.length === 0) {
            return null;
          }

          const progressResults = await mapLimit(
            knownEntries,
            RPC_CONCURRENCY,
            async ([asset, goalIdStr]: [string, unknown]) => {
              try {
                const goalId = BigInt(goalIdStr as string);
                const vaultConfig = vaults[asset as VaultAsset];
                const vault = new ethers.Contract(
                  vaultConfig.address,
                  [
                    "function getUserDeposit(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
                  ],
                  provider
                );

                const attachmentCount = Number(
                  await goalManager.attachmentCount(goalId)
                );
                let totalBalance = BigInt(0);
                const attachments: Array<{
                  owner: string;
                  depositId: bigint;
                  currentValue: bigint;
                }> = [];

                if (attachmentCount > 0) {
                  for (let i = 0; i < attachmentCount; i++) {
                    try {
                      const att: { owner: string; depositId: bigint } =
                        await goalManager.attachmentAt(goalId, i);
                      const [, currentValue]: [bigint, bigint] =
                        await vault.getUserDeposit(att.owner, att.depositId);
                      attachments.push({
                        owner: att.owner,
                        depositId: att.depositId,
                        currentValue,
                      });
                      totalBalance += currentValue;
                    } catch {
                      continue;
                    }
                  }
                }

                const progressUSD = parseFloat(
                  ethers.formatUnits(totalBalance, vaultConfig.decimals)
                );
                const progressPercent =
                  metaGoal.targetAmountUSD > 0
                    ? (progressUSD / metaGoal.targetAmountUSD) * 100
                    : 0;

                return {
                  asset: asset as VaultAsset,
                  data: {
                    goalId: goalIdStr as string,
                    progressUSD,
                    progressPercent,
                    attachmentCount,
                    balance: totalBalance.toString(),
                  },
                  attachments,
                };
              } catch (error) {
                console.error(
                  `Error getting progress for goal ${goalIdStr}:`,
                  error
                );
                return {
                  asset: asset as VaultAsset,
                  data: {
                    goalId: goalIdStr as string,
                    progressUSD: 0,
                    progressPercent: 0,
                    attachmentCount: 0,
                    balance: "0",
                  },
                  attachments: [],
                };
              }
            }
          );

          const participantsSet = new Set<string>(
            (metaGoal.participants || []).map((participant) =>
              participant.toLowerCase()
            )
          );
          const activeGoals: Record<string, string> = {};

          const goalStatuses = await mapLimit(
            progressResults,
            RPC_CONCURRENCY,
            async ({ asset, data }) =>
              goalManager
                .goals(BigInt(data.goalId))
                .then(
                  (
                    goal: [
                      string,
                      string,
                      string,
                      bigint,
                      bigint,
                      bigint,
                      bigint,
                      boolean,
                      boolean
                    ]
                  ) => ({ asset, data, cancelled: goal[7] })
                )
                .catch((err) => {
                  console.error(
                    `Failed to fetch goal status for ${data.goalId}:`,
                    err
                  );
                  return { asset, data, cancelled: false, statusUnknown: true };
                })
          );

          for (let i = 0; i < goalStatuses.length; i++) {
            const { asset, data, cancelled } = goalStatuses[i];
            const { attachments } = progressResults[i];

            if (!cancelled) {
              vaultProgress[asset] = data;
              totalProgressUSD += data.progressUSD;
              activeGoals[asset] = data.goalId;

              attachments.forEach((att) => {
                participantsSet.add(att.owner.toLowerCase());
              });
            }
          }

          const progressPercent =
            metaGoal.targetAmountUSD > 0
              ? (totalProgressUSD / metaGoal.targetAmountUSD) * 100
              : 0;

          if (Object.keys(activeGoals).length === 0) {
            if (!hasUnknownAssets) {
              // Clean up database if no active goals remain
              try {
                await collection.deleteOne({ metaGoalId: metaGoal.metaGoalId });
              } catch (error) {
                console.error(
                  `Error cleaning up cancelled meta goal ${metaGoal.metaGoalId}:`,
                  error
                );
              }
            }
            return null;
          }

          // Update database if some goals were cancelled or participants changed
          const participantsArray = Array.from(participantsSet);
          const needsUpdate =
            Object.keys(activeGoals).length !==
              Object.keys(metaGoal.onChainGoals).length ||
            JSON.stringify(
              (
                metaGoal as MetaGoal & { participants?: string[] }
              ).participants?.sort()
            ) !== JSON.stringify(participantsArray.sort());

          if (!hasUnknownAssets && needsUpdate) {
            try {
              await collection.updateOne(
                { metaGoalId: metaGoal.metaGoalId },
                {
                  $set: {
                    onChainGoals: activeGoals,
                    participants: participantsArray,
                    updatedAt: new Date().toISOString(),
                  },
                }
              );
            } catch (error) {
              console.error(
                `Error updating meta goal ${metaGoal.metaGoalId}:`,
                error
              );
            }
          }

          let userBalance = BigInt(0);
          let userBalanceUSD = 0;

          if (creatorAddress || participantAddress) {
            const targetUser = (creatorAddress ||
              participantAddress)!.toLowerCase();

            for (let i = 0; i < progressResults.length; i++) {
              const { asset, attachments } = progressResults[i];
              const { cancelled } = goalStatuses[i];
              if (cancelled) continue;
              const vaultConfig = vaults[asset as VaultAsset];
              if (!vaultConfig) continue;
              attachments.forEach((att) => {
                if (att.owner.toLowerCase() === targetUser) {
                  userBalance += att.currentValue;
                  userBalanceUSD += parseFloat(
                    ethers.formatUnits(att.currentValue, vaultConfig.decimals)
                  );
                }
              });
            }
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const inviteLink = `${baseUrl}/goals/${metaGoal.metaGoalId}`;

          return {
            ...metaGoal,
            onChainGoals: activeGoals,
            totalProgressUSD,
            progressPercent,
            vaultProgress,
            participants: Array.from(participantsSet),
            userBalance: userBalance.toString(),
            userBalanceUSD: userBalanceUSD.toFixed(2),
            inviteLink,
          };
        });

    const validGoals = goalsWithProgress.filter((goal) => goal !== null);
    return NextResponse.json(validGoals);
  } catch (error) {
    console.error("Get meta-goals error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateMultiVaultGoalResponse | ErrorResponse>> {
  try {
    const body: CreateMultiVaultGoalRequest = await request.json();
    const { name, targetAmountUSD, targetDate, creatorAddress, vaults, chainId, chain } =
      body as CreateMultiVaultGoalRequest & { chainId?: string | number; chain?: string };

    if (!name || !targetAmountUSD || !creatorAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!isValidAddress(creatorAddress)) {
      return NextResponse.json(
        { error: "Invalid creator address" },
        { status: 400 }
      );
    }

    const { provider, contracts, vaults: chainVaults } = resolveChainContext({
      chainId,
      chain,
    });
    const backendWallet = createBackendWallet(provider);
    const goalManager = new ethers.Contract(
      contracts.GOAL_MANAGER,
      GOAL_MANAGER_ABI,
      backendWallet
    );

    const targetVaults =
      vaults === "all" ? (Object.keys(chainVaults) as VaultAsset[]) : vaults;
    const metaGoalId = uuidv4();
    const onChainGoals: Record<VaultAsset, string> = {} as Record<
      VaultAsset,
      string
    >;
    const txHashes: Record<VaultAsset, string> = {} as Record<
      VaultAsset,
      string
    >;

    for (const asset of targetVaults) {
      const vaultConfig = chainVaults[asset];
      const targetAmountWei = ethers.parseUnits(
        targetAmountUSD.toString(),
        vaultConfig.decimals
      );

      let parsedTargetDate;
      if (targetDate) {
        const targetDateMs = new Date(targetDate).getTime();
        const targetDateSeconds = Math.floor(targetDateMs / 1000);
        const minAllowedDate =
          Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
        parsedTargetDate = Math.max(
          targetDateSeconds,
          minAllowedDate + 24 * 60 * 60
        );
      } else {
        parsedTargetDate = getContractCompliantTargetDate();
      }

      const tx = await goalManager.createGoalFor(
        creatorAddress,
        vaultConfig.address,
        targetAmountWei,
        parsedTargetDate,
        name
      );

      const receipt = await tx.wait();
      const goalEvent = findEventInLogs(
        receipt.logs,
        goalManager,
        "GoalCreated"
      );

      if (goalEvent) {
        onChainGoals[asset] = goalEvent.args.goalId.toString();
        txHashes[asset] = tx.hash;
      }
    }

    const metaGoal: MetaGoal & { participants?: string[] } = {
      metaGoalId,
      name,
      targetAmountUSD,
      targetDate: targetDate || "",
      creatorAddress: creatorAddress.toLowerCase(),
      onChainGoals,
      participants: [creatorAddress.toLowerCase()],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const collection = await getMetaGoalsCollection();
    await collection.insertOne(metaGoal as MetaGoal);

    return NextResponse.json({
      success: true,
      metaGoalId,
      onChainGoals,
      txHashes,
    });
  } catch (error) {
    console.error("Create multi-vault goal error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
