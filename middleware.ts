import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// List of routes that require verification
const PROTECTED_ROUTES = [
  "/withdraw",
  "/borrow",
  "/save",
  "/payback",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the route requires verification
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname.startsWith(route) || pathname === route
  );
  
  if (isProtectedRoute) {
    // Get the session token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    
    // If no token or not verified, redirect to verification page
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