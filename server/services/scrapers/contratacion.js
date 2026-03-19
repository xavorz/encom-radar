/**
 * Scraper para licitaciones públicas españolas
 *
 * FUENTE PRINCIPAL: datos.gob.es → API CKAN gratuita (0 tokens)
 * Dataset: "Licitaciones del Sector Público" y similares
 *
 * FUENTE SECUNDARIA: Claude web search (1 llamada Haiku, ~$0.02)
 *
 * Devuelve resultados YA PUNTUADOS con rating, justificacion, por_que_encaja.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// === DATOS.GOB.ES API (GRATIS) ===
const DATOS_GOB_API = 'https://datos.gob.es/apidata/catalog/dataset';

// Keywords para buscar datasets de contratación pública
const DATOS_GOB_QUERIES = [
  'licitaciones',
  'contratación pública',
  'contratos menores',
];

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
  'servicios culturales',
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
 * Busca licitaciones en la API abierta de datos.gob.es (GRATIS)
 */
async function buscarDatosGob() {
  const resultados = [];

  try {
    // Buscar datasets de contratación pública
    const url = `${DATOS_GOB_API}?q=licitaciones+contratación+pública&_sort=metadata_modified&_pageSize=20`;
    console.log('  🔎 Buscando en datos.gob.es (gratis)...');

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.log(`  ⚠️ datos.gob.es: HTTP ${response.status}`);
      return [];
    }

    const data = await response.json();
    const datasets = data.result?.items || data.results || [];

    for (const ds of datasets) {
      const titulo = ds.title || ds._id || '';
      const descripcion = ds.description || '';
      const org = ds.publisher?.name || ds.organization?.title || 'No especificado';
      const textoCompleto = `${titulo} ${descripcion}`;

      const { rating, esValenciana } = calcularScore(textoCompleto, org);
      if (rating < 6) continue;

      // Buscar URL de acceso
      let urlFuente = null;
      if (ds.distribution && ds.distribution.length > 0) {
        urlFuente = ds.distribution[0].accessURL || ds.distribution[0].downloadURL;
      }
      if (!urlFuente && ds._id) {
        urlFuente = `https://datos.gob.es/es/catalogo/${ds._id}`;
      }

      resultados.push({
        titulo: titulo.length > 200 ? titulo.substring(0, 200) + '...' : titulo,
        organismo: org,
        tipo: 'licitación',
        importe: 'Ver dataset',
        plazo_presentacion: null,
        rating,
        justificacion_rating: generarJustificacion(textoCompleto, rating, esValenciana),
        por_que_encaja: esValenciana
          ? 'Licitación pública valenciana en datos.gob.es. Verificar contenido del dataset.'
          : 'Licitación pública relevante en datos.gob.es. Verificar contenido.',
        url_fuente: urlFuente,
        fuente: 'datos.gob.es'
      });
    }

    console.log(`  📋 datos.gob.es: ${resultados.length} datasets relevantes`);
  } catch (err) {
    console.log(`  ⚠️ Error en datos.gob.es: ${err.message}`);
  }

  return resultados;
}

/**
 * Busca licitaciones via Claude web search (fallback, ~$0.02)
 */
async function buscarWebSearch() {
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
        content: `Busca licitaciones públicas y contratos menores ABIERTOS en España a fecha ${hoy} para una empresa que organiza eventos, festivales, producción audiovisual y experiencias culturales y tecnológicas.

Haz estas búsquedas web:
1. licitación "organización de eventos" OR "producción de eventos" OR "servicios audiovisuales" abierta 2026
2. contrato menor OR licitación "servicios culturales" OR "gestión cultural" OR "actividades culturales" Valencia OR Comunitat Valenciana 2026
3. licitación pública "turismo" OR "promoción turística" OR "festival" ayuntamiento OR diputación 2026
4. contrataciondelsectorpublico.gob.es eventos OR cultura OR audiovisual

Busca resultados reales en portales de contratación pública, perfiles del contratante de ayuntamientos, diputaciones y comunidades autónomas.

Para cada licitación que encuentres con plazo aún abierto o reciente, devuelve SOLO un JSON array:
[{
  "titulo": "nombre completo del contrato/licitación",
  "organismo": "entidad contratante",
  "importe": "cantidad o 'No especificado'",
  "plazo_presentacion": "YYYY-MM-DD o null",
  "url_fuente": "URL directa de la licitación (no la home del portal)"
}]

REGLAS:
- Solo licitaciones REALES verificadas en tu búsqueda
- Incluye contratos menores si los encuentras (son oportunidades rápidas)
- URL directa, no genérica
- Si no encuentras ninguna, devuelve: []
- Responde SOLO con el JSON, sin texto antes ni después`
      }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    let licitaciones = parsearJSON(texto);
    if (!Array.isArray(licitaciones)) return [];

    const resultados = [];
    for (const l of licitaciones) {
      const titulo = l.titulo || 'Sin título';
      const organismo = l.organismo || 'No especificado';
      const { rating, esValenciana } = calcularScore(titulo, organismo);
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
          ? 'Licitación pública valenciana detectada. Verificar requisitos y plazos.'
          : 'Licitación pública relevante para el sector de Encom. Verificar requisitos.',
        url_fuente: l.url_fuente || null,
        fuente: 'Web Search'
      });
    }

    console.log(`  📋 Licitaciones web: ${resultados.length} encontradas`);
    return resultados;

  } catch (err) {
    if (err.status === 429) {
      console.log('  ⏳ Rate limit en licitaciones web, saltando...');
      return []; // No reintentar — ya tenemos datos.gob.es
    }
    console.log(`  ⚠️ Error web search licitaciones: ${err.message}`);
    return [];
  }
}

/**
 * Función principal: combina datos.gob.es (gratis) + web search (barato)
 */
async function buscarContratacion() {
  // Primero datos.gob.es (gratis, sin tokens)
  const datosGob = await buscarDatosGob();

  // Luego web search (usa tokens pero es barato)
  const webSearch = await buscarWebSearch();

  const todos = [...datosGob, ...webSearch];
  console.log(`  📋 Licitaciones total: ${todos.length} (datos.gob: ${datosGob.length}, web: ${webSearch.length})`);
  return todos;
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
