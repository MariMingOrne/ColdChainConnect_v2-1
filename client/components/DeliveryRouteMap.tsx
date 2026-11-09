import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { AgentScheduleStop } from "@shared/api";
import { formatCustomerAddress } from "@shared/api";

export interface MapFocus {
  stopId: string;
  requestedAt: number;
}

interface DeliveryRouteMapProps {
  deliveryId: string;
  stops: AgentScheduleStop[];
  focus: MapFocus | null;
}

interface MapStop {
  id: string;
  number: number;
  name: string;
  address: string;
  completed: boolean;
  position: [number, number];
}

function toMapStops(stops: AgentScheduleStop[]): MapStop[] {
  return stops.flatMap((stop, index) => {
    const customer = stop.destination_customer;
    if (!customer || customer.latitude == null || customer.longitude == null) return [];
    return [{
      id: stop.id,
      number: index + 1,
      name: customer.store_name ?? "Customer",
      address: formatCustomerAddress(customer),
      completed: stop.status === "completed",
      position: [customer.latitude, customer.longitude] as [number, number],
    }];
  });
}

function stopIcon(stop: MapStop, focused: boolean) {
  const background = stop.completed ? "#2f855a" : "#1e3a5f";
  const highlight = focused ? "0 0 0 4px #f6ad55" : "0 1px 4px rgba(0,0,0,0.4)";
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;border:2px solid #fff;background:${background};box-shadow:${highlight};color:#fff;font:700 13px/1 system-ui,sans-serif">${stop.number}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitRoute({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const routeKey = positions.map(([latitude, longitude]) => `${latitude},${longitude}`).join("|");
  useEffect(() => {
    if (positions.length === 0) return;
    map.fitBounds(L.latLngBounds(positions), { padding: [32, 32], maxZoom: 16 });
  }, [map, routeKey]);
  return null;
}

function FocusStop({ latitude, longitude, requestedAt }: { latitude?: number; longitude?: number; requestedAt?: number }) {
  const map = useMap();
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, latitude, longitude, requestedAt]);
  return null;
}

export function DeliveryRouteMap({ deliveryId, stops, focus }: DeliveryRouteMapProps) {
  const mapStops = toMapStops(stops);
  if (mapStops.length === 0) return null;

  const positions = mapStops.map((stop) => stop.position);
  const focused = mapStops.find((stop) => stop.id === focus?.stopId);
  const unmappedCount = stops.length - mapStops.length;

  return (
    <div id={`run-map-${deliveryId}`} className="space-y-2 border-b border-border p-4">
      <MapContainer
        center={positions[0]}
        zoom={13}
        scrollWheelZoom={false}
        className="isolate h-64 w-full rounded-lg border border-border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitRoute positions={positions} />
        <FocusStop latitude={focused?.position[0]} longitude={focused?.position[1]} requestedAt={focus?.requestedAt} />
        <Polyline positions={positions} pathOptions={{ color: "#1e3a5f", weight: 4, opacity: 0.7, dashArray: "6 8" }} />
        {mapStops.map((stop) => (
          <Marker key={stop.id} position={stop.position} icon={stopIcon(stop, stop.id === focus?.stopId)}>
            <Popup>
              <strong>{stop.number}. {stop.name}</strong>
              <br />
              {stop.address}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <p className="text-xs text-muted">
        Dashed line joins stops in run order as straight lines, not road directions.
        {unmappedCount > 0 && ` ${unmappedCount} stop${unmappedCount === 1 ? "" : "s"} without coordinates not shown.`}
      </p>
    </div>
  );
}
