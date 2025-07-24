const { ethers } = require("hardhat");
const { writeFileSync } = require("fs");

async function main() {
  // Get the deployer's account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MiniLend with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "CELO");

  // Contract addresses for Celo Mainnet (checksummed)
  const POOL_ADDRESS_PROVIDER = "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5";
  const SORTED_ORACLES = "0x96D7E17a4Af7af46413A7EAD48f01852C364417A";
  const USDC_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
  const CKES_ADDRESS = "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
  const CEUR_ADDRESS = "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73";
  const CREAL_ADDRESS = "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787";
  const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
  const USDT_ADDRESS = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
  const USDGLO_ADDRESS = "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3";
  const EXOF_ADDRESS = "0x73F93dcc49cB8A239e2032663e9475dd5ef29A08";
  const CCOP_ADDRESS = "0x8A567e2aE79CA692Bd748aB832081C45de4041eA";
  const CGHS_ADDRESS = "0xfAeA5F3404bbA20D3cc2f8C4B0A888F55a3c7313";
  const PUSO_ADDRESS = "0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B";
  const TREASURY_ADDRESS = "0xF7530896aBC3674a66E6193A0BACB3c8e0f78390"; // Multisig address

  // Supported tokens (all Mento stablecoins from MockSortedOracles)
  const supportedStablecoins = [
    CKES_ADDRESS,    // Non-dollar-backed (KES)
    CREAL_ADDRESS,   // Non-dollar-backed (BRL)
    EXOF_ADDRESS,    // Non-dollar-backed (XOF)
    CCOP_ADDRESS,    // Non-dollar-backed (COP)
    CGHS_ADDRESS,    // Non-dollar-backed (GHS)
    PUSO_ADDRESS,    // Non-dollar-backed (PHP)
    CUSD_ADDRESS,    // Dollar-backed (USD)
    CEUR_ADDRESS,    // Dollar-backed (EUR)
    USDC_ADDRESS,    // Dollar-backed (USD)
    USDT_ADDRESS,    // Dollar-backed (USD)
    USDGLO_ADDRESS   // Dollar-backed (USD)
  ];

  // Supported collateral (stable assets)
  const supportedCollateral = [
    USDC_ADDRESS,
    CUSD_ADDRESS,
    CEUR_ADDRESS,
    USDT_ADDRESS,
    USDGLO_ADDRESS
  ];

  // Dollar-backed tokens (rely on Aave liquidity)
  const dollarBackedTokens = [
    CUSD_ADDRESS,
    CEUR_ADDRESS,
    USDC_ADDRESS,
    USDT_ADDRESS,
    USDGLO_ADDRESS
  ];

  // Borrowing caps (in token decimals: 1e18 for most, 1e6 for USDC/USDT)
  const maxBorrowPerToken = [
    ethers.parseUnits("50000", 18), // cKES
    ethers.parseUnits("10000", 18), // cREAL
    ethers.parseUnits("10000", 18), // eXOF
    ethers.parseUnits("10000", 18), // cCOP
    ethers.parseUnits("10000", 18), // cGHS
    ethers.parseUnits("10000", 18), // PUSO
    ethers.parseUnits("10000", 18), // cUSD
    ethers.parseUnits("10000", 18), // cEUR
    ethers.parseUnits("1000", 6),   // USDC
    ethers.parseUnits("1000", 6),   // USDT
    ethers.parseUnits("1000", 18)   // USDGLO
  ];

  // Minimum reserve thresholds for non-dollar-backed tokens
  const minReserveThreshold = [
    ethers.parseUnits("1", 18),    // cKES (primary focus, lower threshold)
    ethers.parseUnits("1", 18),    // cREAL
    ethers.parseUnits("50", 18),   // eXOF
    ethers.parseUnits("50", 18),   // cCOP
    ethers.parseUnits("50", 18),   // cGHS
    ethers.parseUnits("50", 18),   // PUSO
    ethers.parseUnits("0", 18),    // cUSD (dollar-backed)
    ethers.parseUnits("0", 18),    // cEUR (dollar-backed)
    ethers.parseUnits("0", 6),     // USDC (dollar-backed)
    ethers.parseUnits("0", 6),     // USDT (dollar-backed)
    ethers.parseUnits("0", 18)     // USDGLO (dollar-backed)
  ];

  // Interest rate parameters (in 1e18 precision)
  const optimalUtilizations = Array(supportedStablecoins.length).fill(ethers.parseUnits("0.8", 18)); // 80%
  const baseRates = Array(supportedStablecoins.length).fill(ethers.parseUnits("0.02", 18)); // 2% APR
  const slope1s = Array(supportedStablecoins.length).fill(ethers.parseUnits("0.04", 18)); // 4%
  const slope2s = Array(supportedStablecoins.length).fill(ethers.parseUnits("0.5", 18)); // 50%

  // Deploy the contract
  const MiniLend = await ethers.getContractFactory("MiniLend");
  console.log("Deploying MiniLend contract...");

  const miniLend = await MiniLend.deploy(
    POOL_ADDRESS_PROVIDER,
    SORTED_ORACLES,
    USDC_ADDRESS,
    supportedStablecoins,
    supportedCollateral,
    dollarBackedTokens,
    maxBorrowPerToken,
    minReserveThreshold,
    TREASURY_ADDRESS,
    optimalUtilizations,
    baseRates,
    slope1s,
    slope2s,
    { gasLimit: 10000000 } // Increased for larger constructor
  );

  await miniLend.waitForDeployment();
  const contractAddress = await miniLend.getAddress();

  console.log("MiniLend deployed to:", contractAddress);

  // Verify default lock periods
  const defaultLockPeriods = [];
  try {
    for (let i = 0; ; i++) {
      const period = await miniLend.defaultLockPeriods(i);
      defaultLockPeriods.push(ethers.formatUnits(period, 0) + " seconds");
    }
  } catch (e) {
    console.log("Default lock periods:", defaultLockPeriods);
  }

  // Save deployment details
  const deploymentDetails = {
    contractAddress,
    deployer: deployer.address,
    poolAddressProvider: POOL_ADDRESS_PROVIDER,
    sortedOracles: SORTED_ORACLES,
    usdc: USDC_ADDRESS,
    treasury: TREASURY_ADDRESS,
    supportedStablecoins,
    supportedCollateral,
    dollarBackedTokens,
    maxBorrowPerToken: maxBorrowPerToken.map(amount => amount.toString()),
    minReserveThreshold: minReserveThreshold.map(amount => amount.toString()),
    optimalUtilizations: optimalUtilizations.map(rate => rate.toString()),
    baseRates: baseRates.map(rate => rate.toString()),
    slope1s: slope1s.map(rate => rate.toString()),
    slope2s: slope2s.map(rate => rate.toString()),
    defaultLockPeriods,
    deploymentDate: new Date().toISOString(),
    network: "Celo Mainnet"
  };

  writeFileSync("minilend-deployment.json", JSON.stringify(deploymentDetails, null, 2));
  console.log("Deployment details saved to minilend-deployment.json");

  // Verify contract on CeloScan
  try {
    console.log("Verifying contract on CeloScan...");
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        POOL_ADDRESS_PROVIDER,
        SORTED_ORACLES,
        USDC_ADDRESS,
        supportedStablecoins,
        supportedCollateral,
        dollarBackedTokens,
        maxBorrowPerToken,
        minReserveThreshold,
        TREASURY_ADDRESS,
        optimalUtilizations,
        baseRates,
        slope1s,
        slope2s
      ]
    });
    console.log("Contract verified on CeloScan");
  } catch (error) {
    console.error("Verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });