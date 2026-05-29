import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { NotificationPanel } from "./NotificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface TopbarProps {
  userName: string;
  onLogout?: () => void;
}

export function Topbar({ userName, onLogout }: TopbarProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount] = useState(4);

  return (
    <header className="bg-navy px-6 md:px-8 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-10 shadow-sm gap-4 md:gap-6">
      {/* Left Section - Logo & Back Button */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Back to Dashboard"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="h-6 w-px bg-white/20 hidden sm:block" />

        <div className="flex items-center gap-2">
          <img src="https://cdn.builder.io/api/v1/image/assets%2F95235f61d85340cc8929dd5e2ec9cafe%2F04690f469f254fd393684ed5411b7cab?format=webp&width=800&height=1200" alt="ACDP Logo" className="w-8 h-8 object-cover rounded-full" />
          <div className="font-rajdhani text-xl font-bold letter-spacing-wider text-white hidden sm:block">
            ACDP
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <input
          type="text"
          placeholder="Search Term"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
        />
      </div>

      {/* Filter Button */}
      <button className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all flex items-center gap-2 hidden sm:flex">
        <span>⊙</span>
        Filter
      </button>

      {/* Right Section */}
      <div className="flex items-center gap-2 relative">
        {/* Notification button */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center cursor-pointer text-white relative transition-all hover:bg-white/20"
        >
          <span className="text-lg">🔔</span>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red rounded-full text-xs flex items-center justify-center text-white font-bold">
              {unreadCount}
            </div>
          )}
        </button>

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
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        )}
      </div>
    </header>
  );
}
