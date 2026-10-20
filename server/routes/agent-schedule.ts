import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db } from "../db";
import { agents, deliveries } from "../db/schema";
import { AuthRequest } from "../middleware/auth";

export const getAgentSchedule: RequestHandler = async (req: AuthRequest, res) => {
  if (!process.env.DATABASE_URL) {
    return res.json({ deliveries: [] });
  }

  try {
    const agent = await db.query.agents.findFirst({
      where: eq(agents.user_id, req.user!.userId),
      columns: { id: true },
    });

    if (!agent) return res.json({ deliveries: [] });

    const assignedDeliveries = await db.query.deliveries.findMany({
      where: eq(deliveries.agent_id, agent.id),
      with: {
        truck: {
          columns: { id: true, license_plate: true, district: true, driver_id: true },
          with: {
            driver: {
              columns: { id: true, full_name: true, contact_info: true, license: true },
            },
          },
        },
        agent: {
          columns: { id: true, full_name: true },
        },
        driver: {
          columns: { id: true, full_name: true, contact_info: true, license: true },
        },
        delivery_items: {
          with: {
            destination_customer: true,
            invoice: {
              columns: { id: true, booking_id: true, receipt_number: true, total_amount: true, agent_id: true },
              with: {
                agent: {
                  columns: { id: true, username: true },
                },
                booking: {
                  with: {
                    order_pallets: {
                      columns: { id: true, order_id: true, status: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const schedule = assignedDeliveries.map((delivery) => ({
      ...delivery,
      driver: delivery.driver ?? delivery.truck?.driver ?? null,
      delivery_items: delivery.delivery_items.map((stop) => ({
        ...stop,
        invoice: stop.invoice
          ? {
              id: stop.invoice.id,
              booking_id: stop.invoice.booking_id,
              receipt_number: stop.invoice.receipt_number,
              total_amount: stop.invoice.total_amount,
            }
          : null,
        sale_agent: stop.invoice?.agent ?? null,
        pallets: stop.invoice?.booking?.order_pallets ?? [],
      })),
    }));

    res.json({ deliveries: schedule });
  } catch (error) {
    console.error("Error fetching agent schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
