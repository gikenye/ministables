"use client";

import { useState, useEffect } from "react";
import { Copy, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const SETTLEMENT_ADDRESS = "0x8005ee53E57aB11E11eAA4EFe07Ee3835Dc02F98";

const COUNTRIES = [
  { code: "KES", name: "Kenya", flag: "🇰🇪", networks: ["Safaricom", "Airtel"] },
  { code: "NGN", name: "Nigeria", flag: "🇳🇬", networks: [] },
  { code: "GHS", name: "Ghana", flag: "🇬🇭", networks: ["MTN", "AirtelTigo"] },
  { code: "UGX", name: "Uganda", flag: "🇺🇬", networks: ["MTN", "Airtel Money"] },
  { code: "CDF", name: "DR Congo", flag: "🇨🇩", networks: ["Orange Money", "Airtel Money"] },
  { code: "MWK", name: "Malawi", flag: "🇲🇼", networks: ["Airtel Money", "TNM"] },
  { code: "ETB", name: "Ethiopia", flag: "🇪🇹", networks: ["Telebirr", "CBE Birr"] },
];

const STABLECOINS = [
  { symbol: "cUSD", icon: "💵", color: "bg-green-500" },
  { symbol: "USDT", icon: "💎", color: "bg-teal-500" },
  { symbol: "USDC", icon: "💰", color: "bg-orange-500" },
];

export default function PayPage() {
   const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
   const [selectedCoin, setSelectedCoin] = useState(STABLECOINS[0]);
   const [exchangeRate, setExchangeRate] = useState<number | null>(null);
   const [txHash, setTxHash] = useState("");
   const [shortcode, setShortcode] = useState("");
   const [amount, setAmount] = useState("");
   const [mobileNetwork, setMobileNetwork] = useState("");
   const [paymentMethod, setPaymentMethod] = useState("Mobile Money");
   const [paybillNumber, setPaybillNumber] = useState("");
   const [accountReference, setAccountReference] = useState("");
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [successMessage, setSuccessMessage] = useState<string | null>(null);
   const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchExchangeRate();
  }, [selectedCountry]);

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch("/api/exchange-rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_code: selectedCountry.code }),
      });
      const data = await res.json();
      if (data.data?.selling_rate) {
        setExchangeRate(data.data.buying_rate);
      } else {
        console.error("Exchange rate API returned invalid data");
        setExchangeRate(null);
      }
    } catch (error) {
      console.error("Failed to fetch exchange rate:", error);
      setExchangeRate(null);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(SETTLEMENT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePay = async () => {
    if (!txHash || !amount) {
      setError("Please fill transaction hash and amount");
      return;
    }

    if (!exchangeRate) {
      setError("Exchange rate not available. Please try again later.");
      return;
    }

    if (selectedCountry.code === "KES") {
      if (paymentMethod === "Mobile Money") {
        if (!shortcode || !mobileNetwork) {
          setError("Please fill phone number and mobile network");
          return;
        }
      } else if (paymentMethod === "PAYBILL") {
        if (!paybillNumber) {
          setError("Please fill paybill number");
          return;
        }
      }
    } else {
      if (!shortcode || !mobileNetwork) {
        setError("Please fill all required fields");
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const fiatAmount = (parseFloat(amount) * exchangeRate).toFixed(2);

      const payload: any = {
        transaction_hash: txHash,
        amount: fiatAmount,
        fee: "10",
        chain: "CELO",
        callback_url: `${window.location.origin}/api/callback`,
      };

      if (selectedCountry.code === "KES") {
        if (paymentMethod === "PAYBILL") {
          payload.type = "PAYBILL";
          payload.shortcode = paybillNumber;
          if (accountReference) {
            payload.account_number = accountReference;
          }
        } else {
          payload.type = "MOBILE";
          payload.mobile_network = mobileNetwork;
          payload.shortcode = shortcode;
        }
      } else if (selectedCountry.code === "NGN") {
        payload.type = "BANK";
        payload.account_number = shortcode;
        payload.bank_code = mobileNetwork;
      } else {
        payload.type = "MOBILE";
        payload.mobile_network = mobileNetwork;
        payload.shortcode = shortcode;
      }

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.code === 200) {
        setSuccessMessage(data.message || "Payment processed successfully");
        setTxHash("");
        setShortcode("");
        setAmount("");
        setPaybillNumber("");
        setAccountReference("");
      } else {
        setError(data.message || `Error: ${data.code}`);
      }
    } catch (error: any) {
      setError(error.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const localAmount = exchangeRate && amount ? (parseFloat(amount) * exchangeRate).toFixed(2) : "0.00";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f5e9] to-white">
      <div className="bg-gradient-to-r from-[#1b5e20] to-[#2e7d32] p-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-yellow-300 mb-1">Pay with Stablecoins</h1>
          <p className="text-sm text-white/80">#cUSD, #USDT & #USDC</p>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
              ×
            </button>
          </div>
        )}

        <div className="bg-white border-2 border-green-200 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Step 1: Send tokens to settlement address</h2>
          <div className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
            <code className="text-xs text-gray-800 break-all">{SETTLEMENT_ADDRESS}</code>
            <button onClick={copyAddress} className="ml-2 p-2 hover:bg-gray-200 rounded">
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
            </button>
          </div>
        </div>
        <div className="bg-white border-2 border-green-200 rounded-xl p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Step 2: Enter transaction details</h2>
          <div className="space-y-4">



          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Which asset did you send?</label>
            <div className="flex gap-2">
              {STABLECOINS.map((coin) => (
                <button
                  key={coin.symbol}
                  onClick={() => setSelectedCoin(coin)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    selectedCoin.symbol === coin.symbol
                      ? "border-green-500 bg-green-50"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  <div className="text-2xl mb-1">{coin.icon}</div>
                  <div className="text-xs font-medium">{coin.symbol}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">How much did you send?</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            {exchangeRate && amount && (
              <p className="text-xs text-gray-500 mt-1">≈ {localAmount} {selectedCountry.code}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Transaction Hash</label>
            <input
              placeholder="0x..."
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Receive in</label>
            <select
              value={selectedCountry.code}
              onChange={(e) => {
                setSelectedCountry(COUNTRIES.find(c => c.code === e.target.value)!);
                setPaymentMethod("Mobile Money"); // Reset to default when country changes
              }}
              className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCountry.code === "KES" && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="Mobile Money"
                    checked={paymentMethod === "Mobile Money"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-2"
                  />
                  Mobile Money
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="PAYBILL"
                    checked={paymentMethod === "PAYBILL"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-2"
                  />
                  PAYBILL
                </label>
              </div>
            </div>
          )}

          {selectedCountry.code === "KES" && paymentMethod === "Mobile Money" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Mobile Network</label>
                <select
                  value={mobileNetwork}
                  onChange={(e) => setMobileNetwork(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="">Select network</option>
                  {selectedCountry.networks.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Phone Number</label>
                <input
                  placeholder="0712345678"
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {selectedCountry.code === "KES" && paymentMethod === "PAYBILL" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Paybill Number</label>
                <input
                  placeholder="123456"
                  value={paybillNumber}
                  onChange={(e) => setPaybillNumber(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Account Reference (Optional)</label>
                <input
                  placeholder="Account reference"
                  value={accountReference}
                  onChange={(e) => setAccountReference(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {selectedCountry.code !== "KES" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {selectedCountry.code === "NGN" ? "Bank Code" : "Mobile Network"}
                </label>
                <select
                  value={mobileNetwork}
                  onChange={(e) => setMobileNetwork(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  <option value="">Select network</option>
                  {selectedCountry.networks.map((network) => (
                    <option key={network} value={network}>
                      {network}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  {selectedCountry.code === "NGN" ? "Account Number" : "Phone Number / Shortcode"}
                </label>
                <input
                  placeholder={selectedCountry.code === "NGN" ? "1234567890" : "0712345678"}
                  value={shortcode}
                  onChange={(e) => setShortcode(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      </div>

        <button
          onClick={handlePay}
          disabled={loading || !txHash || !amount || (selectedCountry.code === "KES" && paymentMethod === "Mobile Money" && (!shortcode || !mobileNetwork)) || (selectedCountry.code === "KES" && paymentMethod === "PAYBILL" && !paybillNumber) || (selectedCountry.code !== "KES" && (!shortcode || !mobileNetwork))}
          className="w-full h-14 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Payment"}
        </button>
      </main>
    </div>
  );
}
