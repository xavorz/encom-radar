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

const FUENTES = [
  'contrataciondelestado.es',
  'infosubvenciones.es (BDNS)',
  'DOGV (dogv.gva.es)',
  'IVACE (ivace.es)',
  'IVAJ (ivaj.gva.es)',
  'Institut Valencià de Cultura (ivc.gva.es)',
  'Perfil contratante Ayuntamiento de Valencia',
  'Creative Europe (ec.europa.eu/creative-europe)',
  'Next Generation EU'
];

async function buscarOportunidades() {
  const hoy = new Date().toISOString().split('T')[0];

  const prompt = `Eres un analista experto en contratación pública, subvenciones y fondos europeos en España, especializado en la Comunidad Valenciana.

PERFIL DE LA EMPRESA:
${PERFIL_ENCOM}

TAREA:
Busca en internet licitaciones públicas, subvenciones y fondos europeos ACTIVOS Y ABIERTOS a fecha de hoy (${hoy}) que puedan ser relevantes para Encom. Céntrate en estas fuentes:
${FUENTES.map(f => `- ${f}`).join('\n')}

Busca convocatorias relacionadas con:
- Organización de eventos culturales, tecnológicos, gaming
- Promoción de la cultura digital e innovación
- Ecosistema startup y emprendimiento
- Turismo y promoción de la ciudad/comunidad
- Transformación digital de eventos
- Industrias creativas y culturales
- Fondos europeos para cultura, innovación, digitalización

${CRITERIOS_RATING}

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
  "url_fuente": "URL de la convocatoria si se conoce"
}

Si no encuentras oportunidades relevantes con rating >= 5, devuelve un array vacío: []
Recuerda: SOLO JSON válido, sin texto adicional.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 15
      }],
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Extraer texto de la respuesta
    let textoCompleto = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        textoCompleto += block.text;
      }
    }

    // Intentar parsear JSON
    let oportunidades = [];
    try {
      // Limpiar posible markdown
      let jsonStr = textoCompleto.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      oportunidades = JSON.parse(jsonStr);
    } catch (parseErr) {
      // Intentar extraer JSON del texto
      const match = textoCompleto.match(/\[[\s\S]*\]/);
      if (match) {
        oportunidades = JSON.parse(match[0]);
      } else {
        console.error('No se pudo extraer JSON de la respuesta de Claude');
        console.error('Respuesta:', textoCompleto.substring(0, 500));
        return [];
      }
    }

    // Filtrar solo rating >= 5 y validar estructura
    return oportunidades
      .filter(o => o.rating >= 5)
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

  } catch (err) {
    console.error('❌ Error en búsqueda con Claude:', err.message);
    throw err;
  }
}

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

GENERA UN INFORME con exactamente estas 3 secciones. Devuelve SOLO un JSON válido (sin markdown, sin bloques de código):

{
  "resumen_ejecutivo": "Máximo 5 líneas. Lenguaje claro, sin tecnicismos. Explica qué es, cuánto dinero hay, para qué sirve y por qué Encom debería presentarse.",
  "plan_tareas": [
    {
      "orden": 1,
      "tarea": "Descripción de la tarea",
      "responsable_sugerido": "CEO / Dirección de proyectos / Administración / Legal / Equipo técnico",
      "tiempo_estimado": "Ej: 2 horas / 1 día / 1 semana",
      "prioridad": "alta" | "media" | "baja"
    }
  ],
  "alertas_criticas": [
    "Cada alerta como string: días restantes, requisitos a verificar, posibles incompatibilidades, documentos que tardan en obtenerse"
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5
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
        informe = JSON.parse(match[0]);
      } else {
        throw new Error('No se pudo parsear el informe');
      }
    }

    return informe;
  } catch (err) {
    console.error('❌ Error generando informe:', err.message);
    throw err;
  }
}

module.exports = { buscarOportunidades, generarInforme };
