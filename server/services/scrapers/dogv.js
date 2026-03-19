/**
 * Scraper para subvenciones autonómicas (GVA, IVACE, IVC, IVAJ)
 *
 * DOGV directo bloquea acceso → Usamos fuentes alternativas:
 * 1. Portal GVA de subvenciones (RSS si disponible)
 * 2. Web search ligero para DOGV, IVACE, IVC, IVAJ
 * Coste: ~$0.02 (1 llamada Haiku con 5 búsquedas)
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function buscarDOGV() {
  const hoy = new Date().toISOString().split('T')[0];

  try {
    console.log('  🔎 Buscando subvenciones autonómicas via web search...');

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
1. site:dogv.gva.es subvención OR ayuda "cultura" OR "eventos" OR "turismo" OR "innovación" 2026
2. site:ivace.es ayudas OR convocatoria abierta 2026
3. "Institut Valencià de Cultura" OR ivc.gva.es subvención OR ayuda festivales OR cultura 2026
4. site:gva.es subvención cultura OR turismo OR innovación OR juventud convocatoria abierta 2026

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

    const resultados = subvenciones.map(s => ({
      titulo: s.titulo || 'Sin título',
      organismo: s.organismo || 'Generalitat Valenciana',
      tipo: 'subvención',
      importe: s.importe || 'No especificado',
      plazo_presentacion: s.plazo_presentacion || null,
      url_fuente: s.url_fuente || null,
      fuente: 'GVA/DOGV',
      datos_raw: {}
    }));

    console.log(`  📋 Subvenciones autonómicas: ${resultados.length} encontradas`);
    return resultados;

  } catch (err) {
    if (err.status === 429) {
      console.log('  ⏳ Rate limit en búsqueda autonómica, esperando 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return buscarDOGV();
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
