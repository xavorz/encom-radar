/**
 * Scraper para Plataforma de Contratación del Sector Público
 * Fuente: contrataciondelsectorpublico.gob.es
 * Usa el feed Atom/RSS de licitaciones abiertas
 */

const xml2js = require('xml2js');

// Feed Atom de licitaciones — sindicación de datos abiertos
const FEEDS = [
  {
    nombre: 'Licitaciones abiertas - Servicios',
    // Feed de contrataciones recientes
    url: 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerique/tipo2_702544.atom'
  }
];

// URL alternativa: búsqueda directa por texto en datos abiertos
const SEARCH_BASE = 'https://contrataciondelsectorpublico.gob.es/wps/poc';

// Términos para buscar licitaciones relevantes
const TERMINOS = [
  'organización eventos',
  'producción eventos',
  'gestión cultural',
  'servicios culturales',
  'actividades culturales',
  'servicios audiovisuales',
  'protocolo eventos',
  'turismo',
  'promoción turística',
  'ferias congresos',
  'comunicación institucional',
];

async function buscarContratacion() {
  const resultados = [];
  const vistos = new Set();

  // Método 1: Buscar en el portal de contratación via búsqueda de texto
  for (const termino of TERMINOS) {
    try {
      // La plataforma tiene un endpoint de búsqueda que devuelve Atom
      const url = `https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerique/todosEstados_702544.atom?texto=${encodeURIComponent(termino)}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/atom+xml, application/xml, text/xml',
          'User-Agent': 'EncomRadar/1.0'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) continue;

      const xml = await response.text();
      const entries = await parsearAtom(xml);

      for (const entry of entries) {
        if (vistos.has(entry.id)) continue;
        vistos.add(entry.id);

        // Solo licitaciones con plazo futuro
        if (entry.plazo && new Date(entry.plazo) < new Date()) continue;

        resultados.push({
          titulo: entry.titulo,
          organismo: entry.organismo,
          tipo: 'licitación',
          importe: entry.importe,
          plazo_presentacion: entry.plazo,
          url_fuente: entry.url,
          fuente: 'PLACSP',
          datos_raw: {
            expediente: entry.expediente,
            estado: entry.estado,
            tipo_contrato: entry.tipo_contrato,
            lugar_ejecucion: entry.lugar_ejecucion
          }
        });
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.log(`  ⚠️ PLACSP error (${termino}): ${err.message}`);
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Método 2: Intentar feed RSS general si el método 1 no da resultados
  if (resultados.length === 0) {
    try {
      console.log('  🔄 Intentando feed RSS general de PLACSP...');
      const rssUrl = 'https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerique/abierto_702544.atom';
      const response = await fetch(rssUrl, {
        headers: { 'Accept': 'application/atom+xml, text/xml', 'User-Agent': 'EncomRadar/1.0' },
        signal: AbortSignal.timeout(20000)
      });

      if (response.ok) {
        const xml = await response.text();
        const entries = await parsearAtom(xml);

        // Filtrar por palabras clave en título
        const keywords = ['evento', 'cultural', 'turism', 'ferial', 'audiovisual', 'comunicación', 'protocolo', 'feria', 'congreso', 'festival'];

        for (const entry of entries) {
          const tituloLower = (entry.titulo || '').toLowerCase();
          const relevante = keywords.some(kw => tituloLower.includes(kw));

          if (relevante && !vistos.has(entry.id)) {
            vistos.add(entry.id);
            resultados.push({
              titulo: entry.titulo,
              organismo: entry.organismo,
              tipo: 'licitación',
              importe: entry.importe,
              plazo_presentacion: entry.plazo,
              url_fuente: entry.url,
              fuente: 'PLACSP',
              datos_raw: {
                expediente: entry.expediente,
                estado: entry.estado,
                tipo_contrato: entry.tipo_contrato,
                lugar_ejecucion: entry.lugar_ejecucion
              }
            });
          }
        }
      }
    } catch (err) {
      console.log(`  ⚠️ PLACSP RSS general: ${err.message}`);
    }
  }

  console.log(`  📋 PLACSP: ${resultados.length} licitaciones encontradas`);
  return resultados;
}

async function parsearAtom(xml) {
  const entries = [];

  try {
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    const result = await parser.parseStringPromise(xml);

    const feed = result.feed || result;
    let items = feed.entry || [];
    if (!Array.isArray(items)) items = [items];

    for (const item of items) {
      try {
        // Extraer datos del entry Atom (estructura CODICE/PLACSP)
        const titulo = extraerTexto(item.title) || '';
        const summary = extraerTexto(item.summary) || '';
        const link = extraerLink(item.link);
        const id = extraerTexto(item.id) || link || titulo;

        // Intentar extraer datos estructurados del contenido
        const content = extraerTexto(item.content) || summary;

        // Extraer organismo
        let organismo = '';
        if (item.author) {
          organismo = extraerTexto(item.author.name) || '';
        }

        // Extraer importe y plazo del contenido/summary
        const importeMatch = content.match(/(\d[\d.,]+)\s*€/);
        const importe = importeMatch ? importeMatch[0] : extraerImporteDeXml(item);

        // Buscar fecha de plazo
        let plazo = null;
        if (item['cbc-place:TenderSubmissionDeadlinePeriod']) {
          plazo = extraerTexto(item['cbc-place:TenderSubmissionDeadlinePeriod']);
        }
        // Buscar en updated como fallback
        if (!plazo && item.updated) {
          // No usar updated como plazo
        }

        entries.push({
          id,
          titulo: titulo || 'Sin título',
          organismo: organismo || 'No especificado',
          importe: importe || 'No especificado',
          plazo: plazo ? new Date(plazo).toISOString().split('T')[0] : null,
          url: link,
          expediente: '',
          estado: 'abierta',
          tipo_contrato: '',
          lugar_ejecucion: ''
        });
      } catch (entryErr) {
        // Saltar entries mal formados
      }
    }
  } catch (err) {
    console.log(`  ⚠️ Error parseando Atom: ${err.message}`);
  }

  return entries;
}

function extraerTexto(node) {
  if (!node) return null;
  if (typeof node === 'string') return node.trim();
  if (node._) return node._.trim();
  if (node['$'] && node['$'].value) return node['$'].value;
  return null;
}

function extraerLink(link) {
  if (!link) return null;
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) {
    const html = link.find(l => l['$'] && l['$'].type === 'text/html');
    const alt = link.find(l => l['$'] && l['$'].rel === 'alternate');
    const first = html || alt || link[0];
    return first && first['$'] ? first['$'].href : null;
  }
  if (link['$']) return link['$'].href;
  return null;
}

function extraerImporteDeXml(item) {
  // Buscar campos comunes de importe en XML de PLACSP
  for (const key of Object.keys(item)) {
    if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('importe')) {
      const val = extraerTexto(item[key]);
      if (val && /\d/.test(val)) return val + '€';
    }
  }
  return null;
}

module.exports = { buscarContratacion };
