import { ObjectId } from 'mongodb';

// Define the user data structure
export interface User {
  _id?: ObjectId;
  address: string;          // Wallet address (primary identifier)
  username?: string;        // Optional username for personalization
  verified: boolean;        // Verification status
  verificationData?: {      // Data from zkSelf verification
    attestationId?: string;
    credentialSubject?: any;
    verificationOptions?: any;
    verifiedAt?: Date;
  };
  identityData?: {          // Identity data from verification
    name?: string[];
    nationality?: string;
    gender?: string;
    minimumAge?: number;
  };
  createdAt: Date;          // When the user was first created
  updatedAt: Date;          // When the user was last updated
}

// Define a type for user updates
export type UserUpdate = Partial<Omit<User, '_id' | 'address' | 'createdAt'>>;

// Define a type for creating a new user
export type NewUser = Omit<User, '_id'>;