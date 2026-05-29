import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface PalletItem {
  id: string;
  productId: string;
  quantity: number;
  expirationNote?: string;
}

export interface Pallet {
  id: string;
  palletId: string;
  supplierName?: string;
  receivedDate?: string;
  temperatureLog?: string;
  storageZone?: string;
  placementLocation?: string;
  items: PalletItem[];
}

export interface Batch {
  id: string;
  name: string;
  pallets: Pallet[];
  createdAt: string;
}

interface InventoryContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedBatchId: string;
  setSelectedBatchId: (id: string) => void;
  selectedPalletId: string | null;
  setSelectedPalletId: (id: string | null) => void;
  batches: Batch[];
  setBatches: (batches: Batch[]) => void;
  refreshBatchesFromDB: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const STORAGE_KEY_SELECTED = "inventory_selected_batch";
const STORAGE_KEY_SELECTED_PALLET = "inventory_selected_pallet";

const ALL_PRODUCTS_BATCH: Batch = {
  id: "batch-all",
  name: "All Products",
  pallets: [],
  createdAt: new Date().toISOString(),
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("batch-all");
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([ALL_PRODUCTS_BATCH]);

  const refreshBatchesFromDB = async () => {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/batches", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const dbBatches: any[] = await res.json();
      const converted = dbBatches.map((batch) => ({
        id: batch.id,
        name: batch.batch_name,
        createdAt: batch.created_at,
        pallets: (batch.pallets || []).map((pallet: any) => ({
          id: pallet.id,
          palletId: pallet.pallet_id,
          supplierName: pallet.supplier_name,
          receivedDate: pallet.received_date,
          temperatureLog: pallet.temperature_log,
          storageZone: pallet.storage_zone,
          placementLocation: pallet.placement_location,
          items: (pallet.items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            quantity: item.qty_units,
            expirationNote: item.expiration_date_note,
          })),
        })),
      }));
      setBatches([ALL_PRODUCTS_BATCH, ...converted]);
      setSelectedPalletId(null);
    } catch (err) {
      console.error("Failed to refresh batches from DB:", err);
    }
  };

  useEffect(() => {
    const savedSelected = localStorage.getItem(STORAGE_KEY_SELECTED) || "batch-all";
    setSelectedBatchId(savedSelected);
    refreshBatchesFromDB();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      localStorage.setItem(STORAGE_KEY_SELECTED, selectedBatchId);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedPalletId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_PALLET, selectedPalletId);
    } else {
      localStorage.removeItem(STORAGE_KEY_SELECTED_PALLET);
    }
  }, [selectedPalletId]);

  return (
    <InventoryContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedBatchId,
        setSelectedBatchId,
        selectedPalletId,
        setSelectedPalletId,
        batches,
        setBatches,
        refreshBatchesFromDB,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryContext() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventoryContext must be used within InventoryProvider");
  return ctx;
}
