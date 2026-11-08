import { describe, expect, it } from "vitest";
import { optimizeRouteOrder } from "./routeOrder";

describe("optimizeRouteOrder", () => {
  it("orders points along a line instead of zig-zagging", () => {
    const points = [
      { id: "a", latitude: 14.0, longitude: 121.0 },
      { id: "c", latitude: 14.2, longitude: 121.0 },
      { id: "b", latitude: 14.1, longitude: 121.0 },
      { id: "d", latitude: 14.3, longitude: 121.0 },
    ];

    expect(optimizeRouteOrder(points).map((point) => point.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps stops without coordinates at the end", () => {
    const points = [
      { id: "x", latitude: null, longitude: null },
      { id: "a", latitude: 14.0, longitude: 121.0 },
      { id: "b", latitude: 14.1, longitude: 121.0 },
      { id: "c", latitude: 14.2, longitude: 121.0 },
    ];

    expect(optimizeRouteOrder(points).map((point) => point.id)).toEqual(["a", "b", "c", "x"]);
  });
});
