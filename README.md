# Cercanías (Madrid)
Web + servidor intermedio con datos en tiempo real de Adif.

1. `npm install && npm run geocode` (una vez: añade coordenadas a las estaciones)
2. `npm start` → http://localhost:3000
3. Revisa `http://localhost:3000/api/raw/18000` (Atocha Cercanías) y ajusta `simplify()` en server.js si algún campo (hora, retraso, destino) sale vacío.

Despliegue: Render, Railway o Fly (necesita servidor siempre encendido por el WebSocket; no sirve Vercel ni Cloudflare Workers).
Datos no oficiales de Adif (canal no documentado, puede cambiar). No afiliado a Adif ni Renfe.
