 import { Mento } from "@mento-protocol/mento-sdk";
import { providers } from "ethers";

async function main() {
  const provider = new providers.JsonRpcProvider(
    "https://alfajores-forno.celo-testnet.org"
  );
  const mento = await Mento.create(provider);

  const pairs = await mento.getTradablePairs();
  console.log(`Found ${pairs.length} tradeable pairs:`);
  console.log(pairs);
}

main()
  .then(() => console.log("Done! 🚀"))
  .catch((e) => console.log("Error: ", e));
