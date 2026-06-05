import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
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
  ClipboardList,
  History,
} from "lucide-react";

interface BottomNavBarProps {
  onLogout: () => void;
}

const globalNavItems = [
  { path: "/",          label: "Dashboard",   icon: LayoutDashboard },
  { path: "/inventory", label: "Inventory",   icon: Package },
  { path: "/sales",     label: "Sales",       icon: TrendingUp },
  { path: "/customers", label: "Customers",   icon: Users },
  { path: "/trucks",    label: "Dispatch",    icon: Truck },
  { path: "/payroll",   label: "Payroll",     icon: Wallet },
  { path: "/expenses",  label: "Finance",     icon: BarChart3 },
  { path: "/reports",   label: "Reports",     icon: FileText },
  { path: "/employees", label: "Employees",   icon: Users2 },
];

// Map of hub paths to their sub-modules
const hubModulesByPath: Record<string, Array<{ path: string; label: string; icon: React.ElementType }>> = {
  "/information-management": [
    { path: "/products", label: "Products", icon: Package },
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/customers", label: "Customers", icon: Users },
    { path: "/agents", label: "Agents", icon: Users2 },
    { path: "/drivers", label: "Drivers", icon: Truck },
  ],
  "/booking-dispatch": [
    { path: "/order-summary", label: "Order Summary", icon: ClipboardList },
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/invoicing", label: "Invoicing", icon: FileText },
    { path: "/delivery", label: "Delivery", icon: Truck },
    { path: "/accounts", label: "Accounts", icon: Wallet },
    { path: "/delivery-history", label: "History", icon: History },
  ],
};

const hubMainModules = [
  { path: "/information-management", label: "Information Management", icon: Package },
  { path: "/booking-dispatch", label: "Booking Dispatch", icon: ClipboardList },
];

export function BottomNavBar({ onLogout }: BottomNavBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Hide navbar for Dashboard and Audit Log (single-view modules)
  if (currentPath === "/" || currentPath === "/audit") {
    return null;
  }

  // Determine which hub the user is in and get the appropriate modules
  let currentHub: string | null = null;
  let modulesToShow: Array<{ path: string; label: string; icon: React.ElementType }> = [];

  if (isAdmin && currentPath.startsWith("/information-management")) {
    currentHub = "/information-management";
    modulesToShow = hubModulesByPath["/information-management"] || [];
  } else if (isAdmin && currentPath.startsWith("/booking-dispatch")) {
    currentHub = "/booking-dispatch";
    modulesToShow = hubModulesByPath["/booking-dispatch"] || [];
  }

  if (currentHub && modulesToShow.length > 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-30 md:hidden">
        <div className="flex overflow-x-auto overflow-y-hidden gap-1 px-2 py-1 justify-center scrollbar-visible" style={{ WebkitOverflowScrolling: "touch" }}>
          {modulesToShow.map(({ path, label, icon: Icon }) => {
            const fullPath = currentHub + path;
            const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + "/");
            return (
              <Link
                key={fullPath}
                to={fullPath}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-full text-[10px] font-semibold transition-all min-w-max gap-0.5 ${
                  isActive
                    ? "bg-accent-2 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={16} />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Show global nav for dashboard or when not in a hub page
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-30 md:hidden">
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-visible gap-1 scroll-smooth touch-pan-x px-2 py-1 justify-center" style={{ WebkitOverflowScrolling: "touch" }}>
        {globalNavItems.map(({ path, label, icon: Icon }) => {
          const isActive = currentPath === path || (path !== "/" && currentPath.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-full text-[10px] font-semibold transition-all min-w-max gap-0.5 ${
                isActive
                  ? "bg-accent-2 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
        <div className="flex-shrink-0 w-2" />
      </div>
    </div>
  );
}
