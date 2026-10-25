import type { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { CreateCustomerSchema, CreateProductSchema } from "../../shared/api";
import { db } from "../db";
import { batch_pallets, customer_discounts, customers, inventory_batches, pallet_items, products } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";

const MAX_IMPORT_ROWS = 1000;

function rowsFromBody(body: unknown): Record<string, unknown>[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { rows?: unknown }).rows)) return null;
  const rows = (body as { rows: unknown[] }).rows;
  if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS || rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) return null;
  return rows as Record<string, unknown>[];
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Invalid import data";
}

export const importProducts: RequestHandler = async (req: AuthRequest, res) => {
  const rows = rowsFromBody(req.body);
  if (!rows) return res.status(400).json({ error: `Import 1–${MAX_IMPORT_ROWS} product rows.` });

  const parsedProducts: z.infer<typeof CreateProductSchema>[] = [];
  for (const [index, row] of rows.entries()) {
    const parsed = CreateProductSchema.safeParse({
      name: row.name,
      sku: row.sku || undefined,
      price: row.price,
      batch_tracking_enabled: row.batch_tracking_enabled === "false" || row.batch_tracking_enabled === false ? false : row.batch_tracking_enabled === "true" || row.batch_tracking_enabled === true ? true : undefined,
      reorder_point: row.reorder_point === "" || row.reorder_point == null ? undefined : Number(row.reorder_point),
      manufacturer: row.manufacturer || undefined,
      is_discontinued: row.is_discontinued === true || String(row.is_discontinued).toLowerCase() === "true",
    });
    if (!parsed.success) return res.status(400).json({ error: `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "invalid product"}` });
    parsedProducts.push(parsed.data);
  }

  const names = new Set<string>();
  const skus = new Set<string>();
  for (const [index, product] of parsedProducts.entries()) {
    const name = product.name.trim().toLowerCase();
    const sku = product.sku?.trim().toLowerCase();
    if (names.has(name) || (sku && skus.has(sku))) return res.status(400).json({ error: `Row ${index + 2}: duplicate product name or SKU in this file.` });
    names.add(name);
    if (sku) skus.add(sku);
  }

  try {
    const existing = await db.query.products.findMany({ columns: { name: true, sku: true } });
    const existingNames = new Set(existing.map((product) => product.name.toLowerCase()));
    const existingSkus = new Set(existing.flatMap((product) => product.sku ? [product.sku.toLowerCase()] : []));
    const duplicateIndex = parsedProducts.findIndex((product) => existingNames.has(product.name.trim().toLowerCase()) || (product.sku && existingSkus.has(product.sku.trim().toLowerCase())));
    if (duplicateIndex >= 0) return res.status(409).json({ error: `Row ${duplicateIndex + 2}: a product with this name or SKU already exists.` });

    const created = parsedProducts.map((product) => ({
      id: randomUUID(),
      ...product,
      name: product.name!,
      price: String(product.price!),
      batch_tracking_enabled: product.batch_tracking_enabled ?? true,
    }));
    await db.transaction(async (tx) => {
      await tx.insert(products).values(created);
    });
    if (req.user) await Promise.all(created.map((product) => logAction(req.user!.userId, "import", "product", product.id, undefined, product)));
    res.status(201).json({ imported: created.length });
  } catch (error) {
    console.error("Product import failed:", error);
    res.status(500).json({ error: messageFromError(error) });
  }
};

export const importCustomers: RequestHandler = async (req: AuthRequest, res) => {
  const rows = rowsFromBody(req.body);
  if (!rows) return res.status(400).json({ error: `Import 1–${MAX_IMPORT_ROWS} customer rows.` });

  const parsedCustomers: z.infer<typeof CreateCustomerSchema>[] = [];
  for (const [index, row] of rows.entries()) {
    let discounts: unknown[] = [];
    try {
      if (row.discounts_json) discounts = JSON.parse(String(row.discounts_json));
    } catch {
      return res.status(400).json({ error: `Row ${index + 2}: Discounts JSON is invalid.` });
    }
    const creditLimit = row.credit_limit === "" || row.credit_limit == null ? null : Number(row.credit_limit);
    const terms = row.credit_terms_days === "" || row.credit_terms_days == null ? undefined : Number(row.credit_terms_days);
    const parsed = CreateCustomerSchema.safeParse({
      store_name: row.store_name,
      location: row.location,
      district: row.district || undefined,
      street_number: row.street_number || undefined,
      street_address: row.street_address || undefined,
      state: row.state || undefined,
      postal_code: row.postal_code || undefined,
      latitude: row.latitude === "" || row.latitude == null ? undefined : Number(row.latitude),
      longitude: row.longitude === "" || row.longitude == null ? undefined : Number(row.longitude),
      contact_person: row.contact_person || undefined,
      contact_info: row.contact_info || undefined,
      payment_type: row.payment_type || undefined,
      credit_limit: creditLimit,
      credit_terms_days: terms,
      discounts,
    });
    if (!parsed.success) return res.status(400).json({ error: `Row ${index + 2}: ${parsed.error.issues[0]?.message ?? "invalid customer"}` });
    parsedCustomers.push(parsed.data);
  }

  const identities = new Set<string>();
  for (const [index, customer] of parsedCustomers.entries()) {
    const identity = `${customer.store_name.trim().toLowerCase()}|${customer.location.trim().toLowerCase()}`;
    if (identities.has(identity)) return res.status(400).json({ error: `Row ${index + 2}: duplicate store and city in this file.` });
    identities.add(identity);
  }

  try {
    const existing = await db.query.customers.findMany({ columns: { store_name: true, location: true } });
    const existingIdentities = new Set(existing.map((customer) => `${customer.store_name.toLowerCase()}|${customer.location.toLowerCase()}`));
    const duplicateIndex = parsedCustomers.findIndex((customer) => existingIdentities.has(`${customer.store_name.trim().toLowerCase()}|${customer.location.trim().toLowerCase()}`));
    if (duplicateIndex >= 0) return res.status(409).json({ error: `Row ${duplicateIndex + 2}: this store and city already exists.` });

    const created = parsedCustomers.map((customer) => ({
      id: randomUUID(),
      ...customer,
      store_name: customer.store_name!,
      location: customer.location!,
      latitude: customer.latitude ?? null,
      longitude: customer.longitude ?? null,
      credit_limit: customer.credit_limit == null ? null : String(customer.credit_limit),
      credit_terms_days: customer.credit_terms_days ?? 30,
    }));
    await db.transaction(async (tx) => {
      await tx.insert(customers).values(created);
      const discountRows = created.flatMap((customer) => (customer.discounts ?? []).map((discount) => ({
        id: randomUUID(),
        customer_id: customer.id,
        label: discount.label,
        rate: String(discount.rate),
      })));
      if (discountRows.length) await tx.insert(customer_discounts).values(discountRows);
    });
    if (req.user) await Promise.all(created.map((customer) => logAction(req.user!.userId, "import", "customer", customer.id, undefined, customer)));
    res.status(201).json({ imported: created.length });
  } catch (error) {
    console.error("Customer import failed:", error);
    res.status(500).json({ error: messageFromError(error) });
  }
};

interface StockImportRow {
  batch_name: string;
  pallet_id: string;
  sku: string;
  quantity: number;
  expiration_date_note?: string;
  supplier_name?: string;
  received_date?: string;
  storage_zone?: string;
  placement_location?: string;
}

export const importInventory: RequestHandler = async (req: AuthRequest, res) => {
  const bodyRows = rowsFromBody(req.body);
  if (!bodyRows) return res.status(400).json({ error: `Import 1–${MAX_IMPORT_ROWS} stock rows.` });
  const rows = bodyRows as unknown as StockImportRow[];

  try {
    const productList = await db.query.products.findMany({ columns: { id: true, sku: true, name: true } });
    const productBySku = new Map<string, string>();
    for (const product of productList) {
      productBySku.set((product.sku || product.name).trim().toLowerCase(), product.id);
    }

    const groups = new Map<string, { batchName: string; palletId: string; supplierName?: string; receivedDate?: string; storageZone?: string; placementLocation?: string; items: { product_id: string; qty_units: number; expiration_date_note?: string }[] }>();
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const batchName = String(row.batch_name ?? "").trim();
    const palletId = String(row.pallet_id ?? "").trim();
    const sku = String(row.sku ?? "").trim().toLowerCase();
    const quantity = Number(row.quantity);
    const productId = productBySku.get(sku);
    if (!batchName || !palletId || !sku || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: `Row ${rowNumber}: batch name, pallet ID, SKU, and a positive whole-number quantity are required.` });
    }
    if (!productId) return res.status(400).json({ error: `Row ${rowNumber}: SKU “${row.sku}” was not found.` });

    const key = `${batchName.toLowerCase()}|${palletId.toLowerCase()}`;
    const metadata = {
      supplierName: row.supplier_name ? String(row.supplier_name).trim() : undefined,
      receivedDate: row.received_date ? String(row.received_date).trim() : undefined,
      storageZone: row.storage_zone ? String(row.storage_zone).trim() : undefined,
      placementLocation: row.placement_location ? String(row.placement_location).trim() : undefined,
    };
    const group = groups.get(key);
    if (group && (group.supplierName !== metadata.supplierName || group.receivedDate !== metadata.receivedDate || group.storageZone !== metadata.storageZone || group.placementLocation !== metadata.placementLocation)) {
      return res.status(400).json({ error: `Row ${rowNumber}: pallet details must match for every row with the same batch and pallet ID.` });
    }
    const pallet = group ?? { batchName, palletId, ...metadata, items: [] };
    pallet.items.push({ product_id: productId, qty_units: quantity, expiration_date_note: row.expiration_date_note ? String(row.expiration_date_note).trim() : undefined });
    groups.set(key, pallet);
  }

    const pallets = [...groups.values()];
    const existingBatches = await db.query.inventory_batches.findMany({ with: { pallets: { columns: { pallet_id: true } } } });
    const existingPallets = new Set(existingBatches.flatMap((batch) => batch.pallets.map((pallet) => `${batch.batch_name.toLowerCase()}|${pallet.pallet_id.toLowerCase()}`)));
    const duplicate = pallets.find((pallet) => existingPallets.has(`${pallet.batchName.toLowerCase()}|${pallet.palletId.toLowerCase()}`));
    if (duplicate) return res.status(409).json({ error: `Pallet “${duplicate.palletId}” already exists in batch “${duplicate.batchName}”.` });

    const importedBatchIds: string[] = [];
    await db.transaction(async (tx) => {
      const byBatch = new Map<string, typeof pallets>();
      for (const pallet of pallets) byBatch.set(pallet.batchName, [...(byBatch.get(pallet.batchName) ?? []), pallet]);
      for (const [batchName, batchPallets] of byBatch) {
        const batchId = randomUUID();
        importedBatchIds.push(batchId);
        await tx.insert(inventory_batches).values({ id: batchId, batch_name: batchName });
        for (const pallet of batchPallets) {
          const palletDbId = randomUUID();
          await tx.insert(batch_pallets).values({
            id: palletDbId,
            batch_id: batchId,
            pallet_id: pallet.palletId,
            supplier_name: pallet.supplierName ?? null,
            received_date: pallet.receivedDate ?? null,
            storage_zone: pallet.storageZone ?? null,
            placement_location: pallet.placementLocation ?? null,
          });
          await tx.insert(pallet_items).values(pallet.items.map((item) => ({
            id: randomUUID(),
            pallet_id: palletDbId,
            product_id: item.product_id,
            qty_units: item.qty_units,
            expiration_date_note: item.expiration_date_note ?? null,
          })));
        }
      }
    });
    if (req.user) await Promise.all(importedBatchIds.map((id) => logAction(req.user!.userId, "import", "batch", id)));
    res.status(201).json({ imported: rows.length, pallets: pallets.length });
  } catch (error) {
    console.error("Inventory import failed:", error);
    res.status(500).json({ error: messageFromError(error) });
  }
};
