import { z } from "zod";

export const orderItemSchema = z.object({
  name: z.string().min(1, "שם פריט הוא שדה חובה"),
  qty: z
    .number()
    .int("כמות חייבת להיות מספר שלם")
    .min(1, "כמות חייבת להיות לפחות 1"),
  unit_price: z.number().min(0, "מחיר חייב להיות 0 או יותר").nullable().optional(),
  product_id: z.string().nullable().optional(),
  component_id: z.string().nullable().optional(),
});

export const orderSchema = z.object({
  supplier_id: z.string().min(1, "יש לבחור ספק"),
  priority: z.enum(["דחוף", "גבוה", "בינוני", "נמוך"]).default("בינוני"),
  shipping: z.string().optional(),
  notes: z.string().nullable().optional(),
  etd: z.string().nullable().optional(),
  eta: z.string().nullable().optional(),
  tracking_number: z.string().nullable().optional(),
  items: z.array(orderItemSchema).min(1, "יש להוסיף לפחות פריט אחד"),
});

export type OrderFormData = z.infer<typeof orderSchema>;
export type OrderItemFormData = z.infer<typeof orderItemSchema>;
