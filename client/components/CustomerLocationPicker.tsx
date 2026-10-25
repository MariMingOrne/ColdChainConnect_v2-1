import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

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

let mapsPromise: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => resolve((window as any).google);
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}

function getLocationDetails(components: any[], latitude: number, longitude: number): LocationDetails {
  const component = (type: string) => components.find((item) => item.types.includes(type))?.long_name ?? "";
  return {
    latitude,
    longitude,
    street_number: component("street_number"),
    street_address: component("route"),
    location: component("locality") || component("postal_town") || component("administrative_area_level_2"),
    state: component("administrative_area_level_1"),
    postal_code: component("postal_code"),
  };
}

export function CustomerLocationPicker({ position, onSelect }: CustomerLocationPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const mapElement = useRef<HTMLDivElement>(null);
  const searchElement = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const [error, setError] = useState("");

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!apiKey || !mapElement.current || !searchElement.current) {
      if (!apiKey) setError("Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to enable location search and pinning.");
      return;
    }

    let disposed = false;
    let map: any;
    let marker: any;

    const updateLocation = (latitude: number, longitude: number, components?: any[]) => {
      const point = { lat: latitude, lng: longitude };
      map.setCenter(point);
      map.setZoom(16);
      marker.setPosition(point);

      if (components?.length) {
        onSelectRef.current(getLocationDetails(components, latitude, longitude));
        setError("");
        return;
      }

      new (window as any).google.maps.Geocoder().geocode({ location: point }, (results: any[], status: string) => {
        if (disposed) return;
        const result = results?.[0];
        if (status !== "OK" || !result) {
          setError("We couldn't find address details for this pin. Try a nearby point or search for the place.");
          return;
        }
        onSelectRef.current(getLocationDetails(result.address_components ?? [], latitude, longitude));
        setError("");
      });
    };

    void loadGoogleMaps(apiKey)
      .then((google) => {
        if (disposed || !mapElement.current || !searchElement.current) return;
        const latitude = Number(position?.latitude);
        const longitude = Number(position?.longitude);
        const hasPosition = position?.latitude != null && position.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
        const center = hasPosition ? { lat: latitude, lng: longitude } : { lat: 14.5995, lng: 120.9842 };

        map = new google.maps.Map(mapElement.current, {
          center,
          zoom: hasPosition ? 16 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        marker = new google.maps.Marker({ map, position: hasPosition ? center : null, draggable: true });
        mapInstance.current = map;
        markerInstance.current = marker;
        map.addListener("click", (event: any) => {
          if (event.latLng) updateLocation(event.latLng.lat(), event.latLng.lng());
        });
        marker.addListener("dragend", () => {
          const point = marker.getPosition();
          if (point) updateLocation(point.lat(), point.lng());
        });

        const autocomplete = new google.maps.places.Autocomplete(searchElement.current, {
          fields: ["address_components", "geometry"],
          types: ["address"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const point = place.geometry?.location;
          if (!point) {
            setError("Choose an address from the search suggestions.");
            return;
          }
          updateLocation(point.lat(), point.lng(), place.address_components ?? []);
        });
      })
      .catch((loadError) => {
        if (!disposed) setError(loadError instanceof Error ? loadError.message : "Google Maps could not be loaded.");
      });

    return () => {
      disposed = true;
      mapInstance.current = null;
      markerInstance.current = null;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapInstance.current;
    const marker = markerInstance.current;
    if (!map || !marker) return;
    const latitude = Number(position?.latitude);
    const longitude = Number(position?.longitude);
    const hasPosition = position?.latitude != null && position.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
    if (!hasPosition) {
      marker.setPosition(null);
      return;
    }
    const point = { lat: latitude, lng: longitude };
    marker.setPosition(point);
    map.setCenter(point);
  }, [position?.latitude, position?.longitude]);

  return (
    <section className="space-y-2">
      <label htmlFor="customer-location-search" className="block text-xs font-semibold text-navy">
        Pin customer location
      </label>
      <div className="relative">
        <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="customer-location-search"
          ref={searchElement}
          type="search"
          disabled={!apiKey}
          placeholder="Search an address or place"
          className="w-full rounded-lg border border-border py-2 pl-9 pr-3 text-sm focus:border-accent-2 focus:outline-none disabled:bg-off-white"
        />
      </div>
      <div ref={mapElement} className="h-56 w-full overflow-hidden rounded-lg border border-border bg-off-white" />
      <p className="text-xs text-muted">Search for the customer’s address or tap the map to place the pin. Address fields will fill automatically.</p>
      {error && <p role="alert" className="text-xs text-amber-700">{error}</p>}
    </section>
  );
}
