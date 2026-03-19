# Encom Radar

Sistema de búsqueda y seguimiento de licitaciones públicas, subvenciones y fondos europeos para Encom.

## Funcionalidades

- **Búsqueda diaria automática** con IA (Claude) en fuentes públicas españolas y europeas
- **Feed cronológico** con agrupación por fecha, filtros y badges de novedad
- **Generación de informes** automáticos con resumen ejecutivo, plan de tareas y alertas
- **Sistema de guardados** con estados editables y notas internas
- **Compartir** oportunidades con enlace público sin login
- **Alertas** cuando un plazo está a menos de 15 días

## Stack técnico

- **Frontend:** React 18 + Tailwind CSS
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **IA:** Anthropic Claude API con web search
- **Scheduler:** node-cron

---

## Ejecución en local

### Requisitos previos

- Node.js 18+
- PostgreSQL 14+ (local o Docker)
- Cuenta de Anthropic con API key

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/encom-radar.git
cd encom-radar
```

### 2. Configurar variables de entorno

```bash
cp .env.example server/.env
```

Edita `server/.env` con tus valores:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
DATABASE_URL=postgresql://usuario:password@localhost:5432/encom_radar
PORT=3001
CLIENT_URL=http://localhost:3000
CRON_SCHEDULE=0 8 * * *
```

### 3. Crear la base de datos

```bash
createdb encom_radar
```

(La app crea las tablas automáticamente al arrancar.)

### 4. Instalar dependencias e iniciar

```bash
# Terminal 1 - Backend
cd server
npm install
npm run dev

# Terminal 2 - Frontend
cd client
npm install
npm start
```

La app estará disponible en `http://localhost:3000`.

---

## Despliegue en Render

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/encom-radar.git
git push -u origin main
```

### 2. Conectar con Render

1. Ve a [render.com](https://render.com) y crea una cuenta
2. Haz clic en **New** > **Blueprint**
3. Conecta tu repositorio de GitHub
4. Render detectará el `render.yaml` y creará automáticamente:
   - Base de datos PostgreSQL (free tier)
   - Servicio API (Node.js)
   - Sitio estático (React)

### 3. Configurar la API key

1. Ve al servicio `encom-radar-api` en Render
2. En **Environment** > **Environment Variables**
3. Añade `ANTHROPIC_API_KEY` con tu clave de Anthropic
4. Actualiza `CLIENT_URL` con la URL real del cliente estático

---

## Variables de entorno

| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clave API de Anthropic | [console.anthropic.com](https://console.anthropic.com) > API Keys |
| `DATABASE_URL` | URL de conexión PostgreSQL | Render la genera automáticamente; en local usa tu conexión |
| `PORT` | Puerto del servidor API | Por defecto: 3001 |
| `CLIENT_URL` | URL del frontend (CORS) | En local: `http://localhost:3000`; en Render: URL del sitio estático |
| `CRON_SCHEDULE` | Expresión cron para búsqueda automática | Por defecto: `0 8 * * *` (8:00 AM diario, hora Madrid) |

---

## API Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/oportunidades` | Listar oportunidades con filtros |
| GET | `/api/oportunidades/resumen` | Resumen desde última visita |
| GET | `/api/oportunidades/guardadas` | Oportunidades guardadas |
| GET | `/api/oportunidades/:id` | Detalle de oportunidad |
| PATCH | `/api/oportunidades/:id` | Actualizar estado/nota |
| POST | `/api/oportunidades/:id/informe` | Generar informe con IA |
| POST | `/api/compartir/:id` | Generar enlace compartido |
| GET | `/api/compartir/ver/:token` | Ver oportunidad compartida |
| POST | `/api/busqueda/ejecutar` | Ejecutar búsqueda manual |
| GET | `/api/busqueda/historial` | Historial de búsquedas |
