import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { InformationManagement } from "./pages/InformationManagement";
import { ManageAccounts } from "./pages/ManageAccounts";
import { BookingDispatch } from "./pages/BookingDispatch";
import { AuditLogPage } from "./pages/AuditLog";
import { Reports } from "./pages/Reports";
import { SearchResults } from "./pages/SearchResults";
import { DriverSchedule } from "./pages/DriverSchedule";
import { Topbar } from "./components/Topbar";
import { AdminNavigation } from "./components/AdminNavigation";
import { PostLoginLoadingScreen } from "./components/auth/PostLoginLoadingScreen";
import { BottomNavBar } from "./components/BottomNavBar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Full layout: topbar + bottom nav (admin only) */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { logout, user } = useAuth();
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar userName={user?.username || "User"} onLogout={logout} />
      <AdminNavigation />
      <div className="flex flex-1">
        <div className="flex-1 flex flex-col bg-off-white min-w-0 pb-32 md:pb-0 animate-fade-in">
          {children}
        </div>
      </div>
      <BottomNavBar onLogout={logout} />
    </div>
  );
};

/** Agent layout: topbar only, no bottom nav, no back-to-dashboard */
const AgentLayout = ({ children, agentMode = false }: { children: React.ReactNode; agentMode?: boolean }) => {
  const { logout, user } = useAuth();
  return (
    <div className={agentMode ? "flex h-dvh min-h-0 flex-col overflow-hidden" : "flex flex-col min-h-screen"}>
      <Topbar userName={user?.username || "User"} onLogout={logout} agentMode />
      <div className={`flex-1 flex flex-col bg-off-white min-w-0 animate-fade-in ${agentMode ? "min-h-0" : ""}`}>
        {children}
      </div>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, user } = useAuth();
  const isAgent = user?.role === "agent";
  const isDriver = user?.role === "driver";

  // ── Driver: only their delivery schedule is accessible ──────────
  if (isAuthenticated && isDriver) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/driver-schedule" element={<AgentLayout><DriverSchedule /></AgentLayout>} />
        <Route path="*" element={<Navigate to="/driver-schedule" replace />} />
      </Routes>
    );
  }

  // ── Agent: only booking-dispatch is accessible ──────────────────
  if (isAuthenticated && isAgent) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/booking-dispatch/*"
          element={
            <AgentLayout agentMode>
              <BookingDispatch />
            </AgentLayout>
          }
        />
        <Route path="/search" element={<AgentLayout><SearchResults /></AgentLayout>} />
        {/* Everything else → booking-dispatch */}
        <Route path="*" element={<Navigate to="/booking-dispatch/order-summary" replace />} />
      </Routes>
    );
  }

  // ── Admin: full access ───────────────────────────────────────────
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isAuthenticated ? <AppLayout><Dashboard /></AppLayout> : <Login />} />
      <Route path="/information-management/*" element={isAuthenticated ? <AppLayout><InformationManagement /></AppLayout> : <Login />} />
      <Route path="/manage-accounts/*" element={isAuthenticated ? <AppLayout><ManageAccounts /></AppLayout> : <Login />} />
      <Route path="/booking-dispatch/*" element={isAuthenticated ? <AppLayout><BookingDispatch /></AppLayout> : <Login />} />
      <Route path="/audit" element={isAuthenticated ? <AppLayout><AuditLogPage /></AppLayout> : <Login />} />
      <Route path="/reports" element={isAuthenticated ? <AppLayout><Reports /></AppLayout> : <Login />} />
      <Route path="/search" element={isAuthenticated ? <AppLayout><SearchResults /></AppLayout> : <Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function PostLoginLoadingGate() {
  const isPostLoginLoading = useAuth((state) => state.isPostLoginLoading);
  return isPostLoginLoading ? <PostLoginLoadingScreen /> : null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
        <PostLoginLoadingGate />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.hasChildNodes()) {
  createRoot(rootElement).render(<App />);
}
