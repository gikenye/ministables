import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { UserService } from "@/lib/services/userService";

export const authOptions: NextAuthOptions = {
  debug: false,
  providers: [
    CredentialsProvider({
      id: "self-protocol",
      name: "Self Protocol",
      credentials: {
        address: { label: "Wallet Address", type: "text" },
        verificationData: { label: "Verification Data", type: "text" },
      },
      async authorize(credentials) {
        console.log("Authorize function called with credentials:", credentials);
        
        if (!credentials?.address) {
          console.error("No address provided");
          return null;
        }

        try {
          const userData = {
            address: credentials.address,
            verified: !!credentials.verificationData, // Only verified if verification data provided
            identityData: credentials.verificationData ? JSON.parse(credentials.verificationData) : null,
          };

          let user;
          try {
            user = await UserService.upsertUser(credentials.address, userData);
          } catch (dbError) {
            console.warn("Database error, proceeding with session-only auth:", dbError);
            // Fallback to session-only authentication
            user = {
              address: credentials.address,
              verified: !!credentials.verificationData,
              identityData: credentials.verificationData ? JSON.parse(credentials.verificationData) : null,
              username: undefined
            };
          }
          
          return {
            id: user.address,
            address: user.address,
            verified: user.verified,
            identityData: user.identityData,
            username: user.username
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.address = user.address;
        token.verified = user.verified;
        token.identityData = user.identityData;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.address = token.address as string;
        session.user.verified = token.verified as boolean;
        session.user.identityData = token.identityData;
        session.user.username = token.username as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Redirect to home instead of forcing verification
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };