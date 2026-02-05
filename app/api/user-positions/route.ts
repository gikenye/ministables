import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import {
  VAULTS,
  CONTRACTS,
  GOAL_MANAGER_ABI,
  ALL_CHAINS,
  CHAINS,
  getContractsForChain,
  getVaultsForChain,
} from "@/lib/backend/constants";
import {
  createProvider,
  createBackendWallet,
  formatAmountForDisplay,
  getContractCompliantTargetDate,
  isValidAddress,
  waitForTransactionReceipt,
  findEventInLogs,
  resolveTargetAmountToken,
} from "@/lib/backend/utils";
import { getMetaGoalsCollection } from "@/lib/backend/database";
import { BlockchainService } from "@/lib/backend/services/blockchain.service";
import { CrossChainService } from "@/lib/backend/services/cross-chain.service";
import { RequestValidator } from "@/lib/backend/validators/request.validator";
import type {
  ErrorResponse,
  AssetBalance,
  VaultAsset,
  MetaGoal,
} from "@/lib/backend/types";

export const dynamic = "force-dynamic";

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

function aggregateAssetBalancesFromDeposits(
  depositsByChain: Record<string, { deposits: Array<{ asset: string; amountUSD: number }> }>
): AssetBalance[] {
  const assetTotals: Record<string, { totalAmountUSD: number; depositCount: number }> = {};

  Object.entries(depositsByChain).forEach(([, { deposits }]) => {
    deposits.forEach((deposit) => {
      if (!assetTotals[deposit.asset]) {
        assetTotals[deposit.asset] = { totalAmountUSD: 0, depositCount: 0 };
      }
      assetTotals[deposit.asset].totalAmountUSD += deposit.amountUSD;
      assetTotals[deposit.asset].depositCount++;
    });
  });

  return Object.entries(assetTotals).map(([asset, totals]) => ({
    asset,
    vault: "",
    totalAmountWei: "0",
    totalAmountUSD: totals.totalAmountUSD.toFixed(2),
    totalSharesWei: "0",
    totalSharesUSD: totals.totalAmountUSD.toFixed(2),
    depositCount: totals.depositCount,
  }));
}

async function getLeaderboardAddressesAcrossChains(): Promise<string[]> {
  const addressMap = new Map<string, string>();

  for (const chainKey of ALL_CHAINS) {
    const chainConfig = CHAINS[chainKey];
    try {
      const provider = createProvider(chainConfig.rpcUrl);
      const blockchainService = new BlockchainService(provider, chainConfig.contracts);
      const leaderboard = blockchainService.getLeaderboard();
      const topLength = await leaderboard.getTopListLength();
      const totalUsers = Number(topLength);
      if (!Number.isFinite(totalUsers) || totalUsers <= 0) {
        continue;
      }
      const [users] = await leaderboard.getTopRange(0, totalUsers);
      users.forEach((address: string) => {
        if (!address) return;
        const key = address.toLowerCase();
        if (!addressMap.has(key)) {
          addressMap.set(key, address);
        }
      });
    } catch (error) {
      console.warn(`Leaderboard fetch failed for ${chainKey}:`, error);
    }
  }

  return Array.from(addressMap.values());
}

interface ConsolidatedUserResponse {
  userAddress: string;
  totalValueUSD: string;
  leaderboardScore: string;
  formattedLeaderboardScore: string;
  leaderboardRank: number | null;
  assetBalances: AssetBalance[];
}

interface GroupGoalMember {
  address: string;
  totalContributionUSD: number;
  contributionPercent: number;
  depositCount: number;
  joinedAt: string;
}

interface GroupGoalMembersData {
  totalContributedUSD: number;
  progressPercent: number;
  memberCount: number;
  members: GroupGoalMember[];
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<unknown>> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const chainParams: ChainParams = {
      chainId: searchParams.get("chainId"),
      chain: searchParams.get("chain"),
    };

    if (action === "all-group-savings") {
      return await handleGetAllGroupSavings();
    }
    if (action === "private-goals") {
      return await handleGetPrivateGoals();
    }
    if (action === "public-goals") {
      return await handleGetPublicGoals();
    }
    if (action === "my-groups") {
      const userAddress = searchParams.get("userAddress");
      if (!userAddress) {
        return NextResponse.json(
          { error: "userAddress required" },
          { status: 400 }
        );
      }
      return await handleGetMyGroups(userAddress);
    }
    if (action === "leaderboard-stats" || action === "leaderboard") {
      const limit = parseInt(searchParams.get("limit") || "100");
      const offset = parseInt(
        searchParams.get("offset") || searchParams.get("start") || "0"
      );
      return await handleGetLeaderboardStatsGET(limit, offset, chainParams);
    }

    const userAddress = searchParams.get("userAddress");

    const validation = RequestValidator.validateUserAddress(userAddress);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error! }, { status: 400 });
    }

    const crossChainService = new CrossChainService();

    // Always aggregate across all supported chains for balances
    const { totalValueUSD, depositsByChain } =
      await crossChainService.getUserDepositsAcrossChains(userAddress!);

    const assetBalances = aggregateAssetBalancesFromDeposits(depositsByChain);

    const response: ConsolidatedUserResponse = {
      userAddress: userAddress!,
      totalValueUSD: totalValueUSD.toFixed(2),
      leaderboardScore: totalValueUSD.toFixed(2),
      formattedLeaderboardScore: totalValueUSD.toFixed(2),
      leaderboardRank: null,
      assetBalances,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ User positions API error:", error);
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
): Promise<NextResponse<unknown | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "create-goal":
        return await handleCreateGoal(request);
      case "create-group-goal":
        return await handleCreateGroupGoal(request);
      case "join-goal":
        return await handleJoinGoal(request);
      case "allocate":
        return await handleAllocate(request);
      case "group-goal-members":
        return await handleGetGroupGoalMembers(request);
      case "group-goal-details":
        return await handleGetGroupGoalDetails(request);
      case "cancel-goal":
        return await handleCancelGoal(request);
      case "invite-to-goal":
        return await handleInviteToGoal(request);
      case "leaderboard-stats":
        return await handleGetLeaderboardStats(request);
      default:
        return NextResponse.json(
          {
            error:
              "Invalid action. Supported: create-goal, create-group-goal, join-goal, allocate, group-goal-members, group-goal-details, cancel-goal, invite-to-goal, leaderboard-stats",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ POST method error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

async function handleCreateGoal(request: NextRequest) {
  const body = await request.json();
  const { name, targetDate, creatorAddress, vaults, chainId, chain } = body as typeof body & {
    targetAmountUSD?: number;
  };
  const targetAmountToken = resolveTargetAmountToken(body);

  if (!name || !targetAmountToken || !creatorAddress) {
    return NextResponse.json(
      {
        error: "Missing required fields: name, targetAmountToken, creatorAddress",
      },
      { status: 400 }
    );
  }

  const validation = RequestValidator.validateUserAddress(creatorAddress);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
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

  const targetVaults: VaultAsset[] =
    vaults === "all" ? (Object.keys(chainVaults) as VaultAsset[]) : vaults;
  const metaGoalId = uuidv4();
  const onChainGoals: Record<VaultAsset, string> = {} as Record<
    VaultAsset,
    string
  >;
  const txHashes: Record<VaultAsset, string> = {} as Record<VaultAsset, string>;

  let parsedTargetDate;
  if (targetDate) {
    const targetDateSeconds = Math.floor(new Date(targetDate).getTime() / 1000);
    const minAllowedDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    parsedTargetDate = Math.max(
      targetDateSeconds,
      minAllowedDate + 24 * 60 * 60
    );
  } else {
    parsedTargetDate = getContractCompliantTargetDate();
  }

  const nonce = await backendWallet.getNonce();
  const txPromises = targetVaults.map(async (asset, index) => {
    const vaultConfig = chainVaults[asset];
    const normalizedAmount = parseFloat(targetAmountToken.toString()).toFixed(
      vaultConfig.decimals
    );
    const targetAmountWei = ethers.parseUnits(
      normalizedAmount,
      vaultConfig.decimals
    );
    const tx = await goalManager.createGoalFor(
      creatorAddress,
      vaultConfig.address,
      targetAmountWei,
      parsedTargetDate,
      name,
      { nonce: nonce + index }
    );
    const receipt = await tx.wait();
    const goalEvent = findEventInLogs(receipt.logs, goalManager, "GoalCreated");
    return {
      asset,
      goalId: goalEvent?.args.goalId.toString() || "",
      txHash: tx.hash,
    };
  });

  const results = await Promise.all(txPromises);
  results.forEach(({ asset, goalId, txHash }) => {
    if (goalId) {
      onChainGoals[asset] = goalId;
      txHashes[asset] = txHash;
    }
  });

  const metaGoal: MetaGoal & { participants?: string[] } = {
    metaGoalId,
    name,
    targetAmountToken,
    targetDate: targetDate || "",
    creatorAddress: creatorAddress.toLowerCase(),
    onChainGoals,
    participants: [creatorAddress.toLowerCase()],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const collection = await getMetaGoalsCollection();
  await collection.insertOne(metaGoal as MetaGoal);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareLink = `${baseUrl}/goals/${metaGoalId}`;

  return NextResponse.json({
    success: true,
    metaGoalId,
    onChainGoals,
    txHashes,
    shareLink,
  });
}

async function handleCreateGroupGoal(request: NextRequest) {
  const body = await request.json();
  const {
    name,
    targetDate,
    creatorAddress,
    vaults,
    isPublic,
    chainId,
    chain,
  } = body as typeof body & { targetAmountUSD?: number };
  const targetAmountToken = resolveTargetAmountToken(body);

  if (!name || !targetAmountToken || !creatorAddress) {
    return NextResponse.json(
      {
        error: "Missing required fields: name, targetAmountToken, creatorAddress",
      },
      { status: 400 }
    );
  }

  const validation = RequestValidator.validateUserAddress(creatorAddress);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
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

  const targetVaults: VaultAsset[] =
    vaults === "all" ? (Object.keys(chainVaults) as VaultAsset[]) : vaults;
  const metaGoalId = uuidv4();
  const onChainGoals: Record<VaultAsset, string> = {} as Record<
    VaultAsset,
    string
  >;
  const txHashes: Record<VaultAsset, string> = {} as Record<VaultAsset, string>;

  let parsedTargetDate;
  if (targetDate) {
    const targetDateSeconds = Math.floor(new Date(targetDate).getTime() / 1000);
    const minAllowedDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    parsedTargetDate = Math.max(
      targetDateSeconds,
      minAllowedDate + 24 * 60 * 60
    );
  } else {
    parsedTargetDate = getContractCompliantTargetDate();
  }

  const nonce = await backendWallet.getNonce();
  const txPromises = targetVaults.map(async (asset, index) => {
    const vaultConfig = chainVaults[asset];
    const normalizedAmount = parseFloat(targetAmountToken.toString()).toFixed(
      vaultConfig.decimals
    );
    const targetAmountWei = ethers.parseUnits(
      normalizedAmount,
      vaultConfig.decimals
    );
    const tx = await goalManager.createGoalFor(
      creatorAddress,
      vaultConfig.address,
      targetAmountWei,
      parsedTargetDate,
      name,
      { nonce: nonce + index }
    );
    const receipt = await tx.wait();
    const goalEvent = findEventInLogs(receipt.logs, goalManager, "GoalCreated");
    return {
      asset,
      goalId: goalEvent?.args.goalId.toString() || "",
      txHash: tx.hash,
    };
  });

  const results = await Promise.all(txPromises);
  results.forEach(({ asset, goalId, txHash }) => {
    if (goalId) {
      onChainGoals[asset] = goalId;
      txHashes[asset] = txHash;
    }
  });

  const metaGoal: MetaGoal = {
    metaGoalId,
    name,
    targetAmountToken,
    targetDate: targetDate || "",
    creatorAddress: creatorAddress.toLowerCase(),
    onChainGoals,
    isPublic: isPublic ?? true,
    participants: [creatorAddress.toLowerCase()],
    invitedUsers: isPublic ? undefined : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const collection = await getMetaGoalsCollection();
  await collection.insertOne(metaGoal);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareLink = `${baseUrl}/goals/${metaGoalId}`;

  return NextResponse.json({
    success: true,
    metaGoalId,
    onChainGoals,
    txHashes,
    shareLink,
  });
}

async function handleJoinGoal(request: NextRequest) {
  const body = await request.json();
  const { goalId, userAddress, depositTxHash, asset, chainId, chain } = body;

  if (!goalId || !userAddress || !depositTxHash || !asset) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: goalId, userAddress, depositTxHash, asset",
      },
      { status: 400 }
    );
  }

  if (!depositTxHash.match(/^0x[0-9a-fA-F]{64}$/)) {
    return NextResponse.json(
      {
        error: `Invalid depositTxHash format. Received: "${depositTxHash}" (length: ${depositTxHash.length}). Must be a valid 66-character hex transaction hash (0x + 64 hex chars)`,
      },
      { status: 400 }
    );
  }

  const { provider, contracts, vaults: chainVaults } = resolveChainContext({
    chainId,
    chain,
  });
  const vaultConfig = chainVaults[asset as keyof typeof chainVaults];
  if (!vaultConfig) {
    return NextResponse.json(
      { error: `Invalid asset. Supported: ${Object.keys(chainVaults).join(", ")}` },
      { status: 400 }
    );
  }

  const backendWallet = createBackendWallet(provider);

  const receipt = await waitForTransactionReceipt(provider, depositTxHash);
  if (!receipt || !receipt.status) {
    return NextResponse.json(
      { error: "Deposit transaction not found or failed" },
      { status: 400 }
    );
  }

  const blockchainService = new BlockchainService(provider, contracts);
  const vault = blockchainService.getVault(vaultConfig.address);
  const depositEvent = findEventInLogs(receipt.logs, vault, "Deposited");

  if (
    !depositEvent ||
    depositEvent.args.user.toLowerCase() !== userAddress.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Invalid deposit transaction" },
      { status: 400 }
    );
  }

  const goalManager = blockchainService.getGoalManager(backendWallet);
  const leaderboard = blockchainService.getLeaderboard(backendWallet);

  const [attachTx, scoreTx] = await Promise.all([
    goalManager.attachDepositsOnBehalf(goalId, userAddress, [
      depositEvent.args.depositId.toString(),
    ]),
    leaderboard.recordDepositOnBehalf(
      userAddress,
      depositEvent.args.amount.toString()
    ),
  ]);

  await Promise.all([attachTx.wait(), scoreTx.wait()]);

  const collection = await getMetaGoalsCollection();
  const metaGoal = (await collection.findOne({
    [`onChainGoals.${asset}`]: goalId,
  })) as (MetaGoal & { participants?: string[] }) | null;

  if (
    metaGoal &&
    metaGoal.participants &&
    !metaGoal.participants.includes(userAddress.toLowerCase())
  ) {
    await collection.updateOne(
      { metaGoalId: metaGoal.metaGoalId },
      {
        $addToSet: { participants: userAddress.toLowerCase() },
        $set: { updatedAt: new Date().toISOString() },
      }
    );
  }

  return NextResponse.json({
    success: true,
    goalId,
    depositId: depositEvent.args.depositId.toString(),
    amount: depositEvent.args.amount.toString(),
    formattedAmount: formatAmountForDisplay(
      depositEvent.args.amount.toString(),
      vaultConfig.decimals,
      4
    ),
    attachTxHash: attachTx.hash,
  });
}

async function handleAllocate(request: NextRequest) {
  const body = await request.json();
  const {
    asset,
    userAddress,
    amount,
    txHash,
    targetGoalId,
    providerPayload,
    chainId,
    chain,
  } = body;

  if (!asset || !userAddress || !amount || !txHash || !providerPayload) {
    return NextResponse.json(
      { error: "Missing required fields: asset, userAddress, amount, txHash, providerPayload" },
      { status: 400 }
    );
  }

  if (
    providerPayload === null ||
    typeof providerPayload !== "object" ||
    Array.isArray(providerPayload)
  ) {
    return NextResponse.json(
      { error: "Invalid providerPayload: expected object" },
      { status: 400 }
    );
  }

  const providerTxCode = (() => {
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

  if (!providerTxCode) {
    return NextResponse.json(
      {
        error: "Missing provider transaction code. providerPayload must include transaction_code",
      },
      { status: 400 }
    );
  }

  if (!txHash.match(/^0x[0-9a-fA-F]{64}$/)) {
    return NextResponse.json(
      {
        error: `Invalid txHash format. Received: "${txHash}" (length: ${txHash.length}). Must be a valid 66-character hex transaction hash (0x + 64 hex chars)`,
      },
      { status: 400 }
    );
  }

  const { provider, contracts, vaults: chainVaults } = resolveChainContext({
    chainId,
    chain,
  });
  const vaultConfig = chainVaults[asset as keyof typeof chainVaults];
  if (!vaultConfig) {
    return NextResponse.json(
      { error: `Invalid asset. Supported: ${Object.keys(chainVaults).join(", ")}` },
      { status: 400 }
    );
  }

  const backendWallet = createBackendWallet(provider);

  const receipt = await waitForTransactionReceipt(provider, txHash);
  if (!receipt || !receipt.status) {
    return NextResponse.json(
      { error: "Transaction not found or failed" },
      { status: 400 }
    );
  }

  const blockchainService = new BlockchainService(provider, contracts);
  const vault = blockchainService.getVault(vaultConfig.address, backendWallet);
  const depositEvent = findEventInLogs(receipt.logs, vault, "Deposited");

  if (!depositEvent) {
    return NextResponse.json(
      { error: "Failed to parse deposit event" },
      { status: 500 }
    );
  }

  if (depositEvent.args.user.toLowerCase() !== userAddress.toLowerCase()) {
    return NextResponse.json(
      {
        error: "User mismatch",
        details: `Deposit belongs to ${depositEvent.args.user}, but request is for ${userAddress}`,
      },
      { status: 400 }
    );
  }

  const goalManager = blockchainService.getGoalManager();
  const goalManagerWrite = blockchainService.getGoalManager(backendWallet);
  const leaderboard = blockchainService.getLeaderboard(backendWallet);

  let attachedGoalId = targetGoalId
    ? BigInt(targetGoalId)
    : await goalManager.getQuicksaveGoal(vaultConfig.address, userAddress);

  if (attachedGoalId.toString() === "0") {
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

  if (attachedGoalId !== BigInt(0)) {
    const goalInfo = await goalManager.goals(attachedGoalId);
    const [, , goalVault, , , , , cancelled, completed] = goalInfo;

    if (goalVault.toLowerCase() !== vaultConfig.address.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "Vault mismatch",
          details: `Goal ${attachedGoalId} is for vault ${goalVault}, but deposit is in vault ${vaultConfig.address}`,
          depositId: depositEvent.args.depositId.toString(),
          goalId: attachedGoalId.toString(),
        },
        { status: 400 }
      );
    }

    if (cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: "Goal is cancelled",
          depositId: depositEvent.args.depositId.toString(),
          goalId: attachedGoalId.toString(),
        },
        { status: 400 }
      );
    }

    if (completed) {
      return NextResponse.json(
        {
          success: false,
          error: "Goal is already completed",
          depositId: depositEvent.args.depositId.toString(),
          goalId: attachedGoalId.toString(),
        },
        { status: 400 }
      );
    }

    const existingGoalId = await goalManager.depositToGoal(
      ethers.solidityPackedKeccak256(
        ["address", "uint256"],
        [userAddress, depositEvent.args.depositId]
      )
    );
    if (existingGoalId !== BigInt(0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Deposit already attached to another goal",
          details: `Deposit ${depositEvent.args.depositId} is already attached to goal ${existingGoalId}`,
          depositId: depositEvent.args.depositId.toString(),
          goalId: attachedGoalId.toString(),
          existingGoalId: existingGoalId.toString(),
        },
        { status: 400 }
      );
    }

    try {
      const vaultContract = new ethers.Contract(
        vaultConfig.address,
        [
          "function getUserDeposit(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
          "function depositCount(address) view returns (uint256)",
        ],
        provider
      );
      const depositCount = await vaultContract.depositCount(userAddress);

      if (depositEvent.args.depositId >= depositCount) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid deposit ID",
            details: `Deposit ID ${
              depositEvent.args.depositId
            } is out of range. User has ${depositCount} deposits (IDs 0-${
              depositCount - 1
            })`,
            depositId: depositEvent.args.depositId.toString(),
            goalId: attachedGoalId.toString(),
          },
          { status: 400 }
        );
      }

      const [shares] = await vaultContract.getUserDeposit(
        userAddress,
        depositEvent.args.depositId
      );

      if (shares === BigInt(0)) {
        return NextResponse.json(
          {
            success: false,
            error: "Deposit not found in vault",
            details: `Deposit ${depositEvent.args.depositId} does not exist for user ${userAddress} in vault ${vaultConfig.address}`,
            depositId: depositEvent.args.depositId.toString(),
            goalId: attachedGoalId.toString(),
          },
          { status: 400 }
        );
      }

      const attachTx = await goalManagerWrite.attachDepositsOnBehalf(
        attachedGoalId,
        depositEvent.args.user,
        [depositEvent.args.depositId.toString()]
      );
      await attachTx.wait();
    } catch (error) {
      console.log(
        "Attachment failed:",
        error instanceof Error ? error.message : String(error)
      );
      return NextResponse.json(
        {
          success: false,
          error: "Attachment failed",
          details: error instanceof Error ? error.message : "Attachment failed",
          depositId: depositEvent.args.depositId.toString(),
          goalId: attachedGoalId.toString(),
        },
        { status: 400 }
      );
    }
  }

  const scoreTx = await leaderboard.recordDepositOnBehalf(userAddress, amount);
  await scoreTx.wait();

  return NextResponse.json({
    success: true,
    depositId: depositEvent.args.depositId.toString(),
    goalId: attachedGoalId.toString(),
    shares: depositEvent.args.shares.toString(),
    formattedShares: formatAmountForDisplay(
      depositEvent.args.shares.toString(),
      vaultConfig.decimals,
      4
    ),
    allocationTxHash: txHash,
  });
}

async function handleGetGroupGoalMembers(request: NextRequest) {
  const body = await request.json();
  const { metaGoalId, chainId, chain } = body;

  if (!metaGoalId) {
    return NextResponse.json(
      { error: "Missing required field: metaGoalId" },
      { status: 400 }
    );
  }

  const collection = await getMetaGoalsCollection();
  const metaGoal = (await collection.findOne({ metaGoalId })) as
    | (MetaGoal & { cachedMembers?: unknown; lastSync?: string })
    | null;

  if (!metaGoal) {
    return NextResponse.json(
      { error: "Group goal not found" },
      { status: 404 }
    );
  }

  const targetAmountToken = resolveTargetAmountToken(metaGoal);
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const isCacheValid =
    metaGoal.lastSync &&
    Date.now() - new Date(metaGoal.lastSync).getTime() < CACHE_TTL_MS;

  let memberData;
  if (isCacheValid && metaGoal.cachedMembers) {
    memberData = metaGoal.cachedMembers;
  } else {
    memberData = await fetchGroupGoalMembers(metaGoal, { chainId, chain });
    await collection.updateOne(
      { metaGoalId },
      {
        $set: { cachedMembers: memberData, lastSync: new Date().toISOString() },
      }
    );
  }

  const mergedMemberData = mergeGroupGoalMembers(
    memberData as GroupGoalMembersData,
    metaGoal
  );

  return NextResponse.json({
    metaGoalId,
    goalName: metaGoal.name,
    targetAmountToken,
    ...mergedMemberData,
  });
}

function mergeGroupGoalMembers(
  memberData: GroupGoalMembersData,
  metaGoal: MetaGoal
): GroupGoalMembersData {
  const membersByAddress = new Map<string, GroupGoalMember>();

  memberData.members.forEach((member) => {
    membersByAddress.set(member.address.toLowerCase(), member);
  });

  const defaultJoinedAt =
    metaGoal.createdAt || metaGoal.updatedAt || new Date().toISOString();

  const additionalAddresses = new Set<string>();
  const addAddress = (address?: string) => {
    if (!address) {
      return;
    }
    const normalized = address.toLowerCase();
    if (!isValidAddress(normalized)) {
      return;
    }
    additionalAddresses.add(normalized);
  };

  addAddress(metaGoal.creatorAddress);
  (metaGoal.participants || []).forEach(addAddress);
  (metaGoal.invitedUsers || []).forEach(addAddress);

  additionalAddresses.forEach((address) => {
    if (!membersByAddress.has(address)) {
      membersByAddress.set(address, {
        address,
        totalContributionUSD: 0,
        contributionPercent: 0,
        depositCount: 0,
        joinedAt: defaultJoinedAt,
      });
    }
  });

  const mergedMembers = Array.from(membersByAddress.values()).sort(
    (a, b) => b.totalContributionUSD - a.totalContributionUSD
  );

  return {
    ...memberData,
    members: mergedMembers,
    memberCount: mergedMembers.length,
  };
}

async function fetchGroupGoalMembers(metaGoal: MetaGoal, chainParams: ChainParams) {
  const { provider, contracts, vaults } = resolveChainContext(chainParams);
  const goalManager = new ethers.Contract(
    contracts.GOAL_MANAGER,
    GOAL_MANAGER_ABI,
    provider
  );

  const memberStats: Record<
    string,
    {
      address: string;
      totalContributionUSD: number;
      contributionPercent: number;
      depositCount: number;
      joinedAt: string;
    }
  > = {};

  for (const [asset, goalIdStr] of Object.entries(metaGoal.onChainGoals)) {
    const goalId = BigInt(goalIdStr as string);
    const attachmentCount = await goalManager.attachmentCount(goalId);

    const vaultConfig = vaults[asset as VaultAsset];
    if (!vaultConfig) {
      console.warn(
        `Skipping unsupported asset ${asset} for meta goal ${metaGoal.metaGoalId}`
      );
      continue;
    }
    const vault = new ethers.Contract(
      vaultConfig.address,
      [
        "function getUserDeposit(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
      ],
      provider
    );

    for (let i = 0; i < Number(attachmentCount); i++) {
      const attachment = await goalManager.attachmentAt(goalId, i);
      const owner = attachment.owner.toLowerCase();
      const [, currentValue] = await vault.getUserDeposit(
        attachment.owner,
        attachment.depositId
      );
      const contributionUSD = parseFloat(
        formatAmountForDisplay(currentValue.toString(), vaultConfig.decimals)
      );

      if (!memberStats[owner]) {
        memberStats[owner] = {
          address: attachment.owner,
          totalContributionUSD: 0,
          contributionPercent: 0,
          depositCount: 0,
          joinedAt: new Date(
            Number(attachment.attachedAt) * 1000
          ).toISOString(),
        };
      } else if (
        new Date(Number(attachment.attachedAt) * 1000) <
        new Date(memberStats[owner].joinedAt)
      ) {
        memberStats[owner].joinedAt = new Date(
          Number(attachment.attachedAt) * 1000
        ).toISOString();
      }

      memberStats[owner].totalContributionUSD += contributionUSD;
      memberStats[owner].depositCount++;
    }
  }

  const totalGoalValue = Object.values(memberStats).reduce(
    (sum, m) => sum + m.totalContributionUSD,
    0
  );
  Object.values(memberStats).forEach((member) => {
    member.contributionPercent =
      totalGoalValue > 0
        ? (member.totalContributionUSD / totalGoalValue) * 100
        : 0;
  });

  const members = Object.values(memberStats).sort(
    (a, b) => b.totalContributionUSD - a.totalContributionUSD
  );

  const targetAmountToken = resolveTargetAmountToken(metaGoal);
  return {
    totalContributedUSD: totalGoalValue,
    progressPercent:
      targetAmountToken > 0
        ? (totalGoalValue / targetAmountToken) * 100
        : 0,
    memberCount: members.length,
    members,
  };
}

async function handleCancelGoal(request: NextRequest) {
  const body = await request.json();
  const { metaGoalId, userAddress, chainId, chain } = body;

  if (!metaGoalId || !userAddress) {
    return NextResponse.json(
      { error: "Missing required fields: metaGoalId, userAddress" },
      { status: 400 }
    );
  }

  const collection = await getMetaGoalsCollection();
  const metaGoal = await collection.findOne({ metaGoalId });

  if (!metaGoal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (metaGoal.creatorAddress.toLowerCase() !== userAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Only goal creator can cancel" },
      { status: 403 }
    );
  }

  const { provider, contracts } = resolveChainContext({ chainId, chain });
  const backendWallet = createBackendWallet(provider);
  const goalManager = new ethers.Contract(
    contracts.GOAL_MANAGER,
    GOAL_MANAGER_ABI,
    backendWallet
  );

  const cancelledGoals: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const alreadyCancelled: string[] = [];
  const statusUnknown: string[] = [];

  for (const [asset, goalIdStr] of Object.entries(metaGoal.onChainGoals)) {
    try {
      const goalId = BigInt(goalIdStr as string);
      const [, , , , , , , cancelled, completed] = await goalManager.goals(
        goalId
      );
      const attachmentCount = await goalManager.attachmentCount(goalId);

      if (cancelled) {
        errors[asset] = "Already cancelled";
        alreadyCancelled.push(asset);
        continue;
      }

      if (!completed && Number(attachmentCount) > 0) {
        errors[asset] = "Goal has deposits attached";
        continue;
      }

      const tx = await goalManager.cancelGoal(goalId);
      await tx.wait();
      cancelledGoals[asset] = tx.hash;
    } catch (error) {
      errors[asset] = error instanceof Error ? error.message : "Unknown error";
    }
  }

  const remainingGoals: Record<string, string> = {};

  for (const [asset, goalIdStr] of Object.entries(metaGoal.onChainGoals)) {
    try {
      const goalId = BigInt(goalIdStr as string);
      const [, , , , , , , cancelled] = await goalManager.goals(goalId);

      if (!cancelled) {
        remainingGoals[asset] = goalIdStr as string;
      }
    } catch (error) {
      console.error(
        `Error checking goal ${goalIdStr} status for asset ${asset}:`,
        error
      );
      statusUnknown.push(asset);
      remainingGoals[asset] = goalIdStr as string;
    }
  }

  if (statusUnknown.length > 0) {
    if (Object.keys(remainingGoals).length === 0) {
      await collection.deleteOne({ metaGoalId });
    } else {
      await collection.updateOne(
        { metaGoalId },
        {
          $set: {
            onChainGoals: remainingGoals,
            updatedAt: new Date().toISOString(),
            cachedMembers: [],
            lastSync: null,
          },
        }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Cannot determine on-chain status for some goals",
        statusUnknown,
        metaGoalId,
        cancelledGoals,
        alreadyCancelled:
          alreadyCancelled.length > 0 ? alreadyCancelled : undefined,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        remainingGoals:
          Object.keys(remainingGoals).length > 0
            ? Object.keys(remainingGoals)
            : undefined,
      },
      { status: 500 }
    );
  }

  if (Object.keys(remainingGoals).length === 0) {
    await collection.deleteOne({ metaGoalId });
  } else {
    await collection.updateOne(
      { metaGoalId },
      {
        $set: {
          onChainGoals: remainingGoals,
          updatedAt: new Date().toISOString(),
          cachedMembers: [],
          lastSync: null,
        },
      }
    );
  }

  return NextResponse.json({
    success:
      Object.keys(cancelledGoals).length > 0 || alreadyCancelled.length > 0,
    metaGoalId,
    cancelledGoals,
    alreadyCancelled:
      alreadyCancelled.length > 0 ? alreadyCancelled : undefined,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    remainingGoals:
      Object.keys(remainingGoals).length > 0
        ? Object.keys(remainingGoals)
        : undefined,
  });
}

async function handleGetGroupGoalDetails(request: NextRequest) {
  const body = await request.json();
  const { metaGoalId, chainId, chain } = body;

  if (!metaGoalId) {
    return NextResponse.json(
      { error: "Missing required field: metaGoalId" },
      { status: 400 }
    );
  }

  const collection = await getMetaGoalsCollection();
  const metaGoal = await collection.findOne({ metaGoalId });

  if (!metaGoal) {
    return NextResponse.json(
      { error: "Group goal not found" },
      { status: 404 }
    );
  }

  const { provider, contracts, vaults } = resolveChainContext({ chainId, chain });
  const goalManager = new ethers.Contract(
    contracts.GOAL_MANAGER,
    GOAL_MANAGER_ABI,
    provider
  );

  const balances: Record<
    string,
    { asset: string; totalBalance: string; formattedBalance: string }
  > = {};
  const transactions: Array<{
    asset: string;
    userAddress: string;
    depositId: string;
    currentValue: string;
    formattedValue: string;
    attachedAt: string;
  }> = [];

  for (const [asset, goalIdStr] of Object.entries(metaGoal.onChainGoals)) {
    const goalId = BigInt(goalIdStr as string);
    const vaultConfig = vaults[asset as VaultAsset];
    if (!vaultConfig) {
      console.warn(
        `Skipping unsupported asset ${asset} for meta goal ${metaGoal.metaGoalId}`
      );
      continue;
    }
    const vault = new ethers.Contract(
      vaultConfig.address,
      [
        "function getUserDeposit(address,uint256) view returns (uint256,uint256,uint256,uint256,bool)",
      ],
      provider
    );

    let totalBalance = BigInt(0);
    const attachmentCount = await goalManager.attachmentCount(goalId);

    for (let i = 0; i < Number(attachmentCount); i++) {
      const attachment = await goalManager.attachmentAt(goalId, i);
      const [, currentValue] = await vault.getUserDeposit(
        attachment.owner,
        attachment.depositId
      );
      totalBalance += currentValue;

      transactions.push({
        asset,
        userAddress: attachment.owner,
        depositId: attachment.depositId.toString(),
        currentValue: currentValue.toString(),
        formattedValue: formatAmountForDisplay(
          currentValue.toString(),
          vaultConfig.decimals,
          4
        ),
        attachedAt: new Date(
          Number(attachment.attachedAt) * 1000
        ).toISOString(),
      });
    }

    balances[asset] = {
      asset,
      totalBalance: totalBalance.toString(),
      formattedBalance: formatAmountForDisplay(
        totalBalance.toString(),
        vaultConfig.decimals,
        4
      ),
    };
  }

  transactions.sort(
    (a, b) =>
      new Date(b.attachedAt).getTime() - new Date(a.attachedAt).getTime()
  );

  const targetAmountToken = resolveTargetAmountToken(metaGoal);
  return NextResponse.json({
    _id: metaGoal._id,
    groupId: metaGoalId,
    metaGoalId,
    goalName: metaGoal.name,
    targetAmountToken,
    goalIds: metaGoal.onChainGoals,
    balances,
    transactions,
  });
}

async function handleGetLeaderboardStatsGET(
  limit: number,
  offset: number,
  _chainParams: ChainParams
) {
  const allUsers = await getLeaderboardAddressesAcrossChains();
  const totalUsers = allUsers.length;

  if (offset >= totalUsers) {
    return NextResponse.json({
      totalUsers,
      limit,
      offset,
      users: [],
    });
  }

  const crossChainService = new CrossChainService();
  const leaderboardData = await Promise.all(
    allUsers.map(async (address: string) => {
      const { totalValueUSD, depositsByChain } =
        await crossChainService.getUserDepositsAcrossChains(address);
      const assetBalances = aggregateAssetBalancesFromDeposits(depositsByChain);
      return {
        userAddress: address,
        totalValueUSD,
        assetBalances,
      };
    })
  );

  leaderboardData.sort((a, b) => b.totalValueUSD - a.totalValueUSD);

  const paginatedData = leaderboardData.slice(offset, offset + limit);

  const rankedUsers = paginatedData.map((user, index) => ({
    rank: offset + index + 1,
    userAddress: user.userAddress,
    totalValueUSD: user.totalValueUSD.toFixed(2),
    leaderboardScore: user.totalValueUSD.toFixed(2),
    formattedLeaderboardScore: user.totalValueUSD.toFixed(2),
    leaderboardRank: offset + index + 1,
    assetBalances: user.assetBalances,
  }));

  return NextResponse.json({
    totalUsers,
    limit,
    offset,
    users: rankedUsers,
  });
}

async function handleGetLeaderboardStats(request: NextRequest) {
  const body = await request.json();
  const { limit = 100, offset = 0, chainId, chain } = body || {};
  return await handleGetLeaderboardStatsGET(limit, offset, {
    chainId,
    chain,
  });
}

async function handleGetAllGroupSavings() {
  const collection = await getMetaGoalsCollection();
  const allGoals = await collection
    .find({ participants: { $exists: true } })
    .toArray();

  const goals = allGoals.map(
    (goal: MetaGoal & { isPublic?: boolean; participants?: string[] }) => ({
      metaGoalId: goal.metaGoalId,
      name: goal.name,
      targetAmountToken: resolveTargetAmountToken(goal),
      targetDate: goal.targetDate,
      creatorAddress: goal.creatorAddress,
      isPublic: goal.isPublic ?? true,
      participantCount: goal.participants?.length || 0,
      createdAt: goal.createdAt,
    })
  );

  return NextResponse.json({ total: goals.length, goals });
}

async function handleGetPrivateGoals() {
  const collection = await getMetaGoalsCollection();
  const privateGoals = await collection
    .find({ isPublic: false, participants: { $exists: true } })
    .toArray();

  const goals = privateGoals.map(
    (goal: MetaGoal & { isPublic?: boolean; participants?: string[] }) => ({
      metaGoalId: goal.metaGoalId,
      name: goal.name,
      targetAmountToken: resolveTargetAmountToken(goal),
      targetDate: goal.targetDate,
      creatorAddress: goal.creatorAddress,
      participantCount: goal.participants?.length || 0,
      createdAt: goal.createdAt,
    })
  );

  return NextResponse.json({ total: goals.length, goals });
}

async function handleGetPublicGoals() {
  const collection = await getMetaGoalsCollection();
  const publicGoals = await collection
    .find({
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }],
      participants: { $exists: true },
    })
    .toArray();

  const goals = publicGoals.map(
    (goal: MetaGoal & { isPublic?: boolean; participants?: string[] }) => ({
      metaGoalId: goal.metaGoalId,
      name: goal.name,
      targetAmountToken: resolveTargetAmountToken(goal),
      targetDate: goal.targetDate,
      creatorAddress: goal.creatorAddress,
      participantCount: goal.participants?.length || 0,
      createdAt: goal.createdAt,
    })
  );

  return NextResponse.json({ total: goals.length, goals });
}

async function handleInviteToGoal(request: NextRequest) {
  const body = await request.json();
  const { metaGoalId, inviterAddress, inviteeAddresses } = body;

  if (
    !metaGoalId ||
    !inviterAddress ||
    !inviteeAddresses ||
    !Array.isArray(inviteeAddresses)
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: metaGoalId, inviterAddress, inviteeAddresses (array)",
      },
      { status: 400 }
    );
  }
  const inviterValidation =
    RequestValidator.validateUserAddress(inviterAddress);
  if (!inviterValidation.valid) {
    return NextResponse.json(
      { error: `Invalid Invitee address: ${inviterValidation.error}` },
      { status: 400 }
    );
  }

  const collection = await getMetaGoalsCollection();
  const metaGoal = await collection.findOne({ metaGoalId });

  if (!metaGoal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  if (metaGoal.creatorAddress.toLowerCase() !== inviterAddress.toLowerCase()) {
    return NextResponse.json(
      { error: "Only goal creator can invite users" },
      { status: 403 }
    );
  }

  if (metaGoal.isPublic !== false) {
    return NextResponse.json(
      { error: "Can only invite to private goals" },
      { status: 400 }
    );
  }

  const normalizedInvitees = inviteeAddresses.map((addr: string) =>
    addr.toLowerCase()
  );

  await collection.updateOne(
    { metaGoalId },
    {
      $addToSet: { invitedUsers: { $each: normalizedInvitees } },
      $set: { updatedAt: new Date().toISOString() },
    }
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const shareLink = `${baseUrl}/goals/${metaGoalId}`;

  return NextResponse.json({
    success: true,
    metaGoalId,
    invitedUsers: normalizedInvitees,
    shareLink,
  });
}

async function handleGetMyGroups(userAddress: string) {
  const collection = await getMetaGoalsCollection();
  const userGroups = await collection
    .find({
      $or: [
        { participants: { $in: [userAddress.toLowerCase()] } },
        { creatorAddress: userAddress.toLowerCase() },
        { invitedUsers: { $in: [userAddress.toLowerCase()] } },
      ],
      name: { $ne: "quicksave" },
    })
    .toArray();

  const goals = userGroups.map((goal: MetaGoal) => ({
    metaGoalId: goal.metaGoalId,
    name: goal.name,
    targetAmountToken: resolveTargetAmountToken(goal),
    targetDate: goal.targetDate,
    creatorAddress: goal.creatorAddress,
    isPublic: goal.isPublic ?? true,
    participantCount: goal.participants?.length || 0,
    isCreator: goal.creatorAddress.toLowerCase() === userAddress.toLowerCase(),
    createdAt: goal.createdAt,
  }));

  const publicGoals = goals.filter((g) => g.isPublic);
  const privateGoals = goals.filter((g) => !g.isPublic);

  return NextResponse.json({
    total: goals.length,
    public: { total: publicGoals.length, goals: publicGoals },
    private: { total: privateGoals.length, goals: privateGoals },
  });
}
