const express = require('express');
const router = express.Router();
const { ejecutarBusqueda, limpiarAntiguas } = require('../services/scheduler');
const { query } = require('../services/db');

// POST /api/busqueda/ejecutar — Búsqueda manual
router.post('/ejecutar', async (req, res) => {
  try {
    console.log('🔍 Búsqueda manual iniciada...');
    const resultado = await ejecutarBusqueda();
    res.json({
      ok: true,
      mensaje: `Búsqueda completada: ${resultado.encontradas} encontradas, ${resultado.guardadas} nuevas guardadas`,
      ...resultado
    });
  } catch (err) {
    console.error('Error en búsqueda manual:', err.message);
    res.status(500).json({ error: 'Error ejecutando búsqueda: ' + err.message });
  }
});

// GET /api/busqueda/historial — Historial de búsquedas
router.get('/historial', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM busquedas ORDER BY created_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo historial:', err.message);
    res.status(500).json({ error: 'Error obteniendo historial de búsquedas' });
  }
});

// POST /api/busqueda/limpiar — Limpiar oportunidades antiguas
router.post('/limpiar', async (req, res) => {
  try {
    await limpiarAntiguas();
    res.json({ ok: true, mensaje: 'Limpieza completada' });
  } catch (err) {
    res.status(500).json({ error: 'Error limpiando' });
  }
});

module.exports = router;
