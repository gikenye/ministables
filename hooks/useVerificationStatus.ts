import { useState, useEffect, useCallback } from "react";
import { useActiveAccount } from "thirdweb/react";

interface VerificationStatus {
  isVerified: boolean;
  nationality?: string;
  olderThan?: number;
  loading: boolean;
  error?: string;
  refetch: () => Promise<void>;
}

export function useVerificationStatus(): VerificationStatus {
  const [verificationStatus, setVerificationStatus] = useState<
    Omit<VerificationStatus, "refetch">
  >({
    isVerified: false,
    loading: false,
  });

  const account = useActiveAccount();
  const address = account?.address;

  const fetchVerificationStatus = useCallback(async () => {
    if (!address) {
      setVerificationStatus({
        isVerified: false,
        loading: false,
      });
      return;
    }

    try {
      setVerificationStatus((prev) => ({
        ...prev,
        loading: true,
        error: undefined,
      }));

      const response = await fetch(`/api/self/verify?userAddress=${address}`);

      if (response.ok) {
        const data = await response.json();
        setVerificationStatus({
          isVerified: true,
          nationality: data.nationality,
          olderThan: data.olderThan,
          loading: false,
        });
      } else {
        // 404 means no verification found
        setVerificationStatus({
          isVerified: false,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching verification status:", error);
      setVerificationStatus({
        isVerified: false,
        loading: false,
        error: "Failed to fetch verification status",
      });
    }
  }, [address]);

  useEffect(() => {
    fetchVerificationStatus();
  }, [fetchVerificationStatus]);

  return {
    ...verificationStatus,
    refetch: fetchVerificationStatus,
  };
}
