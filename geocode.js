// Busca lat/lon de las estaciones en OpenStreetMap (Overpass) y las cruza por nombre.
const Q = '[out:json][timeout:90];node["railway"~"^(station|halt)$"]["station"!="subway"]["station"!="light_rail"](39.9,-4.7,41.1,-3.1);out body;'
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const n = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\(.*?\)?$/, '').replace(/madrid\s*-\s*/g, '').replace(/cercanias/g, '').replace(/[^a-z0-9]/g, '')

export async function geocodeStations(list) {
  let els
  for (const s of SERVERS) {
    try {
      const r = await fetch(s, { method: 'POST', body: 'data=' + encodeURIComponent(Q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'cercanias-app/0.1' } })
      els = (await r.json()).elements
      if (els?.length) break
    } catch (e) { console.log('Overpass falló en', s, e.message) }
  }
  if (!els?.length) return 0
  const osm = els.filter((e) => e.tags?.name).map((e) => ({ k: n(e.tags.name), lat: e.lat, lon: e.lon }))
  let ok = 0
  for (const s of list) {
    const k = n(s.name)
    if (!k) continue
    const h = osm.find((o) => o.k === k) || osm.find((o) => o.k.length > 3 && k.length > 3 && (o.k.includes(k) || k.includes(o.k)))
    if (h) { s.lat = h.lat; s.lon = h.lon; ok++ }
  }
  return ok
}
