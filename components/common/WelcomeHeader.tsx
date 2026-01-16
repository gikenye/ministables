"use client";

import { useEffect, useState } from "react";
import { getUserEmail } from "thirdweb/wallets/in-app";
import { client } from "@/lib/thirdweb/client";

export function WelcomeHeader() {
  const [greeting, setGreeting] = useState("good morning");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("good morning");
    else if (hour < 18) setGreeting("good afternoon");
    else setGreeting("good evening");

    const fetchUser = async () => {
      try {
        const email = await getUserEmail({ client });
        if (email) {
          const truncated = email.split("@")[0];
          setUserName(truncated);
        }
      } catch (error) {
        console.error("Error fetching email:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <div className="flex items-center w-full mb-3 animate-in fade-in slide-in-from-top-1 duration-500">
      <div className="flex items-center bg-[#1e2923]/80 backdrop-blur-md rounded-full p-0.5 pr-3 border border-[#2d3a33] min-w-0 shadow-sm">
        {/* Smaller Avatar: w-7 h-7 */}
        <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[#4ade80] flex items-center justify-center text-[#121a16] font-bold text-sm shadow-inner">
          {userName ? userName.charAt(0).toUpperCase() : "U"}
        </div>
        
        {/* Smaller Text Area: text-xs */}
        <div className="ml-2 truncate">
          <p className="text-white text-xs font-medium truncate">
            {greeting} 
            <span className="text-[#4ade80] ml-1 lowercase">
               {loading ? "..." : (userName || "user")}!
            </span>
            <span className="ml-1">👋</span>
          </p>
        </div>
      </div>
    </div>
  );
}