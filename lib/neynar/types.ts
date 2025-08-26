export interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  followerCount?: number;
  followingCount?: number;
}

export interface FarcasterCast {
  hash: string;
  author: FarcasterUser;
  text: string;
  timestamp: string;
  reactions?: {
    likes: number;
    recasts: number;
  };
}