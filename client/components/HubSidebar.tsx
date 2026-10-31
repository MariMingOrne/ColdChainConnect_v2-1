import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    setIsScanning(false);
  }, [location.pathname]);

  const handleBarcodeDetected = useCallback((code: string) => {
    setIsScanning(false);
    navigate(`${basePath}/preparation?order=${encodeURIComponent(code)}`);
  }, [basePath, navigate]);

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
          onClick={() => setIsScanning(false)}
          className={cn(
            "group relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-bold transition-colors duration-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white",
            isActive
              ? "bg-white/10 text-white"
              : "text-white/85 hover:bg-white/10 hover:text-white"
          )}
        >
          <span className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 group-active:scale-95",
            isActive ? "bg-accent-2 shadow-md shadow-black/20" : "bg-white/10 group-hover:bg-white/20 group-focus-visible:bg-white/20"
          )}>
            <Icon size={19} strokeWidth={isActive ? 2.5 : 2.2} />
          </span>
          <span className="max-w-full truncate text-center text-[9px] leading-tight">
            {module.label}
          </span>
        </Link>
      );
    };

    return (
      <>
        <nav
          aria-label="Agent navigation"
          className="agent-bottom-nav fixed bottom-0 left-0 right-0 z-40 flex h-16 items-stretch justify-around border-t border-white/20 bg-navy shadow-[0_-8px_24px_rgba(15,23,42,0.24)]"
        >
          {modules.slice(0, half).map(renderModule)}
          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setIsScanning(true)}
              aria-label="Open barcode scanner"
              className="group relative -mt-3 flex h-14 w-14 items-center justify-center rounded-full border-4 border-navy bg-accent-2 text-white shadow-lg transition-transform duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ScanBarcode size={22} className="transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110 group-active:scale-105" />
            </button>
            <span className="text-[9px] font-bold leading-tight text-white">Scan</span>
          </div>
          {modules.slice(half).map(renderModule)}
        </nav>
        {isScanning && (
          <AgentBarcodeScanner
            onClose={() => setIsScanning(false)}
            onDetected={handleBarcodeDetected}
          />
        )}
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
