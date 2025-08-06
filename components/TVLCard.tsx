import { TrendingUp } from "lucide-react";
import QueryReservesAndLiquidity from "./QueryReservesAndLiquidity";
import { Contract, getContract } from "thirdweb";
import { formatAmount } from "@/lib/utils";
import { client } from "@/lib/thirdweb/client";
import { celo } from "thirdweb/chains";
import { oracleService } from "@/lib/services/oracleService";

interface TVLCardProps {
  contract: Contract;
  supportedTokens: string[];
  tokenInfo: Record<string, { symbol: string; decimals: number }>;
}

// Aave Pool Address from README
const AAVE_POOL_ADDRESS = "0x9F7Cf9417D5251C59fE94fB9147feEe1aAd9Cea5";

export default function TVLCard({ 
  contract, 
  supportedTokens, 
  tokenInfo 
}: TVLCardProps) {
  const aavePoolContract = getContract({
    client,
    chain: celo,
    address: AAVE_POOL_ADDRESS,
  });

  return (
    <>
      <h2 className="text-lg font-semibold text-center text-primary mb-3">
        Total Value Locked
      </h2>
      <div className="text-center p-3 bg-green-50 rounded-lg mb-4">
        <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
        <p className="text-xs font-medium mb-1 text-gray-600">Available Liquidity</p>
        <TVLSummary 
          contract={contract}
          aavePoolContract={aavePoolContract}
          supportedTokens={supportedTokens}
          tokenInfo={tokenInfo}
        />
      </div>
      <div className="space-y-1.5">
        {supportedTokens.slice(0, 2).map((token) => (
          <TokenReserveItem
            key={token}
            token={token}
            contract={contract}
            aavePoolContract={aavePoolContract}
            tokenInfo={tokenInfo[token]}
          />
        ))}
      </div>
    </>
  );
}

function TVLSummary({ 
  contract, 
  aavePoolContract, 
  supportedTokens, 
  tokenInfo 
}: {
  contract: Contract;
  aavePoolContract: Contract;
  supportedTokens: string[];
  tokenInfo: Record<string, { symbol: string; decimals: number }>;
}) {
  let totalTVL = 0;
  let allLoaded = true;

  const tokenData = supportedTokens.slice(0, 2).map(token => {
    const { totalSupply, isPending } = QueryReservesAndLiquidity({
      token,
      contract,
      aavePoolContract,
    });

    if (isPending) {
      allLoaded = false;
      return 0;
    }

    if (totalSupply && tokenInfo[token]) {
      const info = tokenInfo[token];
      // Convert to USD using oracle service
      return oracleService.convertToUSD(token, totalSupply.toString(), info.decimals);
    }
    return 0;
  });

  totalTVL = tokenData.reduce((acc, val) => acc + val, 0);

  if (!allLoaded) {
    return <p className="text-lg font-bold text-green-600">Loading...</p>;
  }

  return (
    <p className="text-lg font-bold text-green-600">
      ${totalTVL.toFixed(2)}
    </p>
  );
}

function TokenReserveItem({ 
  token, 
  contract, 
  aavePoolContract, 
  tokenInfo 
}: {
  token: string;
  contract: Contract;
  aavePoolContract: Contract;
  tokenInfo: { symbol: string; decimals: number };
}) {
  const { totalSupply, isPending } = QueryReservesAndLiquidity({
    token,
    contract,
    aavePoolContract,
  });

  if (isPending) {
    return (
      <div className="flex justify-between items-center">
        <span className="font-medium text-xs text-gray-700">{tokenInfo.symbol}</span>
        <span className="text-green-600 font-semibold text-xs">Loading...</span>
      </div>
    );
  }

  if (!totalSupply || totalSupply === BigInt(0)) {
    return null;
  }

  const tokenAmount = formatAmount(totalSupply.toString(), tokenInfo.decimals);
  const usdValue = oracleService.convertToUSD(token, totalSupply.toString(), tokenInfo.decimals);

  return (
    <div className="flex justify-between items-center">
      <span className="font-medium text-xs text-gray-700">{tokenInfo.symbol}</span>
      <div className="text-right">
        <div className="text-green-600 font-semibold text-xs">
          {tokenAmount} {tokenInfo.symbol}
        </div>
        <div className="text-gray-500 text-xs">
          ${usdValue.toFixed(2)}
        </div>
      </div>
    </div>
  );
}