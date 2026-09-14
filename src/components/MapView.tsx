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
  // Opt-in: troca o pino padrão do marcador secundário por um ícone de moto
  // que pode girar (secondaryMarkerBearing, em graus). Quem não passar
  // continua com o pino colorido de sempre.
  secondaryMarkerIcon?: "motorbike";
  secondaryMarkerBearing?: number;
  // Opt-in: some os rótulos de nome de estabelecimento/transporte/bairro do
  // estilo padrão do Mapbox, deixando o mapa mais limpo. Quem não passar
  // continua com o estilo "dark-v11" exatamente como sempre foi.
  hideClutterLabels?: boolean;
}

// Camadas de texto do estilo "dark-v11" que mais poluem um mapa pequeno
// (nome de loja/restaurante, transporte, bairro) — nunca as de rua/cidade,
// que ajudam a se orientar. Cada uma é checada antes de mexer: se o Mapbox
// mudar o estilo e alguma sumir, isso é ignorado com segurança.
const CAMADAS_ROTULO_POLUENTE = [
  "poi-label",
  "transit-label",
  "airport-label",
  "settlement-subdivision-label",
];

function criarEtiquetaMarcador(texto: string, cor: string, offsetY: number = -38): mapboxgl.Marker {
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
  // offsetY é ajustável porque o marcador de moto (badge circular centrado)
  // tem uma geometria bem diferente do pino padrão.
  return new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, offsetY] });
}

function criarAnelPulso(cor: string): mapboxgl.Marker {
  // Elemento "raiz" fica sem nenhum estilo de animação — é ele que o Mapbox
  // move via transform (translate) pra acompanhar a coordenada no mapa. Uma
  // animação de transform (scale) direto nesse mesmo elemento entra em
  // conflito com esse posicionamento e vence, "grudando" o marcador num
  // canto fixo do mapa em vez de segui-lo (achado do Rafael em teste real).
  const raiz = document.createElement("div");
  raiz.style.width = "20px";
  raiz.style.height = "20px";
  raiz.style.pointerEvents = "none";

  const pulso = document.createElement("div");
  pulso.style.width = "100%";
  pulso.style.height = "100%";
  pulso.style.borderRadius = "9999px";
  pulso.style.background = cor;
  // Reaproveita a mesma animação "pulse-ring" já usada em outros indicadores
  // de "ao vivo" no app (ex.: status do motorista) — nenhuma keyframe nova.
  pulso.className = "animate-pulse-ring";
  raiz.appendChild(pulso);

  // anchor "bottom" (igual à etiqueta) encosta a BASE do anel exatamente na
  // ponta do pino padrão do Mapbox — com anchor "center" ele ficava metade
  // atrás do pino e metade flutuando abaixo dele.
  return new mapboxgl.Marker({ element: raiz, anchor: "bottom" });
}

// Ícone de moto (mesmo desenho do "Motorbike" da lucide-react, usado como
// SVG puro porque este marcador é um elemento de DOM criado à mão, não JSX).
const MOTORBIKE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" ' +
  'fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="m18 14-1-3"/><path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81"/>' +
  '<path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5"/>' +
  '<circle cx="19" cy="17" r="3"/><circle cx="5" cy="17" r="3"/></svg>';

function criarMarcadorMoto(cor: string): { marker: mapboxgl.Marker; rotatableEl: HTMLDivElement } {
  const badge = document.createElement("div");
  badge.style.width = "36px";
  badge.style.height = "36px";
  badge.style.borderRadius = "9999px";
  badge.style.background = cor;
  badge.style.display = "flex";
  badge.style.alignItems = "center";
  badge.style.justifyContent = "center";
  badge.style.boxShadow = "0 2px 10px rgba(0,0,0,0.45)";
  badge.style.border = "2px solid rgba(255,255,255,0.5)";
  // Transição suave entre um ângulo e outro, em vez do ícone "saltar" pra
  // nova direção a cada atualização de posição do motorista.
  badge.style.transition = "transform 0.4s ease";
  badge.innerHTML = MOTORBIKE_SVG;

  // anchor "center" — o mesmo tratamento de um "puck" de localização (tipo
  // Uber/Google Maps): o círculo fica centrado exatamente na coordenada.
  const marker = new mapboxgl.Marker({ element: badge, anchor: "center" });
  return { marker, rotatableEl: badge };
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
  secondaryMarkerIcon,
  secondaryMarkerBearing,
  hideClutterLabels = false,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const markerLabelRef = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerLabelRef = useRef<mapboxgl.Marker | null>(null);
  const pulseMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const secondaryMarkerRotateElRef = useRef<HTMLDivElement | null>(null);

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
        if (secondaryMarkerIcon === "motorbike") {
          const { marker: motoMarker, rotatableEl } = criarMarcadorMoto(
            secondaryMarker.color || "#6C3CE9",
          );
          motoMarker.setLngLat([secondaryMarker.lng, secondaryMarker.lat]).addTo(map.current);
          secondaryMarkerRef.current = motoMarker;
          secondaryMarkerRotateElRef.current = rotatableEl;
          if (secondaryMarkerBearing !== undefined) {
            rotatableEl.style.transform = `rotate(${secondaryMarkerBearing}deg)`;
          }
        } else {
          secondaryMarkerRef.current = new mapboxgl.Marker({
            color: secondaryMarker.color || "#6C3CE9",
          })
            .setLngLat([secondaryMarker.lng, secondaryMarker.lat])
            .addTo(map.current);
        }

        if (secondaryMarkerLabel) {
          secondaryMarkerLabelRef.current = criarEtiquetaMarcador(
            secondaryMarkerLabel,
            secondaryMarker.color || "#6C3CE9",
            secondaryMarkerIcon === "motorbike" ? -22 : -38,
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

  // Esconder rótulos de poluição visual (loja, transporte, bairro) do estilo
  // padrão — mesmo padrão de espera pelo "load" já usado acima pro pitch/
  // prédios 3D, pro caso do estilo ainda não ter terminado de carregar.
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !hideClutterLabels) return;

    const esconderRotulosPoluentes = () => {
      CAMADAS_ROTULO_POLUENTE.forEach((id) => {
        try {
          if (currentMap.getLayer(id)) {
            currentMap.setLayoutProperty(id, "visibility", "none");
          }
        } catch {
          // Estilo do Mapbox pode não ter essa camada — ignora com segurança.
        }
      });
    };

    if (currentMap.isStyleLoaded()) {
      esconderRotulosPoluentes();
      return;
    }

    currentMap.once("load", esconderRotulosPoluentes);
    return () => {
      currentMap.off("load", esconderRotulosPoluentes);
    };
  }, [hideClutterLabels]);

  // Atualizar marcador secundário quando a posição mudar
  useEffect(() => {
    if (map.current) {
      if (secondaryMarker) {
        if (secondaryMarkerRef.current) {
          secondaryMarkerRef.current.setLngLat([secondaryMarker.lng, secondaryMarker.lat]);
          if (secondaryMarkerLabelRef.current) {
            secondaryMarkerLabelRef.current.setLngLat([secondaryMarker.lng, secondaryMarker.lat]);
          }
        } else if (secondaryMarkerIcon === "motorbike") {
          const { marker: motoMarker, rotatableEl } = criarMarcadorMoto(
            secondaryMarker.color || "#6C3CE9",
          );
          motoMarker.setLngLat([secondaryMarker.lng, secondaryMarker.lat]).addTo(map.current);
          secondaryMarkerRef.current = motoMarker;
          secondaryMarkerRotateElRef.current = rotatableEl;
          if (secondaryMarkerBearing !== undefined) {
            rotatableEl.style.transform = `rotate(${secondaryMarkerBearing}deg)`;
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
            secondaryMarkerIcon === "motorbike" ? -22 : -38,
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
        secondaryMarkerRotateElRef.current = null;
      }
    }
  }, [
    secondaryMarker?.lat,
    secondaryMarker?.lng,
    secondaryMarker?.color,
    secondaryMarkerLabel,
    secondaryMarkerIcon,
  ]);

  // Girar o ícone de moto conforme a direção do motorista, sem mexer na
  // posição (evita re-flyTo/refazer o marcador a cada leve mudança de rumo).
  useEffect(() => {
    if (secondaryMarkerRotateElRef.current && secondaryMarkerBearing !== undefined) {
      secondaryMarkerRotateElRef.current.style.transform = `rotate(${secondaryMarkerBearing}deg)`;
    }
  }, [secondaryMarkerBearing]);

  return <div ref={mapContainer} className={className} />;
}
