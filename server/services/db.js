const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Base de datos inicializada correctamente');
  } catch (err) {
    console.error('❌ Error inicializando la base de datos:', err.message);
    throw err;
  }
}

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.log(`⚠️ Query lenta (${duration}ms):`, text.substring(0, 80));
  }
  return res;
}

async function getUltimaVisita() {
  const res = await query('SELECT ultima_visita FROM visitas ORDER BY id LIMIT 1');
  return res.rows[0]?.ultima_visita || new Date();
}

async function actualizarVisita() {
  await query('UPDATE visitas SET ultima_visita = NOW() WHERE id = 1');
}

module.exports = { pool, initDB, query, getUltimaVisita, actualizarVisita };
