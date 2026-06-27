import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L, { Icon } from "leaflet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waves, AlertTriangle, Info } from "lucide-react";
import type { ClimateLocation, ClimateProjection } from "@/types/climate";

interface SeaLevelMapProps {
  selectedLocation?: ClimateLocation;
  projectedData?: ClimateProjection;
  selectedYear: number;
  onLocationSelect: (latitude: number, longitude: number) => void;
  className?: string;
}

interface SeaLevelZone {
  level: number;
  color: string;
  opacity: number;
  description: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
}

function LocationClickHandler({ onLocationSelect }: { onLocationSelect: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click: (e) => {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    },
  });

  return null;
}

// Sea level visualization overlay component
function SeaLevelOverlay({ seaLevelChange, year }: { seaLevelChange: number; year: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !seaLevelChange) return;

    // Define sea level zones based on projected change
    const zones: SeaLevelZone[] = [
      {
        level: 0.5,
        color: '#FFE4B5',
        opacity: 0.3,
        description: 'Minor coastal flooding risk',
        riskLevel: 'low'
      },
      {
        level: 1.0,
        color: '#FFA500',
        opacity: 0.4,
        description: 'Moderate coastal flooding risk',
        riskLevel: 'moderate'
      },
      {
        level: 2.0,
        color: '#FF6347',
        opacity: 0.5,
        description: 'High coastal flooding risk',
        riskLevel: 'high'
      },
      {
        level: 3.0,
        color: '#DC143C',
        opacity: 0.6,
        description: 'Extreme coastal flooding risk',
        riskLevel: 'extreme'
      }
    ];

    // Clear existing overlays
    map.eachLayer((layer: any) => {
      if (layer.options && layer.options.className === 'sea-level-overlay') {
        map.removeLayer(layer);
      }
    });

    // Add appropriate overlay based on sea level change
    const applicableZone = zones.find(zone => seaLevelChange >= zone.level) || zones[0];
    
    if (seaLevelChange > 0.1) { // Only show overlay for significant changes
      const overlay = L.rectangle(
        map.getBounds(),
        {
          color: applicableZone.color,
          fillColor: applicableZone.color,
          fillOpacity: applicableZone.opacity,
          weight: 0,
          className: 'sea-level-overlay'
        }
      ).addTo(map);

      // Add popup with information
      overlay.bindPopup(`
        <div class="p-2">
          <h4 class="font-semibold">Sea Level Rise Impact (${year})</h4>
          <p class="text-sm mt-1">Projected rise: +${seaLevelChange.toFixed(2)}m</p>
          <p class="text-sm">${applicableZone.description}</p>
        </div>
      `);
    }

  }, [map, seaLevelChange, year]);

  return null;
}

export default function SeaLevelMap({ 
  selectedLocation, 
  projectedData, 
  selectedYear, 
  onLocationSelect,
  className = "" 
}: SeaLevelMapProps) {
  const [mapStyle, setMapStyle] = useState("satellite");
  const [showSeaLevelOverlay, setShowSeaLevelOverlay] = useState(true);
  const mapRef = useRef<any>(null);

  const seaLevelChange = projectedData?.seaLevelChange || 0;
  const coastalFloodingRisk = projectedData?.coastalFloodingRisk || 0;

  // Custom marker icon for selected location
  const locationIcon = new Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `),
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });

  const getTileLayerUrl = (style: string) => {
    switch (style) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'terrain':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}';
      case 'ocean':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}';
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const getSeaLevelRiskBadge = (change: number) => {
    if (change < 0.5) return { variant: "secondary" as const, text: "Low Risk", color: "text-green-600" };
    if (change < 1.0) return { variant: "outline" as const, text: "Moderate Risk", color: "text-yellow-600" };
    if (change < 2.0) return { variant: "destructive" as const, text: "High Risk", color: "text-orange-600" };
    return { variant: "destructive" as const, text: "Extreme Risk", color: "text-red-600" };
  };

  const riskBadge = getSeaLevelRiskBadge(seaLevelChange);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Waves className="h-5 w-5 text-blue-600" />
          Sea Level Change Visualization
        </CardTitle>
        <CardDescription>
          Interactive map showing projected sea level changes and coastal flooding risks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Select value={mapStyle} onValueChange={setMapStyle}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="satellite">Satellite</SelectItem>
                <SelectItem value="terrain">Terrain</SelectItem>
                <SelectItem value="ocean">Ocean</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={showSeaLevelOverlay ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSeaLevelOverlay(!showSeaLevelOverlay)}
              className="flex items-center gap-1"
            >
              <Waves className="h-4 w-4" />
              Sea Level Overlay
            </Button>
          </div>

          {seaLevelChange > 0 && (
            <Badge variant={riskBadge.variant} className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {riskBadge.text}
            </Badge>
          )}
        </div>

        {selectedLocation && projectedData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                +{seaLevelChange.toFixed(2)}m
              </div>
              <div className="text-sm text-muted-foreground">
                Sea Level Rise by {selectedYear}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {coastalFloodingRisk.toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">
                Coastal Flooding Risk
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-2xl font-bold ${riskBadge.color}`}>
                {riskBadge.text}
              </div>
              <div className="text-sm text-muted-foreground">
                Overall Risk Level
              </div>
            </div>
          </div>
        )}

        <div className="h-96 rounded-lg overflow-hidden border">
          <MapContainer
            ref={mapRef}
            center={selectedLocation ? [selectedLocation.latitude, selectedLocation.longitude] : [40.7128, -74.0060]}
            zoom={selectedLocation ? 10 : 3}
            style={{ height: "100%", width: "100%" }}
          >
            <LocationClickHandler onLocationSelect={onLocationSelect} />
            <TileLayer
              url={getTileLayerUrl(mapStyle)}
              attribution={
                mapStyle === 'satellite' || mapStyle === 'terrain' || mapStyle === 'ocean'
                  ? '&copy; Esri'
                  : '&copy; OpenStreetMap contributors'
              }
            />
            
            {selectedLocation && (
              <Marker
                position={[selectedLocation.latitude, selectedLocation.longitude]}
                icon={locationIcon}
              >
                <Popup>
                  <div className="p-2">
                    <h4 className="font-semibold">{selectedLocation.name}</h4>
                    {selectedLocation.country && (
                      <p className="text-sm text-muted-foreground">{selectedLocation.country}</p>
                    )}
                    {projectedData && (
                      <div className="mt-2 space-y-1">
                        <div className="text-sm">
                          <strong>Sea Level Rise ({selectedYear}):</strong> +{seaLevelChange.toFixed(2)}m
                        </div>
                        <div className="text-sm">
                          <strong>Flooding Risk:</strong> {coastalFloodingRisk.toFixed(0)}%
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {showSeaLevelOverlay && seaLevelChange > 0 && (
              <SeaLevelOverlay seaLevelChange={seaLevelChange} year={selectedYear} />
            )}
          </MapContainer>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Sea Level Visualization Information
            </p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              The colored overlay represents projected coastal flooding risk zones. 
              Click anywhere on the map to explore sea level projections for that location. 
              Toggle between satellite, terrain, and ocean views for different perspectives.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
