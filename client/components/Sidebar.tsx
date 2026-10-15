import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Users,
  Truck,
  Wallet,
  BarChart3,
  FileText,
  Users2,
} from "lucide-react";

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
  onLogout: () => void;
}

const navItems = [
  { id: "dashboard",  label: "Dashboard",            icon: LayoutDashboard },
  { id: "inventory",  label: "Inventory Management", icon: Package },
  { id: "sales",      label: "Sales Tracking",       icon: TrendingUp },
  { id: "customers",  label: "Customers",            icon: Users },
  { id: "trucks",     label: "Trucks in Transit",    icon: Truck },
  { id: "payroll",    label: "Payroll",              icon: Wallet },
  { id: "expenses",   label: "Expenses & Finance",   icon: BarChart3 },
  { id: "reports",    label: "Reports",              icon: FileText },
  { id: "employees",  label: "Employees",            icon: Users2 },
];

export function Sidebar({ activePanel, onPanelChange }: SidebarProps) {
  return (
    <nav className="w-56 bg-navy flex flex-col flex-shrink-0 h-full py-6 px-3 gap-2 overflow-y-auto scrollbar-visible">
      {navItems.map(({ id, label, icon: Icon }) => {
        const isActive = activePanel === id;
        return (
          <button
            key={id}
            onClick={() => onPanelChange(id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-full text-sm font-semibold transition-all w-full text-left ${
              isActive
                ? "bg-accent-2 text-white shadow-lg"
                : "text-white/70 bg-white/5 hover:bg-white/15 hover:text-white"
            }`}
          >
            <Icon size={17} className="flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
