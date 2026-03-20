/**
 * Scraper para licitaciones públicas españolas
 *
 * PLACSP requiere certificado digital → no accesible directamente
 * Usamos Claude web search (1 llamada Haiku, ~$0.02) como fuente
 * Si hay rate limit, se salta sin reintentar (es la fuente menos crítica)
 *
 * Devuelve resultados YA PUNTUADOS con rating, justificacion, por_que_encaja.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// === SCORING LOCAL ===
const TIER1 = [
  'organización de eventos', 'producción de eventos', 'festival',
  'gaming', 'videojuego', 'startup', 'ecosistema emprendedor',
  'cultura digital', 'eventos culturales', 'eventos tecnológic',
  'industrias creativas', 'industria cultural', 'servicios audiovisuales',
];
const TIER2 = [
  'feria', 'congreso', 'espectáculo', 'artes escénic',
  'música en vivo', 'promoción turística', 'turismo cultural',
  'actividades culturales', 'transformación digital',
  'audiovisual', 'producción artística', 'gestión cultural',
  'servicios culturales', 'producción audiovisual',
];
const SECTOR_KEYWORDS = [
  'cultural', 'cultura', 'turismo', 'turístic', 'innovación', 'innovacion',
  'digital', 'creativ', 'juventud', 'emprendimiento', 'ocio',
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
  const esValenciana = VALENCIA.some(kw => texto.includes(kw));
  const tieneSector = SECTOR_KEYWORDS.some(kw => texto.includes(kw));
  if (esValenciana && tieneSector) puntos += 5;
  else if (esValenciana) puntos += 3;
  if (puntos <= 1) return { rating: 0, esValenciana };
  if (puntos <= 3) return { rating: 6, esValenciana };
  if (puntos <= 5) return { rating: 7, esValenciana };
  if (puntos <= 8) return { rating: 8, esValenciana };
  if (puntos <= 11) return { rating: 9, esValenciana };
  return { rating: 10, esValenciana };
}

function generarJustificacion(descripcion, rating, esValenciana) {
  const parts = [];
  if (rating >= 9) parts.push('Encaje directo con el perfil de Encom');
  else if (rating >= 7) parts.push('Encaje alto con el perfil de Encom');
  else parts.push('Oportunidad relevante para Encom');
  if (esValenciana) parts.push('Comunitat Valenciana (territorio prioritario)');
  const desc = descripcion.toLowerCase();
  if (desc.includes('festival') || desc.includes('evento')) parts.push('Relacionada con eventos/festivales');
  if (desc.includes('cultura')) parts.push('Sector cultural');
  if (desc.includes('turismo') || desc.includes('turístic')) parts.push('Sector turístico');
  if (desc.includes('digital') || desc.includes('innovación')) parts.push('Innovación/digitalización');
  return parts.join('. ') + '.';
}

/**
 * Busca licitaciones via Claude web search (~$0.02)
 * Si hay rate limit → devuelve [] sin reintentar
 */
async function buscarContratacion() {
  const hoy = new Date().toISOString().split('T')[0];
  const year = new Date().getFullYear();

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
        content: `Fecha de hoy: ${hoy}. Busca licitaciones públicas ABIERTAS en España para una empresa de organización de eventos, festivales, producción audiovisual y experiencias culturales y tecnológicas en Valencia.

Haz exactamente estas búsquedas:
1. "licitación" "organización de eventos" OR "producción audiovisual" OR "servicios culturales" ${year}
2. "contrato" OR "licitación" "eventos" OR "cultural" Valencia Comunitat Valenciana ${year}
3. site:gobierto.es/contratacion Valencia eventos OR cultura OR turismo

Para cada licitación REAL y ABIERTA que encuentres, devuelve un JSON array con este formato:
[{
  "titulo": "nombre del contrato",
  "organismo": "entidad contratante",
  "importe": "cantidad o 'No especificado'",
  "plazo_presentacion": "YYYY-MM-DD o null si no lo encuentras",
  "url_fuente": "URL directa a la licitación"
}]

REGLAS:
- SOLO licitaciones reales verificadas en los resultados de búsqueda
- Incluye contratos menores si los encuentras
- Si no encuentras ninguna licitación abierta, devuelve: []
- Responde SOLO con el JSON array, nada más`
      }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    let licitaciones = parsearJSON(texto);
    if (!Array.isArray(licitaciones)) {
      console.log('  📋 Licitaciones: 0 encontradas (respuesta no parseable)');
      return [];
    }

    const resultados = [];
    for (const l of licitaciones) {
      const titulo = l.titulo || 'Sin título';
      const organismo = l.organismo || 'No especificado';
      const { rating, esValenciana } = calcularScore(titulo, organismo);
      // Licitaciones de web search vienen pre-filtradas → mínimo rating 6
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
          ? 'Licitación pública valenciana. Verificar requisitos y plazos.'
          : 'Licitación pública relevante para Encom. Verificar requisitos.',
        url_fuente: l.url_fuente || null,
        fuente: 'Web Search'
      });
    }

    console.log(`  📋 Licitaciones: ${resultados.length} encontradas (ya puntuadas)`);
    return resultados;

  } catch (err) {
    if (err.status === 429) {
      console.log('  ⏳ Rate limit en licitaciones — saltando (no es crítico)');
      return [];
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
