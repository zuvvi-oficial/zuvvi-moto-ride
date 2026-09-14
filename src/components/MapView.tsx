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
  // Opt-in: legenda fixa acima do marcador principal/secundário. Quem não
  // passar continua com exatamente os mesmos dois marcadores de sempre —
  // isso só adiciona uma etiqueta extra por cima, nunca troca o pino em si.
  markerLabel?: string;
  secondaryMarkerLabel?: string;
  // Opt-in: anel pulsando (radar) atrás do marcador principal, pra indicar
  // "localização ao vivo". Quem não passar continua com o pino de sempre,
  // sem nenhum elemento extra.
  pulsePrimaryMarker?: boolean;
}

function criarEtiquetaMarcador(texto: string, cor: string): mapboxgl.Marker {
  const el = document.createElement("div");
  el.style.transform = "translateY(-4px)";
  el.style.padding = "3px 9px";
  el.style.borderRadius = "9999px";
  el.style.fontSize = "10px";
  el.style.fontWeight = "800";
  el.style.textTransform = "uppercase";
  el.style.letterSpacing = "0.04em";
  el.style.whiteSpace = "nowrap";
  el.style.color = "#130F36";
  el.style.background = cor;
  el.style.border = "1px solid rgba(255,255,255,0.4)";
  el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
  el.style.pointerEvents = "none";
  el.textContent = texto;
  // anchor "bottom" posiciona a etiqueta encostada por cima da ponta do
  // pino padrão do Mapbox (que aponta pra baixo a partir do mesmo ponto).
  return new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -38] });
}

function criarAnelPulso(cor: string): mapboxgl.Marker {
  const el = document.createElement("div");
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "9999px";
  el.style.background = cor;
  el.style.pointerEvents = "none";
  // Reaproveita a mesma animação "pulse-ring" já usada em outros indicadores
  // de "ao vivo" no app (ex.: status do motorista) — nenhuma keyframe nova.
  el.className = "animate-pulse-ring";
  // anchor "center" encosta o anel exatamente no ponto onde a ponta do pino
  // padrão do Mapbox toca o chão (mesma coordenada do marcador principal).
  return new mapboxgl.Marker({ element: el, anchor: "center" });
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
  markerLabel,
  secondaryMarkerLabel,
  pulsePrimaryMarker = false,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const markerLabelRef = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerLabelRef = useRef<mapboxgl.Marker | null>(null);
  const pulseMarkerRef = useRef<mapboxgl.Marker | null>(null);

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
        attributionControl: false,
      });

      map.current.on("load", () => {
        map.current?.resize();
        if (onMapInstance && map.current) {
          onMapInstance(map.current);
        }
      });

      if (pulsePrimaryMarker) {
        // Criado antes do pino principal pra ficar sempre por baixo dele.
        pulseMarkerRef.current = criarAnelPulso(markerColor)
          .setLngLat([center.lng, center.lat])
          .addTo(map.current);
      }

      marker.current = new mapboxgl.Marker({ color: markerColor })
        .setLngLat([center.lng, center.lat])
        .addTo(map.current);

      if (markerLabel) {
        markerLabelRef.current = criarEtiquetaMarcador(markerLabel, markerColor)
          .setLngLat([center.lng, center.lat])
          .addTo(map.current);
      }

      if (secondaryMarker) {
        secondaryMarkerRef.current = new mapboxgl.Marker({
          color: secondaryMarker.color || "#6C3CE9",
        })
          .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
          .addTo(map.current);

        if (secondaryMarkerLabel) {
          secondaryMarkerLabelRef.current = criarEtiquetaMarcador(
            secondaryMarkerLabel,
            secondaryMarker.color || "#6C3CE9",
          )
            .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
            .addTo(map.current);
        }
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
        zoom: zoom,
      });

      if (marker.current) {
        marker.current.setLngLat([center.lng, center.lat]);
      }
      if (markerLabelRef.current) {
        markerLabelRef.current.setLngLat([center.lng, center.lat]);
      }
      if (pulseMarkerRef.current) {
        pulseMarkerRef.current.setLngLat([center.lng, center.lat]);
      }
    }
  }, [center.lat, center.lng, zoom]);

  // Inclinar/desinclinar suavemente quando pitch mudar depois de montado (ex.:
  // o motorista expande o mapa pra tela cheia) e ligar/desligar os prédios 3D
  // junto. Também cobre a própria carga inicial: se o estilo ainda não tiver
  // terminado de carregar (conexão lenta), espera o evento "load" em vez de
  // simplesmente desistir — do contrário a tela cheia podia abrir travada em
  // pitch 0 até o motorista fechar e abrir de novo (achado do Codex no #121).
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;

    const applyCamera = () => {
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
            "fill-extrusion-opacity": 0.75,
          },
        });
      } else if (!show3DBuildings && hasLayer) {
        currentMap.removeLayer("zuvvi-3d-buildings");
      }
    };

    if (currentMap.isStyleLoaded()) {
      applyCamera();
      return;
    }

    currentMap.once("load", applyCamera);
    return () => {
      currentMap.off("load", applyCamera);
    };
  }, [pitch, show3DBuildings]);

  // Atualizar marcador secundário quando a posição mudar
  useEffect(() => {
    if (map.current) {
      if (secondaryMarker) {
        if (secondaryMarkerRef.current) {
          secondaryMarkerRef.current.setLngLat([secondaryMarker.lng, secondaryMarker.lat]);
          if (secondaryMarkerLabelRef.current) {
            secondaryMarkerLabelRef.current.setLngLat([secondaryMarker.lng, secondaryMarker.lat]);
          }
        } else {
          secondaryMarkerRef.current = new mapboxgl.Marker({
            color: secondaryMarker.color || "#6C3CE9",
          })
            .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
            .addTo(map.current);
        }
        if (secondaryMarkerLabel && !secondaryMarkerLabelRef.current) {
          secondaryMarkerLabelRef.current = criarEtiquetaMarcador(
            secondaryMarkerLabel,
            secondaryMarker.color || "#6C3CE9",
          )
            .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
            .addTo(map.current);
        }
      } else {
        if (secondaryMarkerRef.current) {
          secondaryMarkerRef.current.remove();
          secondaryMarkerRef.current = null;
        }
        if (secondaryMarkerLabelRef.current) {
          secondaryMarkerLabelRef.current.remove();
          secondaryMarkerLabelRef.current = null;
        }
      }
    }
  }, [secondaryMarker?.lat, secondaryMarker?.lng, secondaryMarker?.color, secondaryMarkerLabel]);

  return <div ref={mapContainer} className={className} />;
}
