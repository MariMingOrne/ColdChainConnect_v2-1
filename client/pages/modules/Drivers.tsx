import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw } from "lucide-react";
import { Driver } from "@shared/api";

interface DriversProps {
  onBack?: () => void;
}

interface DriverForm {
  address: string;
  contact_info: string;
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

function DriverModal({
  title,
  formData,
  setFormData,
  onClose,
  onSave,
}: {
  title: string;
  formData: DriverForm;
  setFormData: (data: DriverForm) => void;
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
            <label className="block text-xs font-semibold text-navy mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., 123 Main St, Makati"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-navy mb-1">Contact Info</label>
            <input
              type="text"
              value={formData.contact_info}
              onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
              placeholder="e.g., 09171234567"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 accent-navy"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-navy">
              Active Driver
            </label>
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
            Save Driver
          </button>
        </div>
      </div>
    </div>
  );
}

export function Drivers({ onBack }: DriversProps) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverForm>({
    address: "",
    contact_info: "",
    is_active: true,
  });
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const itemsPerPage = 10;

  const fetchDrivers = async () => {
    try {
      const response = await fetch("/api/drivers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch drivers");
      const data = await response.json();
      setDrivers(data);
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
    if (token) {
      fetchDrivers();
    }
  }, [token]);

  const filteredDrivers = drivers.filter(
    (d) =>
      d.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contact_info?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredDrivers.length / itemsPerPage);
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const activeCount = drivers.filter((d) => d.is_active).length;
  const inactiveCount = drivers.length - activeCount;

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({ address: "", contact_info: "", is_active: true });
    setIsModalOpen(true);
  };

  const openEditModal = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      address: driver.address ?? "",
      contact_info: driver.contact_info ?? "",
      is_active: driver.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingDriver ? `/api/drivers/${editingDriver.id}` : "/api/drivers";
      const method = editingDriver ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error("Failed to save driver");
      const saved = await response.json();
      if (editingDriver) {
        setDrivers(drivers.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        setDrivers([...drivers, saved]);
      }
      setIsModalOpen(false);
    } catch {
      alert("Failed to save driver");
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
        <div className="text-muted text-sm">Loading drivers...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 px-4 md:px-6 lg:px-7 py-4 md:py-6 overflow-y-auto scrollbar-visible space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold text-navy letter-spacing-tight">
            Driver Management
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage drivers and field agents
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
        <StatsBox label="Total Drivers" value={drivers.length.toString()} icon="🚛" />
        <StatsBox label="Active" value={activeCount.toString()} icon="✅" />
        <StatsBox label="Inactive" value={inactiveCount.toString()} icon="⛔" color="red" />
        <StatsBox
          label="With Contact"
          value={drivers.filter((d) => d.contact_info).length.toString()}
          icon="📞"
        />
      </div>

      {/* Search + Add */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex items-center bg-navy-mid border border-border rounded-lg px-3 gap-2">
          <span className="text-muted">🔍</span>
          <input
            type="text"
            placeholder="Search by address or contact…"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1 bg-transparent border-none text-white placeholder-muted py-2 outline-none text-sm"
          />
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center gap-2 w-fit"
        >
          ➕ Add Driver
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-visible text-xs md:text-sm">
          <table className="w-full">
            <thead>
              <tr>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Status
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Driver ID
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap hidden md:table-cell">
                  Address
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Contact
                </th>
                <th className="bg-navy-mid text-muted font-barlow-cond text-xs font-bold letter-spacing-wider uppercase px-3 py-3 text-left border-b border-border whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted">
                    {drivers.length === 0 ? "No drivers found" : "No results matching your search"}
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver) => (
                  <tr
                    key={driver.id}
                    className="border-b border-border hover:bg-off-white/50 transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${driver.is_active ? "badge-green" : "badge-red"
                        }`}>
                        {driver.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-navy font-semibold font-mono text-xs">
                      {driver.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-3 py-3 text-navy hidden md:table-cell">
                      {driver.address || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 text-navy">
                      {driver.contact_info || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(driver)}
                          className="px-3 py-1 border border-border rounded-lg text-xs font-semibold text-navy hover:bg-off-white transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id)}
                          className="px-3 py-1 border border-red/30 rounded-lg text-xs font-semibold text-red hover:bg-red/10 transition-colors"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-off-white/50">
            <span className="text-xs text-muted">
              Showing {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredDrivers.length)} of{" "}
              {filteredDrivers.length} drivers
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs font-semibold text-navy">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-border rounded text-xs font-semibold hover:bg-white disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">Total drivers: {filteredDrivers.length}</div>

      {isModalOpen && (
        <DriverModal
          title={editingDriver ? "Edit Driver" : "Add New Driver"}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
