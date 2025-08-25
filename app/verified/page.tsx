"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function VerifiedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page after 3 seconds
    const timer = setTimeout(() => {
      router.push("/");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-600 mb-2">
            ✅ Verification Successful!
          </h1>
          <p className="text-gray-600 text-lg">
            Your identity has been verified
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Image
            src="https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUyNzd0ZmQ5d2ZmcTE1dHNidzgwYXJnbDBlZHh2dG9xMDkyMGl0ZG0yciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/IRFQYGCokErS0/giphy.gif"
            alt="Verification successful animation"
            width={250}
            height={250}
            priority
            unoptimized={true}
            className="rounded-lg shadow-lg"
          />
        </div>

        <div className="text-center">
          <p className="text-gray-500 text-sm">
            Redirecting to home page in a moment...
          </p>
        </div>
      </div>
    </div>
  );
}
