// import { useReadContract } from "thirdweb/react";
// import { prepareContractCall } from "thirdweb";
// import { useSendTransaction } from "thirdweb/react";
// import contract from "@/client " ;
// import { client } from "./client";


// export  function SaveMoney() {
//   const { data, isPending } = useReadContract({
//     contract,
//     method:
//       "function userDeposits(address, address, uint256) view returns (uint256 amount, uint256 lockEnd)",
//     params: [],
//   });
// }


// export  function SupplyLiquidity() {
//   const { mutate: sendTransaction } = useSendTransaction();

//   const onClick = () => {
//     const transaction = prepareContractCall({
//       contract,
//       method:
//         "function supply(address token, uint256 amount, uint256 lockPeriod)",
//       params: [token, amount, lockPeriod],
//     });
//     sendTransaction(transaction);
//   };
// }
