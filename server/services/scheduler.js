const cron = require('node-cron');
const { buscarBDNS } = require('./scrapers/bdns');
const { buscarContratacion } = require('./scrapers/contratacion');
const { buscarDOGV } = require('./scrapers/dogv');
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

  // Evitar doble ejecución el mismo día salvo búsqueda manual
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
    // FASE 1: Scraping directo de fuentes públicas (GRATIS, sin tokens)
    // FUENTE 1: BDNS (API pública gratuita, sin tokens)
    console.log('\n📡 Fuente 1: BDNS (API pública, gratis)...');
    let datosBDNS = [];
    try {
      datosBDNS = await buscarBDNS();
    } catch (err) {
      console.error('  ❌ BDNS falló:', err.message);
    }

    // FUENTE 2: Licitaciones via web search (Haiku, ~$0.02)
    // Pausa de 70s para respetar rate limit de 10K tokens/min
    console.log('\n📡 Fuente 2: Licitaciones (web search)... esperando 70s para rate limit');
    await new Promise(r => setTimeout(r, 70000));
    let datosLicitaciones = [];
    try {
      datosLicitaciones = await buscarContratacion();
    } catch (err) {
      console.error('  ❌ Licitaciones falló:', err.message);
    }

    // FUENTE 3: Subvenciones autonómicas via web search (Haiku, ~$0.02)
    // Pausa de 70s entre llamadas a Haiku
    console.log('\n📡 Fuente 3: Subvenciones autonómicas (web search)... esperando 70s para rate limit');
    await new Promise(r => setTimeout(r, 70000));
    let datosGVA = [];
    try {
      datosGVA = await buscarDOGV();
    } catch (err) {
      console.error('  ❌ GVA/DOGV falló:', err.message);
    }

    // Todas las fuentes ya devuelven resultados con rating incluido
    const todasPuntuadas = [...datosBDNS, ...datosLicitaciones, ...datosGVA];

    console.log(`\n📊 Total recopilado: ${todasPuntuadas.length} oportunidades (ya puntuadas)`);
    console.log(`  - BDNS: ${datosBDNS.length}`);
    console.log(`  - Licitaciones: ${datosLicitaciones.length}`);
    console.log(`  - GVA/DOGV: ${datosGVA.length}`);

    if (todasPuntuadas.length === 0) {
      console.log('⚠️ No se encontraron oportunidades en ninguna fuente');
      const duracion = Date.now() - inicio;
      await query(
        'INSERT INTO busquedas (resultados_encontrados, resultados_guardados, duracion_ms) VALUES (0, 0, $1)',
        [duracion]
      );
      return { encontradas: 0, guardadas: 0, duracion };
    }

    // Deduplicar por título
    const unicas = [];
    const titulosVistos = new Set();
    for (const op of todasPuntuadas) {
      const tituloNorm = op.titulo.toLowerCase().substring(0, 80);
      if (!titulosVistos.has(tituloNorm)) {
        titulosVistos.add(tituloNorm);
        unicas.push(op);
      }
    }
    console.log(`  📋 Tras deduplicar: ${unicas.length} únicas (todas con rating >= 5)`);

    // FASE 2: Guardar en base de datos (sin análisis Claude — scoring ya hecho localmente)
    console.log('\n💾 FASE 2: Guardando en base de datos...');
    let guardadas = 0;

    for (const op of unicas) {
      const existente = await query(
        'SELECT id FROM oportunidades WHERE LOWER(titulo) = LOWER($1) AND organismo = $2',
        [op.titulo, op.organismo]
      );

      if (existente.rows.length > 0) {
        console.log(`  ⏭️ Ya existe: ${op.titulo.substring(0, 50)}...`);
        continue;
      }

      const alertaPlazo = calcularAlertaPlazo(op.plazo_presentacion);

      await query(
        `INSERT INTO oportunidades
        (titulo, organismo, tipo, importe, plazo_presentacion, rating, justificacion_rating, por_que_encaja, url_fuente, alerta_plazo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          op.titulo, op.organismo, op.tipo, op.importe,
          op.plazo_presentacion, op.rating, op.justificacion_rating,
          op.por_que_encaja, op.url_fuente, alertaPlazo
        ]
      );
      guardadas++;
      console.log(`  ✅ (${op.tipo} | rating ${op.rating}) ${op.titulo.substring(0, 60)}`);
    }

    const duracion = Date.now() - inicio;

    await query(
      'INSERT INTO busquedas (resultados_encontrados, resultados_guardados, duracion_ms) VALUES ($1, $2, $3)',
      [unicas.length, guardadas, duracion]
    );

    // Actualizar alertas de plazo
    await query(`
      UPDATE oportunidades
      SET alerta_plazo = (plazo_presentacion IS NOT NULL AND plazo_presentacion - CURRENT_DATE <= 15 AND plazo_presentacion >= CURRENT_DATE),
          updated_at = NOW()
      WHERE estado NOT IN ('resuelta')
    `);

    console.log(`\n✅ Búsqueda completada en ${Math.round(duracion/1000)}s: ${unicas.length} relevantes, ${guardadas} nuevas guardadas\n`);
    return { encontradas: unicas.length, guardadas, duracion };

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
  }, { timezone: 'Europe/Madrid' });
}

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
