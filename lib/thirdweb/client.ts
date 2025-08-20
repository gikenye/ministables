"use client";
import { createThirdwebClient, getContract } from "thirdweb";
import { celo, scroll } from "thirdweb/chains";
import { MINILEND_ADDRESS } from "../constants";

const clientID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientID) {
  throw new Error('Please add your clientID in environment variables');
}

export const client = createThirdwebClient({
  clientId: clientID,
});

export const contract = getContract({ 
  client,
  chain: celo,
  address: MINILEND_ADDRESS,
});
