"use client";
import { useSendTransaction } from "thirdweb/react";
import { prepareContractCall, getContract } from "thirdweb";
import { client } from "@/lib/thirdweb/client";
import { CHAINS, CONTRACTS, getTokenInfoMap } from "@/config/chainConfig";


export function useWithdraw(onSuccess?: () => void) {
  const { mutateAsync: sendTx, isLoading } = useSendTransaction();

  const withdraw = async (token: string, amount: string) => {
    const defaultChain = CHAINS && CHAINS.length > 0 ? CHAINS[0] : undefined;
    const defaultAddress = defaultChain ? CONTRACTS[defaultChain.id] : undefined;

    const tokenMap = defaultChain ? getTokenInfoMap(defaultChain.id) : {};
    const tokenInfo = tokenMap[token];
    if (!tokenInfo) throw new Error("Token not supported");

    const decimals = tokenInfo.decimals || 18;
    const amountWei = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

    const contract = getContract({ client, chain: defaultChain, address: defaultAddress });

    const tx = prepareContractCall({
      contract,
      method: "function withdraw(address token, uint256 amount)",
      params: [token, amountWei],
    });

    await sendTx({ transaction: tx });
    if (onSuccess) onSuccess();
  };

  return { withdraw, isLoading };
}