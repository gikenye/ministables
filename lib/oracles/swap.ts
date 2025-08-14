import { Wallet, providers, utils } from "ethers";
import { Mento } from "@mento-protocol/mento-sdk";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log(
      'Set your private key in the "privateKey" variable. before running this script.'
    );
    process.exit(1);
  }

  const provider = new providers.JsonRpcProvider(
    "https://alfajores-forno.celo-testnet.org"
  );
  const signer = new Wallet(privateKey, provider);
  const mento = await Mento.create(signer);

  const celoTokenAddr = "0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9";
  const cUSDTokenAddr = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
  const tokenUnits = 18; // both CELO and cUSD have 18 decimal places

  const amountIn = utils.parseUnits("0.01", tokenUnits);
  const quoteAmountOut = await mento.getAmountOut(
    celoTokenAddr,
    cUSDTokenAddr,
    amountIn
  );

  console.log(
    `~${utils.formatUnits(
      quoteAmountOut,
      tokenUnits
    )} cUSD in exchange for 0.01 CELO`
  );

  console.log("Increasing trading allowance...");
  const allowanceTxObj = await mento.increaseTradingAllowance(
    celoTokenAddr,
    amountIn
  );
  const allowanceTx = await signer.sendTransaction(allowanceTxObj);
  const allowanceReceipt = await allowanceTx.wait();
  console.log("tx receipt: ", allowanceReceipt);

  console.log("Swapping CELO for cUSD...");
  const expectedAmountOut = quoteAmountOut.mul(99).div(100); // allow 1% slippage from quote
  const swapTxObj = await mento.swapIn(
    celoTokenAddr,
    cUSDTokenAddr,
    amountIn,
    expectedAmountOut
  );
  const swapTx = await signer.sendTransaction(swapTxObj);
  const swapTxReceipt = await swapTx.wait();
  console.log("tx receipt: ", swapTxReceipt);
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));
