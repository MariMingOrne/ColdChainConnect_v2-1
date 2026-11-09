import type { AgentScheduleDelivery, AgentSchedulePallet, DeliveryItem } from "@shared/api";

export function localScheduleDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function partitionAgentSchedule(deliveries: AgentScheduleDelivery[], today: string) {
  return {
    current: deliveries.filter((delivery) => delivery.status !== "completed" && delivery.scheduled_date === today),
    otherDates: deliveries.filter((delivery) => delivery.status !== "completed" && delivery.scheduled_date !== today),
    history: deliveries.filter((delivery) => delivery.status === "completed"),
  };
}

export function statusClasses(status: DeliveryItem["status"]) {
  if (status === "completed") return "border-green/20 bg-green/10 text-green";
  if (status === "in_transit") return "border-gold/30 bg-gold/10 text-navy";
  return "border-blue-200 bg-blue-50 text-navy";
}

export function palletStatusLabel(status: AgentSchedulePallet["status"]) {
  if (status === "draft") return "Preparing";
  if (status === "prepared") return "Prepared";
  if (status === "approved") return "Ready";
  return "Shipped";
}

export function palletTotals(pallets: AgentSchedulePallet[]) {
  const items = pallets.flatMap((pallet) => pallet.items);
  return {
    products: new Set(items.map((item) => item.product?.id ?? item.id)).size,
    units: items.reduce((total, item) => total + item.qty_units, 0),
  };
}
