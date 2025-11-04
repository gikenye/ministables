// Username generator utility
const adjectives = [
  "Happy",
  "Lucky",
  "Bright",
  "Swift",
  "Clever",
  "Bold",
  "Calm",
  "Cool",
  "Epic",
  "Fast",
  "Golden",
  "Heroic",
  "Jolly",
  "Kind",
  "Loyal",
  "Magic",
  "Noble",
  "Quick",
  "Royal",
  "Smart",
  "Stellar",
  "Super",
  "Tidy",
  "Vivid",
  "Wise",
  "Zesty",
  "Brave",
  "Cosmic",
  "Dynamic",
  "Fresh",
  "Gentle",
  "Honest",
  "Iconic",
  "Joyful",
  "Keen",
  "Lively",
  "Mighty",
  "Natural",
  "Optimistic",
  "Peaceful",
  "Radiant",
  "Sincere",
  "Trusty",
  "Unique",
  "Vibrant",
  "Warm",
  "Zen",
];

const nouns = [
  "Tiger",
  "Eagle",
  "Lion",
  "Wolf",
  "Bear",
  "Fox",
  "Shark",
  "Falcon",
  "Panther",
  "Hawk",
  "Dragon",
  "Phoenix",
  "Thunder",
  "Lightning",
  "Storm",
  "Blaze",
  "Frost",
  "Wind",
  "Star",
  "Moon",
  "Sun",
  "Ocean",
  "Mountain",
  "River",
  "Forest",
  "Valley",
  "Peak",
  "Wave",
  "Flame",
  "Crystal",
  "Knight",
  "Warrior",
  "Guardian",
  "Champion",
  "Hero",
  "Legend",
  "Master",
  "Sage",
  "Explorer",
  "Pioneer",
  "Voyager",
  "Ranger",
  "Scout",
  "Hunter",
  "Seeker",
  "Wanderer",
  "Dreamer",
];

/**
 * Generate a random username based on wallet address
 * Uses the wallet address as a seed to ensure consistent usernames per address
 */
export function generateUsernameFromAddress(walletAddress: string): string {
  if (!walletAddress) return "Anonymous User";

  // Create a simple hash from the wallet address
  let hash = 0;
  for (let i = 0; i < walletAddress.length; i++) {
    const char = walletAddress.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value to handle negative hashes
  const positiveHash = Math.abs(hash);

  // Select adjective and noun based on hash
  const adjectiveIndex = positiveHash % adjectives.length;
  const nounIndex = Math.floor(positiveHash / adjectives.length) % nouns.length;

  const adjective = adjectives[adjectiveIndex];
  const noun = nouns[nounIndex];

  // Add a number based on part of the address for uniqueness
  const addressNumber = parseInt(walletAddress.slice(-4), 16) % 100;

  return `${adjective}${noun}${addressNumber}`;
}

/**
 * Get avatar URL based on wallet address using DiceBear API
 */
export function getAvatarUrl(
  walletAddress: string,
  style: "avataaars" | "bottts" | "identicon" | "initials" = "avataaars"
): string {
  if (!walletAddress) return "";

  // Use a reliable avatar service that generates consistent avatars based on seed
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${walletAddress}&backgroundColor=b6e3f4,c0aede,d1d4f9,fecaca,fed7aa,fef3c7`;
}

/**
 * Get member since date from wallet address creation estimate
 * For demo purposes, we'll use a fixed date but this could be enhanced
 */
export function getMemberSinceDate(walletAddress?: string): string {
  // Guard against falsy inputs
  if (!walletAddress) {
    return "";
  }

  // For now, return a consistent date based on the address
  // In a real app, you'd track actual user registration dates
  const hash = walletAddress.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const monthsAgo = (hash % 24) + 1; // 1-24 months ago

  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}
