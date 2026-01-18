"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { theme } from "@/lib/theme";

type RequestState = "idle" | "loading" | "success" | "error";

export default function RetryDepositPage() {
  const router = useRouter();
  const [receiptNumber, setReceiptNumber] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = receiptNumber.trim();
    if (!trimmed) return;

    setRequestState("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/onramp/retry-by-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptNumber: trimmed }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        setRequestState("error");
        setMessage(
          data?.error || "We could not retry this deposit. Please try again."
        );
        return;
      }

      setRequestState("success");
      setMessage(
        data?.message || "Retry submitted. We are processing your allocation."
      );
    } catch (error) {
      setRequestState("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <button
          onClick={() => router.push("/")}
          className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white"
        >
          <ArrowLeft size={14} />
          Back to app
        </button>

        <div
          className="rounded-[2.5rem] p-6 text-white shadow-2xl border border-white/5 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(to bottom right, ${theme.colors.cardGradientFrom}, ${theme.colors.cardGradientTo})`,
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">
                Retry Deposit
              </p>
              <h1 className="text-3xl font-bold mt-2 tracking-tight">
                Funds not yet arrived ?
              </h1>
              <p className="text-sm text-white/70 mt-2 max-w-md">
                Enter your MPESA receipt code. We will retry your deposit.
              </p>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 border border-white/10">
              <RotateCcw size={20} className="text-white" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <label
                htmlFor="receipt"
                className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-semibold"
              >
                MPESA Receipt Code
              </label>
              <input
                id="receipt"
                value={receiptNumber}
                onChange={(event) => setReceiptNumber(event.target.value)}
                placeholder="e.g. UAI3Y4B86T"
                className="mt-2 w-full bg-transparent text-lg font-semibold text-white placeholder:text-white/30 outline-none"
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={requestState === "loading"}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black rounded-xl text-sm font-bold transition active:scale-95 shadow-lg disabled:opacity-60"
            >
              {requestState === "loading" ? "Retrying..." : "Retry Deposit"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                requestState === "success"
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-400/40 bg-rose-400/10 text-rose-100"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
