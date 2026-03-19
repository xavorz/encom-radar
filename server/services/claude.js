const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const PERFIL_ENCOM = `Empresa valenciana de eventos tecnológicos y culturales. Proyectos: OWN Festival, Valencia Digital Summit, Valencia Game City. Experiencia en: organización de eventos, cultura digital, gaming, ecosistema startup, colaboración institucional con Ayuntamiento de Valencia y GVA, IVACE, Feria Valencia.`;

/**
 * Analiza y puntúa oportunidades ya obtenidas por los scrapers.
 * Usa Haiku para ahorrar tokens (solo análisis de texto, no web search).
 */
async function analizarOportunidades(oportunidadesRaw) {
  if (!oportunidadesRaw || oportunidadesRaw.length === 0) return [];

  // Lotes de 30 para minimizar llamadas a la API
  const LOTE_SIZE = 30;
  // Pausa de 60s entre lotes para respetar rate limit de 10K tokens/min
  const PAUSA_ENTRE_LOTES = 60000;
  const MAX_LOTES = 5; // Máximo 5 lotes (150 oportunidades) para no eternizar
  const resultados = [];

  const totalLotes = Math.min(Math.ceil(oportunidadesRaw.length / LOTE_SIZE), MAX_LOTES);

  for (let i = 0; i < oportunidadesRaw.length && Math.floor(i / LOTE_SIZE) < MAX_LOTES; i += LOTE_SIZE) {
    const loteNum = Math.floor(i / LOTE_SIZE) + 1;
    const lote = oportunidadesRaw.slice(i, i + LOTE_SIZE);
    console.log(`  🤖 Analizando lote ${loteNum}/${totalLotes} (${lote.length} oportunidades)...`);

    const loteAnalizado = await analizarLote(lote);
    resultados.push(...loteAnalizado);

    // Pausa larga entre lotes para respetar rate limit
    if (i + LOTE_SIZE < oportunidadesRaw.length && loteNum < MAX_LOTES) {
      console.log(`  ⏸️  Pausa 60s antes del siguiente lote (rate limit)...`);
      await new Promise(r => setTimeout(r, PAUSA_ENTRE_LOTES));
    }
  }

  return resultados;
}

async function analizarLote(lote, intento = 0) {
  const oportunidadesTexto = lote.map((op, idx) => `
[${idx + 1}]
Título: ${op.titulo}
Organismo: ${op.organismo}
Tipo: ${op.tipo}
Importe: ${op.importe}
Plazo: ${op.plazo_presentacion || 'No especificado'}
URL: ${op.url_fuente || 'No disponible'}
Fuente: ${op.fuente || 'N/A'}
Info adicional: ${JSON.stringify(op.datos_raw || {})}`).join('\n---');

  const prompt = `Eres un analista de oportunidades de financiación pública para empresas de eventos.

PERFIL DE ENCOM:
${PERFIL_ENCOM}

OPORTUNIDADES A ANALIZAR:
${oportunidadesTexto}

Para cada oportunidad, evalúa su relevancia para Encom con un rating de 1 a 10:
- 9-10: encaje directo con Encom, requisitos cumplibles, importe relevante
- 7-8: encaje alto con algún requisito a verificar
- 5-6: encaje parcial, explorable con socio o adaptación
- 1-4: no relevante para Encom

Devuelve EXCLUSIVAMENTE un JSON array. Por cada oportunidad incluye:
{
  "indice": número (el [N] del listado),
  "rating": número 1-10,
  "justificacion_rating": "Por qué esta puntuación",
  "por_que_encaja": "Explicación concreta de por qué encaja o no con Encom"
}

SOLO devuelve las que tengan rating >= 5.
Si ninguna llega a 5, devuelve array vacío: []
SOLO JSON válido, sin texto adicional.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    let analisis = parsearJSON(texto);
    if (!Array.isArray(analisis)) return [];

    // Combinar análisis con datos originales
    return analisis
      .filter(a => a.rating >= 5)
      .map(a => {
        const original = lote[a.indice - 1];
        if (!original) return null;
        return {
          titulo: original.titulo,
          organismo: original.organismo,
          tipo: original.tipo,
          importe: original.importe,
          plazo_presentacion: original.plazo_presentacion,
          rating: Math.min(10, Math.max(5, parseInt(a.rating) || 5)),
          justificacion_rating: a.justificacion_rating || '',
          por_que_encaja: a.por_que_encaja || '',
          url_fuente: original.url_fuente || null
        };
      })
      .filter(Boolean);

  } catch (err) {
    if (err.status === 429 && intento < 2) {
      const espera = (intento + 1) * 60000; // 60s, 120s
      console.log(`  ⏳ Rate limit en análisis (intento ${intento + 1}/2), esperando ${espera/1000}s...`);
      await new Promise(r => setTimeout(r, espera));
      return analizarLote(lote, intento + 1);
    }
    if (err.status === 429) {
      console.log('  ⛔ Rate limit persistente, saltando este lote');
    } else {
      console.error('  ❌ Error analizando lote:', err.message);
    }
    return [];
  }
}

/**
 * Genera informe detallado para una oportunidad.
 * Usa Haiku + web search limitado para encontrar la URL exacta.
 */
async function generarInforme(oportunidad) {
  const prompt = `Eres un consultor estratégico especializado en licitaciones públicas y subvenciones para empresas de eventos.

PERFIL DE ENCOM:
${PERFIL_ENCOM}

OPORTUNIDAD:
- Título: ${oportunidad.titulo}
- Organismo: ${oportunidad.organismo}
- Tipo: ${oportunidad.tipo}
- Importe: ${oportunidad.importe}
- Plazo de presentación: ${oportunidad.plazo_presentacion || 'No especificado'}
- Rating de afinidad: ${oportunidad.rating}/10
- Por qué encaja: ${oportunidad.por_que_encaja}
${oportunidad.url_fuente ? `- URL conocida: ${oportunidad.url_fuente}` : ''}

INSTRUCCIONES:
1. Busca en internet la convocatoria EXACTA usando el título y el organismo. Encuentra la página específica con las bases, requisitos y documentación.
2. Si la URL que tenemos es genérica (home del organismo), busca la URL específica de esta convocatoria.
3. Genera el informe basándote en la información real que encuentres.

Devuelve SOLO un JSON válido (sin markdown, sin bloques de código):

{
  "url_convocatoria": "URL EXACTA de la página de la convocatoria (no la home del organismo). null si no la encuentras.",
  "resumen_ejecutivo": "Máximo 5 líneas. Lenguaje claro, sin tecnicismos. Explica qué es, cuánto dinero hay, para qué sirve y por qué Encom debería presentarse.",
  "plan_tareas": [
    {
      "orden": 1,
      "tarea": "Descripción concreta de la tarea",
      "responsable_sugerido": "CEO / Dirección de proyectos / Administración / Legal / Equipo técnico",
      "tiempo_estimado": "Ej: 2 horas / 1 día / 1 semana",
      "prioridad": "alta | media | baja"
    }
  ],
  "alertas_criticas": [
    "Cada alerta como string: días restantes, requisitos a verificar, posibles incompatibilidades, documentos que tardan en obtenerse"
  ]
}

SOLO JSON, sin texto adicional.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3
      }],
      messages: [{ role: 'user', content: prompt }]
    });

    let texto = '';
    for (const block of response.content) {
      if (block.type === 'text') texto += block.text;
    }

    console.log('📄 Respuesta informe (primeros 200 chars):', texto.substring(0, 200));

    if (!texto || texto.trim().length === 0) {
      console.log('⚠️ Respuesta vacía, reintentando sin web search...');
      const retry = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Genera un informe JSON sobre esta oportunidad para Encom (eventos tecnológicos y culturales en Valencia).
Oportunidad: "${oportunidad.titulo}" del ${oportunidad.organismo}. Tipo: ${oportunidad.tipo}. Importe: ${oportunidad.importe}. Plazo: ${oportunidad.plazo_presentacion || 'no especificado'}.
Devuelve SOLO este JSON:
{"url_convocatoria": null, "resumen_ejecutivo": "...", "plan_tareas": [{"orden": 1, "tarea": "...", "responsable_sugerido": "...", "tiempo_estimado": "...", "prioridad": "alta"}], "alertas_criticas": ["..."]}`
        }]
      });
      texto = '';
      for (const block of retry.content) {
        if (block.type === 'text') texto += block.text;
      }
    }

    const informe = parsearJSON(texto);
    if (!informe || typeof informe !== 'object') {
      throw new Error('La IA no devolvió un informe válido. Inténtalo de nuevo.');
    }
    return informe;

  } catch (err) {
    if (err.status === 429) {
      console.log('⏳ Rate limit en informe, esperando 30s...');
      await new Promise(r => setTimeout(r, 30000));
      return generarInforme(oportunidad);
    }
    console.error('❌ Error generando informe:', err.message);
    throw err;
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
    // Intentar extraer array o objeto
    const matchArr = texto.match(/\[[\s\S]*\]/);
    if (matchArr) {
      try { return JSON.parse(matchArr[0]); } catch {}
    }
    const matchObj = texto.match(/\{[\s\S]*\}/);
    if (matchObj) {
      try { return JSON.parse(matchObj[0]); } catch {}
    }
    console.error('❌ No se pudo parsear JSON:', texto.substring(0, 200));
    return null;
  }
}

// analizarOportunidades ya no se usa (scoring local en cada scraper)
module.exports = { generarInforme };
