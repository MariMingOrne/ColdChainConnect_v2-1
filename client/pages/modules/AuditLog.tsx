import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuditLog } from "@shared/api";
import { useAuth } from "../../hooks/useAuth";

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      // Set mock data if API fails
      setLogs([
        {
          id: "log-1",
          user_id: "user-1",
          action: "create",
          resource_type: "customer",
          created_at: new Date().toISOString(),
        },
      ] as AuditLog[]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
  }, [token]);

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-800",
      update: "bg-blue-100 text-blue-800",
      delete: "bg-red-100 text-red-800",
    };
    return colors[action] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy">Audit Log</h1>
          <p className="text-gray-600">View all system actions and user activity</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
          title="Refresh data"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Resource ID</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  No activity yet
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                      {log.action.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {log.resource_type}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.resource_id?.slice(0, 8) || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
