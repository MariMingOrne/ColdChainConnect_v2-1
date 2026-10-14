import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clock, Eye, Search } from "lucide-react";
import { AuditLog } from "@shared/api";
import { describeLog } from "./auditDescribe";

interface AuditLogTableProps {
  logs: AuditLog[];
  onView: (log: AuditLog) => void;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
};

const selectClass = "px-3 py-2 border border-border rounded-lg bg-white text-navy text-sm focus:outline-none focus:border-accent-2";

export function AuditLogTable({ logs, onView }: AuditLogTableProps) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const resources = useMemo(() => Array.from(new Set(logs.map((log) => log.resource_type))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (resourceFilter !== "all" && log.resource_type !== resourceFilter) return false;
      if (terms.length === 0) return true;
      const haystack = [
        describeLog(log),
        log.user_id,
        log.action,
        log.resource_type,
        log.resource_id ?? "",
        new Date(log.created_at).toLocaleString(),
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [logs, query, actionFilter, resourceFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by description, user ID, action, resource, or date…"
            className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-navy focus:border-accent-2 focus:outline-none"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
          <option value="all">All actions</option>
          {actions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
        <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className={selectClass}>
          <option value="all">All resources</option>
          {resources.map((resource) => (
            <option key={resource} value={resource}>{resource.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500">
        Showing {filteredLogs.length} of {logs.length} entries
      </p>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Resource ID</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {logs.length === 0 ? "No activity yet" : "No entries match your search"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.user_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"}`}>
                      {log.action.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-navy">{describeLog(log)}</TableCell>
                  <TableCell className="text-sm capitalize">{log.resource_type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-sm">{log.resource_id?.slice(0, 8) || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onView(log)} aria-label="View details">
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
