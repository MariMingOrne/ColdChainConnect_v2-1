import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Package,
  CalendarDays,
  FileText,
  Truck,
  CreditCard,
  History,
  ScanBarcode,
} from "lucide-react";
import { AgentBarcodeScanner } from "../pages/modules/AgentBarcodeScanner";

interface Module {
  label: string;
  path: string;
}

interface HubSidebarProps {
  modules: Module[];
  basePath: string;
  agentMode?: boolean;
}

const moduleIcons: Record<string, React.ElementType> = {
  "/order-summary":    ClipboardList,
  "/preparation":      Package,
  "/inventory":        Package,
  "/invoicing":        FileText,
  "/delivery":         Truck,
  "/accounts":         CreditCard,
  "/delivery-history": History,
};

export function HubSidebar({ modules, basePath, agentMode = false }: HubSidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [isScanning, setIsScanning] = useState(false);

  // ── Agent: fixed bottom app bar with icons ──────────────────────
  if (agentMode) {
    const half = Math.ceil(modules.length / 2);
    const renderModule = (module: Module) => {
      const fullPath = `${basePath}${module.path}`;
      const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + "/");
      const Icon = agentMode && module.path === "/inventory"
        ? CalendarDays
        : moduleIcons[module.path] ?? ClipboardList;

      return (
        <Link
          key={module.path}
          to={fullPath}
          className={cn(
            "group relative flex h-full min-w-0 flex-1 flex-col items-center justify-center px-1 text-[10px] font-semibold transition-all",
            isActive
              ? "text-white bg-accent-2"
              : "text-white/55 hover:text-white hover:bg-white/10"
          )}
        >
          <Icon
            size={20}
            strokeWidth={isActive ? 2.5 : 1.8}
            className="transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-125 group-focus-visible:-translate-y-1 group-focus-visible:scale-125 group-active:-translate-y-1 group-active:scale-110"
          />
          <span className="absolute bottom-1 left-0 right-0 max-h-0 overflow-hidden truncate text-center leading-tight opacity-0 transition-all duration-200 group-hover:max-h-5 group-hover:opacity-100 group-focus-visible:max-h-5 group-focus-visible:opacity-100 group-active:max-h-5 group-active:opacity-100">
            {module.label}
          </span>
        </Link>
      );
    };

    return (
      <>
        <nav aria-label="Agent navigation" className="agent-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-white/10 bg-navy">
          {modules.slice(0, half).map(renderModule)}
          <div className="flex-1 flex justify-center">
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              aria-label="Open barcode scanner"
              className="group relative -mt-6 flex h-14 w-14 items-center justify-center rounded-full border-4 border-navy bg-accent-2 text-white shadow-lg transition-transform duration-200 ease-out hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ScanBarcode size={22} className="transition-transform duration-200 ease-out group-hover:scale-125 group-focus-visible:scale-125 group-active:scale-110" />
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-navy px-2 py-0.5 text-[10px] font-semibold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100">
                Scan
              </span>
            </button>
          </div>
          {modules.slice(half).map(renderModule)}
        </nav>
        {isScanning && <AgentBarcodeScanner onClose={() => setIsScanning(false)} />}
      </>
    );
  }

  // ── Admin: original left sidebar ────────────────────────────────
  return (
    <aside className="hidden md:flex w-56 bg-navy flex-col py-6 px-3 gap-2 flex-shrink-0 h-full overflow-y-auto scrollbar-visible">
      <nav className="flex flex-col gap-2">
        {modules.map((module) => {
          const fullPath = `${basePath}${module.path}`;
          const isActive = currentPath === fullPath || currentPath.startsWith(fullPath + "/");
          return (
            <Link
              key={module.path}
              to={fullPath}
              className={cn(
                "flex items-center px-4 py-3 rounded-full text-sm font-semibold transition-all",
                isActive
                  ? "bg-accent-2 text-white shadow-lg"
                  : "text-white/70 bg-white/5 hover:bg-white/15 hover:text-white"
              )}
            >
              {module.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
