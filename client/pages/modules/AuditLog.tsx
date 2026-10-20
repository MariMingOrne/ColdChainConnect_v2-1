import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Download, RefreshCw } from "lucide-react";
import { AuditLog } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";
import { AuditLogTable } from "./audit/AuditLogTable";
import { AuditLogDetailDialog } from "./audit/AuditLogDetailDialog";
import { AuditReports } from "./audit/AuditReports";

type PageTab = "activity" | "reports";

export function AuditLogPage() {
  const [pageTab, setPageTab] = useState<PageTab>("activity");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/audit-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      const data = await response.json();
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading logs");
      setLogs([{ id: "log-1", user_id: "user-1", action: "create", resource_type: "customer", created_at: new Date().toISOString() }] as AuditLog[]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch("/api/backup", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to create backup");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setIsBackingUp(false);
    }
  };

  useEffect(() => { if (token) fetchLogs(); }, [token]);

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Audit Log</h1>
          <p className="text-gray-600">
            Every create, update, and delete is recorded with who made it, when, and exactly which fields changed.
          </p>
        </div>
        <div className="flex gap-2 w-fit">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={handleBackup}
            disabled={isBackingUp}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download size={16} className={isBackingUp ? "animate-pulse" : ""} />
            {isBackingUp ? "Preparing backup…" : "Backup all data"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: "activity", label: "Activity Log", icon: "🕐" },
          { id: "reports", label: "Reports", icon: "📊" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setPageTab(tab.id as PageTab)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition-all ${
              pageTab === tab.id
                ? "bg-white border-border text-navy -mb-px"
                : "bg-off-white border-transparent text-gray-500 hover:text-navy"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {pageTab === "activity" && (
        <>
          {error && (
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="text-red-700">{error}</p>
            </Card>
          )}
          {isLoading ? (
            <LoadingSpinner className="min-h-32" />
          ) : (
            <AuditLogTable logs={logs} onView={setSelectedLog} />
          )}
          <AuditLogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
        </>
      )}

      {pageTab === "reports" && <AuditReports logs={logs} />}
    </div>
  );
}
