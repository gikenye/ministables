import { getContract } from "thirdweb";
import { celo } from "thirdweb/chains";
import { client } from "@/lib/thirdweb/client";
import { MINILEND_ADDRESS } from "@/lib/services/thirdwebService";

export function useMinilendContract() {
  return getContract({
    client,
    chain: celo,
    address: MINILEND_ADDRESS,
  });
}