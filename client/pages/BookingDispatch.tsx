import { Routes, Route } from "react-router-dom";
import { HubSidebar } from "@/components/HubSidebar";
import { BookingSummary } from "./modules/BookingSummary";
import { Invoicing } from "./modules/Invoicing";
import { DeliveryDispatch } from "./modules/Delivery";
import { AccountsReceivable } from "./modules/AccountsReceivable";
import { DeliveryHistory } from "./modules/DeliveryHistory";
import { BookingInventory } from "./modules/BookingInventory";
import { Preparation } from "./modules/Preparation";
import { InventoryProvider } from "../context/InventoryContext";
import { useAuth } from "../hooks/useAuth";

const adminModules = [
  { label: "Order Summary",       path: "/order-summary" },
  { label: "Preparation",         path: "/preparation" },
  { label: "Pallets",             path: "/inventory" },
  { label: "Invoicing",           path: "/invoicing" },
  { label: "Delivery",            path: "/delivery" },
  { label: "Accounts Receivable", path: "/accounts" },
  { label: "Delivery History",    path: "/delivery-history" },
];

const agentModules = [
  { label: "Order Summary", path: "/order-summary" },
  { label: "Preparation",   path: "/preparation" },
  { label: "Delivery",      path: "/delivery" },
];

export function BookingDispatch() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";
  const modules = isAgent ? agentModules : adminModules;

  return (
    <InventoryProvider>
      <div className="flex h-full">
        {/* Sidebar for admin, bottom bar for agent (rendered inside HubSidebar) */}
        <HubSidebar modules={modules} basePath="/booking-dispatch" agentMode={isAgent} />

        {/* Content — add bottom padding for agent so bar doesn't overlap */}
        <div className={`flex-1 overflow-auto ${isAgent ? "pb-20" : ""}`}>
          <Routes>
            <Route path="/order-summary"    element={<BookingSummary />} />
            <Route path="/preparation"      element={<Preparation />} />
            <Route path="/inventory"        element={<BookingInventory />} />
            <Route path="/invoicing"        element={<Invoicing />} />
            <Route path="/delivery"         element={<DeliveryDispatch />} />
            <Route path="/accounts"         element={<AccountsReceivable />} />
            <Route path="/delivery-history" element={<DeliveryHistory />} />
            <Route path="/"                 element={<BookingSummary />} />
          </Routes>
        </div>
      </div>
    </InventoryProvider>
  );
}
