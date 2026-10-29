import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentScheduleResponse, Booking, Delivery, DeliveryItem, DriverSchedule, Product } from "@shared/api";
import { useAuth } from "./useAuth";

type NotificationType = "orders" | "stock" | "delivery";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  icon: string;
  href: string;
  read: boolean;
}

type NotificationSource = Omit<AppNotification, "read">;
type AdminDelivery = Delivery & { delivery_items?: DeliveryItem[] };

function readIds(key: string | null): string[] {
  if (!key) return [];
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) && saved.every((id) => typeof id === "string") ? saved : [];
  } catch {
    return [];
  }
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  return date.toLocaleDateString();
}

async function fetchJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Could not load notifications.");
  return response.json() as Promise<T>;
}

export function useNotifications() {
  const role = useAuth((state) => state.user?.role);
  const userId = useAuth((state) => state.user?.id);
  const token = useAuth((state) => state.token);
  const readKey = userId ? `coldchain-notifications:${userId}:read` : null;
  const dismissedKey = userId ? `coldchain-notifications:${userId}:dismissed` : null;
  const [sources, setSources] = useState<NotificationSource[]>([]);
  const [read, setRead] = useState<string[]>(() => readIds(readKey));
  const [dismissed, setDismissed] = useState<string[]>(() => readIds(dismissedKey));
  const [truckAssignments, setTruckAssignments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRead(readIds(readKey));
    setDismissed(readIds(dismissedKey));
  }, [readKey, dismissedKey]);

  const refresh = useCallback(async () => {
    if (!token || !role) {
      setSources([]);
      setTruckAssignments([]);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const next: NotificationSource[] = [];
      let assignments: string[] = [];

      if (role === "admin") {
        const [bookings, products, stock, deliveries] = await Promise.all([
          fetchJson<Booking[]>("/api/bookings?status=pending", token),
          fetchJson<Product[]>("/api/products", token),
          fetchJson<Record<string, number>>("/api/products/inventory", token),
          fetchJson<AdminDelivery[]>("/api/deliveries", token),
        ]);

        for (const booking of bookings) {
          next.push({
            id: `booking:${booking.id}:pending`,
            type: "orders",
            title: "Order awaiting approval",
            message: `${booking.customer?.store_name ?? "Customer order"} · ${booking.booking_items?.length ?? 0} product lines`,
            timestamp: booking.created_at,
            icon: "🧾",
            href: "/booking-dispatch/order-summary",
          });
        }

        for (const product of products) {
          const quantity = stock[product.id] ?? 0;
          if (!product.is_discontinued && (product.reorder_point ?? 0) > 0 && quantity <= product.reorder_point!) {
            next.push({
              id: `stock:${product.id}:${quantity}`,
              type: "stock",
              title: "Low stock",
              message: `${product.name}${product.sku ? ` (${product.sku})` : ""} has ${quantity} units; reorder point is ${product.reorder_point}.`,
              timestamp: product.updated_at,
              icon: "📦",
              href: "/information-management/inventory",
            });
          }
        }

        for (const delivery of deliveries) {
          const remaining = (delivery.delivery_items ?? []).filter((stop) => stop.status !== "completed").length;
          if (delivery.status !== "completed" && remaining > 0) {
            next.push({
              id: `delivery:${delivery.id}`,
              type: "delivery",
              title: "Delivery run in progress",
              message: `${remaining} stop${remaining === 1 ? "" : "s"} remain${remaining === 1 ? "s" : ""} on the run.`,
              timestamp: delivery.updated_at,
              icon: "🚚",
              href: "/booking-dispatch/delivery",
            });
          }
        }
      } else if (role === "agent") {
        const [bookings, schedule] = await Promise.all([
          fetchJson<Booking[]>("/api/bookings?status=pending", token),
          fetchJson<AgentScheduleResponse>("/api/agent-schedule", token),
        ]);

        for (const booking of bookings) {
          next.push({
            id: `booking:${booking.id}:pending`,
            type: "orders",
            title: "Order awaiting approval",
            message: `${booking.customer?.store_name ?? "Your order"} is waiting for admin approval.`,
            timestamp: booking.created_at,
            icon: "🧾",
            href: "/booking-dispatch/order-summary",
          });
        }

        const activeDeliveries = schedule.deliveries.filter((delivery) => delivery.status !== "completed");
        const truckMap = new Map<string, string>();
        for (const delivery of activeDeliveries) {
          const key = delivery.truck?.id ?? delivery.id;
          truckMap.set(key, `${delivery.truck?.license_plate ?? "Truck not assigned"} · ${delivery.truck?.district ?? "District not assigned"}`);
          const remaining = delivery.delivery_items.filter((stop) => stop.status !== "completed").length;
          if (remaining > 0) {
            next.push({
              id: `delivery:${delivery.id}`,
              type: "delivery",
              title: "Assigned delivery run",
              message: `${delivery.truck?.license_plate ?? "Truck"} · ${delivery.truck?.district ?? "District"} · ${remaining} stop${remaining === 1 ? "" : "s"} remaining`,
              timestamp: delivery.updated_at,
              icon: "🚚",
              href: "/booking-dispatch/inventory",
            });
          }
        }
        assignments = [...truckMap.values()];
      } else {
        const schedule = await fetchJson<DriverSchedule>("/api/driver-schedule", token);
        for (const delivery of schedule.deliveries) {
          const remaining = delivery.delivery_items.filter((stop) => stop.status !== "completed").length;
          if (remaining > 0) {
            next.push({
              id: `driver-delivery:${delivery.id}`,
              type: "delivery",
              title: "Today’s assigned run",
              message: `${delivery.truck.license_plate} · ${delivery.truck.district} · ${remaining} stop${remaining === 1 ? "" : "s"} remaining`,
              timestamp: `${schedule.date}T00:00:00`,
              icon: "🚚",
              href: "/driver-schedule",
            });
          }
        }
      }

      setSources(next.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)));
      setTruckAssignments(assignments);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Could not load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, [role, token]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const notifications = useMemo(() => sources
    .filter((notification) => !dismissed.includes(notification.id))
    .map((notification) => ({ ...notification, timestamp: timeLabel(notification.timestamp), read: read.includes(notification.id) })), [sources, read, dismissed]);

  const persistIds = (key: string | null, ids: string[]) => {
    if (key) localStorage.setItem(key, JSON.stringify(ids));
  };

  const markAsRead = (id: string) => {
    setRead((current) => {
      const updated = current.includes(id) ? current : [...current, id];
      persistIds(readKey, updated);
      return updated;
    });
  };

  const markAllAsRead = () => {
    setRead((current) => {
      const updated = [...new Set([...current, ...sources.map((notification) => notification.id)])];
      persistIds(readKey, updated);
      return updated;
    });
  };

  const dismiss = (id: string) => {
    setDismissed((current) => {
      const updated = current.includes(id) ? current : [...current, id];
      persistIds(dismissedKey, updated);
      return updated;
    });
  };

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    truckAssignments,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    dismiss,
  };
}
