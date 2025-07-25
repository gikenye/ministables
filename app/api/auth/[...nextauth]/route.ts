import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  debug: true, // Enable debug mode for troubleshooting
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
          // For now, we'll simplify the verification process
          // Just create a user with the address and mark as verified
          return {
            id: credentials.address,
            address: credentials.address,
            verified: true,
            // We'll add identity data later when we have proper verification
            identityData: {
              name: ["Verified User"],
              nationality: "Unknown",
              gender: "Unknown"
            },
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.address = token.address as string;
        session.user.verified = token.verified as boolean;
        session.user.identityData = token.identityData;
      }
      return session;
    },
  },
  pages: {
    signIn: "/self",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "your-secret-key-for-next-auth-jwt-encryption",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };