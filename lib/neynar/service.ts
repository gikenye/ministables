import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
import { FeedType } from "@neynar/nodejs-sdk/build/api";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY!,
});

const client = new NeynarAPIClient(config);

export async function fetchUserFeed(fid: number) {
  return await client.fetchFeed({
    feedType: FeedType.Following,
    fid,
    limit: 50,
  });
}

export async function fetchUser(fid: number) {
  return await client.fetchBulkUsers({ fids: [fid] });
}