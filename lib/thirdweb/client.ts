"use client";
import { createThirdwebClient } from "thirdweb";

const clientID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientID) {
  throw new Error('Please add your clientID in environment variables');
}

export const client = createThirdwebClient({
  clientId: clientID,
});
