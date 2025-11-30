const ALLOCATE_API_URL = process.env.ALLOCATE_API_URL;

if (!ALLOCATE_API_URL) {
  throw new Error('ALLOCATE_API_URL environment variable is required');
}

export async function getUserPositions(address: string) {
  const url = `${ALLOCATE_API_URL}/api/user-positions?userAddress=${address}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch user positions: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request to allocate API timed out');
    }
    throw error;
  }
}