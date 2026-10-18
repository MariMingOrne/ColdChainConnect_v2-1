import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { AuditLog } from "@shared/api";
import { SearchFilterBar } from "@/components/SearchFilterBar";
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

const HEAD_CLASS =
  "bg-navy-mid text-muted font-barlow-cond text-xs font-bold uppercase tracking-wider px-3 py-3 border-b border-border whitespace-nowrap";

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
        log.user_name,
        log.action,
        log.resource_type,
        log.resource_id ?? "",
        new Date(log.created_at).toLocaleString(),
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [logs, query, actionFilter, resourceFilter]);

  return (
    <div className="flex flex-col gap-4">
      <SearchFilterBar
        searchTerm={query}
        onSearchChange={setQuery}
        placeholder="Search by description, user, action, resource, or date…"
        filters={[
          {
            name: "action",
            value: actionFilter,
            onChange: setActionFilter,
            options: [
              { label: "All actions", value: "all" },
              ...actions.map((action) => ({ label: action, value: action })),
            ],
          },
          {
            name: "resource",
            value: resourceFilter,
            onChange: setResourceFilter,
            options: [
              { label: "All resources", value: "all" },
              ...resources.map((resource) => ({ label: resource.replace(/_/g, " "), value: resource })),
            ],
          },
        ]}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto text-xs md:text-sm">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${HEAD_CLASS} text-left`}>Timestamp</th>
                <th className={`${HEAD_CLASS} text-left`}>User</th>
                <th className={`${HEAD_CLASS} text-left`}>Action</th>
                <th className={`${HEAD_CLASS} text-left`}>Description</th>
                <th className={`${HEAD_CLASS} text-left`}>Resource</th>
                <th className={`${HEAD_CLASS} text-left`}>Resource ID</th>
                <th className={`${HEAD_CLASS} text-right`}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted">
                    {logs.length === 0 ? "No activity yet" : "No entries match your search"}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border transition-colors hover:bg-off-white/50"
                  >
                    <td className="px-3 py-3 whitespace-nowrap text-navy">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-semibold text-navy">{log.user_name || "Unknown user"}</div>
                      <div className="font-mono text-xs text-muted">{log.user_id.slice(0, 8)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"}`}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-navy">{describeLog(log)}</td>
                    <td className="px-3 py-3 capitalize text-navy whitespace-nowrap">
                      {log.resource_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted whitespace-nowrap">
                      {log.resource_id?.slice(0, 8) || "-"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => onView(log)}
                        aria-label="View details"
                        className="inline-flex items-center justify-center rounded-lg border border-border bg-white p-2 text-navy transition-colors hover:bg-off-white"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border bg-off-white/50 px-6 py-4 text-xs text-muted">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </div>
    </div>
  );
}
