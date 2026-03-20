/**
 * Scraper para subvenciones autonómicas (GVA, IVACE, IVC, IVAJ)
 *
 * DOGV directo bloquea acceso → web search ligero
 * Coste: ~$0.02 (1 llamada Haiku con 5 búsquedas)
 *
 * Devuelve resultados YA PUNTUADOS (rating, justificacion, etc.)
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Scoring local (mismo sistema que BDNS y contratacion)
const TIER1 = [
  'organización de eventos', 'producción de eventos', 'festival',
  'gaming', 'videojuego', 'startup', 'ecosistema emprendedor',
  'cultura digital', 'eventos culturales', 'eventos tecnológic',
  'industrias creativas', 'industria cultural',
];
const TIER2 = [
  'feria', 'congreso', 'espectáculo', 'artes escénic',
  'música en vivo', 'promoción turística', 'turismo cultural',
  'actividades culturales', 'transformación digital',
  'audiovisual', 'producción artística',
];
const TIER3 = [
  'cultural', 'cultura', 'turismo', 'innovación', 'digital',
  'creativ', 'juventud', 'emprendimiento', 'ocio', 'patrimonio',
];
const VALENCIA = [
  'valencia', 'valencian', 'ivace', 'ivaj', 'gva', 'generalitat',
  'diputació', 'diputacion de valencia', 'feria valencia',
  'comunitat valenciana', 'conselleria', 'ivc',
];

function calcularScore(descripcion, organismo) {
  const texto = `${descripcion} ${organismo}`.toLowerCase();
  let puntos = 0;
  for (const kw of TIER1) { if (texto.includes(kw)) puntos += 4; }
  for (const kw of TIER2) { if (texto.includes(kw)) puntos += 2; }
  for (const kw of TIER3) { if (texto.includes(kw)) puntos += 1; }
  const esValenciana = VALENCIA.some(kw => texto.includes(kw));
  if (esValenciana) puntos += 3;
  if (puntos <= 0) return { rating: 0, esValenciana };
  if (puntos <= 2) return { rating: 5, esValenciana };
  if (puntos <= 4) return { rating: 6, esValenciana };
  if (puntos <= 6) return { rating: 7, esValenciana };
  if (puntos <= 9) return { rating: 8, esValenciana };
  if (puntos <= 12) return { rating: 9, esValenciana };
  return { rating: 10, esValenciana };
}

function generarJustificacion(descripcion, rating, esValenciana) {
  const parts = [];
  if (rating >= 9) parts.push('Encaje directo con el perfil de Encom');
  else if (rating >= 7) parts.push('Encaje alto con el perfil de Encom');
  else parts.push('Encaje parcial, explorable con adaptación');
  if (esValenciana) parts.push('Comunitat Valenciana (territorio prioritario)');
  const desc = descripcion.toLowerCase();
  if (desc.includes('festival') || desc.includes('evento')) parts.push('Relacionada con eventos/festivales');
  if (desc.includes('cultura')) parts.push('Sector cultural');
  if (desc.includes('turismo') || desc.includes('turístic')) parts.push('Sector turístico');
  if (desc.includes('digital') || desc.includes('innovación')) parts.push('Innovación/digitalización');
  return parts.join('. ') + '.';
}

async function buscarDOGV(intento = 1) {
  const MAX_INTENTOS = 2;
  const hoy = new Date().toISOString().split('T')[0];

  try {
    console.log(`  🔎 Buscando subvenciones autonómicas via web search (intento ${intento}/${MAX_INTENTOS})...`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5
      }],
      messages: [{
        role: 'user',
        content: `Busca subvenciones y ayudas ABIERTAS de la Comunitat Valenciana a fecha ${hoy} relevantes para una empresa de eventos tecnológicos y culturales.

Haz estas búsquedas:
1. "Valencia Innovation Capital" subvención OR ayuda eventos OR innovación OR emprendimiento 2026
2. site:ivace.es ayudas OR convocatoria abierta 2026
3. "Institut Valencià de Cultura" subvención OR ayuda festivales OR cultura OR audiovisual 2026
4. Ayuntamiento de València OR Generalitat Valenciana subvención eventos OR cultura OR turismo OR innovación 2026

Para cada subvención REAL que encuentres con plazo abierto, devuelve un JSON array:
[{
  "titulo": "nombre completo de la convocatoria",
  "organismo": "IVACE / Institut Valencià de Cultura / IVAJ / Conselleria de X / etc",
  "importe": "cantidad o 'No especificado'",
  "plazo_presentacion": "YYYY-MM-DD o null",
  "url_fuente": "URL EXACTA de la convocatoria (la página específica, NO la home del organismo)"
}]

IMPORTANTE:
- Solo convocatorias REALES verificadas en la búsqueda
- Solo con plazo aún abierto o sin fecha límite conocida
- URL exacta, no genérica
- Si no encuentras ninguna, devuelve: []
- SOLO JSON, sin texto adicional`
      }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    let subvenciones = parsearJSON(texto);
    if (!Array.isArray(subvenciones)) return [];

    // Puntuar localmente y filtrar
    const resultados = [];
    for (const s of subvenciones) {
      const titulo = s.titulo || 'Sin título';
      const organismo = s.organismo || 'Generalitat Valenciana';
      const { rating, esValenciana } = calcularScore(titulo, organismo);

      // Subvenciones GVA vienen pre-filtradas por la búsqueda + son valencianas → mínimo rating 7
      const ratingFinal = Math.max(rating, 7);

      resultados.push({
        titulo,
        organismo,
        tipo: 'subvención',
        importe: s.importe || 'No especificado',
        plazo_presentacion: s.plazo_presentacion || null,
        rating: ratingFinal,
        justificacion_rating: generarJustificacion(titulo, ratingFinal, esValenciana),
        por_que_encaja: `Subvención autonómica valenciana. Territorio prioritario para Encom. Verificar requisitos y plazos.`,
        url_fuente: s.url_fuente || null,
        fuente: 'GVA/DOGV'
      });
    }

    console.log(`  📋 Subvenciones autonómicas: ${resultados.length} encontradas (ya puntuadas)`);
    return resultados;

  } catch (err) {
    if (err.status === 429 && intento < MAX_INTENTOS) {
      console.log(`  ⏳ Rate limit en búsqueda autonómica, esperando 90s (intento ${intento}/${MAX_INTENTOS})...`);
      await new Promise(r => setTimeout(r, 90000));
      return buscarDOGV(intento + 1);
    }
    if (err.status === 429) {
      console.log('  ⚠️ Rate limit persistente en GVA/DOGV — saltando');
      return [];
    }
    console.log(`  ⚠️ Error buscando subvenciones autonómicas: ${err.message}`);
    return [];
  }
}

function parsearJSON(texto) {
  if (!texto) return null;
  try {
    let jsonStr = texto.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch {
    const match = texto.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

module.exports = { buscarDOGV };
