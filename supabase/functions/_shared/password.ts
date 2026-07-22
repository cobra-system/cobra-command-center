/**
 * Password validation utilities.
 */

const MIN_LENGTH = 10;

/**
 * Validates password strength.
 * Requires: minimum 10 characters, at least one uppercase, one lowercase, one digit, one special char.
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < MIN_LENGTH) {
    return { valid: false, error: `הסיסמה חייבת להכיל לפחות ${MIN_LENGTH} תווים` };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "הסיסמה חייבת להכיל לפחות ספרה אחת" };
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, error: "הסיסמה חייבת להכיל לפחות תו מיוחד אחד (!@#$%^&*)" };
  }

  return { valid: true };
}
