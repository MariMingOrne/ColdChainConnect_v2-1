import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface BatchItem {
  productId: string;
  quantity: number;
  expiryDate: string;
}

export interface Batch {
  id: string;
  name: string;
  items: BatchItem[];
  createdAt: string;
}

interface InventoryContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedBatchId: string;
  setSelectedBatchId: (id: string) => void;
  batches: Batch[];
  setBatches: (batches: Batch[]) => void;
}

const InventoryContext = createContext<InventoryContextType | null>(null);

const STORAGE_KEYS = {
  BATCHES: "inventory_batches",
  SELECTED_BATCH: "inventory_selected_batch",
};

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);

  // Initialize batches from localStorage on mount
  useEffect(() => {
    const savedBatches = localStorage.getItem(STORAGE_KEYS.BATCHES);
    const savedSelectedBatch = localStorage.getItem(STORAGE_KEYS.SELECTED_BATCH);

    const allProductsBatch: Batch = {
      id: "batch-all",
      name: "All Products",
      items: [],
      createdAt: new Date().toISOString(),
    };

    if (savedBatches) {
      try {
        let parsedBatches = JSON.parse(savedBatches);
        parsedBatches = parsedBatches.filter((b: any) => b.id !== "batch-all");
        parsedBatches = parsedBatches.map((batch: any) => {
          if (batch.productIds && !batch.items) {
            return {
              ...batch,
              items: batch.productIds.map((productId: string) => ({
                productId,
                quantity: 0,
                expiryDate: new Date().toISOString().split("T")[0],
              })),
              productIds: undefined,
            };
          }
          return batch;
        });
        setBatches([allProductsBatch, ...parsedBatches]);
        setSelectedBatchId(savedSelectedBatch || "batch-all");
      } catch {
        setBatches([allProductsBatch]);
        setSelectedBatchId("batch-all");
      }
    } else {
      setBatches([allProductsBatch]);
      setSelectedBatchId("batch-all");
    }
  }, []);

  // Persist batches to localStorage whenever they change
  useEffect(() => {
    if (batches.length > 0) {
      localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
    }
  }, [batches]);

  // Persist selected batch to localStorage
  useEffect(() => {
    if (selectedBatchId) {
      localStorage.setItem(STORAGE_KEYS.SELECTED_BATCH, selectedBatchId);
    }
  }, [selectedBatchId]);

  return (
    <InventoryContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedBatchId,
        setSelectedBatchId,
        batches,
        setBatches,
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
