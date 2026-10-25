import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Circle, MapPin, Maximize2, Minimize2, Search } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface LocationDetails {
  latitude: number;
  longitude: number;
  street_number: string;
  street_address: string;
  location: string;
  state: string;
  postal_code: string;
}

interface CustomerLocationPickerProps {
  position?: { latitude?: string | number | null; longitude?: string | number | null };
  onSelect: (details: LocationDetails) => void;
}

interface PlaceResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const nominatimCache = new Map<string, Promise<unknown>>();
let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function requestNominatim<T>(url: string): Promise<T> {
  const cached = nominatimCache.get(url);
  if (cached) return cached as Promise<T>;

  const request = requestQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Address lookup is temporarily unavailable. Please try again.");
    return response.json() as Promise<T>;
  });

  nominatimCache.set(url, request);
  void request.catch(() => nominatimCache.delete(url));
  requestQueue = request.then(() => undefined, () => undefined);
  return request;
}

function toLocationDetails(result: PlaceResult): LocationDetails {
  const address = result.address ?? {};
  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    street_number: address.house_number ?? "",
    street_address: address.road ?? address.pedestrian ?? address.footway ?? "",
    location: address.city ?? address.town ?? address.village ?? address.city_district ?? address.municipality ?? address.county ?? "",
    state: address.state ?? address.province ?? "",
    postal_code: address.postcode ?? "",
  };
}

function selectedPosition(position?: CustomerLocationPickerProps["position"]) {
  if (position?.latitude == null || position.longitude == null) return null;
  const latitude = Number(position.latitude);
  const longitude = Number(position.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] as [number, number] : null;
}

function MapViewport({ position, expanded }: { position: [number, number] | null; expanded: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 16);
  }, [map, position]);
  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(timeout);
  }, [expanded, map]);
  return null;
}

function MapPinEvents({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

const pinIcon = L.divIcon({
  className: "customer-map-pin",
  html: '<span style="display:block;width:20px;height:20px;background:#d9342b;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 1px 5px #0006"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

export function CustomerLocationPicker({ position, onSelect }: CustomerLocationPickerProps) {
  const [pin, setPin] = useState<[number, number] | null>(() => selectedPosition(position));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setPin(selectedPosition(position)), [position?.latitude, position?.longitude]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);

  const selectResult = (result: PlaceResult) => {
    const details = toLocationDetails(result);
    setPin([details.latitude, details.longitude]);
    onSelect(details);
    setResults([]);
    setQuery(result.display_name);
    setError("");
  };

  const searchPlaces = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    if (!search) return;
    setIsSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
        "accept-language": navigator.language || "en",
        q: search,
      });
      const places = await requestNominatim<PlaceResult[]>(`https://nominatim.openstreetmap.org/search?${params}`);
      setResults(places);
      if (places.length === 0) setError("No matching address found. Try a more specific search.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Address search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setPin([latitude, longitude]);
    setIsLookingUp(true);
    setError("");
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      "accept-language": navigator.language || "en",
      lat: String(latitude),
      lon: String(longitude),
    });
    try {
      const place = await requestNominatim<PlaceResult>(`https://nominatim.openstreetmap.org/reverse?${params}`);
      onSelect(toLocationDetails(place));
      setQuery(place.display_name);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Address lookup failed.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const center = pin ?? [14.5995, 120.9842];
  const mapView = (
    <div
      data-popup-open={expanded ? "true" : undefined}
      role={expanded ? "dialog" : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? "Choose customer location" : undefined}
      className={expanded ? "fixed inset-0 z-[100] flex h-dvh w-screen flex-col bg-white p-3" : "relative"}
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-1">
        <span className="font-semibold text-navy">{expanded ? "Choose the customer’s exact location" : ""}</span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Exit fullscreen map" : "Expand map"}
          title={expanded ? "Exit fullscreen map" : "Expand map"}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-navy shadow-md hover:bg-off-white"
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          <span>{expanded ? "Close map" : "Expand map"}</span>
        </button>
      </div>
      <MapContainer
        center={center}
        zoom={pin ? 16 : 11}
        scrollWheelZoom
        style={expanded ? { flex: "1 1 0%", height: "100%", minHeight: 0, width: "100%" } : { height: 224, width: "100%" }}
        className="w-full min-h-0 rounded-lg border border-border"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport position={pin} expanded={expanded} />
        <MapPinEvents onPick={(latitude, longitude) => void reverseGeocode(latitude, longitude)} />
        {pin && (
          <Marker position={pin} icon={pinIcon} draggable eventHandlers={{ dragend: (event) => {
            const point = event.target.getLatLng();
            void reverseGeocode(point.lat, point.lng);
          } }} />
        )}
      </MapContainer>
    </div>
  );

  return (
    <section className="space-y-2">
      <label htmlFor="customer-location-search" className="block text-xs font-semibold text-navy">
        Pin customer location
      </label>
      <form onSubmit={searchPlaces} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="customer-location-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search an address or place"
            className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:border-accent-2 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={isSearching || !query.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-navy px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Search size={15} />
          {isSearching ? "Searching" : "Search"}
        </button>
      </form>
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lon}`}>
              <button type="button" onClick={() => selectResult(result)} className="w-full px-3 py-2 text-left text-sm text-navy hover:bg-off-white">
                {result.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {expanded ? createPortal(mapView, document.body) : mapView}
      <p className="text-xs text-muted">Search for the address or tap/drag the pin to fill the address fields. OpenStreetMap contributors.</p>
      {(isLookingUp || error) && (
        <p role={error ? "alert" : undefined} className={`text-xs ${error ? "text-amber-700" : "text-muted"}`}>
          {isLookingUp ? <><Circle size={10} className="mr-1 inline animate-pulse" />Looking up address…</> : error}
        </p>
      )}
    </section>
  );
}
