export const docStatusFlow = ["ממתין לאישור", "אושר", "נשלח לספק", "בוצע"];

export const docStatusColors: Record<string, string> = {
  "ממתין לאישור": "bg-warning/15 text-warning",
  "אושר": "bg-primary/15 text-primary",
  "נשלח לספק": "bg-accent/15 text-accent",
  "בוצע": "bg-success/15 text-success",
};

export const payStatusColors: Record<string, string> = {
  "ממתין": "bg-warning/15 text-warning",
  "שולם": "bg-success/15 text-success",
  "מאוחר": "bg-destructive/15 text-destructive",
};

export const currencySymbol: Record<string, string> = {
  USD: "$",
  EUR: "€",
  ILS: "₪",
};

export const paymentTypeLabels: Record<string, string> = {
  Full: "מלא",
  Deposit: "מקדמה",
  Balance: "יתרה",
};
