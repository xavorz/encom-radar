const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const { query } = require('../services/db');

// POST /api/compartir/:id — Generar enlace compartido
router.post('/:id', async (req, res) => {
  try {
    // Verificar si ya tiene token
    const existing = await query(
      'SELECT share_token FROM oportunidades WHERE id = $1',
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    let token = existing.rows[0].share_token;

    if (!token) {
      token = nanoid(24);
      await query(
        'UPDATE oportunidades SET share_token = $1, updated_at = NOW() WHERE id = $2',
        [token, req.params.id]
      );
    }

    res.json({ token, url: `/share/${token}` });
  } catch (err) {
    console.error('Error generando enlace compartido:', err.message);
    res.status(500).json({ error: 'Error generando enlace compartido' });
  }
});

// GET /api/compartir/ver/:token — Ver oportunidad compartida
router.get('/ver/:token', async (req, res) => {
  try {
    const result = await query(
      `SELECT titulo, organismo, tipo, importe, plazo_presentacion, rating,
              justificacion_rating, por_que_encaja, fecha_deteccion, informe, alerta_plazo
       FROM oportunidades WHERE share_token = $1`,
      [req.params.token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enlace no válido o eliminado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo compartida:', err.message);
    res.status(500).json({ error: 'Error obteniendo oportunidad compartida' });
  }
});

// DELETE /api/compartir/:id — Eliminar enlace compartido
router.delete('/:id', async (req, res) => {
  try {
    await query(
      'UPDATE oportunidades SET share_token = NULL, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error eliminando enlace:', err.message);
    res.status(500).json({ error: 'Error eliminando enlace compartido' });
  }
});

module.exports = router;
