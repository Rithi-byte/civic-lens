import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { STATUSES, CATEGORIES, DEFAULT_CENTER } from '../lib/constants';

const Tiles = () => (
  <TileLayer
    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  />
);

// Map of many issues, colored by status
export function IssuesMap({ points = [], height = 480 }) {
  return (
    <div className="card overflow-hidden" style={{ height }}>
      <MapContainer center={DEFAULT_CENTER} zoom={11} scrollWheelZoom className="h-full w-full">
        <Tiles />
        {points.map((p) => (
          <CircleMarker
            key={p._id}
            center={[p.location.lat, p.location.lng]}
            radius={p.priority === 'critical' ? 11 : 8}
            pathOptions={{ color: 'white', weight: 2, fillColor: STATUSES[p.status]?.color, fillOpacity: 0.9 }}
          >
            <Popup>
              <p className="!m-0 text-xs font-semibold text-slate-500">{CATEGORIES[p.category]?.label}</p>
              <Link to={`/issues/${p._id}`} className="font-semibold">
                {p.title}
              </Link>
              <p className="!m-0 text-xs">{STATUSES[p.status]?.label}</p>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="pointer-events-none relative -mt-10 flex justify-end px-3">
        <div className="pointer-events-auto z-[500] flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs shadow">
          {Object.entries(STATUSES).map(([k, s]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Single issue location
export function SinglePointMap({ lat, lng, color = '#0d9488', height = 220 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200" style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <Tiles />
        <CircleMarker center={[lat, lng]} radius={10} pathOptions={{ color: 'white', weight: 3, fillColor: color, fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ value }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 15));
  }, [value, map]);
  return null;
}

// Click-to-pick location for the report form
export function LocationPicker({ value, onChange, height = 280 }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-300" style={{ height }}>
      <MapContainer center={value ? [value.lat, value.lng] : DEFAULT_CENTER} zoom={value ? 15 : 11} className="h-full w-full cursor-crosshair">
        <Tiles />
        <ClickHandler onPick={onChange} />
        <FlyTo value={value} />
        {value && (
          <CircleMarker
            center={[value.lat, value.lng]}
            radius={10}
            pathOptions={{ color: 'white', weight: 3, fillColor: '#e11d48', fillOpacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
}
