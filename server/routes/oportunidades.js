const express = require('express');
const router = express.Router();
const { query, getUltimaVisita, actualizarVisita } = require('../services/db');
const { generarInforme } = require('../services/claude');

// GET /api/oportunidades — Feed principal con filtros
router.get('/', async (req, res) => {
  try {
    const { dias = 10, tipo, rating_min = 5, estado } = req.query;

    let sql = `
      SELECT * FROM oportunidades
      WHERE fecha_deteccion >= CURRENT_DATE - $1::integer
      AND rating >= $2
    `;
    const params = [parseInt(dias), parseInt(rating_min)];
    let paramIdx = 3;

    if (tipo) {
      sql += ` AND tipo = $${paramIdx}`;
      params.push(tipo);
      paramIdx++;
    }

    if (estado) {
      sql += ` AND estado = $${paramIdx}`;
      params.push(estado);
      paramIdx++;
    }

    sql += ' ORDER BY fecha_deteccion DESC, rating DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo oportunidades:', err.message);
    res.status(500).json({ error: 'Error obteniendo oportunidades' });
  }
});

// GET /api/oportunidades/resumen — Resumen desde última visita
router.get('/resumen', async (req, res) => {
  try {
    const ultimaVisita = await getUltimaVisita();

    const nuevas = await query(
      'SELECT COUNT(*) as total FROM oportunidades WHERE created_at > $1',
      [ultimaVisita]
    );

    const altasRating = await query(
      'SELECT COUNT(*) as total FROM oportunidades WHERE created_at > $1 AND rating >= 8',
      [ultimaVisita]
    );

    const alertas = await query(
      `SELECT COUNT(*) as total FROM oportunidades
       WHERE alerta_plazo = true AND estado NOT IN ('resuelta', 'presentada')`,
      []
    );

    const diasSinVisita = Math.floor((new Date() - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24));

    // Actualizar visita
    await actualizarVisita();

    res.json({
      ultima_visita: ultimaVisita,
      dias_sin_visita: diasSinVisita,
      nuevas: parseInt(nuevas.rows[0].total),
      altas_rating: parseInt(altasRating.rows[0].total),
      alertas_plazo: parseInt(alertas.rows[0].total)
    });
  } catch (err) {
    console.error('Error obteniendo resumen:', err.message);
    res.status(500).json({ error: 'Error obteniendo resumen' });
  }
});

// GET /api/oportunidades/guardadas
router.get('/guardadas', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM oportunidades
       WHERE estado IN ('guardada', 'en preparación', 'presentada', 'resuelta')
       ORDER BY
         CASE WHEN alerta_plazo = true THEN 0 ELSE 1 END,
         plazo_presentacion ASC NULLS LAST,
         rating DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error obteniendo guardadas:', err.message);
    res.status(500).json({ error: 'Error obteniendo guardadas' });
  }
});

// GET /api/oportunidades/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM oportunidades WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    // Marcar como vista si es nueva
    if (result.rows[0].estado === 'nueva') {
      await query("UPDATE oportunidades SET estado = 'vista', updated_at = NOW() WHERE id = $1", [req.params.id]);
      result.rows[0].estado = 'vista';
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo oportunidad:', err.message);
    res.status(500).json({ error: 'Error obteniendo oportunidad' });
  }
});

// PATCH /api/oportunidades/:id — Actualizar estado/nota
router.patch('/:id', async (req, res) => {
  try {
    const { estado, nota_interna } = req.body;
    const updates = [];
    const params = [];
    let idx = 1;

    if (estado) {
      updates.push(`estado = $${idx}`);
      params.push(estado);
      idx++;
    }

    if (nota_interna !== undefined) {
      updates.push(`nota_interna = $${idx}`);
      params.push(nota_interna);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await query(
      `UPDATE oportunidades SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error actualizando oportunidad:', err.message);
    res.status(500).json({ error: 'Error actualizando oportunidad' });
  }
});

// POST /api/oportunidades/:id/informe — Generar informe con Claude
router.post('/:id/informe', async (req, res) => {
  try {
    const result = await query('SELECT * FROM oportunidades WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Oportunidad no encontrada' });
    }

    const oportunidad = result.rows[0];
    console.log(`📝 Generando informe para: ${oportunidad.titulo.substring(0, 50)}...`);

    const informe = await generarInforme(oportunidad);

    // Si el informe incluye url_convocatoria, actualizar la oportunidad
    const updates = { informe: JSON.stringify(informe) };
    let sql = 'UPDATE oportunidades SET informe = $1, updated_at = NOW()';
    const params = [JSON.stringify(informe)];

    if (informe.url_convocatoria) {
      sql += ', url_fuente = $2 WHERE id = $3';
      params.push(informe.url_convocatoria, req.params.id);
    } else {
      sql += ' WHERE id = $2';
      params.push(req.params.id);
    }

    await query(sql, params);

    res.json(informe);
  } catch (err) {
    console.error('Error generando informe:', err.message, err.stack);
    res.status(500).json({ error: 'Error generando informe: ' + err.message });
  }
});

module.exports = router;
