import { useSendTransaction } from "thirdweb/react";
import { prepareContractCall } from "thirdweb";
import { useMinilendContract } from "./useMinilendContract";

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  "0xcebA9300f2b948710d2653dD7B07f33A8B32118C": { symbol: "USDC", decimals: 6 },
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": { symbol: "cUSD", decimals: 18 },
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": { symbol: "cEUR", decimals: 18 },
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": { symbol: "cREAL", decimals: 18 },
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e": { symbol: "USDT", decimals: 6 },
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": { symbol: "cKES", decimals: 18 },
  "0x4F604735c1cF31399C6E711D5962b2B3E0225AD3": { symbol: "USDGLO", decimals: 18 },
};

export function useWithdraw(onSuccess?: () => void) {
  const contract = useMinilendContract();
  const { mutateAsync: sendTx, isLoading } = useSendTransaction();

  const withdraw = async (token: string, amount: string) => {
    const tokenInfo = TOKEN_INFO[token];
    if (!tokenInfo) throw new Error("Token not supported");
    
    const amountWei = BigInt(parseFloat(amount) * Math.pow(10, tokenInfo.decimals));

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