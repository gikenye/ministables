export interface SelfVerification {
  walletAddress: string;
  sessionId: string;
  attestationId: string;
  userIdentifier: string;
  nullifier: string;
  nationality?: string;
  olderThan?: number;
  ofac: boolean[];
  forbiddenCountriesListPacked: string[];
  userData?: string;
  verifiedAt: Date;
  chainId: number;
  endpoint: string;
  createdAt: Date;
  updatedAt: Date;
}
