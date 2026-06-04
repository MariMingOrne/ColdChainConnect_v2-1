import { RequestHandler } from "express";
import { Pallet, PalletItem, CreatePalletSchema, UpdatePalletStatusSchema } from "@shared/api";

const pallets: Pallet[] = [];
let productInventory: Record<string, number> = {
  "prod-1": 100,
  "prod-2": 50,
  "prod-3": 200,
};

export const listPallets: RequestHandler = (_req, res) => {
  res.json(pallets);
};

export const getPallet: RequestHandler = (req, res) => {
  const { id } = req.params;
  const pallet = pallets.find((p) => p.id === id);
  if (!pallet) return res.status(404).json({ error: "Pallet not found" });
  res.json(pallet);
};

export const createPallet: RequestHandler = (req, res) => {
  try {
    const { order_id, items } = CreatePalletSchema.parse(req.body);
    const palletId = `pallet-${Date.now()}`;
    const now = new Date().toISOString();

    const palletItems: PalletItem[] = items.map((item, idx) => ({
      id: `pallet-item-${Date.now()}-${idx}`,
      pallet_id: palletId,
      product_id: item.product_id,
      qty_units: item.qty_units,
      unit_cost: "0.00",
      batch_item_id: item.batch_item_id,
      created_at: now,
      updated_at: now,
    }));

    const newPallet: Pallet = {
      id: palletId,
      order_id,
      status: "draft",
      created_at: now,
      updated_at: now,
      items: palletItems,
      batch_links: [],
    };

    pallets.push(newPallet);
    res.status(201).json(newPallet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const updatePalletStatus: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;
    const { status } = UpdatePalletStatusSchema.parse(req.body);

    const pallet = pallets.find((p) => p.id === id);
    if (!pallet) return res.status(404).json({ error: "Pallet not found" });

    pallet.status = status;
    pallet.updated_at = new Date().toISOString();

    res.json(pallet);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const approvePallet: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;

    const pallet = pallets.find((p) => p.id === id);
    if (!pallet) return res.status(404).json({ error: "Pallet not found" });
    if (pallet.status !== "draft") return res.status(400).json({ error: "Only draft pallets can be approved" });

    if (pallet.items) {
      for (const item of pallet.items) {
        if (!productInventory[item.product_id]) {
          productInventory[item.product_id] = 0;
        }
        const deductAmount = Math.min(item.qty_units, productInventory[item.product_id]);
        productInventory[item.product_id] -= deductAmount;
      }
    }

    pallet.status = "approved";
    pallet.updated_at = new Date().toISOString();

    res.json({ pallet, inventory: productInventory });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePallet: RequestHandler = (req, res) => {
  const { id } = req.params;
  const idx = pallets.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Pallet not found" });

  const [deleted] = pallets.splice(idx, 1);
  res.json({ message: "Pallet deleted", pallet: deleted });
};

export const getProductInventory: RequestHandler = (_req, res) => {
  res.json(productInventory);
};

export const suggestBatches: RequestHandler = async (req, res) => {
  const { orderId } = req.params;

  // Placeholder: would fetch order items and find compatible batches
  res.json({
    order_id: orderId,
    suggested_batches: [
      {
        batch_id: "inv-batch-001",
        batch_name: "Morning Delivery",
        compatibility_score: 0.9,
        items_available: [
          { product_id: "prod-1", qty_available: 50, qty_needed: 40 },
        ],
      },
    ],
  });
};
