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

/** Labels for purchase_documents.document_subtype (see the add_document_subtype migration). */
export const docSubtypeLabels: Record<string, string> = {
  PI: "PI",
  PO: "PO",
  SWIFT: "SWIFT",
  BL: "שטר מטען",
  PACKING_LIST: "רשימת אריזה",
  INVOICE: "חשבונית",
  COA: "תעודת איכות",
  CUSTOMS: "מכס",
  // Import dossier document kinds — see src/lib/importFiles.ts
  COMMERCIAL_INVOICE: "חשבונית מסחרית",
  DECLARATION: "רשימון יבוא",
  FREIGHT_INVOICE: "חשבונית הובלה",
  TERMINAL_INVOICE: "חשבונית מסוף",
  FORWARDER_INVOICE: "חשבונית משלח מרכזת",
  INSURANCE: "ביטוח",
  CERTIFICATE_OF_ORIGIN: "תעודת מקור",
  OTHER: "אחר",
};

export const docSubtypeColors: Record<string, string> = {
  SWIFT: "bg-success/15 text-success",
  BL: "bg-accent/15 text-accent",
  PACKING_LIST: "bg-muted text-muted-foreground",
  INVOICE: "bg-primary/15 text-primary",
  COA: "bg-warning/15 text-warning",
  CUSTOMS: "bg-warning/15 text-warning",
  COMMERCIAL_INVOICE: "bg-primary/15 text-primary",
  DECLARATION: "bg-warning/15 text-warning",
  FREIGHT_INVOICE: "bg-accent/15 text-accent",
  TERMINAL_INVOICE: "bg-accent/15 text-accent",
  FORWARDER_INVOICE: "bg-primary/15 text-primary",
  INSURANCE: "bg-muted text-muted-foreground",
  CERTIFICATE_OF_ORIGIN: "bg-muted text-muted-foreground",
  OTHER: "bg-muted text-muted-foreground",
};
