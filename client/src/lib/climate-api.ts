import { apiRequest } from "./queryClient";
import type { ClimateLocation, ClimateProjection } from "@/types/climate";

export const climateApi = {
  searchLocations: async (query: string): Promise<ClimateLocation[]> => {
    const response = await apiRequest("GET", `/api/locations/search?q=${encodeURIComponent(query)}`);
    return response.json();
  },

  createLocation: async (location: { name: string; latitude: number; longitude: number; country?: string; region?: string }): Promise<ClimateLocation> => {
    const response = await apiRequest("POST", "/api/locations", location);
    return response.json();
  },

  getClimateProjection: async (locationId: number, year: number): Promise<ClimateProjection> => {
    const response = await apiRequest("GET", `/api/projections/${locationId}/${year}`);
    return response.json();
  },

  getLocationProjections: async (locationId: number): Promise<ClimateProjection[]> => {
    const response = await apiRequest("GET", `/api/projections/${locationId}`);
    return response.json();
  },

  exportCSV: async (locationId: number, year: number): Promise<Blob> => {
    const response = await apiRequest("GET", `/api/export/csv/${locationId}/${year}`);
    return response.blob();
  }
};

// Geocoding utility functions
export const geocodingUtils = {
  reverseGeocode: async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Using Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error("Geocoding failed");
      }
      
      const data = await response.json();
      const address = data.address;
      
      let locationName = "";
      if (address?.city) {
        locationName = address.city;
      } else if (address?.town) {
        locationName = address.town;
      } else if (address?.village) {
        locationName = address.village;
      } else if (address?.county) {
        locationName = address.county;
      }
      
      if (address?.state) {
        locationName += locationName ? `, ${address.state}` : address.state;
      }
      
      if (address?.country) {
        locationName += locationName ? `, ${address.country}` : address.country;
      }
      
      return locationName || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
    }
  },

  searchLocations: async (query: string): Promise<Array<{name: string, latitude: number, longitude: number}>> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error("Location search failed");
      }
      
      const data = await response.json();
      
      return data.map((item: any) => ({
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
    } catch (error) {
      console.error("Location search error:", error);
      return [];
    }
  },

  getLocationName: async (latitude: number, longitude: number): Promise<string> => {
    return geocodingUtils.reverseGeocode(latitude, longitude);
  }
};
