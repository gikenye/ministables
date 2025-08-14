const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying UUPS BackendPriceOracle with:", deployer.address);

  const initialUpdater = process.env.PRICE_UPDATER_ADDRESS || deployer.address; // backend relayer

  const Factory = await ethers.getContractFactory("BackendPriceOracle");
  const proxy = await upgrades.deployProxy(Factory, [initialUpdater], {
    kind: "uups",
    initializer: "initialize",
  });

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("BackendPriceOracle proxy:", proxyAddress);
  console.log("BackendPriceOracle implementation:", implAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


