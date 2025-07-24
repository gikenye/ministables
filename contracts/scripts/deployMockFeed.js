const { ethers } = require("hardhat");

async function main() {
  try {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log(
      `Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} CELO`
    );

    const feeData = await ethers.provider.getFeeData();
    console.log("feeData:", feeData);
    const gasPrice = (feeData.gasPrice || ethers.parseUnits("5", "gwei")) + ethers.parseUnits("5", "gwei");

    const MockSortedOracles = await ethers.getContractFactory("MockSortedOracles");
    const mockSortedOracles = await MockSortedOracles.deploy({ gasPrice, gasLimit: 2000000 });
    await mockSortedOracles.waitForDeployment();
    const contractAddress = await mockSortedOracles.getAddress();
    console.log("MockSortedOracles deployed to:", contractAddress);

    const tokens = [
      { address: ethers.getAddress("0x456a3D042C0DbD3db53D5489e98dFb038553B0d0"), name: "cKES" },
      { address: ethers.getAddress("0x765DE816845861e75A25fCA122bb6898B8B1282a"), name: "cUSD" },
      { address: ethers.getAddress("0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787"), name: "cREAL" },
      { address: ethers.getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"), name: "USDC" },
    ];

    for (const token of tokens) {
      try {
        const rate = await mockSortedOracles.rates(token.address);
        console.log(`Rate for ${token.name} in mapping: ${rate.toString()}`);
        if (rate == 0) {
          console.log(`Setting rate for ${token.name}...`);
          await mockSortedOracles.setRate(token.address, ethers.parseUnits("1.428571428571428571", 18));
        }
        const [medianRate, timestamp] = await mockSortedOracles.getMedianRate(token.address);
        console.log(
          `${token.name} rate: ${ethers.formatUnits(medianRate, 18)} CELO, Timestamp: ${timestamp.toString()}, Age: ${Math.floor(Date.now() / 1000) - Number(timestamp)}`
        );
      } catch (err) {
        console.error(`Error fetching rate for ${token.name}:`, err);
      }
    }

    // Save deployment details
    const deploymentDetails = {
      contractAddress,
      deployer: deployer.address,
      network: "Celo Mainnet",
      deploymentDate: new Date().toISOString(),
    };
    require("fs").writeFileSync("mockSortedOracles-deployment.json", JSON.stringify(deploymentDetails, null, 2));
    console.log("Deployment details saved to mockSortedOracles-deployment.json");
  } catch (err) {
    console.error("Script failed:", err);
    process.exit(1);
  }
}

main();