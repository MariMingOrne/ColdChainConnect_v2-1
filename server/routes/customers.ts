import { RequestHandler } from "express";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { customers, customer_discounts } from "../db/schema";
import { CustomerDiscount } from "@shared/api";
import { AuthRequest } from "../middleware/auth";
import { logAction } from "../middleware/audit-logger";
import { demoCustomers } from "../demo-data";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceDiscounts(tx: Tx, customerId: string, discounts: CustomerDiscount[]) {
  await tx.delete(customer_discounts).where(eq(customer_discounts.customer_id, customerId));
  if (discounts.length === 0) return;
  await tx.insert(customer_discounts).values(
    discounts.map((discount) => ({
      id: randomUUID(),
      customer_id: customerId,
      label: discount.label,
      rate: String(Number(discount.rate)),
    }))
  );
}

export const listCustomers: RequestHandler = async (_req, res) => {
  try {
    // Use demo data if no database
    if (!process.env.DATABASE_URL) {
      return res.json(demoCustomers);
    }

    const allCustomers = await db.query.customers.findMany({ with: { discounts: true } });
    res.json(allCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

function validateCreditFields(body: { credit_limit?: unknown; credit_terms_days?: unknown }): string | null {
  const { credit_limit, credit_terms_days } = body;
  if (credit_limit !== undefined && credit_limit !== null && (typeof credit_limit !== "number" || credit_limit < 0)) {
    return "Credit limit must be a non-negative number or empty";
  }
  if (
    credit_terms_days !== undefined &&
    (!Number.isInteger(credit_terms_days) || (credit_terms_days as number) < 1 || (credit_terms_days as number) > 365)
  ) {
    return "Credit terms must be a whole number of days between 1 and 365";
  }
  return null;
}

export const createCustomer: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { store_name, location, district, street_number, street_address, state, postal_code, latitude, longitude, contact_person, contact_info, agent_id, payment_type, discounts, credit_limit, credit_terms_days } = req.body;

  if (!store_name || !location) {
    return res
      .status(400)
      .json({ error: "Store name and location are required" });
  }

  const creditError = validateCreditFields(req.body);
  if (creditError) {
    return res.status(400).json({ error: creditError });
  }

  try {
    // Demo mode: can't write to database
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: "Database not configured. Set DATABASE_URL." });
    }

    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(customers).values({
        id,
        store_name,
        location,
        district,
        street_number,
        street_address,
        state,
        postal_code,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        contact_person,
        contact_info,
        agent_id,
        payment_type,
        credit_limit: credit_limit == null ? null : String(credit_limit),
        credit_terms_days,
      });
      await replaceDiscounts(tx, id, discounts ?? []);
    });

    const newCustomer = await db.query.customers.findFirst({
      where: eq(customers.id, id),
      with: { discounts: true },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "create",
        "customer",
        id,
        undefined,
        newCustomer
      );
    }

    res.status(201).json(newCustomer);
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateCustomer: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;
  const { store_name, location, district, street_number, street_address, state, postal_code, latitude, longitude, contact_person, contact_info, agent_id, payment_type, discounts, credit_limit, credit_terms_days } = req.body;

  const creditError = validateCreditFields(req.body);
  if (creditError) {
    return res.status(400).json({ error: creditError });
  }

  try {
    const existing = await db.query.customers.findFirst({
      where: eq(customers.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(customers)
        .set({
          store_name: store_name || existing.store_name,
          location: location || existing.location,
          district: district ?? existing.district,
          street_number: street_number ?? existing.street_number,
          street_address: street_address ?? existing.street_address,
          state: state ?? existing.state,
          postal_code: postal_code ?? existing.postal_code,
          latitude: latitude === undefined ? existing.latitude : latitude,
          longitude: longitude === undefined ? existing.longitude : longitude,
          contact_person: contact_person ?? existing.contact_person,
          contact_info: contact_info ?? existing.contact_info,
          agent_id: agent_id ?? existing.agent_id,
          payment_type: payment_type ?? existing.payment_type,
          credit_limit: credit_limit === undefined ? existing.credit_limit : credit_limit === null ? null : String(credit_limit),
          credit_terms_days: credit_terms_days ?? existing.credit_terms_days,
          updated_at: new Date(),
        })
        .where(eq(customers.id, id));

      if (discounts !== undefined) {
        await replaceDiscounts(tx, id, discounts);
      }
    });

    const updated = await db.query.customers.findFirst({
      where: eq(customers.id, id),
      with: { discounts: true },
    });

    if (req.user) {
      await logAction(
        req.user.userId,
        "update",
        "customer",
        id,
        existing,
        updated
      );
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteCustomer: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  const { id } = req.params;

  try {
    const existing = await db.query.customers.findFirst({
      where: eq(customers.id, id),
    });

    if (!existing) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await db.delete(customers).where(eq(customers.id, id));

    if (req.user) {
      await logAction(
        req.user.userId,
        "delete",
        "customer",
        id,
        existing,
        undefined
      );
    }

    res.json({ message: "Customer deleted" });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
