import { useUserDeposits } from "@/hooks/useContractData";
import { Contract } from "thirdweb";
import { formatAmount } from "@/lib/utils";

interface WithdrawableAmountProps {
  contract: Contract;
  userAddress: string;
  tokenAddress: string;
  tokenInfo: { symbol: string; decimals: number };
}

export function WithdrawableAmount({ contract, userAddress, tokenAddress, tokenInfo }: WithdrawableAmountProps) {
  const { data: depositData, isPending } = useUserDeposits(contract, userAddress, tokenAddress, 0);

  if (isPending) {
    return <span className="text-xs text-muted-foreground">Loading...</span>;
  }

  if (!depositData || depositData[0] === BigInt(0)) {
    return <span className="text-xs text-muted-foreground">0</span>;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const lockEnd = Number(depositData[1]);
  const isLocked = lockEnd > currentTime;

  if (isLocked) {
    return <span className="text-xs text-destructive-foreground0">Locked</span>;
  }

  const formattedAmount = formatAmount(depositData[0].toString(), tokenInfo.decimals);
  return (
    <span className="text-xs text-success">
      {parseFloat(formattedAmount).toFixed(4)}
    </span>
  );
}