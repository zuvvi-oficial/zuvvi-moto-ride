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
  // Opt-in: por padrão o mapa continua exatamente como sempre foi (visão de
  // cima, sem prédios) — só quem passar esses props explicitamente ganha a
  // perspectiva 3D, então nenhuma tela existente muda sozinha.
  pitch?: number;
  show3DBuildings?: boolean;
}

export function MapView({
  center,
  zoom = 15,
  token,
  markerColor = "#C6FF3D",
  secondaryMarker,
  onMapInstance,
  className = "w-full h-full",
  pitch = 0,
  show3DBuildings = false,
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
        pitch: pitch,
        attributionControl: false
      });

      map.current.on('load', () => {
        map.current?.resize();

        // Camada padrão do Mapbox (mesma dos exemplos oficiais): a style
        // dark-v11 já traz a fonte "composite" com a layer "building", só
        // não é extrudada por padrão. Só adiciona quando pedido — nunca
        // roda nas telas que não passaram show3DBuildings.
        if (show3DBuildings && map.current && !map.current.getLayer("zuvvi-3d-buildings")) {
          map.current.addLayer({
            id: "zuvvi-3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#2a2a55",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.75
            }
          });
        }

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

  // Inclinar/desinclinar suavemente quando pitch mudar depois de montado (ex.:
  // o motorista expande o mapa pra tela cheia) e ligar/desligar os prédios 3D
  // junto — sem isso só o valor inicial de pitch seria respeitado.
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !currentMap.isStyleLoaded()) return;

    currentMap.easeTo({ pitch, duration: 800 });

    const hasLayer = currentMap.getLayer("zuvvi-3d-buildings");
    if (show3DBuildings && !hasLayer) {
      currentMap.addLayer({
        id: "zuvvi-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#2a2a55",
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "min_height"],
          "fill-extrusion-opacity": 0.75
        }
      });
    } else if (!show3DBuildings && hasLayer) {
      currentMap.removeLayer("zuvvi-3d-buildings");
    }
  }, [pitch, show3DBuildings]);

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
