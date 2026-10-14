import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { HubSidebar } from "@/components/HubSidebar";
import { CreateAccountDialog } from "@/components/CreateAccountDialog";
import { Agents } from "./modules/Agents";
import { Drivers } from "./modules/Drivers";

const modules = [
  { label: "Agents", path: "/agents" },
  { label: "Drivers", path: "/drivers" },
];

export function ManageAccounts() {
  const [showCreateAccount, setShowCreateAccount] = useState(false);

  return (
    <div className="flex h-full">
      <HubSidebar modules={modules} basePath="/manage-accounts" />
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="px-4 md:px-6 lg:px-7 pt-4 md:pt-6 flex justify-end">
          <button
            onClick={() => setShowCreateAccount(true)}
            className="px-4 py-2 bg-navy text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Create Accounts
          </button>
        </div>
        <Routes>
          <Route path="/agents" element={<Agents />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/" element={<Agents />} />
        </Routes>
      </div>

      <CreateAccountDialog open={showCreateAccount} onOpenChange={setShowCreateAccount} />
    </div>
  );
}
