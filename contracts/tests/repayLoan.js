require('dotenv').config();
const { ethers } = require("ethers");

async function main() {
    // Validate private key
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY not set in .env file");
    }

    const provider = new ethers.JsonRpcProvider("https://forno.celo.org");
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const myAddress = await signer.getAddress();
    console.log("My address:", myAddress);

    const CREAL_ADDRESS = "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787";
    const MINILEND_ADDRESS = "0xe58866e69dD87DcF84d5057ED182ae49AC6952E9";
    const CREAL_AMOUNT = ethers.parseEther("1.0");

    const cREAL = new ethers.Contract(CREAL_ADDRESS, [
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function balanceOf(address) view returns (uint256)"
    ], signer);
    const minilend = new ethers.Contract(MINILEND_ADDRESS, [
        "function repay(address, uint256)",
        "function userBorrows(address, address) view returns (uint256)"
    ], signer);

    console.log("cREAL balance:", ethers.formatUnits(await cREAL.balanceOf(myAddress), 18));
    console.log("cREAL allowance:", ethers.formatUnits(await cREAL.allowance(myAddress, MINILEND_ADDRESS), 18));
    console.log("User cREAL borrow balance:", ethers.formatUnits(await minilend.userBorrows(myAddress, CREAL_ADDRESS), 18));

    console.log("Approving cREAL...");
    await (await cREAL.approve(MINILEND_ADDRESS, CREAL_AMOUNT, { gasLimit: 100000 })).wait();
    console.log("cREAL allowance after approval:", ethers.formatUnits(await cREAL.allowance(myAddress, MINILEND_ADDRESS), 18));

    console.log("Simulating repay...");
    const repayData = minilend.interface.encodeFunctionData("repay", [CREAL_ADDRESS, CREAL_AMOUNT]);
    try {
        await provider.call({ to: MINILEND_ADDRESS, data: repayData, from: myAddress });
        console.log("Simulated repay succeeded");
    } catch (e) {
        console.error("Simulated repay error:", e);
    }

    console.log("Repaying cREAL...");
    await (await minilend.repay(CREAL_ADDRESS, CREAL_AMOUNT, { gasLimit: 1000000 })).wait();
    console.log("Repaid");
}

main().catch(console.error);