import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { toast } from "sonner";

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  token: string;
  markerColor?: string;
  secondaryMarker?: { lat: number; lng: number; color?: string } | undefined;
  onMapInstance?: (map: mapboxgl.Map) => void;
  className?: string;
}

export function MapView({ 
  center, 
  zoom = 15, 
  token, 
  markerColor = "#C6FF3D",
  secondaryMarker,
  onMapInstance,
  className = "w-full h-full"
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!mapboxgl.supported()) {
      toast.error("Seu navegador não suporta o mapa.");
      return;
    }

    try {
      mapboxgl.accessToken = token;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [center.lng, center.lat],
        zoom: zoom,
        attributionControl: false
      });

      map.current.on('load', () => {
        map.current?.resize();
        if (onMapInstance && map.current) {
          onMapInstance(map.current);
        }
      });

      marker.current = new mapboxgl.Marker({ color: markerColor })
        .setLngLat([center.lng, center.lat])
        .addTo(map.current);

      if (secondaryMarker) {
        secondaryMarkerRef.current = new mapboxgl.Marker({ color: secondaryMarker.color || "#6C3CE9" })
          .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
          .addTo(map.current);
      }

    } catch (err) {
      console.error("Erro ao inicializar mapa:", err);
      toast.error("Falha ao inicializar o mapa.");
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [token, markerColor]);

  // Atualizar centro e marcador quando as coordenadas mudarem
  useEffect(() => {
    if (map.current && center) {
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: zoom
      });
      
      if (marker.current) {
        marker.current.setLngLat([center.lng, center.lat]);
      }
    }
  }, [center.lat, center.lng, zoom]);

  // Atualizar marcador secundário quando a posição mudar
  useEffect(() => {
    if (map.current) {
      if (secondaryMarker) {
        if (secondaryMarkerRef.current) {
          secondaryMarkerRef.current.setLngLat([secondaryMarker.lng, secondaryMarker.lat]);
        } else {
          secondaryMarkerRef.current = new mapboxgl.Marker({ color: secondaryMarker.color || "#6C3CE9" })
            .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
            .addTo(map.current);
        }
      } else if (secondaryMarkerRef.current) {
        secondaryMarkerRef.current.remove();
        secondaryMarkerRef.current = null;
      }
    }
  }, [secondaryMarker?.lat, secondaryMarker?.lng, secondaryMarker?.color]);

  return <div ref={mapContainer} className={className} />;
}
