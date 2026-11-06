import { describe, expect, it } from "vitest";
import type { AgentScheduleDelivery } from "@shared/api";
import { localScheduleDate, partitionAgentSchedule } from "./agentSchedule";

function delivery(id: string, scheduled_date: string | null, status: AgentScheduleDelivery["status"]): AgentScheduleDelivery {
  return {
    id,
    truck_id: "truck-1",
    status,
    scheduled_date,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    truck: { id: "truck-1", license_plate: "ABC", district: "North" },
    agent: null,
    driver: null,
    delivery_items: [],
  };
}

describe("agent delivery schedule", () => {
  it("uses the device's local calendar date", () => {
    expect(localScheduleDate(new Date(2025, 0, 2, 23, 30))).toBe("2025-01-02");
    expect(localScheduleDate(new Date(2025, 0, 3, 0, 1))).toBe("2025-01-03");
  });

  it("shows only today's unfinished runs as current while retaining other runs", () => {
    const runs = [
      delivery("today", "2025-01-02", "in_transit"),
      delivery("yesterday", "2025-01-01", "pending"),
      delivery("tomorrow", "2025-01-03", "pending"),
      delivery("unscheduled", null, "pending"),
      delivery("completed", "2025-01-02", "completed"),
    ];
    const result = partitionAgentSchedule(runs, "2025-01-02");
    expect(result.current.map((run) => run.id)).toEqual(["today"]);
    expect(result.otherDates.map((run) => run.id)).toEqual(["yesterday", "tomorrow", "unscheduled"]);
    expect(result.history.map((run) => run.id)).toEqual(["completed"]);
  });
});
