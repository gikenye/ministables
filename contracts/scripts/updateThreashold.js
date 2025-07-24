const { ethers } = require("hardhat");

async function updateThresholds() {
  const [owner] = await ethers.getSigners();
  const miniLend = await ethers.getContractAt("MiniLend", "0x37E3b6e39706dc753A47585C0FA5f75832b847B8", owner);

  const CKES_ADDRESS = "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0";
  const CREAL_ADDRESS = "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787";

  // Update minReserveThreshold
  await miniLend.updateReserveThreshold(CKES_ADDRESS, ethers.parseUnits("1", 18)); // Higher for cKES
  console.log("Updated cKES minReserveThreshold to 100");
  await miniLend.updateReserveThreshold(CREAL_ADDRESS, ethers.parseUnits("1", 18));
  console.log("Updated cREAL minReserveThreshold to 50");
}

updateThresholds()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Update failed:", error);
    process.exit(1);
  });