import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapMarker } from "@/types/climate";

// Fix for default markers in Leaflet with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface InteractiveMapProps {
  selectedLocation?: MapMarker;
  onLocationSelect: (latitude: number, longitude: number) => void;
  className?: string;
}

export default function InteractiveMap({ selectedLocation, onLocationSelect, className = "" }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [20, 0], // Center of the world
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      noWrap: false,
    }).addTo(map);

    // Add click handler
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    });

    mapInstanceRef.current = map;
    setIsMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [onLocationSelect]);

  useEffect(() => {
    if (!mapInstanceRef.current || !isMapReady) return;

    // Update marker when selected location changes
    if (selectedLocation) {
      if (markerRef.current) {
        markerRef.current.remove();
      }

      const marker = L.marker([selectedLocation.latitude, selectedLocation.longitude])
        .addTo(mapInstanceRef.current)
        .bindPopup(selectedLocation.name);

      markerRef.current = marker;

      // Center map on selected location
      mapInstanceRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 10);
    }
  }, [selectedLocation, isMapReady]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden border border-slate-200" />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Zoom In"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Zoom Out"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => mapInstanceRef.current?.setView([20, 0], 2)}
          className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Reset View"
        >
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
        <div className="text-xs font-medium text-slate-700 mb-2">Map Legend</div>
        <div className="space-y-1 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-600 rounded-full mr-2"></div>
            <span className="text-slate-600">Selected Location</span>
          </div>
          <div className="text-slate-500 text-xs mt-2">
            Click anywhere to select location
          </div>
        </div>
      </div>
    </div>
  );
}
