import { RequestHandler } from "express";
import { InventoryBatch, InventoryBatchItem, CreateInventoryBatchSchema, UpdateInventoryBatchSchema } from "../../shared/api";

const inventoryBatches: InventoryBatch[] = [
  {
    id: "inv-batch-001",
    name: "Morning Delivery",
    status: "closed",
    created_at: new Date("2024-01-15").toISOString(),
    closed_at: new Date("2024-01-15").toISOString(),
    updated_at: new Date("2024-01-15").toISOString(),
    items: [
      {
        id: "inv-item-001",
        batch_id: "inv-batch-001",
        product_id: "prod-1",
        qty_units: 100,
        unit_cost: "50.00",
        created_at: new Date("2024-01-15").toISOString(),
        updated_at: new Date("2024-01-15").toISOString(),
      },
      {
        id: "inv-item-002",
        batch_id: "inv-batch-001",
        product_id: "prod-2",
        qty_units: 50,
        unit_cost: "75.00",
        created_at: new Date("2024-01-15").toISOString(),
        updated_at: new Date("2024-01-15").toISOString(),
      },
    ],
  },
  {
    id: "inv-batch-002",
    name: "Weekly Restock",
    status: "open",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: "inv-item-003",
        batch_id: "inv-batch-002",
        product_id: "prod-3",
        qty_units: 200,
        unit_cost: "100.00",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

export const listInventoryBatches: RequestHandler = (_req, res) => {
  res.json(inventoryBatches);
};

export const getInventoryBatch: RequestHandler = (req, res) => {
  const { id } = req.params;
  const batch = inventoryBatches.find((b) => b.id === id);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json(batch);
};

export const createInventoryBatch: RequestHandler = (req, res) => {
  try {
    const { name, items } = CreateInventoryBatchSchema.parse(req.body);
    const batchId = `inv-batch-${Date.now()}`;
    const now = new Date().toISOString();

    const batchItems: InventoryBatchItem[] = items.map((item, idx) => ({
      id: `inv-item-${Date.now()}-${idx}`,
      batch_id: batchId,
      product_id: item.product_id,
      qty_units: item.qty_units,
      unit_cost: "0.00",
      created_at: now,
      updated_at: now,
    }));

    const newBatch: InventoryBatch = {
      id: batchId,
      name,
      status: "open",
      created_at: now,
      updated_at: now,
      items: batchItems,
    };

    inventoryBatches.push(newBatch);
    res.status(201).json(newBatch);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updateInventoryBatch: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const updates = UpdateInventoryBatchSchema.parse(req.body);

    const batch = inventoryBatches.find((b) => b.id === id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });

    if (updates.name) batch.name = updates.name;
    if (updates.status) {
      batch.status = updates.status;
      if (updates.status === "closed") {
        batch.closed_at = new Date().toISOString();
      }
    }
    batch.updated_at = new Date().toISOString();

    res.json(batch);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteInventoryBatch: RequestHandler = (req, res) => {
  const { id } = req.params;
  const idx = inventoryBatches.findIndex((b) => b.id === id);
  if (idx === -1) return res.status(404).json({ error: "Batch not found" });

  const [deleted] = inventoryBatches.splice(idx, 1);
  res.json({ message: "Batch deleted", batch: deleted });
};

export const addInventoryBatchItem: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, qty_units } = req.body;

    const batch = inventoryBatches.find((b) => b.id === id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.status === "closed") return res.status(400).json({ error: "Cannot add items to closed batch" });

    if (!batch.items) batch.items = [];

    const newItem: InventoryBatchItem = {
      id: `inv-item-${Date.now()}`,
      batch_id: id,
      product_id,
      qty_units,
      unit_cost: "0.00",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    batch.items.push(newItem);
    batch.updated_at = new Date().toISOString();

    res.status(201).json(newItem);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeInventoryBatchItem: RequestHandler = (req, res) => {
  const { id, itemId } = req.params;
  const batch = inventoryBatches.find((b) => b.id === id);
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  if (batch.status === "closed") return res.status(400).json({ error: "Cannot modify closed batch" });

  const itemIdx = batch.items?.findIndex((i) => i.id === itemId) ?? -1;
  if (itemIdx === -1) return res.status(404).json({ error: "Item not found" });

  const [deleted] = batch.items!.splice(itemIdx, 1);
  batch.updated_at = new Date().toISOString();

  res.json({ message: "Item removed", item: deleted });
};
