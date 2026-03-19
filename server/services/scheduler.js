const cron = require('node-cron');
const { buscarOportunidades } = require('./claude');
const { query } = require('./db');

function calcularAlertaPlazo(fechaPlazo) {
  if (!fechaPlazo) return false;
  const hoy = new Date();
  const plazo = new Date(fechaPlazo);
  const diasRestantes = Math.ceil((plazo - hoy) / (1000 * 60 * 60 * 24));
  return diasRestantes <= 15 && diasRestantes >= 0;
}

async function ejecutarBusqueda({ forzar = false } = {}) {
  const inicio = Date.now();
  console.log(`\n🔍 [${new Date().toISOString()}] Iniciando búsqueda de oportunidades...`);

  // Evitar doble ejecución el mismo día salvo que sea búsqueda manual (forzar=true)
  if (!forzar) {
    const hoy = new Date().toISOString().split('T')[0];
    const yaEjecutada = await query(
      "SELECT id FROM busquedas WHERE fecha = $1 AND errores IS NULL",
      [hoy]
    );
    if (yaEjecutada.rows.length > 0) {
      console.log(`⏭️  Ya se ejecutó una búsqueda exitosa hoy (${hoy}), saltando.`);
      return { encontradas: 0, guardadas: 0, duracion: 0, saltada: true };
    }
  }

  try {
    const oportunidades = await buscarOportunidades();
    console.log(`📋 Encontradas ${oportunidades.length} oportunidades con rating >= 5`);

    let guardadas = 0;

    for (const op of oportunidades) {
      // Verificar duplicados por título similar
      const existente = await query(
        'SELECT id FROM oportunidades WHERE LOWER(titulo) = LOWER($1) AND organismo = $2',
        [op.titulo, op.organismo]
      );

      if (existente.rows.length > 0) {
        console.log(`⏭️  Ya existe: ${op.titulo.substring(0, 60)}...`);
        continue;
      }

      const alertaPlazo = calcularAlertaPlazo(op.plazo_presentacion);

      await query(
        `INSERT INTO oportunidades
        (titulo, organismo, tipo, importe, plazo_presentacion, rating, justificacion_rating, por_que_encaja, url_fuente, alerta_plazo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          op.titulo,
          op.organismo,
          op.tipo,
          op.importe,
          op.plazo_presentacion,
          op.rating,
          op.justificacion_rating,
          op.por_que_encaja,
          op.url_fuente,
          alertaPlazo
        ]
      );
      guardadas++;
      console.log(`✅ Guardada (rating ${op.rating}): ${op.titulo.substring(0, 60)}`);
    }

    const duracion = Date.now() - inicio;

    // Registrar búsqueda
    await query(
      'INSERT INTO busquedas (resultados_encontrados, resultados_guardados, duracion_ms) VALUES ($1, $2, $3)',
      [oportunidades.length, guardadas, duracion]
    );

    // Actualizar alertas de plazo en oportunidades existentes
    await query(`
      UPDATE oportunidades
      SET alerta_plazo = (plazo_presentacion IS NOT NULL AND plazo_presentacion - CURRENT_DATE <= 15 AND plazo_presentacion >= CURRENT_DATE),
          updated_at = NOW()
      WHERE estado NOT IN ('resuelta')
    `);

    console.log(`✅ Búsqueda completada: ${guardadas} nuevas guardadas en ${duracion}ms\n`);
    return { encontradas: oportunidades.length, guardadas, duracion };

  } catch (err) {
    const duracion = Date.now() - inicio;
    await query(
      'INSERT INTO busquedas (resultados_encontrados, resultados_guardados, duracion_ms, errores) VALUES (0, 0, $1, $2)',
      [duracion, err.message]
    ).catch(() => {});
    console.error(`❌ Error en búsqueda: ${err.message}`);
    throw err;
  }
}

function iniciarScheduler() {
  const cronSchedule = process.env.CRON_SCHEDULE || '0 8 * * *';

  console.log(`⏰ Scheduler configurado: "${cronSchedule}"`);

  cron.schedule(cronSchedule, async () => {
    try {
      await ejecutarBusqueda();
    } catch (err) {
      console.error('❌ Error en ejecución programada:', err.message);
    }
  }, {
    timezone: 'Europe/Madrid'
  });
}

// Limpiar oportunidades antiguas (más de 30 días, no guardadas)
async function limpiarAntiguas() {
  try {
    const res = await query(`
      DELETE FROM oportunidades
      WHERE fecha_deteccion < CURRENT_DATE - INTERVAL '30 days'
      AND estado IN ('nueva', 'vista')
    `);
    if (res.rowCount > 0) {
      console.log(`🧹 Limpiadas ${res.rowCount} oportunidades antiguas`);
    }
  } catch (err) {
    console.error('Error limpiando oportunidades antiguas:', err.message);
  }
}

module.exports = { iniciarScheduler, ejecutarBusqueda, limpiarAntiguas };
