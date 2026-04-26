import { z } from "zod";

export const supplierSchema = z.object({
  company: z.string().min(1, "שם חברה הוא שדה חובה"),
  contact_name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  email: z.string().email("כתובת אימייל לא תקינה").nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  payment_terms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  supplier_number: z.string().nullable().optional(),
});

export const supplierContactSchema = z.object({
  name: z.string().min(1, "שם איש קשר הוא שדה חובה"),
  role: z.string().nullable().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").nullable().optional(),
  phone: z.string().nullable().optional(),
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
export type SupplierContactFormData = z.infer<typeof supplierContactSchema>;
