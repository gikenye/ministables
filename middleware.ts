import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require wallet connection (but not necessarily verification)
const WALLET_REQUIRED_ROUTES = [
  "/dashboard",
];

// Routes that require full verification for transactions
const VERIFICATION_REQUIRED_ROUTES = [
  "/api/transactions",
  "/api/borrow",
  "/api/deposit",
  "/api/withdraw",
  "/api/repay",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if route requires verification for transactions
  const requiresVerification = VERIFICATION_REQUIRED_ROUTES.some(route => 
    pathname.startsWith(route)
  );
  
  if (requiresVerification) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    // For transaction routes, require verification
    if (!token || !token.verified) {
      const url = new URL("/self", request.url);
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};