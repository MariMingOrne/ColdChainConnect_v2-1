import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { ActionButtons } from "@/components/ActionButtons";
import { Agent } from "@shared/api";

interface AgentForm {
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
}

function StatsBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color?: string;
}) {
  const colorClass = color ? `text-${color}` : "text-accent-2";
  return (
    <div className="bg-white border border-border rounded-lg p-3 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`font-rajdhani text-xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function ViewAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Agent Details</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Name</label>
            <div className="text-sm text-navy font-semibold">{agent.name || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Email</label>
            <div className="text-sm text-navy">{agent.email || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Phone</label>
            <div className="text-sm text-navy">{agent.phone || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Status</label>
            <div className="text-sm"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${agent.is_active ? "badge-green" : "badge-red"}`}>{agent.is_active ? "Active" : "Inactive"}</span></div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end border-t border-border rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentModal({
  title,
  formData,
  setFormData,
  onClose,
  onSave,
}: {
  title: string;
  formData: AgentForm;
  setFormData: (data: AgentForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., John Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., john@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., 09171234567"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90"
          >
            Save Agent
          </button>
        </div>
      </div>
    </div>
  );
}

export function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [formData, setFormData] = useState<AgentForm>({
    name: "",
    email: "",
    phone: "",
    is_active: true,
  });
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const itemsPerPage = 10;

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch agents");
      const data = await response.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading agents");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAgents();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchAgents();
    }
  }, [token]);

  const filteredAgents = agents.filter(
    (a) =>
      a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = agents.filter((a) => a.is_active).length;
  const inactiveCount = agents.length - activeCount;

  const openAddModal = () => {
    setEditingAgent(null);
    setFormData({ name: "", email: "", phone: "", is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name ?? "",
      email: agent.email ?? "",
      phone: agent.phone ?? "",
      is_active: agent.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : "/api/agents";
      const method = editingAgent ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to save agent");
      const saved = await response.json();
      if (editingAgent) {
        setAgents(agents.map((a) => (a.id === saved.id ? saved : a)));
      } else {
        setAgents([...agents, saved]);
      }
      setIsModalOpen(false);
    } catch {
      alert("Failed to save agent");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    try {
      await fetch(`/api/agents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAgents(agents.filter((a) => a.id !== id));
    } catch {
      alert("Failed to delete agent");
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !agent.is_active }),
      });
      if (!response.ok) throw new Error("Failed to update agent");
      const updated = await response.json();
      setAgents(agents.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      alert("Failed to update agent");
    }
  };

  if (isLoading && !isRefreshing) {
    return (
      <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6">
        <div className="text-muted text-sm">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto scrollbar-visible space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Agent Management
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage agents and field staff
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬇ Import Excel
          </button>
          <button className="px-4 py-2 bg-white border border-border text-navy rounded-lg font-semibold text-sm hover:bg-off-white transition-colors">
            ⬆ Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsBox label="Total Agents" value={agents.length.toString()} icon="👥" />
        <StatsBox label="Active" value={activeCount.toString()} icon="✅" />
        <StatsBox label="Inactive" value={inactiveCount.toString()} icon="⛔" color="red" />
        <StatsBox
          label="With Email"
          value={agents.filter((a) => a.email).length.toString()}
          icon="📧"
        />
      </div>

      {/* Search + Add + Delete Toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch">
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          placeholder="Search by name, email, or phone…"
        />
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 w-fit"
        >
          ➕ Add Agent
        </button>
        <button
          onClick={() => setShowDeleteButtons(!showDeleteButtons)}
          className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            showDeleteButtons
              ? "bg-red text-white hover:opacity-90"
              : "bg-white border border-border text-navy hover:bg-off-white"
          }`}
        >
          {showDeleteButtons ? "🔓 Delete Enabled" : "🔒 Enable Delete"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-visible text-xs md:text-sm">
          <table className="w-full">
            <thead>
              <tr>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Name
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden md:table-cell">
                  Email
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Phone
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Status
                </th>
                <th className="sticky right-0 z-10 bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-center border-b border-border whitespace-nowrap shadow-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedAgents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    {agents.length === 0 ? "No agents found" : "No results matching your search"}
                  </td>
                </tr>
              ) : (
                paginatedAgents.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-border hover:bg-off-white/50 transition-colors"
                  >
                    <td className="px-3 py-3 text-navy font-semibold">
                      {agent.name || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 text-navy hidden md:table-cell text-xs">
                      {agent.email || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 text-navy text-xs">
                      {agent.phone || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${agent.is_active ? "badge-green" : "badge-red"
                        }`}>
                        {agent.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="sticky right-0 z-10 px-3 py-3 bg-white border-l border-border shadow-left">
                      <ActionButtons
                        onView={() => setViewingAgent(agent)}
                        onEdit={() => openEditModal(agent)}
                        onDelete={() => handleDelete(agent.id)}
                        showDelete={showDeleteButtons}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Always Display */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-off-white/50">
          <div className="text-xs text-muted">
            Page {currentPage} of {Math.max(1, totalPages)} · {filteredAgents.length} agents
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-navy bg-white rounded border border-border">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted">Total agents: {filteredAgents.length}</div>

      {viewingAgent && (
        <ViewAgentModal agent={viewingAgent} onClose={() => setViewingAgent(null)} />
      )}

      {isModalOpen && (
        <AgentModal
          title={editingAgent ? "Edit Agent" : "Add New Agent"}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
