import { formatAmount } from "@/lib/utils";
import { useTotalSupply, useTotalBorrows, useMinReserveThreshold, useIsBorrowingPaused } from "@/lib/thirdweb/minilend-contract";
import { Contract } from "thirdweb";

interface TokenLiquidityProps {
  contract: Contract;
  tokenAddress: string;
  tokenInfo: { symbol: string; decimals: number };
}

export function TokenLiquidity({ contract, tokenAddress, tokenInfo }: TokenLiquidityProps) {
  const { data: totalSupply, isPending: isSupplyPending } = useTotalSupply(contract, tokenAddress);
  const { data: totalBorrows, isPending: isBorrowsPending } = useTotalBorrows(contract, tokenAddress);
  const { data: minReserveThreshold, isPending: isThresholdPending } = useMinReserveThreshold(contract, tokenAddress);
  const { data: isBorrowingPaused, isPending: isPausedPending } = useIsBorrowingPaused(contract, tokenAddress);

  const isPending = isSupplyPending || isBorrowsPending || isThresholdPending || isPausedPending;

  if (isPending) {
    return <span className="text-xs text-muted-foreground">Loading...</span>;
  }

  if (isBorrowingPaused) {
    return <span className="text-xs text-destructive-foreground0">Paused</span>;
  }

  let availableLiquidity = BigInt(0);
  if (totalSupply && totalBorrows !== undefined && minReserveThreshold !== undefined) {
    const supply = totalSupply || BigInt(0);
    const borrows = totalBorrows || BigInt(0);
    const threshold = minReserveThreshold || BigInt(0);
    
    if (supply > borrows + threshold) {
      availableLiquidity = supply - borrows - threshold;
    }
  }

  if (availableLiquidity === BigInt(0)) {
    return <span className="text-xs text-muted-foreground">0 available</span>;
  }

  const formattedAmount = formatAmount(availableLiquidity.toString(), tokenInfo.decimals);
  return (
    <span className="text-xs text-success">
      {parseFloat(formattedAmount).toFixed(2)} available
    </span>
  );
}