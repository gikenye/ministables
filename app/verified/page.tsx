"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function VerifiedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page after 2 seconds
    const timer = setTimeout(() => {
      router.push("/");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-primary">Identity Verified!</h1>
        </div>

        <div className="flex justify-center">
          <Image
            src="https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3d2NnNDg0cmNvc3VnMW82M2J1bG1vaHoxMTd3cXhqYjd6cmE5cDk5eSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/xREmhz5xoZyfbIr8EI/giphy.gif"
            alt="Verification successful"
            width={200}
            height={200}
            priority
            unoptimized={true}
          />
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600 text-sm">
            Age & Identity Verified
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Redirecting to Minilend...
          </p>
        </div>
      </div>
    </div>
  );
}
