import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { products } from "../db/schema";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { demoProducts } from "../demo-data";

export const listProducts: RequestHandler = async (_req, res) => {
  try {
    // Use demo data if no database
    if (!process.env.DATABASE_URL) {
      return res.json(demoProducts);
    }

    const allProducts = await db.query.products.findMany();
    res.json(allProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createProduct: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { name, sku, price, image_filename, batch_tracking_enabled } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: "Name and price are required" });
  }

  try {
    const id = randomUUID();
    await db.insert(products).values({
      id,
      name,
      sku: sku || null,
      price: price.toString(),
      image_filename: image_filename || null,
      batch_tracking_enabled: batch_tracking_enabled ?? true,
    });

    const newProduct = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "product",
        id,
        undefined,
        newProduct
      );
    }

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProduct: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { name, sku, price, image_filename, batch_tracking_enabled, reorder_point, manufacturer, is_discontinued } = req.body;

  try {
    const existing = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    await db
      .update(products)
      .set({
        name: name || existing.name,
        sku: sku !== undefined ? sku : existing.sku,
        price: price ? price.toString() : existing.price,
        image_filename: image_filename !== undefined ? image_filename : existing.image_filename,
        batch_tracking_enabled:
          batch_tracking_enabled ?? existing.batch_tracking_enabled,
        reorder_point: reorder_point !== undefined ? reorder_point : existing.reorder_point,
        manufacturer: manufacturer !== undefined ? manufacturer : existing.manufacturer,
        is_discontinued: is_discontinued !== undefined ? is_discontinued : existing.is_discontinued,
        updated_at: new Date(),
      })
      .where(eq(products.id, id));

    const updated = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "product",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteProduct: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;

  try {
    const existing = await db.query.products.findFirst({
      where: eq(products.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Product not found" });
    }

    await db.delete(products).where(eq(products.id, id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "product",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
