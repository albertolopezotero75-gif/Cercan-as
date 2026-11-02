// Cercanías · servidor intermedio. Lee el canal en tiempo real de Adif (SignalR, no documentado)
// y lo expone como JSON. Necesita un servidor siempre encendido (Render, Railway, Fly...).
import express from 'express'
import * as signalR from '@microsoft/signalr'
import { readFileSync, writeFileSync } from 'node:fs'
import { geocodeStations } from './geocode.js'

let stations = JSON.parse(readFileSync('data/stations.json', 'utf8'))
const norm = (c) => String(c).replace(/^0+(?=\d)/, '')
const last = new Map() // código -> { at, data }
const joined = new Set()

const conn = new signalR.HubConnectionBuilder()
  .withUrl('https://info.adif.es/InfoStation', {
    skipNegotiation: true,
    transport: signalR.HttpTransportType.WebSockets,
    headers: {
      Origin: 'https://info.adif.es',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    },
  })
  .configureLogging(signalR.LogLevel.Error)
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .build()

conn.on('ReceiveMessage', (raw) => {
  try {
    const data = JSON.parse(raw)
    const code = data?.station_settings?.code
    if (code) last.set(norm(code), { at: Date.now(), data })
  } catch (e) { console.error('mensaje no válido', e.message) }
})
conn.on('ReceiveError', (e) => console.error('Adif ReceiveError:', e))
conn.onreconnected(async () => { for (const c of joined) await join(c) })
conn.onclose(() => setTimeout(start, 5000))

async function join(code) {
  await conn.invoke('JoinInfo', code)
  await conn.invoke('GetLastMessage', code)
}
let adifError = null
async function start() {
  try { await conn.start(); for (const c of joined) await join(c); console.log('Conectado a Adif') }
  catch (e) { adifError = String(e.message).slice(0, 200); console.error('Sin conexión con Adif:', e.message); setTimeout(start, 10000) }
}

async function board(code) {
  const k = norm(code)
  if (!joined.has(code)) { joined.add(code); if (conn.state === 'Connected') await join(code) }
  for (let i = 0; i < 25 && !last.has(k); i++) await new Promise((r) => setTimeout(r, 200))
  return last.get(k)
}

// Los nombres exactos de los campos horarios no están documentados: se devuelven todos los
// campos que parezcan una hora o un retraso para poder ajustarlos con /api/raw/:code.
const timeLike = (t) => Object.fromEntries(Object.entries(t).filter(([k]) => /time|hora|delay|retraso|eta|arriv|depart/i.test(k)))
function simplify(t) {
  const d = t.destinations?.[0] ?? {}
  return {
    line: (d.line || '').replace(/ROD[A-Z0-9]*|CER[A-Z0-9]*|TRA[A-Z0-9]*/g, '').trim(),
    destination: d.name || d.station || d.title || null,
    platform: (t.platform || '').trim() || null,
    status: t.status ?? null,
    stop: t.class_stop ?? null,
    times: timeLike(t),
  }
}

const app = express()
app.use(express.static('public'))
let geoState = 'pendiente'
async function geo() {
  if (stations.filter((x) => x.lat).length > stations.length * 0.3) { geoState = 'listo'; return }
  geoState = 'buscando'
  for (let i = 0; i < 4; i++) {
    const ok = await geocodeStations(stations)
    console.log('Coordenadas encontradas:', ok)
    if (ok) { try { writeFileSync('data/stations.json', JSON.stringify(stations)) } catch {} geoState = 'listo'; return }
    await new Promise((r) => setTimeout(r, 15000))
  }
  geoState = 'error'
}
app.get('/api/status', (_q, r) => r.json({ adif: conn.state, errorAdif: adifError, coordenadas: geoState, estaciones: stations.length, conCoordenadas: stations.filter((x) => x.lat).length }))
app.get('/api/stations', (_q, r) => r.json(stations))
app.get('/api/board/:code', async (q, r) => {
  const m = await board(q.params.code)
  if (!m) return r.status(404).json({ error: 'Adif no devuelve pantalla para esta estación (puede no tenerla).' })
  const trains = (m.data.trains || []).filter((t) => t.traffic_type === 'C').map(simplify)
  r.json({ station: q.params.code, updated: m.at, trains })
})
app.get('/api/raw/:code', async (q, r) => { const m = await board(q.params.code); r.json(m?.data ?? null) })

start()
geo()
app.listen(process.env.PORT || 3000, () => console.log('Cercanías en http://localhost:' + (process.env.PORT || 3000)))
