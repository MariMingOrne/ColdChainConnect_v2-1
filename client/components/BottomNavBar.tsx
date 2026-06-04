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

const hubModules = [
  { path: "/information-management",  label: "Information Management", icon: Package },
  { path: "/booking-dispatch",        label: "Booking Dispatch",       icon: ClipboardList },
  { path: "/audit",                   label: "Audit Log",              icon: History },
];

export function BottomNavBar({ onLogout }: BottomNavBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Show hub modules bottom bar if admin is inside a hub page
  const isInHub = isAdmin && (
    currentPath.startsWith("/information-management") ||
    currentPath.startsWith("/booking-dispatch") ||
    currentPath.startsWith("/audit")
  );

  if (isInHub) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-30 md:hidden">
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-visible gap-1 scroll-smooth touch-pan-x px-2 py-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {hubModules.map(({ path, label, icon: Icon }) => {
            const isActive = currentPath.startsWith(path);
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

  // Show global nav for dashboard or when not in a hub page
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-navy border-t border-white/10 z-30 md:hidden">
      <div className="flex overflow-x-auto overflow-y-hidden scrollbar-visible gap-1 scroll-smooth touch-pan-x px-2 py-1" style={{ WebkitOverflowScrolling: "touch" }}>
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
