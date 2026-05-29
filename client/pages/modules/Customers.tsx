import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Customer } from "@shared/api";
import { RefreshCw } from "lucide-react";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { ActionButtons } from "@/components/ActionButtons";

interface CustomersProps {
  onBack?: () => void;
}

interface CustomerForm {
  store_name: string;
  location: string;
  contact_info: string;
  payment_type: "" | "cash" | "check" | "bank_transfer" | "cod" | "credit";
  tax_rate: string;
}

const PAYMENT_OPTIONS: Array<Exclude<CustomerForm["payment_type"], "">> = [
  "cash",
  "check",
  "bank_transfer",
  "cod",
  "credit",
];

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

function ViewCustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-border max-w-lg w-full">
        <div className="sticky top-0 bg-navy-mid px-6 py-4 flex items-center justify-between border-b border-border rounded-t-2xl">
          <h2 className="font-rajdhani text-lg font-bold text-white">Customer Details</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Store Name</label>
            <div className="text-sm text-navy font-semibold">{customer.store_name}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Location</label>
            <div className="text-sm text-navy">{customer.location || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Contact Info</label>
            <div className="text-sm text-navy">{customer.contact_info || "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Payment Type</label>
            <div className="text-sm text-navy">{customer.payment_type ? customer.payment_type.replace("_", " ").toUpperCase() : "—"}</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Tax Rate</label>
            <div className="text-sm text-navy">{customer.tax_rate ? `${(Number(customer.tax_rate) * 100).toFixed(2)}%` : "—"}</div>
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

function CustomerModal({
  title,
  formData,
  setFormData,
  onClose,
  onSave,
}: {
  title: string;
  formData: CustomerForm;
  setFormData: (data: CustomerForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-white">
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-border bg-navy-mid px-6 py-4">
          <h2 className="font-rajdhani text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-2xl text-white hover:opacity-70">
            ×
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Store Name *
            </label>
            <input
              type="text"
              value={formData.store_name}
              onChange={(e) =>
                setFormData({ ...formData, store_name: e.target.value })
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
              placeholder="e.g., ABC Market - Makati"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
              placeholder="e.g., Makati City"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Contact Info
            </label>
            <input
              type="text"
              value={formData.contact_info}
              onChange={(e) =>
                setFormData({ ...formData, contact_info: e.target.value })
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
              placeholder="e.g., 555-0001"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Payment Type
            </label>
            <select
              value={formData.payment_type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  payment_type: e.target.value as CustomerForm["payment_type"],
                })
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
            >
              <option value="">Select payment type</option>
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-navy">
              Tax Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.tax_rate}
              onChange={(e) =>
                setFormData({ ...formData, tax_rate: e.target.value })
              }
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent-2 focus:outline-none"
              placeholder="12"
            />
            <p className="mt-1 text-xs text-muted">Use Philippine VAT or store-specific tax rate.</p>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-2xl border-t border-border bg-off-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg bg-accent-2 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Save Customer
          </button>
        </div>
      </div>
    </div>
  );
}

export function Customers({ onBack }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerForm>({
    store_name: "",
    location: "",
    contact_info: "",
    payment_type: "",
    tax_rate: "",
  });
  const { token } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const itemsPerPage = 10;

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch customers");
      const data = (await response.json()) as Customer[];
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading customers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCustomers();
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (token) {
      fetchCustomers();
    }
  }, [token]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.store_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.payment_type?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [customers, searchQuery]
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const paymentTypeCount = new Set(
    customers.map((customer) => customer.payment_type).filter(Boolean)
  ).size;

  const averageTaxRate =
    customers.length > 0
      ? customers.reduce((sum, customer) => sum + Number(customer.tax_rate ?? 0), 0) /
        customers.length
      : 0;

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      store_name: "",
      location: "",
      contact_info: "",
      payment_type: "",
      tax_rate: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      store_name: customer.store_name,
      location: customer.location,
      contact_info: customer.contact_info ?? "",
      payment_type: (customer.payment_type as CustomerForm["payment_type"]) ?? "",
      tax_rate:
        customer.tax_rate !== undefined && customer.tax_rate !== null
          ? String(Number(customer.tax_rate) * 100)
          : "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.store_name.trim() || !formData.location.trim()) return;

    try {
      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : "/api/customers";
      const method = editingCustomer ? "PATCH" : "POST";

      const taxRateValue =
        formData.tax_rate.trim() === ""
          ? undefined
          : Number(formData.tax_rate) / 100;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          store_name: formData.store_name,
          location: formData.location,
          contact_info: formData.contact_info || undefined,
          payment_type: formData.payment_type || undefined,
          tax_rate:
            taxRateValue !== undefined && !Number.isNaN(taxRateValue)
              ? taxRateValue
              : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to save customer");

      const saved = (await response.json()) as Customer;

      if (editingCustomer) {
        setCustomers(customers.map((customer) => (customer.id === saved.id ? saved : customer)));
      } else {
        setCustomers([...customers, saved]);
      }

      setIsModalOpen(false);
    } catch {
      alert("Failed to save customer");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;

    try {
      await fetch(`/api/customers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(customers.filter((customer) => customer.id !== id));
    } catch {
      alert("Failed to delete customer");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="text-sm text-muted">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-rajdhani text-3xl font-bold tracking-tight text-navy">
            Customer Management
          </h1>
          <p className="mt-1 text-xs text-muted">
            Manage customer stores, payment terms, and Philippine tax settings
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh data"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white">
            ⬇ Import Excel
          </button>
          <button className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-off-white">
            ⬆ Export Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatsBox label="Total Customers" value={customers.length.toString()} icon="🏪" />
        <StatsBox label="Payment Types" value={paymentTypeCount.toString()} icon="💳" />
        <StatsBox
          label="Avg Tax Rate"
          value={`${averageTaxRate > 0 ? (averageTaxRate * 100).toFixed(2) : "0.00"}%`}
          icon="🧾"
        />
        <StatsBox
          label="With Tax Data"
          value={customers.filter((customer) => customer.tax_rate !== undefined).length.toString()}
          icon="📊"
          color="gold"
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <SearchFilterBar
          searchTerm={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          placeholder="Search by store, location, or payment type…"
        />

        <button
          onClick={openAddModal}
          className="flex w-fit items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          ➕ Add Customer
        </button>

        <button
          onClick={() => setShowDeleteButtons(!showDeleteButtons)}
          className={`w-fit rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            showDeleteButtons
              ? "bg-red text-white hover:opacity-90"
              : "border border-border bg-white text-navy hover:bg-off-white"
          }`}
        >
          {showDeleteButtons ? "🔓 Delete Enabled" : "🔒 Enable Delete"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <div className="overflow-x-auto text-xs md:text-sm">
          <table className="w-full">
            <thead>
              <tr>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                  Store Name
                </th>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                  Location
                </th>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap hidden md:table-cell">
                  Contact Info
                </th>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                  Payment Type
                </th>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                  Tax Rate
                </th>
                <th className="border-b border-border bg-navy-mid px-3 py-3 text-left font-barlow-cond text-xs font-bold uppercase tracking-wider text-muted whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    {customers.length === 0
                      ? "No customers found"
                      : "No results matching your search"}
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-border transition-colors hover:bg-off-white/50"
                  >
                    <td className="px-3 py-3 font-semibold text-navy">
                      {customer.store_name}
                    </td>
                    <td className="px-3 py-3 text-navy">{customer.location}</td>
                    <td className="hidden px-3 py-3 text-navy md:table-cell">
                      {customer.contact_info || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {customer.payment_type ? (
                        <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                          {customer.payment_type.replace("_", " ").toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {customer.tax_rate !== undefined && customer.tax_rate !== null ? (
                        <span className="inline-block rounded bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
                          {(Number(customer.tax_rate) * 100).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ActionButtons
                        onView={() => setViewingCustomer(customer)}
                        onEdit={() => openEditModal(customer)}
                        onDelete={() => handleDelete(customer.id)}
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
        <div className="flex items-center justify-between border-t border-border bg-off-white/50 px-6 py-4">
          <div className="text-xs text-muted">
            Page {currentPage} of {Math.max(1, totalPages)} · {filteredCustomers.length} customers
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

      <div className="text-xs text-muted">
        Total customers: {filteredCustomers.length}
      </div>

      {viewingCustomer && (
        <ViewCustomerModal customer={viewingCustomer} onClose={() => setViewingCustomer(null)} />
      )}

      {isModalOpen && (
        <CustomerModal
          title={editingCustomer ? "Edit Customer" : "Add New Customer"}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
