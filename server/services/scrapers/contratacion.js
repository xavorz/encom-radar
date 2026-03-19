/**
 * Scraper para licitaciones públicas españolas
 *
 * contrataciondelsectorpublico.gob.es requiere certificado → NO accesible
 * Alternativa: búsqueda con Claude web search (1 sola llamada barata)
 * Coste: ~$0.02-0.04 por ejecución
 *
 * Devuelve resultados YA PUNTUADOS (rating, justificacion, etc.)
 * para evitar la fase de análisis posterior con Claude.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Reutilizamos el mismo scoring local que BDNS
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
  'comunitat valenciana', 'conselleria',
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
  if (desc.includes('licitación') || desc.includes('contrat')) parts.push('Licitación pública');
  return parts.join('. ') + '.';
}

/**
 * Busca licitaciones usando una única llamada a Claude con web search.
 * Devuelve resultados YA PUNTUADOS con rating >= 5.
 */
async function buscarContratacion() {
  const hoy = new Date().toISOString().split('T')[0];

  try {
    console.log('  🔎 Buscando licitaciones via web search...');

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
        content: `Busca licitaciones públicas ABIERTAS en España a fecha ${hoy} relevantes para una empresa de organización de eventos tecnológicos y culturales en Valencia.

Busca en Google con estas queries exactas:
1. site:contrataciondelsectorpublico.gob.es licitación abierta "eventos" OR "cultural" OR "turismo" 2026
2. licitación pública abierta "organización de eventos" OR "producción de eventos" OR "servicios culturales" Valencia 2026
3. "perfil del contratante" Valencia licitación eventos OR cultura OR turismo 2026

Para cada licitación REAL que encuentres con plazo abierto, devuelve un JSON array:
[{
  "titulo": "nombre completo",
  "organismo": "entidad convocante",
  "importe": "cantidad o 'No especificado'",
  "plazo_presentacion": "YYYY-MM-DD o null",
  "url_fuente": "URL EXACTA de la licitación (no la home del portal)"
}]

IMPORTANTE:
- Solo licitaciones REALES que hayas verificado en la búsqueda
- Solo con plazo de presentación aún abierto
- URL exacta de la licitación, NO la página principal del portal
- Si no encuentras ninguna, devuelve: []
- SOLO JSON, sin texto adicional`
      }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    let licitaciones = parsearJSON(texto);
    if (!Array.isArray(licitaciones)) return [];

    // Puntuar localmente cada resultado y filtrar por rating >= 5
    const resultados = [];
    for (const l of licitaciones) {
      const titulo = l.titulo || 'Sin título';
      const organismo = l.organismo || 'No especificado';
      const { rating, esValenciana } = calcularScore(titulo, organismo);

      // Las licitaciones vienen de web search ya filtradas por relevancia,
      // así que les damos mínimo rating 6 si el scoring local no llega
      const ratingFinal = Math.max(rating, 6);

      resultados.push({
        titulo,
        organismo,
        tipo: 'licitación',
        importe: l.importe || 'No especificado',
        plazo_presentacion: l.plazo_presentacion || null,
        rating: ratingFinal,
        justificacion_rating: generarJustificacion(titulo, ratingFinal, esValenciana),
        por_que_encaja: esValenciana
          ? `Licitación pública valenciana detectada. Verificar requisitos y plazos.`
          : `Licitación pública relevante para el sector de Encom. Verificar requisitos.`,
        url_fuente: l.url_fuente || null,
        fuente: 'Web Search'
      });
    }

    console.log(`  📋 Licitaciones: ${resultados.length} encontradas (ya puntuadas)`);
    return resultados;

  } catch (err) {
    if (err.status === 429) {
      console.log('  ⏳ Rate limit en licitaciones, esperando 60s...');
      await new Promise(r => setTimeout(r, 60000));
      return buscarContratacion();
    }
    console.log(`  ⚠️ Error buscando licitaciones: ${err.message}`);
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

module.exports = { buscarContratacion };
