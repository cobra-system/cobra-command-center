import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PrintableLock {
  id: number;
  name: string;
  barcode_value: string;
  sort_order: number;
}

export default function LockControlPrintPage() {
  const [locks, setLocks] = useState<PrintableLock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("warehouse_locks")
      .select("id, name, barcode_value, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setLocks(data as PrintableLock[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white text-black p-6 print-root">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .print-root { padding: 0 !important; }
          .lock-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ברקודי בקרת נעילה — קוברה תל אביב</h1>
          <p className="text-sm text-gray-600 mt-1">
            הדפס/י, חתוך/י לפי הקווים והדבק/י כל ברקוד ליד המנעול המתאים.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
        >
          <Printer className="h-4 w-4" />
          הדפסה
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">טוען...</div>
      ) : (
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-4">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="lock-card border-2 border-dashed border-gray-400 rounded-lg p-4 flex items-center gap-4"
              dir="rtl"
            >
              <div className="bg-white p-2 rounded border border-gray-200 shrink-0">
                <QRCodeSVG value={lock.barcode_value} size={140} level="M" includeMargin={false} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 font-mono">#{lock.id}</div>
                <div className="text-lg font-bold leading-tight">{lock.name}</div>
                <div className="text-xs text-gray-500 mt-2 font-mono break-all">
                  {lock.barcode_value}
                </div>
                <div className="text-[10px] text-gray-400 mt-2">
                  סרוק/י לרישום פתיחה / סגירה
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
