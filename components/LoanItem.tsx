import { useUserBorrows } from "@/hooks/useContractData";
import { Contract } from "thirdweb";
import { formatAmount } from "@/lib/utils";
import { getTokenIcon } from "@/lib/utils/tokenIcons";

interface LoanItemProps {
  contract: Contract;
  userAddress: string;
  tokenAddress: string;
  tokenInfo: { symbol: string; decimals: number };
  onSelect: (loan: {
    token: string;
    symbol: string;
    principal: string;
    totalOwed: string;
    decimals: number;
  }) => void;
  isSelected: boolean;
}

export function LoanItem({ contract, userAddress, tokenAddress, tokenInfo, onSelect, isSelected }: LoanItemProps) {
  const { data: borrowAmount, isPending } = useUserBorrows(contract, userAddress, tokenAddress);

  if (isPending) {
    return (
      <div className="border rounded p-2 border-gray-200">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{tokenInfo.symbol}</span>
          <span className="text-xs text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  if (!borrowAmount || borrowAmount === BigInt(0)) {
    return null;
  }

  const principal = parseFloat(formatAmount(borrowAmount.toString(), tokenInfo.decimals));
  const estimatedInterest = principal * 0.05; // 5% estimated interest
  const totalOwed = principal + estimatedInterest;

  const loan = {
    token: tokenAddress,
    symbol: tokenInfo.symbol,
    principal: borrowAmount.toString(),
    totalOwed: (totalOwed * Math.pow(10, tokenInfo.decimals)).toString(),
    decimals: tokenInfo.decimals,
  };

  return (
    <div
      className={`border rounded p-2 cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-gray-200 hover:border-primary/50"
      }`}
      onClick={() => onSelect(loan)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getTokenIcon(tokenInfo.symbol).startsWith('http') ? (
            <img src={getTokenIcon(tokenInfo.symbol)} alt={tokenInfo.symbol} className="w-4 h-4 rounded-full" />
          ) : (
            <span className="text-sm">{getTokenIcon(tokenInfo.symbol)}</span>
          )}
          <span className="font-medium text-sm">{tokenInfo.symbol}</span>
        </div>
        <span className="text-sm text-red-600 font-medium">
          {totalOwed.toFixed(4)}
        </span>
      </div>
      {isSelected && (
        <div className="text-xs text-primary mt-1">✓ Selected</div>
      )}
    </div>
  );
}