import { isValidAddress } from "../utils";

export class RequestValidator {
  private static validateAddress(paramName: string, value: string | null): { valid: boolean; error?: string } {
    if (!value) {
      return { valid: false, error: `Missing required parameter: ${paramName}` };
    }
    if (!isValidAddress(value)) {
      return { valid: false, error: `Invalid ${paramName}` };
    }
    return { valid: true };
  }

  static validateUserAddress(userAddress: string | null): { valid: boolean; error?: string } {
    return this.validateAddress("userAddress", userAddress);
  }

  static validateVaultAddress(vaultAddress: string | null): { valid: boolean; error?: string } {
    return this.validateAddress("vaultAddress", vaultAddress);
  }
}
