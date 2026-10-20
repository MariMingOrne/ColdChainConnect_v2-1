import { Routes, Route, Navigate } from "react-router-dom";
import { HubSidebar } from "@/components/HubSidebar";
import { BookingSummary } from "./modules/BookingSummary";
import { Invoicing } from "./modules/Invoicing";
import { DeliveryDispatch } from "./modules/Delivery";
import { AccountsReceivable } from "./modules/AccountsReceivable";
import { DeliveryHistory } from "./modules/DeliveryHistory";
import { AgentReports } from "./modules/AgentReports";
import { BookingInventory } from "./modules/BookingInventory";
import { AgentDeliverySchedule } from "./modules/AgentDeliverySchedule";
import { Preparation } from "./modules/Preparation";
import { AgentPalletTracking } from "./modules/AgentPalletTracking";
import { InventoryProvider } from "../context/InventoryContext";
import { useAuth } from "../hooks/useAuth";

const adminModules = [
  { label: "Orders",              path: "/order-summary" },
  { label: "Pallet Preparation", path: "/preparation" },
  { label: "Pallet Tracking",     path: "/inventory" },
  { label: "Receipts",            path: "/invoicing" },
  { label: "Truck Dispatch",      path: "/delivery" },
  { label: "Accounts Receivable", path: "/accounts" },
  { label: "Delivery History",    path: "/delivery-history" },
  { label: "Returns",             path: "/agent-returns" },
];

const agentModules = [
  { label: "Orders",            path: "/order-summary" },
  { label: "Pallet Tracking", path: "/preparation" },
  { label: "Delivery Schedule", path: "/inventory" },
  { label: "Returns",           path: "/agent-returns" },
];

export function BookingDispatch() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";
  const modules = isAgent ? agentModules : adminModules;

  return (
    <InventoryProvider>
      <div className="flex h-full min-h-0 min-w-0">
        {/* Sidebar for admin, bottom bar for agent (rendered inside HubSidebar) */}
        <HubSidebar
          modules={modules}
          basePath="/booking-dispatch"
          agentMode={isAgent}
        />

        {/* Content — add bottom padding for agent so bar doesn't overlap */}
        <div className={`hide-scrollbar min-h-0 flex-1 overflow-auto ${isAgent ? "pb-20" : ""}`}>
          <Routes>
            <Route path="/order-summary"    element={<BookingSummary />} />
            <Route path="/preparation"      element={isAgent ? <AgentPalletTracking /> : <Preparation />} />
            <Route path="/inventory"        element={isAgent ? <AgentDeliverySchedule /> : <BookingInventory />} />
            <Route path="/invoicing"        element={<Invoicing />} />
            <Route
              path="/delivery"
              element={isAgent ? <Navigate to="/booking-dispatch/order-summary" replace /> : <DeliveryDispatch />}
            />
            <Route path="/accounts"         element={<AccountsReceivable />} />
            <Route path="/delivery-history" element={<DeliveryHistory />} />
            <Route path="/agent-returns"    element={<AgentReports />} />
            <Route path="/"                 element={<BookingSummary />} />
          </Routes>
        </div>
      </div>
    </InventoryProvider>
  );
}
