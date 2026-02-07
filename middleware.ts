import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const RAW_CORS_ORIGINS = [
  process.env.CORS_ALLOW_ORIGINS || "",
  process.env.NEXT_PUBLIC_APP_URL || "",
  process.env.NEXT_PUBLIC_ALLOCATE_API_URL || "",
]
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean);

const CORS_ALLOW_ALL = RAW_CORS_ORIGINS.includes("*");
const CORS_ALLOWED_ORIGINS = new Set(
  RAW_CORS_ORIGINS.filter((origin) => origin !== "*").map((origin) => {
    try {
      return new URL(origin).origin;
    } catch {
      return origin;
    }
  })
);

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (CORS_ALLOW_ALL) return origin;
  if (CORS_ALLOWED_ORIGINS.has(origin)) return origin;
  return null;
}

function buildCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With, x-cron-token",
    Vary: "Origin",
  };
}

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
  const isApiRoute = pathname.startsWith("/api");
  const origin = request.headers.get("origin");

  if (isApiRoute) {
    const allowedOrigin = resolveAllowedOrigin(origin);
    if (request.method === "OPTIONS") {
      if (!allowedOrigin) {
        return new NextResponse(null, { status: 403 });
      }
      return new NextResponse(null, {
        status: 204,
        headers: buildCorsHeaders(allowedOrigin),
      });
    }
    const response = NextResponse.next();
    if (allowedOrigin) {
      const headers = buildCorsHeaders(allowedOrigin);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }
    return response;
  }
  
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
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
