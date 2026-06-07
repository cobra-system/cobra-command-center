import { z } from "zod";

const nonNegativeNumber = z.number().min(0, "הערך חייב להיות 0 או יותר");
const optionalNonNegative = z
  .number()
  .min(0, "הערך חייב להיות 0 או יותר")
  .nullable()
  .optional();

export const productSchema = z.object({
  name: z.string().min(1, "שם מוצר הוא שדה חובה"),
  sku: z.string().min(1, "מק״ט הוא שדה חובה"),
  category: z.string().optional(),
  division: z.string().nullable().optional(),
  product_type: z.string().optional(),
  supplier: z.string().nullable().optional(),
  shipping: z.string().nullable().optional(),
  purchase_price: optionalNonNegative,
  sale_price: optionalNonNegative,
  monthly_sales: optionalNonNegative,
  monthly_order: optionalNonNegative,
  stock_qty: nonNegativeNumber.default(0),
  incoming_qty: nonNegativeNumber.default(0),
  reorder_point: optionalNonNegative,
  lead_time_days: z
    .number()
    .int("זמן אספקה חייב להיות מספר שלם")
    .min(1, "זמן אספקה חייב להיות לפחות יום אחד")
    .max(365, "זמן אספקה לא יכול לעלות על 365 ימים")
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  end_product_url: z.string().nullable().optional(),
});

export const productComponentSchema = z.object({
  name: z.string().min(1, "שם רכיב הוא שדה חובה"),
  sku: z.string().nullable().optional(),
  supplier: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  stock_qty: optionalNonNegative,
  price: optionalNonNegative,
  notes: z.string().nullable().optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;
export type ProductComponentFormData = z.infer<typeof productComponentSchema>;
