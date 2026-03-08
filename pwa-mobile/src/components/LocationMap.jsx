import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ícone customizado para o marcador
const customIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDMyIDQwIj48cGF0aCBkPSJNMTYgMEMxMi4zIDAgOS4yIDMuMSA5LjIgNi44YzAgNS4zIDYuOCAxNi44IDYuOCAxNi44czYuOC0xMS41IDYuOC0xNi44YzAtMy43LTMuMS02LjgtNi44LTYuOHpNMTYgOS41YzEuNCAwIDIuNSAxLjEgMi41IDIuNWMwIDEuNC0xLjEgMi41LTIuNSAyLjVjLTEuNCAwLTIuNS0xLjEtMi41LTIuNWMwLTEuNCAxLjEtMi41IDIuNS0yLjV6IiBmaWxsPSIjMTBlYzVkIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

export default function LocationMap({ location, isDarkMode }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (!location || !mapContainer.current) return;

    // Inicializar mapa apenas uma vez
    if (!map.current) {
      map.current = L.map(mapContainer.current, {
        zoom: 16,
        center: [location.latitude, location.longitude],
        attributionControl: true,
        zoomControl: true
      });

      // Adicionar camada do OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map.current);
    }

    // Atualizar posição do mapa e marcador
    if (map.current) {
      map.current.setView([location.latitude, location.longitude], 16);

      // Remover marcador anterior se existir
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (circleRef.current) {
        circleRef.current.remove();
      }

      // Adicionar novo marcador
      markerRef.current = L.marker(
        [location.latitude, location.longitude],
        { icon: customIcon }
      )
        .bindPopup(
          `<div class="text-sm"><strong>Sua Localização</strong><br/>
          Lat: ${location.latitude.toFixed(5)}<br/>
          Lng: ${location.longitude.toFixed(5)}<br/>
          Precisão: ±${Math.round(location.accuracy)}m</div>`,
          { maxWidth: 250 }
        )
        .addTo(map.current)
        .openPopup();

      // Adicionar círculo de precisão
      circleRef.current = L.circle(
        [location.latitude, location.longitude],
        {
          radius: location.accuracy || 50,
          color: isDarkMode ? '#3b82f6' : '#06b6d4',
          fillColor: isDarkMode ? '#3b82f6' : '#06b6d4',
          fillOpacity: 0.15,
          weight: 2,
          dashArray: '5, 5',
          lineCap: 'round'
        }
      ).addTo(map.current);
    }

    // Cleanup na desmontagem
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
      if (circleRef.current) {
        circleRef.current.remove();
      }
    };
  }, [location, isDarkMode]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-80 rounded-2xl overflow-hidden shadow-lg border-2"
      style={{
        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
      }}
    />
  );
}
