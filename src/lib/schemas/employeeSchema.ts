import { z } from "zod";
import { passwordSchema } from "./passwordSchema";

export const employeeCreateSchema = z.object({
  name: z.string().min(1, "שם הוא שדה חובה"),
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: passwordSchema,
  role_definition_id: z.string().optional(),
});

export const employeeUpdateSchema = z.object({
  name: z.string().min(1, "שם הוא שדה חובה"),
  password: z
    .string()
    .refine(
      (val) => val === "" || val.length >= 10,
      "הסיסמה חייבת להכיל לפחות 10 תווים"
    )
    .refine(
      (val) => val === "" || /[A-Z]/.test(val),
      "הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית"
    )
    .refine(
      (val) => val === "" || /[a-z]/.test(val),
      "הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית"
    )
    .refine(
      (val) => val === "" || /[0-9]/.test(val),
      "הסיסמה חייבת להכיל לפחות ספרה אחת"
    )
    .refine(
      (val) => val === "" || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val),
      "הסיסמה חייבת להכיל לפחות תו מיוחד אחד (!@#$%^&*)"
    ),
  role_definition_id: z.string().optional(),
});

export type EmployeeCreateData = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateData = z.infer<typeof employeeUpdateSchema>;
