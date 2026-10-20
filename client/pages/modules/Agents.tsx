import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RefreshCw, Eye, EyeOff } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Agent } from "@shared/api";

interface AgentForm {
  full_name: string;
  email: string;
  contact_info: string;
  emergency_contact: string;
  hire_date: string;
  address: string;
  is_active: boolean;
  username: string;
  password: string;
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewAgentModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Agent Details</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {[
            ["Full Name", agent.full_name],
            ["Username", agent.user?.username],
            ["Email", agent.email],
            ["Contact Info", agent.contact_info],
            ["Emergency Contact", agent.emergency_contact],
            ["Hire Date", agent.hire_date],
            ["Address", agent.address],
          ].map(([label, value]) => (
            <div key={label as string}>
              <label className="block text-xs font-semibold text-muted mb-1">{label}</label>
              <div className="text-sm text-navy font-medium">{value || "—"}</div>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Status</label>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${agent.is_active ? "badge-green" : "badge-red"}`}>
              {agent.is_active ? "Active" : "Inactive"}
            </span>
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

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function AgentModal({
  title,
  isEdit,
  formData,
  setFormData,
  onClose,
  onSave,
  mfaEnabled,
  isResettingMfa,
  mfaMessage,
  onResetMfa,
}: {
  title: string;
  isEdit: boolean;
  formData: AgentForm;
  setFormData: (data: AgentForm) => void;
  onClose: () => void;
  onSave: () => void;
  mfaEnabled: boolean;
  isResettingMfa: boolean;
  mfaMessage: string | null;
  onResetMfa: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const field = (
    label: string,
    key: keyof AgentForm,
    placeholder?: string,
    type = "text"
  ) => (
    <div>
      <label className="block text-xs font-semibold text-navy mb-1">{label}</label>
      <input
        type={type}
        value={formData[key] as string}
        onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Account Credentials */}
          <div className="bg-off-white rounded-xl p-4 space-y-3 border border-border">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Account Credentials</p>
            {field("Username", "username", "e.g., jdelacruz")}

            <div>
              <label className="block text-xs font-semibold text-navy mb-1">
                Password{isEdit && <span className="text-muted font-normal ml-1">(leave blank to keep current)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
                  placeholder={isEdit ? "Enter new password to change…" : "Enter password…"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Agent Details */}
          {field("Full Name", "full_name", "e.g., Juan Dela Cruz")}
          {field("Email", "email", "e.g., juan@example.com", "email")}
          {field("Contact Info", "contact_info", "e.g., 09171234567")}
          {field("Emergency Contact", "emergency_contact", "e.g., Name & phone number")}
          {field("Hire Date", "hire_date", "", "date")}
          {field("Address", "address", "e.g., 123 Main St, Makati")}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 accent-navy"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-navy">Active Agent</label>
          </div>

          {isEdit && (
            <div className="bg-off-white rounded-xl p-4 space-y-3 border border-border">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">Authenticator (MFA)</p>
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${mfaEnabled ? "badge-green" : "badge-red"}`}>
                  {mfaEnabled ? "Enabled" : "Not set up"}
                </span>
                {mfaEnabled && (
                  <button
                    type="button"
                    onClick={onResetMfa}
                    disabled={isResettingMfa}
                    className="px-3 py-1.5 text-xs font-semibold border border-red/30 bg-red/10 text-red rounded-lg hover:bg-red/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResettingMfa ? "Resetting…" : "Reset MFA"}
                  </button>
                )}
              </div>
              {mfaMessage && <p className="text-xs text-muted">{mfaMessage}</p>}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white">
            Cancel
          </button>
          <button onClick={onSave} className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90">
            Save Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  showDelete,
  onView,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  showDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = (agent.full_name || agent.user?.username || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-white border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-navy-mid flex items-center justify-center shrink-0">
          <span className="font-rajdhani font-bold text-sm text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-navy text-sm truncate">
            {agent.full_name || agent.user?.username || "—"}
          </div>
          <div className="text-xs text-muted truncate">@{agent.user?.username || "—"}</div>
        </div>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-bold ${agent.is_active ? "badge-green" : "badge-red"}`}>
          {agent.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-muted block">Email</span>
          <span className="text-navy font-medium truncate">{agent.email || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Contact</span>
          <span className="text-navy font-medium">{agent.contact_info || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Hired</span>
          <span className="text-navy font-medium">{agent.hire_date || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Address</span>
          <span className="text-navy font-medium truncate">{agent.address || "—"}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-border">
        <button onClick={onView} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy transition-colors">View</button>
        <button onClick={onEdit} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy transition-colors">Edit</button>
        {showDelete && (
          <button onClick={onDelete} className="flex-1 py-1.5 text-xs font-semibold bg-red/10 border border-red/30 rounded-lg hover:bg-red/20 text-red transition-colors">Delete</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResettingMfa, setIsResettingMfa] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<string | null>(null);
  const { token } = useAuth();

  const emptyForm = (): AgentForm => ({
    full_name: "",
    email: "",
    contact_info: "",
    emergency_contact: "",
    hire_date: "",
    address: "",
    is_active: true,
    username: "",
    password: "",
  });

  const [formData, setFormData] = useState<AgentForm>(emptyForm());
  const itemsPerPage = 12;

  const fetchAgents = async () => {
    try {
      const response = await fetch("/api/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch agents");
      setAgents(await response.json());
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
    if (token) fetchAgents();
  }, [token]);

  const filteredAgents = agents.filter(
    (a) =>
      (a.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.user?.username?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.contact_info?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openAddModal = () => {
    setEditingAgent(null);
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setMfaMessage(null);
    setFormData({
      full_name: agent.full_name ?? "",
      email: agent.email ?? "",
      contact_info: agent.contact_info ?? "",
      emergency_contact: agent.emergency_contact ?? "",
      hire_date: agent.hire_date ?? "",
      address: agent.address ?? "",
      is_active: agent.is_active ?? true,
      username: agent.user?.username ?? "",
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingAgent) {
        // PATCH agent profile
        const agentRes = await fetch(`/api/agents/${editingAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            full_name: formData.full_name,
            email: formData.email,
            contact_info: formData.contact_info,
            emergency_contact: formData.emergency_contact,
            hire_date: formData.hire_date,
            address: formData.address,
            is_active: formData.is_active,
          }),
        });
        if (!agentRes.ok) throw new Error("Failed to update agent");
        const saved = await agentRes.json();

        // Update password if provided
        if (formData.password && editingAgent.user_id) {
          const userRes = await fetch(`/api/users/${editingAgent.user_id}/password`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ password: formData.password }),
          });
          if (!userRes.ok) throw new Error("Agent saved but password update failed");
        }

        setAgents(agents.map((a) => (a.id === saved.id ? saved : a)));
      } else {
        // Create new agent (account + profile in one call)
        if (!formData.username || !formData.password) {
          alert("Username and password are required for new agents");
          return;
        }
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
            full_name: formData.full_name,
            email: formData.email,
            contact_info: formData.contact_info,
            emergency_contact: formData.emergency_contact,
            hire_date: formData.hire_date,
            address: formData.address,
            is_active: formData.is_active,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create agent");
        }
        setAgents([...agents, await res.json()]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save agent");
    }
  };

  const handleResetMfa = async () => {
    if (!editingAgent?.user_id) return;
    const username = editingAgent.user?.username;
    if (!confirm(`Reset MFA for ${username}? They will need to set up their authenticator app again at next sign-in.`)) return;

    setIsResettingMfa(true);
    setMfaMessage(null);
    try {
      const res = await fetch(`/api/users/${editingAgent.user_id}/mfa/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to reset MFA");
      }
      const userId = editingAgent.user_id;
      const clearMfa = (a: Agent): Agent =>
        a.user_id === userId && a.user ? { ...a, user: { ...a.user, mfa_enabled: false } } : a;
      setAgents((prev) => prev.map(clearMfa));
      setEditingAgent((prev) => (prev ? clearMfa(prev) : prev));
      setMfaMessage("MFA reset. The next sign-in will ask them to set up a new authenticator.");
    } catch (err) {
      setMfaMessage(err instanceof Error ? err.message : "Failed to reset MFA");
    } finally {
      setIsResettingMfa(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent? This will also remove their login account.")) return;
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

  if (isLoading && !isRefreshing) {
    return (
      <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6">
        <LoadingSpinner className="min-h-64" />
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
          <p className="text-xs text-muted mt-1">Manage agents — account-linked field staff</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-fit"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red/10 border border-red/30 text-red rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search + Add + Delete Toggle */}
      <div className="flex flex-col md:flex-row gap-3">
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={(value) => { setSearchQuery(value); setCurrentPage(1); }}
          placeholder="Search by name, username, email, contact…"
        />
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 w-fit"
        >
          ➕ Add Agent
        </button>
        <button
          onClick={() => setShowDeleteButtons(!showDeleteButtons)}
          className={`w-fit px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
            showDeleteButtons
              ? "bg-red text-white hover:opacity-90"
              : "bg-white border border-border text-navy hover:bg-off-white"
          }`}
        >
          {showDeleteButtons ? "🔓 Delete Enabled" : "🔒 Enable Delete"}
        </button>
      </div>

      {/* Cards grid */}
      {paginatedAgents.length === 0 ? (
        <div className="text-center text-muted text-sm py-12">
          {agents.length === 0 ? "No agents found" : "No results matching your search"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {paginatedAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              showDelete={showDeleteButtons}
              onView={() => setViewingAgent(agent)}
              onEdit={() => openEditModal(agent)}
              onDelete={() => handleDelete(agent.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-2">
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
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>

      {viewingAgent && (
        <ViewAgentModal agent={viewingAgent} onClose={() => setViewingAgent(null)} />
      )}

      {isModalOpen && (
        <AgentModal
          title={editingAgent ? "Edit Agent" : "Add New Agent"}
          isEdit={!!editingAgent}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          mfaEnabled={editingAgent?.user?.mfa_enabled ?? false}
          isResettingMfa={isResettingMfa}
          mfaMessage={mfaMessage}
          onResetMfa={handleResetMfa}
        />
      )}
    </div>
  );
}
