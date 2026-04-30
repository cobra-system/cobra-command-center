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
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          .print-root { padding: 0 !important; }
          .lock-card { break-inside: avoid; page-break-inside: avoid; }
          html, body { background: white !important; }
        }
      `}</style>

      <div className="no-print max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ברקודי בקרת נעילה — קוברה תל אביב</h1>
          <p className="text-sm text-gray-600 mt-1">
            הדפס/י, חתוך/י לפי הקווים והדבק/י כל ברקוד ליד המנעול המתאים. הומלץ להדפיס על מדבקה עמידה למים.
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
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-3">
          {locks.map((lock) => (
            <div
              key={lock.id}
              className="lock-card border-2 border-dashed border-gray-400 rounded-lg p-4 flex flex-col items-center text-center bg-white"
              dir="rtl"
            >
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                  #{lock.id}
                </span>
                <span className="text-[10px] text-gray-500">בקרת נעילה · קוברה ת"א</span>
              </div>
              <div className="text-xl font-bold leading-tight mb-3">{lock.name}</div>
              <div className="bg-white p-3 rounded border-2 border-gray-200 mb-3">
                <QRCodeSVG value={lock.barcode_value} size={220} level="H" includeMargin={false} />
              </div>
              <div className="text-[11px] text-gray-600 font-mono break-all mb-1">
                {lock.barcode_value}
              </div>
              <div className="text-[10px] text-gray-500">
                סרוק/י לרישום פתיחה / סגירה
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
