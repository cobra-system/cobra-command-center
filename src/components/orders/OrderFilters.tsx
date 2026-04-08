import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Priority } from "@/contexts/AppContext";

const statusFilterOptions = [
  { value: "all", label: "הכל" },
  { value: "PENDING", label: "ממתין" },
  { value: "ORDERED", label: "הוזמן" },
  { value: "SHIPPED", label: "נשלח" },
];

const priorities: { value: Priority; label: string }[] = [
  { value: "דחוף", label: "דחוף" },
  { value: "גבוה", label: "גבוה" },
  { value: "בינוני", label: "בינוני" },
  { value: "נמוך", label: "נמוך" },
];

interface OrderFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  workflowFilter: string;
  setWorkflowFilter: (v: string) => void;
}

export function OrderFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  paymentFilter,
  setPaymentFilter,
  workflowFilter,
  setWorkflowFilter,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
      <div className="relative flex-1 min-w-[150px] max-w-sm order-first w-full sm:w-auto sm:order-none">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="חיפוש לפי מוצר או ספק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>
      <div className="flex bg-secondary rounded-lg p-1 overflow-x-auto">
        {statusFilterOptions.map(s => (
          <button key={s.value} onClick={() => setStatusFilter(s.value)} className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
            statusFilter === s.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}>{s.label}</button>
        ))}
      </div>
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="עדיפות" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל העדיפויות</SelectItem>
          {priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={paymentFilter} onValueChange={setPaymentFilter}>
        <SelectTrigger className="w-[100px] sm:w-[120px]"><SelectValue placeholder="תשלום" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל התשלומים</SelectItem>
          <SelectItem value="שולם">שולם</SelectItem>
          <SelectItem value="שולם פיקדון">שולם פיקדון</SelectItem>
          <SelectItem value="ממתין">ממתין</SelectItem>
        </SelectContent>
      </Select>
      <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
        <SelectTrigger className="w-[110px] sm:w-[130px]"><SelectValue placeholder="תהליך" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">כל התהליכים</SelectItem>
          <SelectItem value="active">תהליך פעיל</SelectItem>
          <SelectItem value="completed">ארכיון (הושלמו)</SelectItem>
          <SelectItem value="none">ללא תהליך</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
