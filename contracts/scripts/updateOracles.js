const hre = require("hardhat");

const ministablesAbi = [
  // updateOracles
  {
    inputs: [{ internalType: "address", name: "newOracles", type: "address" }],
    name: "updateOracles",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // owner
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  // oracles
  {
    inputs: [],
    name: "oracles",
    outputs: [
      { internalType: "contract ISortedOracles", name: "", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

async function main() {
  // Addresses
  const ministablesAddress = process.env.MINISTABLES_PROXY_ADDRESS || "0x4e1B2f1b9F5d871301D41D7CeE901be2Bd97693c";
  const newOracleAddress = process.env.BACKEND_ORACLE_ADDRESS || "0x66b2Ed926b810ca5296407d0fE8F1dB73dFe5924";

  // Get signer from Hardhat (assumes --network uses the right account)
  const [signer] = await hre.ethers.getSigners();

  // Create contract instance
  const ministables = new hre.ethers.Contract(
    ministablesAddress,
    ministablesAbi,
    signer,
  );

  // Check current owner
  const currentOwner = await ministables.owner();
  console.log("Current owner:", currentOwner);

  // Check current oracle
  const currentOracle = await ministables.oracles();
  console.log("Current oracle:", currentOracle);

  // Update oracle
  console.log(`Updating oracle to: ${newOracleAddress} ...`);
  const tx = await ministables.updateOracles(newOracleAddress);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("Oracle updated!");

  // Confirm new oracle
  const updatedOracle = await ministables.oracles();
  console.log("Updated oracle address:", updatedOracle);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
