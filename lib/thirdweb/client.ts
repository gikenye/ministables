"use client";
import { createThirdwebClient, getContract } from "thirdweb";
import { celo, scroll } from "thirdweb/chains";

const clientID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;


if (!clientID) {
  throw new Error('Please add your clientID in environment variables');
}

export const client = createThirdwebClient({
  clientId: clientID,
});

export function getClientContract(chain: any, address: string) {
  return getContract({
    client,
    chain,
    address,
  })
}
