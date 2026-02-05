
function resolveAllocateBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_ALLOCATE_API_URL || "";
  }

  return (
    process.env.ALLOCATE_API_URL ||
    process.env.NEXT_PUBLIC_ALLOCATE_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  );
}

export async function getUserPositions(address: string, chainId?: number) {
  const baseUrl = resolveAllocateBaseUrl();
  const params = new URLSearchParams({ userAddress: address });
  if (chainId) params.set("chainId", String(chainId));
  const url = baseUrl
    ? `${baseUrl}/api/user-positions?${params}`
    : `/api/user-positions?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch user positions: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request to allocate API timed out");
    }
    throw error;
  }
}
