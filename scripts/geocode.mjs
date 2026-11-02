import { readFileSync, writeFileSync } from 'node:fs'
import { geocodeStations } from '../geocode.js'
const f = 'data/stations.json'
const list = JSON.parse(readFileSync(f, 'utf8'))
const ok = await geocodeStations(list)
writeFileSync(f, JSON.stringify(list))
console.log(`Listo: ${ok} de ${list.length} estaciones con coordenadas.`)
