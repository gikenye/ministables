"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  BASENAME_RESOLVER_ADDRESS,
  resolveL2Name,
} from "thirdweb/extensions/ens";
import { base } from "thirdweb/chains";
import { getProfiles, getUserEmail, type Profile } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";

type LinkedAccountDetails = Profile["details"] & {
  givenName?: string;
  picture?: string;
  name?: string;
};

export function WelcomeHeader() {
  const account = useActiveAccount();
  const [greeting, setGreeting] = useState("good morning");
  const [profileName, setProfileName] = useState("");
  const [emailNickname, setEmailNickname] = useState("");
  const [basename, setBasename] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("good morning");
    else if (hour < 18) setGreeting("good afternoon");
    else setGreeting("good evening");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const extractProfileDetails = (profiles: Profile[]) => {
      const getDetails = (profile: Profile) =>
        profile.details as LinkedAccountDetails;
      const withGivenName = profiles.find((profile) => {
        const details = getDetails(profile);
        return typeof details.givenName === "string" && details.givenName.trim();
      });
      if (withGivenName) return getDetails(withGivenName);

      const withName = profiles.find((profile) => {
        const details = getDetails(profile);
        return typeof details.name === "string" && details.name.trim();
      });
      if (withName) return getDetails(withName);

      const withEmail = profiles.find((profile) => {
        const details = getDetails(profile);
        return typeof details.email === "string" && details.email.trim();
      });
      return withEmail ? getDetails(withEmail) : null;
    };

    const fetchUser = async () => {
      setLoading(true);

      try {
        const profiles = await getProfiles({ client });
        const details = extractProfileDetails(profiles);
        const givenName = details?.givenName?.trim();
        const name = details?.name?.trim();
        const email = details?.email?.trim();
        const picture = details?.picture?.trim();
        const nextProfileName = givenName || name || "";
        const nextEmailNickname = email ? email.split("@")[0] : "";
        let fallbackNickname = "";

        if (!nextProfileName && !nextEmailNickname) {
          const fallbackEmail = await getUserEmail({ client });
          fallbackNickname = fallbackEmail ? fallbackEmail.split("@")[0] : "";
        }

        if (!cancelled) {
          setProfileName(nextProfileName);
          setEmailNickname(nextEmailNickname || fallbackNickname);

          if (picture) {
            setUserAvatarUrl(picture);
            setAvatarError(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  useEffect(() => {
    let cancelled = false;
    const address = account?.address;

    if (!address) {
      setBasename(null);
      return;
    }

    setBasename(null);

    const resolveBasename = async () => {
      try {
        const name = await resolveL2Name({
          client,
          address,
          resolverAddress: BASENAME_RESOLVER_ADDRESS,
          resolverChain: base,
        });

        if (!cancelled) {
          setBasename(name ?? null);
        }
      } catch (error) {
        console.error("Error resolving basename:", error);
        if (!cancelled) {
          setBasename(null);
        }
      }
    };

    resolveBasename();

    return () => {
      cancelled = true;
    };
  }, [account?.address]);

  const displayName = profileName || basename || emailNickname;

  return (
    <div className="flex items-center w-full mb-3 animate-in fade-in slide-in-from-top-1 duration-500">
      <div className="flex items-center bg-[#1e2923]/80 backdrop-blur-md rounded-full p-0.5 pr-3 border border-[#2d3a33] min-w-0 shadow-sm">
        {/* Smaller Avatar: w-7 h-7 */}
        <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[#4ade80] flex items-center justify-center text-[#121a16] font-bold text-sm shadow-inner overflow-hidden">
          {userAvatarUrl && !avatarError ? (
            <img
              src={userAvatarUrl}
              alt={displayName ? `${displayName} avatar` : "User avatar"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
            />
          ) : (
            displayName?.charAt(0).toUpperCase() || "U"
          )}
        </div>
        
        {/* Smaller Text Area: text-xs */}
        <div className="ml-2 truncate">
          <p className="text-white text-xs font-medium truncate">
            {greeting} 
            <span className="text-[#4ade80] ml-1">
               {loading ? "..." : (displayName || "user")}!
            </span>
            <span className="ml-1">👋</span>
          </p>
        </div>
      </div>
    </div>
  );
}
