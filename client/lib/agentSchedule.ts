import type { AgentScheduleDelivery } from "@shared/api";

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
