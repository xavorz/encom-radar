/**
 * Scraper para DOGV (Diari Oficial de la Generalitat Valenciana)
 * Busca publicaciones recientes relacionadas con subvenciones y licitaciones
 * para eventos, cultura, turismo, innovación
 */

const DOGV_SEARCH = 'https://dogv.gva.es/es/resultados-de-busqueda';

// Palabras clave para buscar en DOGV
const KEYWORDS = [
  'subvención eventos',
  'subvención cultura',
  'subvención festivales',
  'subvención turismo',
  'ayudas cultura valenciana',
  'ayudas innovación',
  'licitación eventos',
  'IVACE ayudas',
  'Institut Valencià de Cultura',
];

async function buscarDOGV() {
  const resultados = [];
  const vistos = new Set();

  // DOGV no tiene API pública, pero podemos buscar via su buscador web
  // y parsear los resultados HTML básicos
  for (const keyword of KEYWORDS) {
    try {
      // El buscador de DOGV acepta parámetros GET
      const url = `https://dogv.gva.es/datos/buscador/resultados.jsp?texto=${encodeURIComponent(keyword)}&tipo=todo&fechaDesde=${getFechaHace30Dias()}&fechaHasta=${getHoy()}`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'EncomRadar/1.0'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) continue;

      const html = await response.text();
      const entries = parsearResultadosDOGV(html, keyword);

      for (const entry of entries) {
        if (vistos.has(entry.titulo)) continue;
        vistos.add(entry.titulo);
        resultados.push(entry);
      }
    } catch (err) {
      if (err.name !== 'TimeoutError') {
        console.log(`  ⚠️ DOGV error (${keyword}): ${err.message}`);
      }
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Si la búsqueda web no funciona, intentar RSS del portal de la GVA
  if (resultados.length === 0) {
    try {
      console.log('  🔄 Intentando fuentes alternativas GVA...');
      // Portal de subvenciones de la GVA
      const gvaUrl = 'https://www.gva.es/es/web/subvenciones/listado-de-subvenciones';
      const response = await fetch(gvaUrl, {
        headers: { 'Accept': 'text/html', 'User-Agent': 'EncomRadar/1.0' },
        signal: AbortSignal.timeout(15000)
      });

      if (response.ok) {
        const html = await response.text();
        const entries = parsearSubvencionesGVA(html);
        for (const entry of entries) {
          if (!vistos.has(entry.titulo)) {
            vistos.add(entry.titulo);
            resultados.push(entry);
          }
        }
      }
    } catch (err) {
      console.log(`  ⚠️ GVA portal: ${err.message}`);
    }
  }

  console.log(`  📋 DOGV/GVA: ${resultados.length} publicaciones encontradas`);
  return resultados;
}

function parsearResultadosDOGV(html, keyword) {
  const resultados = [];

  // Extraer títulos y enlaces de los resultados
  // Patrón típico: <a href="/datos/2026/03/19/pdf/2026_XXXXX.pdf">Título...</a>
  const regex = /<a[^>]*href="([^"]*dogv[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1].startsWith('http') ? match[1] : `https://dogv.gva.es${match[1]}`;
    const titulo = match[2].replace(/<[^>]+>/g, '').trim();

    if (titulo.length < 20) continue; // Demasiado corto, probablemente un enlace de navegación

    // Filtrar solo lo relevante
    const tituloLower = titulo.toLowerCase();
    const esRelevante = ['subvenc', 'ayuda', 'convocatoria', 'licitación', 'contrat', 'cultura', 'turism', 'event', 'festival', 'innovac'].some(k => tituloLower.includes(k));

    if (!esRelevante) continue;

    // Determinar tipo
    let tipo = 'subvención';
    if (tituloLower.includes('licitación') || tituloLower.includes('contrat')) {
      tipo = 'licitación';
    }

    resultados.push({
      titulo: titulo.substring(0, 300),
      organismo: extraerOrganismoDOGV(titulo),
      tipo,
      importe: 'Ver convocatoria',
      plazo_presentacion: null,
      url_fuente: url,
      fuente: 'DOGV',
      datos_raw: { keyword }
    });
  }

  return resultados;
}

function parsearSubvencionesGVA(html) {
  const resultados = [];

  // Buscar enlaces a subvenciones en el portal GVA
  const regex = /<a[^>]*href="([^"]*)"[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const titulo = match[2].replace(/<[^>]+>/g, '').trim();
    const tituloLower = titulo.toLowerCase();

    if (titulo.length < 30) continue;

    const esRelevante = ['cultura', 'turism', 'event', 'festival', 'innovac', 'empren', 'digital', 'juvent'].some(k => tituloLower.includes(k));

    if (!esRelevante) continue;

    const url = match[1].startsWith('http') ? match[1] : `https://www.gva.es${match[1]}`;

    resultados.push({
      titulo: titulo.substring(0, 300),
      organismo: 'Generalitat Valenciana',
      tipo: 'subvención',
      importe: 'Ver convocatoria',
      plazo_presentacion: null,
      url_fuente: url,
      fuente: 'GVA',
      datos_raw: {}
    });
  }

  return resultados;
}

function extraerOrganismoDOGV(titulo) {
  const lower = titulo.toLowerCase();
  if (lower.includes('ivace') || lower.includes('innovació')) return 'IVACE';
  if (lower.includes('institut valencià de cultura') || lower.includes('ivc')) return 'Institut Valencià de Cultura';
  if (lower.includes('ivaj') || lower.includes('joventut')) return 'IVAJ';
  if (lower.includes('turisme')) return 'Turisme Comunitat Valenciana';
  if (lower.includes('ajuntament') || lower.includes('ayuntamiento de val')) return 'Ayuntamiento de Valencia';
  return 'Generalitat Valenciana';
}

function getHoy() {
  return new Date().toISOString().split('T')[0].split('-').reverse().join('/');
}

function getFechaHace30Dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0].split('-').reverse().join('/');
}

module.exports = { buscarDOGV };
