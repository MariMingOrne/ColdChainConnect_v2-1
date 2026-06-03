import { Routes, Route } from "react-router-dom";
import { HubSidebar } from "@/components/HubSidebar";
import { Pricing } from "./modules/Pricing";
import { Inventory } from "./Inventory";
import { Customers } from "./modules/Customers";
import { Drivers } from "./modules/Drivers";
import { Agents } from "./modules/Agents";
import { InventoryProvider } from "../context/InventoryContext";

const modules = [
  { label: "Products", path: "/products" },
  { label: "Inventory", path: "/inventory" },
  { label: "Customers", path: "/customers" },
  { label: "Agents", path: "/agents" },
  { label: "Drivers", path: "/drivers" },
];

export function InformationManagement() {
  return (
    <InventoryProvider>
      <div className="flex h-full">
        <HubSidebar modules={modules} basePath="/information-management" />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/products" element={<Pricing />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/" element={<ProductsDefault />} />
          </Routes>
        </div>
      </div>
    </InventoryProvider>
  );
}

function ProductsDefault() {
  return <Pricing />;
}
