import { NavLink, useLocation } from "react-router-dom";
import { Boxes, ChartNoAxesCombined, ClipboardList, LayoutDashboard, Truck } from "lucide-react";

const links = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, end: true },
  { label: "Inventory & Storage", path: "/information-management/inventory", icon: Boxes },
  { label: "Bookings & Orders", path: "/booking-dispatch/order-summary", icon: ClipboardList },
  { label: "Logistics & Fleet", path: "/booking-dispatch/delivery", icon: Truck },
  { label: "Reports", path: "/reports", icon: ChartNoAxesCombined },
];

export function AdminNavigation() {
  const { pathname } = useLocation();
  const isSectionActive = (path: string) => {
    if (path === "/") return pathname === "/";
    if (path === "/information-management/inventory") return pathname.startsWith("/information-management");
    if (path === "/booking-dispatch/order-summary") return pathname.startsWith("/booking-dispatch") && !pathname.startsWith("/booking-dispatch/delivery");
    if (path === "/booking-dispatch/delivery") return pathname.startsWith("/booking-dispatch/delivery");
    return pathname === path;
  };
  return (
    <nav aria-label="Main navigation" className="sticky top-[72px] z-20 hidden border-b border-border bg-white md:block">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-4 py-2 lg:px-8">
        {links.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            aria-current={isSectionActive(path) ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2 ${isSectionActive(path) ? "bg-accent-2/10 text-accent-2" : "text-gray-600 hover:bg-off-white hover:text-navy"}`}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <div className="ml-auto shrink-0 border-l border-border pl-2">
          <NavLink
            to="/audit"
            aria-current={pathname === "/audit" || pathname.startsWith("/manage-accounts") ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2 ${pathname === "/audit" || pathname.startsWith("/manage-accounts") ? "bg-navy text-white" : "text-gray-500 hover:bg-off-white hover:text-navy"}`}
          >
            Administration
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
