import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api/axios';
import MonumentPanel from '../components/MonumentPanel';
import { BALKAN_BOUNDS, countryStyle, filterMonuments, isKosovo, markerSvg, MONUMENT_TYPES, NEIGHBOR_LABELS, TYPE_LABELS, validMonuments } from '../utils/map';

const markerIcons = Object.fromEntries(MONUMENT_TYPES.map((type) => [type, [false, true].map((selected) => L.divIcon({ className: 'heritage-marker-shell', html: `<span class="heritage-marker-circle${selected ? ' is-selected' : ''}">${markerSvg(type)}</span>`, iconSize: [36, 36], iconAnchor: [18, 18], tooltipAnchor: [18, -12] }))]));
const countryLabels = NEIGHBOR_LABELS.map((country) => ({ ...country, icon: L.divIcon({ className: 'country-label', html: country.name, iconSize: [130, 20], iconAnchor: [65, 10] }) }));

function MapViewport({ kosovo, selected, reset }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(kosovo).getBounds();
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 9, animate: false });
  }, [map, kosovo, reset]);
  useEffect(() => {
    if (!selected) return;
    const zoom = selected.fly ? Math.max(map.getZoom(), 12) : map.getZoom();
    const mobile = window.matchMedia('(max-width: 1023px)').matches;
    const offset = mobile ? map.getSize().y * 0.28 : 0;
    const center = map.unproject(map.project([selected.lat, selected.lng], zoom).add([0, offset]), zoom);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.flyTo(center, zoom, { animate: !reducedMotion, duration: 0.65 });
  }, [map, selected]);
  useEffect(() => {
    let frame;
    const resize = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => map.invalidateSize({ animate: false })); });
    resize.observe(map.getContainer());
    return () => { resize.disconnect(); cancelAnimationFrame(frame); };
  }, [map]);
  return null;
}

export default function MapDashboard() {
  const [geo, setGeo] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [geoAttempt, setGeoAttempt] = useState(0);
  const [monuments, setMonuments] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [listAttempt, setListAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [reset, setReset] = useState(0);
  const origin = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setGeoError(false);
    fetch('/geo/countries.geojson', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(async (response) => {
      if (!response.ok) throw new Error('Map request failed');
      const data = await response.json();
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.some(isKosovo)) throw new Error('Kosovo boundary missing');
      if (!controller.signal.aborted) setGeo(data);
    }).catch(() => { if (!controller.signal.aborted) setGeoError(true); });
    return () => controller.abort();
  }, [geoAttempt]);
  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true); setListError(false);
    api.get('/monuments', { signal: controller.signal }).then(({ data }) => { if (!controller.signal.aborted) setMonuments(validMonuments(data)); }).catch(() => { if (!controller.signal.aborted) setListError(true); }).finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [listAttempt]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null); setDetailLoading(true); setDetailError(false);
    api.get(`/monuments/${encodeURIComponent(selected.slug)}`, { signal: controller.signal }).then(({ data }) => {
      if (!data || data.slug !== selected.slug || typeof data.name_en !== 'string') throw new Error('Invalid monument details');
      if (!controller.signal.aborted) setDetail(data);
    }).catch(() => { if (!controller.signal.aborted) setDetailError(true); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected, detailAttempt]);
  const closePanel = useCallback(() => { setSelected(null); setDetail(null); setDetailError(false); origin.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (!selected) return;
    const escape = (event) => { if (event.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [selected, closePanel]);
  const kosovo = useMemo(() => geo?.features.find(isKosovo), [geo]);
  const filtered = useMemo(() => filterMonuments(monuments, query), [monuments, query]);
  const visible = useMemo(() => selected && !filtered.some((monument) => monument.slug === selected.slug) ? [...filtered, selected] : filtered, [filtered, selected]);
  const choose = (monument, element, fly = false) => { origin.current = element; setDetail(null); setDetailLoading(true); setDetailError(false); setSelected({ ...monument, fly }); setSearchOpen(false); };

  return <section className="map-dashboard" aria-label="Kosovo heritage map">
    <div className="map-viewport">
      {geo ? <MapContainer center={[42.6, 20.9]} zoom={8} minZoom={7} maxZoom={15} maxBounds={BALKAN_BOUNDS} maxBoundsViscosity={1} worldCopyJump={false} zoomControl={false} className="heritage-map" attributionControl>
        <GeoJSON data={geo} style={countryStyle} interactive={false} attribution='Borders: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener noreferrer">Natural Earth · 1:50m</a>' />
        <MapViewport kosovo={kosovo} selected={selected} reset={reset} />
        {countryLabels.map((country) => <Marker key={country.name} position={country.position} icon={country.icon} interactive={false} keyboard={false} />)}
        {visible.map((monument) => <Marker key={monument.slug} position={[monument.lat, monument.lng]} icon={(markerIcons[monument.type] || markerIcons.monument)[selected?.slug === monument.slug ? 1 : 0]} title={monument.name_en} alt={monument.name_en} zIndexOffset={selected?.slug === monument.slug ? 1000 : 0} eventHandlers={{ click: (event) => choose(monument, event.target.getElement()) }}><Tooltip direction="top" offset={[0, -12]}>{monument.name_en}</Tooltip></Marker>)}
        <MapZoomControls onReset={() => { closePanel(); setQuery(''); setReset((value) => value + 1); }} />
      </MapContainer> : <div className="flex h-full items-center justify-center p-8 text-center">{geoError ? <div role="alert"><p>We couldn’t load the map. Please try again.</p><button type="button" className="btn-primary mt-4" onClick={() => setGeoAttempt((value) => value + 1)}>Try again</button></div> : <p role="status">Drawing Kosovo’s heritage map…</p>}</div>}
      <div className="map-search rounded-2xl border border-heritage-tan bg-heritage-bg/95 p-4 shadow-sm">
        <p className="eyebrow mb-2">Explore Kosovo</p><form onSubmit={(event) => { event.preventDefault(); if (filtered[0]) choose(filtered[0], event.currentTarget.querySelector('input'), true); }}><label htmlFor="monument-search" className="sr-only">Search monuments by name</label><input id="monument-search" className="form-input py-2.5 text-sm" placeholder="Find a monument…" value={query} autoComplete="off" onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} /></form>
        {listLoading && <p role="status" className="mt-3 text-xs">Loading monuments…</p>}
        {listError && <div role="alert" className="mt-3 text-xs"><p>Monuments could not be loaded.</p><button className="mt-2 underline" onClick={() => setListAttempt((value) => value + 1)}>Try again</button></div>}
        {!listLoading && !listError && !monuments.length && <p className="mt-3 text-xs">No monuments have been added yet.</p>}
        {searchOpen && query.trim() && !listLoading && <div className="mt-3 max-h-56 overflow-y-auto">{filtered.length ? <ul aria-label="Matching monuments" className="space-y-1">{filtered.slice(0, 12).map((monument) => <li key={monument.slug}><button type="button" className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-heritage-tan/50" onClick={(event) => choose(monument, event.currentTarget, true)}>{monument.name_en}<span className="mt-1 block text-xs text-heritage-dark/50">{TYPE_LABELS[monument.type] || 'Monument'}</span></button></li>)}</ul> : <p className="text-sm text-heritage-dark/60">No monuments match that name.</p>}</div>}
      </div>
      <details className="map-legend rounded-xl border border-heritage-tan bg-heritage-bg/95 p-3 shadow-sm" open><summary className="cursor-pointer text-xs font-semibold">Monument types</summary><ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{MONUMENT_TYPES.map((type) => <li key={type} className="flex items-center gap-2 text-[11px] text-heritage-dark/70"><span className="legend-icon" dangerouslySetInnerHTML={{ __html: markerSvg(type) }} />{TYPE_LABELS[type]}</li>)}</ul></details>
    </div>
    {selected && <MonumentPanel selected={selected} monument={detail?.slug === selected.slug ? detail : null} loading={detailLoading} error={detailError} onClose={closePanel} onRetry={() => setDetailAttempt((value) => value + 1)} />}
  </section>;
}

function MapZoomControls({ onReset }) {
  const map = useMap();
  const controls = useRef(null);
  useEffect(() => { L.DomEvent.disableClickPropagation(controls.current); L.DomEvent.disableScrollPropagation(controls.current); }, []);
  return <div ref={controls} className="map-controls flex flex-col gap-2"><button type="button" className="map-control" aria-label="Zoom in" onClick={() => map.zoomIn()}>+</button><button type="button" className="map-control" aria-label="Zoom out" onClick={() => map.zoomOut()}>−</button><button type="button" className="map-control text-xs" onClick={onReset}>Reset</button></div>;
}
