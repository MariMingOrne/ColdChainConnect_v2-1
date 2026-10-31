import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Search, ShieldCheck, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationPanel } from "./NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface TopbarProps {
  userName: string;
  onLogout?: () => void;
  agentMode?: boolean; // hides back-to-dashboard button
}

export function Topbar({ userName, onLogout, agentMode = false }: TopbarProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("q") ?? "");
  const [showNotifications, setShowNotifications] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const role = useAuth((state) => state.user?.role);
  const {
    notifications,
    unreadCount,
    truckAssignments,
    isLoading: isLoadingNotifications,
    error: notificationError,
    refresh: refreshNotifications,
    markAsRead,
    markAllAsRead,
    dismiss,
  } = useNotifications();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && role !== "agent") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [role]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="bg-navy px-6 md:px-8 py-4 flex items-center flex-shrink-0 sticky top-0 z-10 shadow-sm gap-4 md:gap-6 animate-slide-down">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Left Section - Logo & Back Button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {!agentMode && (
            <button
              onClick={() => navigate("/")}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              title="Back to Dashboard"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {!agentMode && <div className="h-6 w-px bg-white/20 hidden sm:block" />}

          <div className="flex items-center gap-2">
            <img src="https://cdn.builder.io/api/v1/image/assets%2F95235f61d85340cc8929dd5e2ec9cafe%2F04690f469f254fd393684ed5411b7cab?format=webp&width=800&height=1200" alt="ACDP Logo" className="w-8 h-8 object-cover rounded-full" />
            <div className="font-rajdhani text-xl font-bold letter-spacing-wider text-white hidden sm:block">
              ACDP
            </div>
          </div>

          {role === "agent" && (
            <div className="flex min-w-0 flex-1 items-center gap-2 border-l border-white/20 pl-3 sm:pl-4" aria-label="Assigned truck and district">
              <Truck size={16} className="shrink-0 text-white/80" />
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-white/60">Assigned truck · district</span>
                <span className="truncate text-xs font-semibold text-white" title={truckAssignments.join(" / ")}>
                  {truckAssignments.length ? truckAssignments.join(" / ") : "No active truck assignment"}
                </span>
              </div>
            </div>
          )}
        </div>

        {role !== "agent" && (
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              aria-keyshortcuts="Control+K Meta+K"
              title="Press Ctrl+K or Command+K to search"
              placeholder="Search products, customers, orders…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-24 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            />
            <kbd className="absolute right-10 top-1/2 hidden -translate-y-1/2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/65 xl:block">Ctrl / ⌘ K</kbd>
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 relative">
        {/* Notification button */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer text-white relative transition-all hover:bg-white/20"
        >
          <span className="text-lg">🔔</span>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red rounded-full text-[10px] flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}
        </button>

        {role === "admin" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Administration" className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-white/20">
                <ShieldCheck size={17} aria-hidden="true" />
                <span className="hidden sm:inline">Administration</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-navy text-white border-white/20">
              <DropdownMenuItem onClick={() => navigate("/audit")} className="focus:bg-white/10 focus:text-white cursor-pointer">Audit Log</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/manage-accounts")} className="focus:bg-white/10 focus:text-white cursor-pointer">Manage Accounts</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Settings dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer text-white transition-all hover:bg-white/20">
              <span className="text-lg">⚙️</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-navy text-white border-white/20">
            <DropdownMenuItem onClick={onLogout} className="focus:bg-white/10 focus:text-white cursor-pointer">Log Out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notification Panel */}
        {showNotifications && (
          <NotificationPanel
            notifications={notifications}
            isLoading={isLoadingNotifications}
            error={notificationError}
            onRefresh={() => void refreshNotifications()}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDismiss={dismiss}
            onClose={() => setShowNotifications(false)}
          />
        )}
      </div>
    </header>
  );
}
