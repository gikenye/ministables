import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useActiveAccount } from "thirdweb/react";
import { User } from "@/lib/models/user";

interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch user data from the API
 */
export function useUser(): UseUserResult {
  const { data: session } = useSession();
  const account = useActiveAccount();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = account?.address || session?.user?.address;

  const fetchUser = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users?userId=${userId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // User not found, this might be a new user
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const userData = await response.json();
      setUser(userData);
    } catch (err) {
      console.error("Error fetching user:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [userId]);

  return {
    user,
    loading,
    error,
    refetch: fetchUser,
  };
}
