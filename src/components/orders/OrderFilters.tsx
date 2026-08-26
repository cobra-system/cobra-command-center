import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority } from "@/contexts/AppContext";

const statusFilterOptions = [
  { value: "all",               label: "הכל" },
  { value: "PENDING",           label: "ממתין" },
  { value: "ORDERED",           label: "הוזמן" },
  { value: "SHIPPED",           label: "נשלח" },
  { value: "ARRIVED_PORT",      label: "הגיע לנמל" },
  { value: "CUSTOMS_CLEARANCE", label: "שחרור מכס" },
  { value: "CANCELLED",         label: "בוטל" },
];

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

interface OrderFiltersProps {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  carrierFilter: string;
  setCarrierFilter: (v: string) => void;
  trackingStateFilter: string;
  setTrackingStateFilter: (v: string) => void;
  originFilter: string;
  setOriginFilter: (v: string) => void;
  orderCounts: Record<string, number>;
}

export function OrderFilters({
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  paymentFilter,
  setPaymentFilter,
  carrierFilter,
  setCarrierFilter,
  trackingStateFilter,
  setTrackingStateFilter,
  originFilter,
  setOriginFilter,
  orderCounts,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
      <div className="flex bg-secondary rounded-lg p-1 overflow-x-auto">
        {statusFilterOptions.map(s => {
          const count = s.value === "all"
            ? Object.values(orderCounts).reduce((a, b) => a + b, 0)
            : (orderCounts[s.value] || 0);
          return (
            <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}>
              {s.label}
              {count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                  statusFilter === s.value ? "bg-primary/20 text-primary" : "bg-muted-foreground/20 text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="עדיפות" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל העדיפויות</SelectItem>
          {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={originFilter} onValueChange={setOriginFilter}>
        <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="מקור" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל המקורות</SelectItem>
          <SelectItem value="local">ישראל</SelectItem>
          <SelectItem value="import">חו״ל</SelectItem>
        </SelectContent>
      </Select>
      <Select value={paymentFilter} onValueChange={setPaymentFilter}>
        <SelectTrigger className="w-[100px] sm:w-[120px]"><SelectValue placeholder="תשלום" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל התשלומים</SelectItem>
          <SelectItem value="שולם">שולם</SelectItem>
          <SelectItem value="שולם חלקי">שולם חלקי</SelectItem>
          <SelectItem value="ממתין">ממתין</SelectItem>
        </SelectContent>
      </Select>
      <Select value={carrierFilter} onValueChange={setCarrierFilter}>
        <SelectTrigger className="w-[120px] sm:w-[140px]"><SelectValue placeholder="חברת שילוח" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל חברות השילוח</SelectItem>
          <SelectItem value="dhl">DHL</SelectItem>
          <SelectItem value="tclog">TCLOG</SelectItem>
          <SelectItem value="other">אחר</SelectItem>
          <SelectItem value="none">לא מוגדר</SelectItem>
        </SelectContent>
      </Select>
      <Select value={trackingStateFilter} onValueChange={setTrackingStateFilter}>
        <SelectTrigger className="w-[130px] sm:w-[150px]"><SelectValue placeholder="מצב מעקב" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל מצבי המעקב</SelectItem>
          <SelectItem value="pre-transit">ממתין לאיסוף</SelectItem>
          <SelectItem value="transit">בדרך</SelectItem>
          <SelectItem value="delivered">נמסר</SelectItem>
          <SelectItem value="failure">תקלה</SelectItem>
          <SelectItem value="unsynced">טרם סונכרן</SelectItem>
          <SelectItem value="error">שגיאת סנכרון</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
