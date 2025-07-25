import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      address: string;
      verified: boolean;
      identityData?: any;
    } & DefaultSession["user"];
  }

  interface User {
    address: string;
    verified: boolean;
    identityData?: any;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    address: string;
    verified: boolean;
    identityData?: any;
  }
}