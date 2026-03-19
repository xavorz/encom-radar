/**
 * Scraper para licitaciones públicas españolas
 *
 * contrataciondelsectorpublico.gob.es requiere certificado → NO accesible
 * Alternativa: usar datos.gob.es que tiene dataset de contratación pública
 * + búsqueda complementaria con Claude web search (1 sola llamada barata)
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const PERFIL_ENCOM = `Empresa valenciana de eventos tecnológicos y culturales. Proyectos: OWN Festival, Valencia Digital Summit, Valencia Game City. Experiencia en: organización de eventos, cultura digital, gaming, ecosistema startup, colaboración institucional con Ayuntamiento de Valencia y GVA, IVACE, Feria Valencia.`;

/**
 * Busca licitaciones usando una única llamada a Claude con web search.
 * Esto es el fallback porque PLACSP requiere certificado digital.
 * Coste estimado: ~$0.02-0.04 por ejecución (1 sola llamada, Haiku, 5 búsquedas)
 */
async function buscarContratacion() {
  const hoy = new Date().toISOString().split('T')[0];

  try {
    console.log('  🔎 Buscando licitaciones via web search (fallback)...');

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

    const resultados = licitaciones.map(l => ({
      titulo: l.titulo || 'Sin título',
      organismo: l.organismo || 'No especificado',
      tipo: 'licitación',
      importe: l.importe || 'No especificado',
      plazo_presentacion: l.plazo_presentacion || null,
      url_fuente: l.url_fuente || null,
      fuente: 'Web Search',
      datos_raw: {}
    }));

    console.log(`  📋 Licitaciones (web search): ${resultados.length} encontradas`);
    return resultados;

  } catch (err) {
    if (err.status === 429) {
      console.log('  ⏳ Rate limit en búsqueda de licitaciones, esperando 30s...');
      await new Promise(r => setTimeout(r, 30000));
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
