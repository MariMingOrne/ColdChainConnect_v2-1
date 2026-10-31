import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
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
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/information-management/inventory", label: "Inventory", icon: Package },
  { path: "/booking-dispatch/order-summary", label: "Orders", icon: ClipboardList },
  { path: "/booking-dispatch/delivery", label: "Logistics", icon: Truck },
  { path: "/reports", label: "Reports", icon: FileText },
];

// Map of hub paths to their sub-modules
const hubModulesByPath: Record<string, Array<{ path: string; label: string; icon: React.ElementType }>> = {
  "/information-management": [
    { path: "/products", label: "Products", icon: Package },
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/customers", label: "Customers", icon: Users },
  ],
  "/booking-dispatch": [
    { path: "/order-summary", label: "Orders", icon: ClipboardList },
    { path: "/inventory", label: "Pallet Tracking", icon: Package },
    { path: "/invoicing", label: "Receipts", icon: FileText },
    { path: "/delivery", label: "Truck Dispatch", icon: Truck },
    { path: "/accounts", label: "Accounts Receivable", icon: Wallet },
    { path: "/delivery-history", label: "Delivery History", icon: History },
  ],
};

const hubMainModules = [
  { path: "/information-management", label: "Information Management", icon: Package },
  { path: "/booking-dispatch", label: "Booking & Dispatch", icon: ClipboardList },
];

export function BottomNavBar({ onLogout }: BottomNavBarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user, token } = useAuth();
  const isAdmin = user?.role === "admin";
  const [counts, setCounts] = useState({ pendingOrders: 0, activeDeliveries: 0 });

  useEffect(() => {
    if (!isAdmin || !token) return;
    let active = true;
    const loadCounts = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [ordersResponse, deliveriesResponse] = await Promise.all([
          fetch("/api/bookings", { headers }),
          fetch("/api/deliveries", { headers }),
        ]);
        if (!ordersResponse.ok || !deliveriesResponse.ok) return;
        const [orders, deliveries] = await Promise.all([ordersResponse.json(), deliveriesResponse.json()]);
        if (active) setCounts({
          pendingOrders: orders.filter((order: { status: string }) => order.status === "pending").length,
          activeDeliveries: deliveries.filter((delivery: { status: string }) => delivery.status !== "completed").length,
        });
      } catch {
        if (active) setCounts({ pendingOrders: 0, activeDeliveries: 0 });
      }
    };
    void loadCounts();
    const intervalId = window.setInterval(() => void loadCounts(), 60_000);
    return () => { active = false; window.clearInterval(intervalId); };
  }, [isAdmin, token]);

  const countForPath = (path: string) => {
    if (path.endsWith("/order-summary")) return counts.pendingOrders;
    if (path.endsWith("/delivery")) return counts.activeDeliveries;
    return 0;
  };

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
                <span className="relative"><Icon size={16} />{countForPath(path) > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red px-1 text-center text-[9px] font-bold leading-4 text-white">{countForPath(path) > 99 ? "99+" : countForPath(path)}</span>}</span>
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
              <span className="relative"><Icon size={16} />{countForPath(path) > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red px-1 text-center text-[9px] font-bold leading-4 text-white">{countForPath(path) > 99 ? "99+" : countForPath(path)}</span>}</span>
              <span>{label}</span>
            </Link>
          );
        })}
        <div className="flex-shrink-0 w-2" />
      </div>
    </div>
  );
}
