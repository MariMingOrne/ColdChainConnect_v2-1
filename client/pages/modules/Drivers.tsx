import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RefreshCw } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Driver } from "@shared/api";
import { DriverScheduleModal } from "@/components/driver/DriverScheduleModal";

interface DriversProps {
  onBack?: () => void;
}

interface DriverForm {
  full_name: string;
  contact_info: string;
  license: string;
  hire_date: string;
  employment_type: "full_time" | "part_time" | "";
  is_active: boolean;
  username: string;
  password: string;
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewDriverModal({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Driver Details</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {[
            ["Full Name", driver.full_name],
            ["Contact Info", driver.contact_info],
            ["License", driver.license],
            ["Hire Date", driver.hire_date],
            ["Employment Type", driver.employment_type?.replace("_", " ")],
            ["Login Username", driver.user?.username],
          ].map(([label, value]) => (
            <div key={label as string}>
              <label className="block text-xs font-semibold text-muted mb-1">{label}</label>
              <div className="text-sm text-navy font-medium capitalize">{value || "—"}</div>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Status</label>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${driver.is_active ? "badge-green" : "badge-red"}`}>
              {driver.is_active ? "Active" : "Inactive"}
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

function DriverModal({
  title,
  formData,
  setFormData,
  hasLogin,
  onClose,
  onSave,
}: {
  title: string;
  formData: DriverForm;
  setFormData: (data: DriverForm) => void;
  hasLogin: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const field = (
    label: string,
    key: keyof DriverForm,
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
          {field("Full Name *", "full_name", "e.g., Juan Dela Cruz")}
          {field("Contact Info", "contact_info", "e.g., 09171234567")}
          {field("License Number", "license", "e.g., N01-23-456789")}
          {field("Hire Date", "hire_date", "", "date")}

          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Employment Type</label>
            <select
              value={formData.employment_type}
              onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
            >
              <option value="">Select employment type…</option>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
            </select>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Login</p>
            {field("Username", "username", "e.g., juan.delacruz")}
            {field(
              "Password",
              "password",
              hasLogin ? "Leave blank to keep current password" : "At least 4 characters",
              "password"
            )}
            <p className="text-xs text-muted">
              Drivers sign in with these details and set up an authenticator app on first login.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 accent-navy"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-navy">Active Driver</label>
          </div>
        </div>

        <div className="sticky bottom-0 bg-off-white px-6 py-4 flex justify-end gap-2 border-t border-border rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg font-semibold text-sm hover:bg-white">
            Cancel
          </button>
          <button onClick={onSave} className="px-4 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90">
            Save Driver
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Driver Card ──────────────────────────────────────────────────────────────

function DriverCard({
  driver,
  showDelete,
  onView,
  onEdit,
  onSchedule,
  onDelete,
}: {
  driver: Driver;
  showDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
}) {
  const initials = (driver.full_name || "?")
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
            {driver.full_name || "—"}
          </div>
          <div className="text-xs text-muted truncate">{driver.license || "No license"}</div>
        </div>
        <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-bold ${driver.is_active ? "badge-green" : "badge-red"}`}>
          {driver.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div>
          <span className="text-muted block">Contact</span>
          <span className="text-navy font-medium">{driver.contact_info || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Employment</span>
          <span className="text-navy font-medium capitalize">{driver.employment_type?.replace("_", " ") || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Hired</span>
          <span className="text-navy font-medium">{driver.hire_date || "—"}</span>
        </div>
        <div>
          <span className="text-muted block">Login</span>
          <span className="text-navy font-medium">{driver.user?.username || "No login"}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-border">
        <button onClick={onView} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy transition-colors">View</button>
        <button onClick={onSchedule} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy transition-colors">Schedule</button>
        <button onClick={onEdit} className="flex-1 py-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-off-white text-navy transition-colors">Edit</button>
        {showDelete && (
          <button onClick={onDelete} className="flex-1 py-1.5 text-xs font-semibold bg-red/10 border border-red/30 rounded-lg hover:bg-red/20 text-red transition-colors">Delete</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function Drivers({ onBack }: DriversProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [viewingDriver, setViewingDriver] = useState<Driver | null>(null);
  const [schedulingDriver, setSchedulingDriver] = useState<Driver | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { token } = useAuth();

  const emptyForm = (): DriverForm => ({
    full_name: "",
    contact_info: "",
    license: "",
    hire_date: "",
    employment_type: "",
    is_active: true,
    username: "",
    password: "",
  });

  const [formData, setFormData] = useState<DriverForm>(emptyForm());
  const itemsPerPage = 12;

  const fetchDrivers = async () => {
    try {
      const response = await fetch("/api/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch drivers");
      setDrivers(await response.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading drivers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDrivers();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) fetchDrivers();
  }, [token]);

  const filteredDrivers = drivers.filter(
    (d) =>
      (d.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.contact_info?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.license?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData(emptyForm());
    setIsModalOpen(true);
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      full_name: driver.full_name ?? "",
      contact_info: driver.contact_info ?? "",
      license: driver.license ?? "",
      hire_date: driver.hire_date ?? "",
      employment_type: (driver.employment_type as any) ?? "",
      is_active: driver.is_active ?? true,
      username: driver.user?.username ?? "",
      password: "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.full_name) {
        alert("Full name is required");
        return;
      }

      if (editingDriver) {
        const res = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            full_name: formData.full_name,
            contact_info: formData.contact_info,
            license: formData.license,
            hire_date: formData.hire_date,
            employment_type: formData.employment_type || undefined,
            is_active: formData.is_active,
            username: formData.username || undefined,
            password: formData.password || undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed to update driver");
        const saved = await res.json();
        setDrivers(drivers.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        const res = await fetch("/api/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            full_name: formData.full_name,
            contact_info: formData.contact_info,
            license: formData.license,
            hire_date: formData.hire_date,
            employment_type: formData.employment_type || undefined,
            username: formData.username || undefined,
            password: formData.password || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create driver");
        }
        setDrivers([...drivers, await res.json()]);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save driver");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this driver?")) return;
    try {
      await fetch(`/api/drivers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDrivers(drivers.filter((d) => d.id !== id));
    } catch {
      alert("Failed to delete driver");
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Driver Management
          </h1>
          <p className="text-xs text-muted mt-1">Manage field drivers</p>
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

      <div className="flex flex-col md:flex-row gap-3">
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={(value) => { setSearchQuery(value); setCurrentPage(1); }}
          placeholder="Search by name, contact, license…"
        />
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 w-fit"
        >
          ➕ Add Driver
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

      {paginatedDrivers.length === 0 ? (
        <div className="text-center text-muted text-sm py-12">
          {drivers.length === 0 ? "No drivers found" : "No results matching your search"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {paginatedDrivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              showDelete={showDeleteButtons}
              onView={() => setViewingDriver(driver)}
              onEdit={() => openEditModal(driver)}
              onSchedule={() => setSchedulingDriver(driver)}
              onDelete={() => handleDelete(driver.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-2 py-2">
        <div className="text-xs text-muted">
          Page {currentPage} of {Math.max(1, totalPages)} · {filteredDrivers.length} drivers
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

      {viewingDriver && (
        <ViewDriverModal driver={viewingDriver} onClose={() => setViewingDriver(null)} />
      )}

      {schedulingDriver && (
        <DriverScheduleModal driver={schedulingDriver} onClose={() => setSchedulingDriver(null)} />
      )}

      {isModalOpen && (
        <DriverModal
          title={editingDriver ? "Edit Driver" : "Add New Driver"}
          formData={formData}
          setFormData={setFormData}
          hasLogin={Boolean(editingDriver?.user)}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
