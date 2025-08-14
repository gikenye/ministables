import { Wallet, providers, utils } from "ethers";
import { Mento } from "@mento-protocol/mento-sdk";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log(
      'Set your private key in the "privateKey" env variable. before running this script.'
    );
    process.exit(1);
  }

  const provider = new providers.JsonRpcProvider(
    "https://alfajores-forno.celo-testnet.org"
  );
  const signer = new Wallet(privateKey, provider);
  const mento = await Mento.create(signer);

  // swapping cUSD for cEUR using the router
  // swapping cUSD for Celo and then Celo for cEUR
  const cUSDTokenAddr = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
  const cEURTokenAddr = "0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F";
  const tokenUnits = 18; // both cEUR and cUSD have 18 decimal places

  // find the tradable pair path for the tokens to swap through the router
  const tradablePair = await mento.findPairForTokens(
    cUSDTokenAddr,
    cEURTokenAddr
  );

  const amountIn = utils.parseUnits("0.01", tokenUnits);
  const quoteAmountOut = await mento.getAmountOut(
    cUSDTokenAddr,
    cEURTokenAddr,
    amountIn,
    tradablePair
  );

  console.log(
    `~${utils.formatUnits(
      quoteAmountOut,
      tokenUnits
    )} cEUR in exchange for 0.01 cUSD`
  );

  console.log("Increasing trading allowance...");
  const allowanceTxObj = await mento.increaseTradingAllowance(
    cUSDTokenAddr,
    amountIn,
    tradablePair
  );
  const allowanceTx = await signer.sendTransaction(allowanceTxObj);
  const allowanceReceipt = await allowanceTx.wait();
  console.log("tx receipt: ", allowanceReceipt);

  console.log("Swapping cUSD for cEUR...");
  const expectedAmountOut = quoteAmountOut.mul(99).div(100); // allow 1% slippage from quote
  const swapTxObj = await mento.swapIn(
    cUSDTokenAddr,
    cEURTokenAddr,
    amountIn,
    expectedAmountOut,
    tradablePair
  );
  const swapTx = await signer.sendTransaction(swapTxObj);
  const swapTxReceipt = await swapTx.wait();
  console.log("tx receipt: ", swapTxReceipt);
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));
