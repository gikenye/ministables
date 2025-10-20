"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// Component to handle search params
function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const error = searchParams.get("error");

    // Map error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      CredentialsSignin:
        "Failed to sign in with your credentials. Please try again.",
      SessionRequired: "You need to be signed in to access this page.",
      Default: "An authentication error occurred. Please try again.",
    };

    setErrorMessage(errorMessages[error || ""] || errorMessages["Default"]);

    // Redirect back to verification page after 5 seconds
    const timer = setTimeout(() => {
      router.push("/self");
    }, 5000);

    return () => clearTimeout(timer);
  }, [searchParams, router]);

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-destructive"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Authentication Error
      </h2>
      <p className="text-muted-foreground mb-6">{errorMessage}</p>
      <div className="flex flex-col space-y-3">
        <Link
          href="/self"
          className="bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors"
        >
          Try Again
        </Link>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Return to Home
        </Link>
      </div>
      <p className="text-muted-foreground text-xs mt-6">
        You will be redirected to the verification page in 5 seconds...
      </p>
    </div>
  );
}

// Fallback component while loading
function ErrorFallback() {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Loading...</h2>
      <p className="text-muted-foreground mb-6">
        Please wait while we process your request.
      </p>
    </div>
  );
}

export default function AuthError() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-card p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <Suspense fallback={<ErrorFallback />}>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
