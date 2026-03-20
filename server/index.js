require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./services/db');
const { iniciarScheduler, limpiarAntiguas } = require('./services/scheduler');

const oportunidadesRouter = require('./routes/oportunidades');
const compartirRouter = require('./routes/compartir');
const busquedaRouter = require('./routes/busqueda');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/oportunidades', oportunidadesRouter);
app.use('/api/compartir', compartirRouter);
app.use('/api/busqueda', busquedaRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// En producción (Docker/Coolify): servir el frontend estático
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));
  // SPA fallback: cualquier ruta que no sea /api → index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
}

// Iniciar servidor
async function start() {
  try {
    // Inicializar base de datos
    await initDB();
    console.log('📦 Base de datos lista');

    // Iniciar scheduler
    iniciarScheduler();
    console.log('⏰ Scheduler iniciado');

    // Programar limpieza diaria a las 3:00 AM
    const cron = require('node-cron');
    cron.schedule('0 3 * * *', limpiarAntiguas, { timezone: 'Europe/Madrid' });

    app.listen(PORT, () => {
      console.log(`\n🚀 Encom Radar API corriendo en puerto ${PORT}`);
      console.log(`📡 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Cliente: ${process.env.CLIENT_URL || 'http://localhost:3000'}\n`);
    });
  } catch (err) {
    console.error('❌ Error iniciando servidor:', err.message);
    process.exit(1);
  }
}

start();
