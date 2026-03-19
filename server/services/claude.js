const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const PERFIL_ENCOM = `Empresa valenciana de eventos tecnológicos y culturales. Proyectos: OWN Festival, Valencia Digital Summit, Valencia Game City. Experiencia en: organización de eventos, cultura digital, gaming, ecosistema startup, colaboración institucional con Ayuntamiento de Valencia y GVA, IVACE, Feria Valencia.`;

const CRITERIOS_RATING = `
Criterios de puntuación (rating 1-10):
- 9-10: encaje directo con el perfil de Encom, requisitos cumplibles, importe relevante
- 7-8: encaje alto con algún requisito a verificar
- 5-6: encaje parcial, explorable con socio o adaptación
- 1-4: no relevante (no incluir)
Solo devuelve oportunidades con rating >= 5.`;

const JSON_FORMAT = `
FORMATO DE RESPUESTA:
Devuelve EXCLUSIVAMENTE un JSON array válido (sin texto adicional, sin markdown, sin bloques de código). Cada elemento debe tener exactamente estos campos:
{
  "titulo": "Nombre completo de la convocatoria/licitación",
  "organismo": "Entidad convocante",
  "tipo": "licitación" | "subvención" | "fondo europeo",
  "importe": "Cantidad o rango (ej: '50.000€' o 'Hasta 200.000€' o 'No especificado')",
  "plazo_presentacion": "YYYY-MM-DD o null si no se conoce",
  "rating": número entre 5 y 10,
  "justificacion_rating": "Por qué esta puntuación",
  "por_que_encaja": "Explicación concreta de por qué encaja con Encom",
  "url_fuente": "URL EXACTA de la página de la convocatoria (NO la home del organismo, sino la URL específica del anuncio/convocatoria/licitación). Si no encuentras la URL exacta, pon null."
}

Si no encuentras oportunidades relevantes con rating >= 5, devuelve un array vacío: []
IMPORTANTE: SOLO JSON válido, sin texto adicional, sin explicaciones.
IMPORTANTE: Para url_fuente, NUNCA pongas la página principal de un organismo (como ivace.es o dogv.gva.es). Pon la URL específica de la convocatoria o null si no la encuentras.`;

// Búsquedas especializadas por tipo
const BLOQUES_BUSQUEDA = [
  {
    nombre: 'Licitaciones públicas',
    prompt: (hoy) => `Eres un analista experto en contratación pública española.

PERFIL DE LA EMPRESA:
${PERFIL_ENCOM}

TAREA:
Busca en internet LICITACIONES PÚBLICAS con plazo abierto a fecha ${hoy} relevantes para Encom. Usa estas búsquedas concretas:

1. Busca en Google: site:contrataciondelestado.es "organización de eventos" OR "producción de eventos" OR "gestión cultural" OR "actividades culturales" 2025 2026
2. Busca en Google: site:contrataciondelestado.es "Valencia" "eventos" OR "cultura" OR "turismo" licitación abierta 2026
3. Busca: "perfil contratante" "Ayuntamiento de Valencia" eventos OR cultura OR turismo licitación 2026
4. Busca: "licitación" "Generalitat Valenciana" OR "GVA" eventos OR festivales OR cultura 2026 abierta
5. Busca: licitación pública España "organización de eventos" OR "gestión de eventos" OR "producción técnica eventos" abierta 2026

Para cada licitación encontrada, verifica que esté realmente abierta (plazo no vencido) y que sea adjudicable a una empresa de eventos privada (no solo para personas físicas o entidades sin ánimo de lucro).

${CRITERIOS_RATING}

${JSON_FORMAT}`
  },
  {
    nombre: 'Subvenciones nacionales y autonómicas',
    prompt: (hoy) => `Eres un analista experto en subvenciones públicas en España, especializado en la Comunidad Valenciana.

PERFIL DE LA EMPRESA:
${PERFIL_ENCOM}

TAREA:
Busca en internet SUBVENCIONES activas y abiertas a fecha ${hoy} relevantes para una empresa de eventos tecnológicos y culturales. Busca específicamente en:

1. infosubvenciones.es (BDNS) — busca convocatorias abiertas con términos: "eventos culturales", "industrias culturales", "cultura digital", "innovación cultural", "gaming", "videojuegos", "emprendimiento", "startup"
2. DOGV (dogv.gva.es) — convocatorias recientes de ayudas de la Generalitat Valenciana para cultura, turismo, innovación, empresa
3. IVACE (ivace.es) — ayudas a la internacionalización, digitalización, innovación empresarial
4. IVAJ (ivaj.gva.es) — programas de juventud, emprendimiento joven, cultura joven
5. Institut Valencià de Cultura (ivc.gva.es) — subvenciones para festivales, artes escénicas, música, cultura
6. Ayuntamiento de Valencia — subvenciones para actividades culturales, fiestas, turismo

Busca también subvenciones de:
- Ministerio de Cultura
- ICEX (internacionalización)
- Red.es (digitalización)
- ENISA (emprendimiento)

${CRITERIOS_RATING}

${JSON_FORMAT}`
  },
  {
    nombre: 'Fondos europeos',
    prompt: (hoy) => `Eres un analista experto en fondos y programas europeos.

PERFIL DE LA EMPRESA:
${PERFIL_ENCOM}

TAREA:
Busca en internet FONDOS Y PROGRAMAS EUROPEOS con convocatorias abiertas a fecha ${hoy} relevantes para una empresa de eventos tecnológicos y culturales en Valencia, España. Busca específicamente:

1. Creative Europe (ec.europa.eu/creative-europe) — convocatorias abiertas para cultura, festivales, cooperación cultural
2. Next Generation EU — fondos canalizados por España para digitalización, cultura, turismo (Plan de Recuperación)
3. Horizon Europe — convocatorias de innovación, industrias creativas
4. Erasmus+ — proyectos de juventud, innovación educativa
5. COSME / Single Market Programme — apoyo a PYMES, turismo
6. Interreg Mediterranean / Sudoe — proyectos transfronterizos de cultura y turismo
7. European Social Fund Plus — formación, empleo, inclusión

Incluye también fondos FEDER gestionados por la Comunidad Valenciana para innovación, cultura y turismo.

${CRITERIOS_RATING}

${JSON_FORMAT}`
  }
];

function parsearRespuesta(textoCompleto) {
  let oportunidades = [];
  try {
    let jsonStr = textoCompleto.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    oportunidades = JSON.parse(jsonStr);
  } catch (parseErr) {
    const match = textoCompleto.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        oportunidades = JSON.parse(match[0]);
      } catch {
        console.error('No se pudo parsear el JSON extraído');
        return [];
      }
    } else {
      console.error('No se encontró JSON array en la respuesta');
      console.error('Respuesta:', textoCompleto.substring(0, 300));
      return [];
    }
  }

  if (!Array.isArray(oportunidades)) return [];

  return oportunidades
    .filter(o => o && o.rating >= 5)
    .map(o => ({
      titulo: o.titulo || 'Sin título',
      organismo: o.organismo || 'No especificado',
      tipo: ['licitación', 'subvención', 'fondo europeo'].includes(o.tipo) ? o.tipo : 'subvención',
      importe: o.importe || 'No especificado',
      plazo_presentacion: o.plazo_presentacion || null,
      rating: Math.min(10, Math.max(5, parseInt(o.rating) || 5)),
      justificacion_rating: o.justificacion_rating || '',
      por_que_encaja: o.por_que_encaja || '',
      url_fuente: o.url_fuente || null
    }));
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ejecutarBloqueBusqueda(bloque, hoy, intentos = 0) {
  console.log(`  🔎 Buscando: ${bloque.nombre}...`);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 6
      }],
      messages: [{
        role: 'user',
        content: bloque.prompt(hoy)
      }]
    });

    let textoCompleto = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textoCompleto += block.text;
      }
    }

    const resultados = parsearRespuesta(textoCompleto);
    console.log(`  ✅ ${bloque.nombre}: ${resultados.length} resultados`);
    return resultados;

  } catch (err) {
    // Reintento automático en rate limit (máx 2 intentos)
    if (err.status === 429 && intentos < 2) {
      const espera = (intentos + 1) * 20000; // 20s, 40s
      console.log(`  ⏳ Rate limit en ${bloque.nombre}, esperando ${espera/1000}s...`);
      await esperar(espera);
      return ejecutarBloqueBusqueda(bloque, hoy, intentos + 1);
    }
    console.error(`  ❌ Error en ${bloque.nombre}: ${err.message}`);
    return [];
  }
}

async function buscarOportunidades() {
  const hoy = new Date().toISOString().split('T')[0];
  console.log(`🔍 Iniciando búsqueda en 3 bloques (secuencial)...`);

  // Ejecutar secuencialmente con pausa de 15s entre bloques para evitar rate limit
  const resultados = [];
  for (const bloque of BLOQUES_BUSQUEDA) {
    const res = await ejecutarBloqueBusqueda(bloque, hoy);
    resultados.push(res);
    if (bloque !== BLOQUES_BUSQUEDA[BLOQUES_BUSQUEDA.length - 1]) {
      console.log(`  ⏸️  Pausa 15s antes del siguiente bloque...`);
      await esperar(15000);
    }
  }

  // Combinar y deduplicar por título similar
  const todas = resultados.flat();
  const unicas = [];
  const titulosVistos = new Set();

  for (const op of todas) {
    const tituloNorm = op.titulo.toLowerCase().substring(0, 60);
    if (!titulosVistos.has(tituloNorm)) {
      titulosVistos.add(tituloNorm);
      unicas.push(op);
    }
  }

  console.log(`📋 Total: ${todas.length} encontradas, ${unicas.length} únicas tras deduplicar`);
  return unicas;
}

async function generarInforme(oportunidad) {
  // Usamos haiku para informes (más barato, no necesita web search para generar el plan)
  const MODEL_INFORME = 'claude-haiku-4-5-20251001';

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
    // Esperar 15s para no solapar con posibles búsquedas en curso
    await esperar(15000);

    const response = await client.messages.create({
      model: MODEL_INFORME,
      max_tokens: 4000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3
      }],
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    let textoCompleto = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textoCompleto += block.text;
      }
    }

    console.log('📄 Respuesta informe (primeros 300 chars):', textoCompleto.substring(0, 300));

    if (!textoCompleto || textoCompleto.trim().length === 0) {
      // Si no hay texto, puede que Claude haya devuelto solo tool_use blocks
      // Intentar con un prompt más directo sin web search
      console.log('⚠️ Respuesta vacía, reintentando sin web search...');
      const retry = await client.messages.create({
        model: MODEL_INFORME,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Genera un informe JSON sobre esta oportunidad para la empresa Encom (eventos tecnológicos y culturales en Valencia).

Oportunidad: "${oportunidad.titulo}" del ${oportunidad.organismo}. Tipo: ${oportunidad.tipo}. Importe: ${oportunidad.importe}. Plazo: ${oportunidad.plazo_presentacion || 'no especificado'}.

Devuelve SOLO este JSON:
{"url_convocatoria": null, "resumen_ejecutivo": "...", "plan_tareas": [{"orden": 1, "tarea": "...", "responsable_sugerido": "...", "tiempo_estimado": "...", "prioridad": "alta"}], "alertas_criticas": ["..."]}`
        }]
      });

      textoCompleto = '';
      for (const block of retry.content) {
        if (block.type === 'text') textoCompleto += block.text;
      }
    }

    let informe;
    try {
      let jsonStr = textoCompleto.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      informe = JSON.parse(jsonStr);
    } catch {
      const match = textoCompleto.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          informe = JSON.parse(match[0]);
        } catch (e2) {
          console.error('❌ JSON inválido extraído:', match[0].substring(0, 200));
          throw new Error('La IA devolvió un JSON mal formado. Inténtalo de nuevo.');
        }
      } else {
        console.error('❌ Sin JSON en respuesta:', textoCompleto.substring(0, 500));
        throw new Error('La IA no devolvió un informe válido. Inténtalo de nuevo.');
      }
    }

    return informe;
  } catch (err) {
    // Reintento en rate limit
    if (err.status === 429) {
      console.log('⏳ Rate limit en informe, esperando 30s...');
      await esperar(30000);
      return generarInforme(oportunidad); // un único reintento
    }
    console.error('❌ Error generando informe:', err.message);
    throw err;
  }
}

module.exports = { buscarOportunidades, generarInforme };
