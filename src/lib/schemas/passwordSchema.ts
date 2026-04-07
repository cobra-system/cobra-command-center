import { z } from "zod";

const MIN_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(MIN_LENGTH, `הסיסמה חייבת להכיל לפחות ${MIN_LENGTH} תווים`)
  .refine((val) => /[A-Z]/.test(val), "הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית")
  .refine((val) => /[a-z]/.test(val), "הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית")
  .refine((val) => /[0-9]/.test(val), "הסיסמה חייבת להכיל לפחות ספרה אחת")
  .refine(
    (val) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val),
    "הסיסמה חייבת להכיל לפחות תו מיוחד אחד (!@#$%^&*)"
  );

export const passwordChangeSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmPassword"],
  });

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
