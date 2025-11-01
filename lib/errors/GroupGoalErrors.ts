/**
 * Custom error classes for GroupGoal service
 */

/**
 * Base class for application errors
 */
export class GroupGoalClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupGoalClientError";
  }
}

/**
 * Input validation errors
 */
export class GroupGoalValidationError extends GroupGoalClientError {
  constructor(message: string) {
    super(message);
    this.name = "GroupGoalValidationError";
  }
}

/**
 * Business logic errors
 */
export class GroupGoalBusinessError extends GroupGoalClientError {
  constructor(message: string) {
    super(message);
    this.name = "GroupGoalBusinessError";
  }
}

/**
 * Resource not found errors
 */
export class GroupGoalNotFoundError extends GroupGoalClientError {
  constructor(message: string = "Group goal not found") {
    super(message);
    this.name = "GroupGoalNotFoundError";
  }
}

/**
 * Permission errors
 */
export class GroupGoalPermissionError extends GroupGoalClientError {
  constructor(message: string) {
    super(message);
    this.name = "GroupGoalPermissionError";
  }
}

/**
 * Helper function to check error type
 */
export function isClientError(error: Error): boolean {
  return error instanceof GroupGoalClientError;
}
