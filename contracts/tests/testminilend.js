const { ethers } = require("ethers");
require("dotenv").config();

// --- CONFIGURATION ---
const providers = [
  new ethers.JsonRpcProvider("https://forno.celo.org"),
  new ethers.JsonRpcProvider("https://rpc.ankr.com/celo"),
  new ethers.JsonRpcProvider("https://1rpc.io/celo")
];

async function getProvider() {
  for (const p of providers) {
    try {
      await p.getBlockNumber();
      return p;
    } catch (e) {
      console.warn(`Provider ${p.connection.url} failed, trying next...`);
    }
  }
  throw new Error("All providers failed");
}

async function main() {
  const provider = await getProvider();
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const MINILEND_CELO = "0x89E356E80De29B466E774A5Eb543118B439EE41E";
  const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C"; // cUSD
  const CKES_ADDRESS = "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
  const CREAL_ADDRESS = "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787";
  const ORACLE_ADDRESS = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A";
  const AAVE_POOL_ADDRESS = "0x3E59A31363E2ad014dcbc521c4a0d5757d9f3402"; // Aave v3 pool on Celo
  const LOCK_60_SECONDS = 60; // 60 seconds for testing
  const CKES_AMOUNT = ethers.parseUnits("5", 18); // 5 cKES
  const USDC_AMOUNT = ethers.parseUnits("0.1", 6); // 0.1 cUSD
  const CREAL_AMOUNT = ethers.parseUnits("0.01", 18); // 0.01 cREAL
  const CREAL_SUPPLY_AMOUNT = ethers.parseUnits("0.1", 18); // 0.1 cREAL

  // --- ABI ---
  const MINILEND_ABI = [
    {
      "inputs": [
        {"internalType": "address", "name": "_poolAddressProvider", "type": "address"},
        {"internalType": "address", "name": "_oracles", "type": "address"},
        {"internalType": "address", "name": "_usdc", "type": "address"},
        {"internalType": "address[]", "name": "_supportedStablecoins", "type": "address[]"},
        {"internalType": "address[]", "name": "_supportedCollateral", "type": "address[]"},
        {"internalType": "address[]", "name": "_dollarBackedTokens", "type": "address[]"},
        {"internalType": "uint256[]", "name": "_maxBorrowPerToken", "type": "uint256[]"},
        {"internalType": "uint256[]", "name": "_minReserveThreshold", "type": "uint256[]"},
        {"internalType": "address", "name": "_treasury", "type": "address"},
        {"internalType": "uint256[]", "name": "_optimalUtilizations", "type": "uint256[]"},
        {"internalType": "uint256[]", "name": "_baseRates", "type": "uint256[]"},
        {"internalType": "uint256[]", "name": "_slope1s", "type": "uint256[]"},
        {"internalType": "uint256[]", "name": "_slope2s", "type": "uint256[]"}
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
        {"indexed": false, "internalType": "uint256", "name": "collateralUsed", "type": "uint256"}
      ],
      "name": "Borrowed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "CollateralDeposited",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": false, "internalType": "string", "name": "message", "type": "string"},
        {"indexed": false, "internalType": "address", "name": "value", "type": "address"}
      ],
      "name": "DebugAddress",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": false, "internalType": "string", "name": "message", "type": "string"}
      ],
      "name": "DebugString",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": false, "internalType": "string", "name": "message", "type": "string"},
        {"indexed": false, "internalType": "uint256", "name": "value", "type": "uint256"}
      ],
      "name": "DebugUint",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "principal", "type": "uint256"},
        {"indexed": false, "internalType": "uint256", "name": "interest", "type": "uint256"}
      ],
      "name": "Repaid",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
        {"indexed": false, "internalType": "uint256", "name": "lockPeriod", "type": "uint256"}
      ],
      "name": "Supplied",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
        {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
        {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
        {"indexed": false, "internalType": "uint256", "name": "interest", "type": "uint256"}
      ],
      "name": "Withdrawn",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "aavePool",
      "outputs": [{"internalType": "contract IPool", "name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"},
        {"internalType": "address", "name": "collateralToken", "type": "address"}
      ],
      "name": "borrow",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "", "type": "address"},
        {"internalType": "address", "name": "", "type": "address"}
      ],
      "name": "depositLockEnd",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "depositCollateral",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "name": "dollarBackedTokens",
      "outputs": [{"internalType": "address", "name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "user", "type": "address"},
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "address", "name": "collateralToken", "type": "address"}
      ],
      "name": "isUndercollateralized",
      "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "repay",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "name": "supportedCollateral",
      "outputs": [{"internalType": "address", "name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "name": "supportedStablecoins",
      "outputs": [{"internalType": "address", "name": "", "type": "address"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"},
        {"internalType": "uint256", "name": "lockPeriod", "type": "uint256"}
      ],
      "name": "supply",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [{"internalType": "address", "name": "", "type": "address"}],
      "name": "totalSupply",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "", "type": "address"},
        {"internalType": "address", "name": "", "type": "address"}
      ],
      "name": "userBorrows",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "", "type": "address"},
        {"internalType": "address", "name": "", "type": "address"}
      ],
      "name": "userCollateral",
      "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "token", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"}
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  const ERC20_ABI = [
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ];

  const ORACLE_ABI = [
    "function getMedianRate(address) external view returns (uint256 rate, uint256 timestamp)",
    "function setRate(address token, uint256 newRate) external",
    "function owner() view returns (address)"
  ];

  const AAVE_POOL_ABI = [
    {
      "inputs": [{"internalType": "address", "name": "asset", "type": "address"}],
      "name": "getReserveData",
      "outputs": [
        {
          "components": [
            {"internalType": "uint256", "name": "configuration", "type": "uint256"},
            {"internalType": "uint128", "name": "liquidityIndex", "type": "uint128"},
            {"internalType": "uint128", "name": "currentLiquidityRate", "type": "uint128"},
            {"internalType": "uint128", "name": "variableBorrowIndex", "type": "uint128"},
            {"internalType": "uint128", "name": "currentVariableBorrowRate", "type": "uint128"},
            {"internalType": "uint128", "name": "currentStableBorrowRate", "type": "uint128"},
            {"internalType": "uint40", "name": "lastUpdateTimestamp", "type": "uint40"},
            {"internalType": "address", "name": "aTokenAddress", "type": "address"},
            {"internalType": "address", "name": "stableDebtTokenAddress", "type": "address"},
            {"internalType": "address", "name": "variableDebtTokenAddress", "type": "address"},
            {"internalType": "address", "name": "interestRateStrategyAddress", "type": "address"},
            {"internalType": "uint128", "name": "accruedToTreasury", "type": "uint128"},
            {"internalType": "uint8", "name": "id", "type": "uint8"}
          ],
          "internalType": "struct DataTypes.ReserveData",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {"internalType": "address", "name": "asset", "type": "address"},
        {"internalType": "uint256", "name": "amount", "type": "uint256"},
        {"internalType": "address", "name": "onBehalfOf", "type": "address"},
        {"internalType": "uint16", "name": "referralCode", "type": "uint16"}
      ],
      "name": "supply",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ];

  // --- CONTRACT INSTANCES ---
  const minilend = new ethers.Contract(MINILEND_CELO, MINILEND_ABI, signer);
  const ckes = new ethers.Contract(CKES_ADDRESS, ERC20_ABI, signer);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
  const creal = new ethers.Contract(CREAL_ADDRESS, ERC20_ABI, signer);
  const oracle = new ethers.Contract(ORACLE_ADDRESS, ORACLE_ABI, signer);
  const aavePool = new ethers.Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, signer);

  async function fetchLogsWithRetry(filter, fromBlock, toBlock, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await minilend.queryFilter(filter, fromBlock, toBlock);
      } catch (e) {
        if (i === retries - 1) throw e;
        console.warn(`Log fetch failed, retrying (${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async function repayWithRetry(token, amount, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const nonce = await provider.getTransactionCount(signer.getAddress(), "pending");
        const feeData = await provider.getFeeData();
        console.log("Fee data:", {
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : "null",
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : "null",
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "null"
        });
        const maxFeePerGas = feeData.maxFeePerGas && typeof feeData.maxFeePerGas !== "string" ? feeData.maxFeePerGas * 2n : ethers.parseUnits("5", "gwei");
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas && typeof feeData.maxPriorityFeePerGas !== "string" ? feeData.maxPriorityFeePerGas : ethers.parseUnits("2", "gwei");
        console.log(`Repay attempt ${i + 1}, nonce: ${nonce}, maxFeePerGas: ${ethers.formatUnits(maxFeePerGas, "gwei")} gwei, maxPriorityFeePerGas: ${ethers.formatUnits(maxPriorityFeePerGas, "gwei")} gwei`);
        const estimatedGas = await minilend.repay.estimateGas(token, amount);
        console.log(`Estimated gas for repay: ${estimatedGas.toString()}`);
        const tx = await minilend.repay(token, amount, {
          gasLimit: estimatedGas * 12n / 10n, // 20% buffer
          nonce: nonce,
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas
        });
        await tx.wait();
        return tx;
      } catch (e) {
        console.warn(`Repay attempt ${i + 1} failed: ${e.message}`);
        if (i === retries - 1) throw e;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      }
    }
  }

  const myAddress = await signer.getAddress();
  console.log("My address:", myAddress);

  // Check account balance
  const celoBalance = await provider.getBalance(myAddress);
  console.log("Account CELO balance:", ethers.formatEther(celoBalance));

  // Check pending transactions
  const pendingTxCount = await provider.getTransactionCount(myAddress, "pending");
  console.log("Pending transaction count:", pendingTxCount);

  // Check Aave pool address
  const poolAddress = await minilend.aavePool();
  console.log("Aave pool address:", poolAddress);

  // Verify cREAL is not dollar-backed
  const dollarBackedTokens = [];
  try {
    for (let i = 0; ; i++) {
      const token = await minilend.dollarBackedTokens(i);
      dollarBackedTokens.push(token);
    }
  } catch (e) {}
  console.log("Is cREAL dollar-backed?", dollarBackedTokens.includes(CREAL_ADDRESS));
  console.log("Dollar-backed tokens:", dollarBackedTokens);

  // Check supported stablecoins and collateral
  const supportedStablecoins = [];
  try {
    for (let i = 0; ; i++) {
      const token = await minilend.supportedStablecoins(i);
      supportedStablecoins.push(token);
    }
  } catch (e) {}
  console.log("Supported stablecoins:", supportedStablecoins);

  const supportedCollateral = [];
  try {
    for (let i = 0; ; i++) {
      const token = await minilend.supportedCollateral(i);
      supportedCollateral.push(token);
    }
  } catch (e) {}
  console.log("Supported collateral:", supportedCollateral);

  // Check lock period
  console.log("LOCK_60_SECONDS (script):", LOCK_60_SECONDS.toString());

  // Check oracle owner
  const oracleOwner = await oracle.owner();
  console.log("Oracle owner:", oracleOwner);
  if (oracleOwner !== myAddress) {
    console.warn("Wallet is not oracle owner. Ensure cREAL and cUSD prices are set.");
  }

  // Check oracle prices
  const [crealPrice, crealTimestamp] = await oracle.getMedianRate(CREAL_ADDRESS);
  console.log("cREAL price:", ethers.formatUnits(crealPrice, 18), "CELO");
  console.log("cREAL price timestamp:", new Date(Number(crealTimestamp) * 1000).toISOString());
  const [usdcPrice, usdcTimestamp] = await oracle.getMedianRate(USDC_ADDRESS);
  console.log("cUSD price:", ethers.formatUnits(usdcPrice, 18), "CELO");
  console.log("cUSD price timestamp:", new Date(Number(usdcTimestamp) * 1000).toISOString());

  // Check balances and allowances
  const myCkesBalance = await ckes.balanceOf(myAddress);
  const myCrealBalance = await creal.balanceOf(myAddress);
  const myUsdcBalance = await usdc.balanceOf(myAddress);
  const minilendAddress = MINILEND_CELO;
  const myCkesAllowance = await ckes.allowance(myAddress, minilendAddress);
  const myCrealAllowance = await creal.allowance(myAddress, minilendAddress);
  const myUsdcAllowance = await usdc.allowance(myAddress, minilendAddress);
  console.log("My cKES balance (raw):", myCkesBalance.toString());
  console.log("My cKES balance:", ethers.formatUnits(myCkesBalance, 18));
  console.log("My cREAL balance (raw):", myCrealBalance.toString());
  console.log("My cREAL balance:", ethers.formatUnits(myCrealBalance, 18));
  console.log("My cUSD balance (raw):", myUsdcBalance.toString());
  console.log("My cUSD balance:", ethers.formatUnits(myUsdcBalance, 6));
  console.log("My cKES allowance:", ethers.formatUnits(myCkesAllowance, 18));
  console.log("My cREAL allowance:", ethers.formatUnits(myCrealAllowance, 18));
  console.log("My cUSD allowance:", ethers.formatUnits(myUsdcAllowance, 6));
  console.log("CKES_AMOUNT:", ethers.formatUnits(CKES_AMOUNT, 18));
  console.log("CREAL_AMOUNT:", ethers.formatUnits(CREAL_AMOUNT, 18));
  console.log("USDC_AMOUNT:", ethers.formatUnits(USDC_AMOUNT, 6));

  // Check cREAL reserves
  const crealReserves = await minilend.totalSupply(CREAL_ADDRESS);
  console.log("cREAL reserves before supply:", ethers.formatUnits(crealReserves, 18));

  // Check user borrows for all stablecoins
  for (const token of supportedStablecoins) {
    const borrowBalance = await minilend.userBorrows(myAddress, token);
    console.log(`User borrows for ${token}:`, ethers.formatUnits(borrowBalance, token === USDC_ADDRESS ? 6 : 18));
    if (borrowBalance > 0) {
      console.warn(`Non-zero borrow balance for ${token}: ${ethers.formatUnits(borrowBalance, token === USDC_ADDRESS ? 6 : 18)}`);
      console.log(`Approving ${token} for repayment...`);
      const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);
      const nonce = await provider.getTransactionCount(myAddress, "pending");
      const feeData = await provider.getFeeData();
      console.log("Fee data for approve:", {
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : "null",
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : "null",
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "null"
      });
      const maxFeePerGas = feeData.maxFeePerGas && typeof feeData.maxFeePerGas !== "string" ? feeData.maxFeePerGas * 2n : ethers.parseUnits("5", "gwei");
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas && typeof feeData.maxPriorityFeePerGas !== "string" ? feeData.maxPriorityFeePerGas : ethers.parseUnits("2", "gwei");
      const estimatedGas = await tokenContract.approve.estimateGas(MINILEND_CELO, borrowBalance);
      console.log(`Estimated gas for approve: ${estimatedGas.toString()}`);
      await tokenContract.approve(MINILEND_CELO, borrowBalance, {
        gasLimit: estimatedGas * 12n / 10n, // 20% buffer
        nonce: nonce,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: maxPriorityFeePerGas
      });
      console.log(`Repaying ${token}...`);
      const tx = await repayWithRetry(token, borrowBalance);
      console.log(`Repaid ${token}, tx:`, tx.hash);
    }
  }

  // Check cUSD collateral lock status
  const lockEnd = await minilend.depositLockEnd(myAddress, USDC_ADDRESS);
  const currentTimestamp = Math.floor(Date.now() / 1000);
  console.log("cUSD collateral lock end:", new Date(Number(lockEnd) * 1000).toISOString());
  console.log("Current timestamp:", new Date(currentTimestamp * 1000).toISOString());
  if (Number(lockEnd) > currentTimestamp) {
    console.warn("cUSD collateral is still locked until", new Date(Number(lockEnd) * 1000).toISOString());
  }

  // 1. Supply cKES
  if (myCkesBalance < CKES_AMOUNT) {
    console.error("Insufficient cKES balance. Please acquire at least", ethers.formatUnits(CKES_AMOUNT, 18), "cKES.");
    return;
  }
  console.log("Approving cKES...");
  let tx = await ckes.approve(MINILEND_CELO, CKES_AMOUNT, { gasLimit: 100000 });
  await tx.wait();
  console.log("My cKES allowance after approval:", ethers.formatUnits(await ckes.allowance(myAddress, MINILEND_CELO), 18));
  console.log("Supplying cKES with 60-second lock...");
  tx = await minilend.supply(CKES_ADDRESS, CKES_AMOUNT, LOCK_60_SECONDS, { gasLimit: 500000 });
  await tx.wait();
  console.log("Supplied cKES, tx:", tx.hash);

  // Check cKES lock period
  const ckesLockEnd = await minilend.depositLockEnd(myAddress, CKES_ADDRESS);
  console.log("cKES lock end:", new Date(Number(ckesLockEnd) * 1000).toISOString());

  // 2. Supply cREAL
  if (myCrealBalance < CREAL_SUPPLY_AMOUNT) {
    console.error("Insufficient cREAL balance. Please acquire at least", ethers.formatUnits(CREAL_SUPPLY_AMOUNT, 18), "cREAL.");
    return;
  }
  console.log("Approving cREAL...");
  tx = await creal.approve(MINILEND_CELO, CREAL_SUPPLY_AMOUNT, { gasLimit: 100000 });
  await tx.wait();
  console.log("My cREAL allowance after approval:", ethers.formatUnits(await creal.allowance(myAddress, MINILEND_CELO), 18));
  console.log("Supplying cREAL with 60-second lock...");
  tx = await minilend.supply(CREAL_ADDRESS, CREAL_SUPPLY_AMOUNT, LOCK_60_SECONDS, { gasLimit: 500000 });
  await tx.wait();
  console.log("Supplied cREAL, tx:", tx.hash);

  // Check cREAL lock period
  const crealLockEnd = await minilend.depositLockEnd(myAddress, CREAL_ADDRESS);
  console.log("cREAL lock end:", new Date(Number(crealLockEnd) * 1000).toISOString());

  // Check cREAL reserves after supply
  const crealReservesAfter = await minilend.totalSupply(CREAL_ADDRESS);
  console.log("cREAL reserves after supply:", ethers.formatUnits(crealReservesAfter, 18));

  // 3. Deposit cUSD collateral
  if (myUsdcBalance < USDC_AMOUNT) {
    console.error("Insufficient cUSD balance. Please acquire at least", ethers.formatUnits(USDC_AMOUNT, 6), "cUSD.");
    return;
  }
  console.log("Approving cUSD...");
  tx = await usdc.approve(MINILEND_CELO, USDC_AMOUNT, { gasLimit: 100000 });
  await tx.wait();
  console.log("My cUSD allowance after approval:", ethers.formatUnits(await usdc.allowance(myAddress, MINILEND_CELO), 6));
  console.log("Depositing cUSD collateral...");
  tx = await minilend.depositCollateral(USDC_ADDRESS, USDC_AMOUNT, { gasLimit: 500000 });
  await tx.wait();
  console.log("Deposited cUSD collateral, tx:", tx.hash);

  // Check cUSD collateral balance
  const collateralBalance = await minilend.userCollateral(myAddress, USDC_ADDRESS);
  console.log("cUSD collateral balance:", ethers.formatUnits(collateralBalance, 6));

  // Debug state before borrow
  console.log("Debugging state before borrow...");
  const isUndercollateralizedBefore = await minilend.isUndercollateralized(myAddress, CREAL_ADDRESS, USDC_ADDRESS);
  console.log("Loan undercollateralized before borrow:", isUndercollateralizedBefore);
  const userBorrowsBefore = await minilend.userBorrows(myAddress, CREAL_ADDRESS);
  console.log("User cREAL borrows before:", ethers.formatUnits(userBorrowsBefore, 18));
  console.log("Collateralization ratio:", (0.1 * Number(ethers.formatUnits(usdcPrice, 18)) / (0.01 * Number(ethers.formatUnits(crealPrice, 18))) * 100), "%");

  // 4. Borrow cREAL
  console.log("Borrowing cREAL...");
  try {
    tx = await minilend.borrow(CREAL_ADDRESS, CREAL_AMOUNT, USDC_ADDRESS, { gasLimit: 1500000 });
    console.log("Borrow transaction hash:", tx.hash);
    await tx.wait();
    console.log("Borrowed cREAL!");
    // Fetch debug events for borrow
    const events = await fetchLogsWithRetry(minilend.filters.DebugString(), tx.blockNumber, tx.blockNumber);
    const uintEvents = await fetchLogsWithRetry(minilend.filters.DebugUint(), tx.blockNumber, tx.blockNumber);
    const addressEvents = await fetchLogsWithRetry(minilend.filters.DebugAddress(), tx.blockNumber, tx.blockNumber);
    console.log("Borrow DebugString events:", events.map(e => e.args.message));
    console.log("Borrow DebugUint events:", uintEvents.map(e => ({ message: e.args.message, value: e.args.value.toString() })));
    console.log("Borrow DebugAddress events:", addressEvents.map(e => ({ message: e.args.message, value: e.args.value })));
    // Verify borrow success
    const receipt = await provider.getTransactionReceipt(tx.hash);
    console.log("Borrow transaction status:", receipt.status === 1 ? "Success" : "Failed");
    if (receipt.status === 1) {
      const borrowEvents = await fetchLogsWithRetry(minilend.filters.Borrowed(myAddress, CREAL_ADDRESS), receipt.blockNumber, receipt.blockNumber);
      console.log("Borrowed event:", borrowEvents.length > 0 ? borrowEvents[0].args : "None");
    }
    // Check user borrows after
    const userBorrowsAfter = await minilend.userBorrows(myAddress, CREAL_ADDRESS);
    console.log("User cREAL borrows after:", ethers.formatUnits(userBorrowsAfter, 18));
  } catch (e) {
    console.error("Borrow failed:", e.message);
    if (e.transaction) console.log("Failed transaction hash:", e.transaction.hash);
    if (e.receipt) {
      console.log("Failed transaction receipt:", e.receipt);
      const events = await fetchLogsWithRetry(minilend.filters.DebugString(), e.receipt.blockNumber, e.receipt.blockNumber);
      const uintEvents = await fetchLogsWithRetry(minilend.filters.DebugUint(), e.receipt.blockNumber, e.receipt.blockNumber);
      const addressEvents = await fetchLogsWithRetry(minilend.filters.DebugAddress(), e.receipt.blockNumber, e.receipt.blockNumber);
      console.log("Borrow DebugString events:", events.map(e => e.args.message));
      console.log("Borrow DebugUint events:", uintEvents.map(e => ({ message: e.args.message, value: e.args.value.toString() })));
      console.log("Borrow DebugAddress events:", addressEvents.map(e => ({ message: e.args.message, value: e.args.value })));
    }
    console.log("Suggestions: Check Aave pool configuration, increase cREAL supply, or verify cUSD support.");
    return;
  }

  // Check collateralization status
  console.log("Checking collateralization status...");
  const isUndercollateralized = await minilend.isUndercollateralized(myAddress, CREAL_ADDRESS, USDC_ADDRESS);
  console.log("Loan undercollateralized:", isUndercollateralized);

  // 5. Repay cREAL loan
  const myCrealBalanceAfterBorrow = await creal.balanceOf(myAddress);
  if (myCrealBalanceAfterBorrow < CREAL_AMOUNT) {
    console.error("Insufficient cREAL balance for repayment. Please acquire at least", ethers.formatUnits(CREAL_AMOUNT, 18), "cREAL.");
    return;
  }
  console.log("Approving cREAL for repayment...");
  const nonceApprove = await provider.getTransactionCount(myAddress, "pending");
  const feeDataApprove = await provider.getFeeData();
  console.log("Fee data for approve:", {
    maxFeePerGas: feeDataApprove.maxFeePerGas ? ethers.formatUnits(feeDataApprove.maxFeePerGas, "gwei") : "null",
    maxPriorityFeePerGas: feeDataApprove.maxPriorityFeePerGas ? ethers.formatUnits(feeDataApprove.maxPriorityFeePerGas, "gwei") : "null",
    gasPrice: feeDataApprove.gasPrice ? ethers.formatUnits(feeDataApprove.gasPrice, "gwei") : "null"
  });
  const maxFeePerGasApprove = feeDataApprove.maxFeePerGas && typeof feeDataApprove.maxFeePerGas !== "string" ? feeDataApprove.maxFeePerGas * 2n : ethers.parseUnits("5", "gwei");
  const maxPriorityFeePerGasApprove = feeDataApprove.maxPriorityFeePerGas && typeof feeDataApprove.maxPriorityFeePerGas !== "string" ? feeDataApprove.maxPriorityFeePerGas : ethers.parseUnits("2", "gwei");
  const estimatedGasApprove = await creal.approve.estimateGas(MINILEND_CELO, CREAL_AMOUNT);
  console.log(`Estimated gas for approve: ${estimatedGasApprove.toString()}`);
   tx = await creal.approve(MINILEND_CELO, CREAL_AMOUNT, {
    gasLimit: estimatedGasApprove * 12n / 10n, // 20% buffer
    nonce: nonceApprove,
    maxFeePerGas: maxFeePerGasApprove,
    maxPriorityFeePerGas: maxPriorityFeePerGasApprove
  });
  await tx.wait();
  console.log("Repaying cREAL loan...");
  try {
    tx = await repayWithRetry(CREAL_ADDRESS, CREAL_AMOUNT);
    console.log("Repaid cREAL loan, tx:", tx.hash);
  } catch (e) {
    console.error("Repay failed:", e.message);
    if (e.transaction) {
      console.log("Failed transaction hash:", e.transaction.hash);
      const txResponse = await provider.getTransaction(e.transaction.hash);
      console.log("Transaction response:", txResponse);
    }
    if (e.receipt) {
      console.log("Failed transaction receipt:", e.receipt);
      const events = await fetchLogsWithRetry(minilend.filters.DebugString(), e.receipt.blockNumber, e.receipt.blockNumber);
      const uintEvents = await fetchLogsWithRetry(minilend.filters.DebugUint(), e.receipt.blockNumber, e.receipt.blockNumber);
      const addressEvents = await fetchLogsWithRetry(minilend.filters.DebugAddress(), e.receipt.blockNumber, e.receipt.blockNumber);
      console.log("Repay DebugString events:", events.map(e => e.args.message));
      console.log("Repay DebugUint events:", uintEvents.map(e => ({ message: e.args.message, value: e.args.value.toString() })));
      console.log("Repay DebugAddress events:", addressEvents.map(e => ({ message: e.args.message, value: e.args.value })));
    }
    return;
  }

  // Wait for 60-second lock period
  console.log("Waiting 60 seconds for lock period...");
  const finalCkesLockEnd = await minilend.depositLockEnd(myAddress, CKES_ADDRESS);
  if (Number(finalCkesLockEnd) > Math.floor(Date.now() / 1000)) {
    console.log("Waiting for cKES lock to expire...");
    await new Promise(resolve => setTimeout(resolve, (Number(finalCkesLockEnd) * 1000 - Date.now()) + 1000));
  }

  // Check lock status after wait
  console.log("cKES lock end after wait:", new Date(Number(finalCkesLockEnd) * 1000).toISOString());
  console.log("Current timestamp:", new Date(Math.floor(Date.now() / 1000) * 1000).toISOString());

  // 6. Withdraw cKES
  console.log("Withdrawing cKES...");
  try {
    // Check available supply
    const availableCkes = await minilend.userCollateral(myAddress, CKES_ADDRESS);
    console.log("Available cKES balance:", ethers.formatUnits(availableCkes, 18));
    if (availableCkes < CKES_AMOUNT) {
      console.error("Insufficient cKES to withdraw:", ethers.formatUnits(availableCkes, 18), "<", ethers.formatUnits(CKES_AMOUNT, 18));
      return;
    }
    // Check user borrows again
    for (const token of supportedStablecoins) {
      const borrowBalance = await minilend.userBorrows(myAddress, token);
      console.log(`User borrows for ${token} before withdraw:`, ethers.formatUnits(borrowBalance, token === USDC_ADDRESS ? 6 : 18));
      if (borrowBalance > 0) {
        console.error(`Cannot withdraw: Outstanding borrow for ${token}: ${ethers.formatUnits(borrowBalance, token === USDC_ADDRESS ? 6 : 18)}`);
        return;
      }
    }
    // Check Aave aToken balance for cKES
    let ckesATokenBalance = ethers.toBigInt(0);
    try {
      const ckesReserveData = await aavePool.getReserveData(CKES_ADDRESS);
      if (ckesReserveData.aTokenAddress !== ethers.ZeroAddress) {
        const ckesAToken = new ethers.Contract(ckesReserveData.aTokenAddress, ERC20_ABI, signer);
        ckesATokenBalance = await ckesAToken.balanceOf(minilendAddress);
        console.log("Contract aToken balance for cKES before withdraw:", ethers.formatUnits(ckesATokenBalance, 18));
      } else {
        console.warn("Invalid cKES aToken address (0x0). Skipping cKES aToken balance check.");
      }
    } catch (e) {
      console.warn("Failed to fetch cKES aToken balance:", e.message);
      console.log("Skipping cKES aToken balance check.");
    }
    // Attempt withdrawal
    const nonceWithdraw = await provider.getTransactionCount(myAddress, "pending");
    const feeDataWithdraw = await provider.getFeeData();
    console.log("Fee data for withdraw:", {
      maxFeePerGas: feeDataWithdraw.maxFeePerGas ? ethers.formatUnits(feeDataWithdraw.maxFeePerGas, "gwei") : "null",
      maxPriorityFeePerGas: feeDataWithdraw.maxPriorityFeePerGas ? ethers.formatUnits(feeDataWithdraw.maxPriorityFeePerGas, "gwei") : "null",
      gasPrice: feeDataWithdraw.gasPrice ? ethers.formatUnits(feeDataWithdraw.gasPrice, "gwei") : "null"
    });
    const maxFeePerGasWithdraw = feeDataWithdraw.maxFeePerGas && typeof feeDataWithdraw.maxFeePerGas !== "string" ? feeDataWithdraw.maxFeePerGas * 2n : ethers.parseUnits("5", "gwei");
    const maxPriorityFeePerGasWithdraw = feeDataWithdraw.maxPriorityFeePerGas && typeof feeDataWithdraw.maxPriorityFeePerGas !== "string" ? feeDataWithdraw.maxPriorityFeePerGas : ethers.parseUnits("2", "gwei");
    const estimatedGasWithdraw = await minilend.withdraw.estimateGas(CKES_ADDRESS, CKES_AMOUNT);
    console.log(`Estimated gas for withdraw: ${estimatedGasWithdraw.toString()}`);
    tx = await minilend.withdraw(CKES_ADDRESS, CKES_AMOUNT, {
      gasLimit: estimatedGasWithdraw * 12n / 10n, // 20% buffer
      nonce: nonceWithdraw,
      maxFeePerGas: maxFeePerGasWithdraw,
      maxPriorityFeePerGas: maxPriorityFeePerGasWithdraw
    });
    console.log("Withdraw transaction hash:", tx.hash);
    await tx.wait();
    console.log("Withdrew cKES!");
  } catch (e) {
    console.error("Withdraw failed:", e.message);
    if (e.transaction) console.log("Failed transaction hash:", e.transaction.hash);
    if (e.receipt) {
      console.log("Failed transaction receipt:", e.receipt);
      const events = await fetchLogsWithRetry(minilend.filters.DebugString(), e.receipt.blockNumber, e.receipt.blockNumber);
      const uintEvents = await fetchLogsWithRetry(minilend.filters.DebugUint(), e.receipt.blockNumber, e.receipt.blockNumber);
      const addressEvents = await fetchLogsWithRetry(minilend.filters.DebugAddress(), e.receipt.blockNumber, e.receipt.blockNumber);
      console.log("Withdraw DebugString events:", events.map(e => e.args.message));
      console.log("Withdraw DebugUint events:", uintEvents.map(e => ({ message: e.args.message, value: e.args.value.toString() })));
      console.log("Withdraw DebugAddress events:", addressEvents.map(e => ({ message: e.args.message, value: e.args.value })));
    }
    // Check Aave reserve data for cKES on failure
    try {
      const ckesReserveDataAfter = await aavePool.getReserveData(CKES_ADDRESS);
      console.log("Aave cKES reserve data after failure:", {
        aTokenAddress: ckesReserveDataAfter.aTokenAddress,
        liquidityIndex: ckesReserveDataAfter.liquidityIndex.toString(),
        currentLiquidityRate: ethers.formatUnits(ckesReserveDataAfter.currentLiquidityRate, 27),
        availableLiquidity: ethers.formatUnits(await ckes.balanceOf(ckesReserveDataAfter.aTokenAddress), 18)
      });
    } catch (e) {
      console.warn("Failed to fetch cKES reserve data:", e.message);
    }
    return;
  }

  // Check final balances
  const finalCkesBalance = await ckes.balanceOf(myAddress);
  const finalCrealBalance = await creal.balanceOf(myAddress);
  const finalUsdcBalance = await usdc.balanceOf(myAddress);
  console.log("Final cKES balance:", ethers.formatUnits(finalCkesBalance, 18));
  console.log("Final cREAL balance:", ethers.formatUnits(finalCrealBalance, 18));
  console.log("Final cUSD balance:", ethers.formatUnits(finalUsdcBalance, 6));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});