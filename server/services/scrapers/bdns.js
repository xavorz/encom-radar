/**
 * Scraper para BDNS (Base de Datos Nacional de Subvenciones)
 * API REST: https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda
 *
 * Estructura real de la API:
 * - content[]: array de convocatorias
 * - Cada item: { id, numeroConvocatoria, descripcion, nivel1, nivel2, nivel3, fechaRecepcion, mrr }
 * - Paginación: page, pageSize
 * - NO acepta parámetro de búsqueda por texto
 *
 * Estrategia: obtener las últimas N convocatorias y filtrar localmente por keywords
 */

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda';

// Keywords para filtrar localmente en la descripción
const KEYWORDS = [
  'evento', 'festival', 'cultural', 'cultura', 'turismo', 'turístic',
  'innovación', 'innovació', 'digital', 'tecnológic', 'gaming', 'videojuego',
  'emprendimiento', 'startup', 'audiovisual', 'creativ', 'feria', 'congreso',
  'música', 'escénic', 'juventud', 'joventut', 'ocio', 'promoción',
  'espectáculo', 'patrimonio cultural', 'industria cultural',
  'comunicación', 'publicidad', 'diseño', 'producción artística'
];

// Keywords para valencia/comunitat valenciana
const KEYWORDS_VALENCIA = [
  'valencia', 'valencian', 'ivace', 'ivaj', 'gva', 'generalitat',
  'diputació', 'diputacion de valencia', 'feria valencia'
];

async function buscarBDNS() {
  const resultados = [];
  const vistos = new Set();

  // Obtener las últimas 500 convocatorias (paginando de 100 en 100)
  const PAGINAS = 5;
  const PAGE_SIZE = 100;

  for (let page = 0; page < PAGINAS; page++) {
    try {
      const url = `${BDNS_API}?page=${page}&pageSize=${PAGE_SIZE}`;

      console.log(`  📥 BDNS página ${page + 1}/${PAGINAS}...`);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EncomRadar/1.0'
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        console.log(`  ⚠️ BDNS página ${page}: HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      const convocatorias = data.content || [];

      if (!Array.isArray(convocatorias) || convocatorias.length === 0) break;

      for (const conv of convocatorias) {
        const id = conv.numeroConvocatoria || conv.id;
        if (!id || vistos.has(id)) continue;
        vistos.add(id);

        const descripcion = (conv.descripcion || '').toLowerCase();
        const organismo = `${conv.nivel1 || ''} ${conv.nivel2 || ''} ${conv.nivel3 || ''}`.toLowerCase();

        // Filtrar: debe contener al menos un keyword relevante
        const esRelevante = KEYWORDS.some(kw => descripcion.includes(kw));
        const esValenciana = KEYWORDS_VALENCIA.some(kw =>
          descripcion.includes(kw) || organismo.includes(kw)
        );

        if (!esRelevante && !esValenciana) continue;

        // Determinar el organismo más específico
        const org = conv.nivel3 || conv.nivel2 || conv.nivel1 || 'No especificado';

        resultados.push({
          titulo: conv.descripcion || 'Sin título',
          organismo: org,
          tipo: 'subvención',
          importe: 'Ver convocatoria',
          plazo_presentacion: null, // La API básica no incluye plazos
          url_fuente: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${id}`,
          fuente: 'BDNS',
          datos_raw: {
            numero: id,
            fechaRecepcion: conv.fechaRecepcion,
            nivel1: conv.nivel1,
            nivel2: conv.nivel2,
            nivel3: conv.nivel3,
            mrr: conv.mrr,
            esValenciana
          }
        });
      }

      // Pausa entre páginas
      await new Promise(r => setTimeout(r, 800));

    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.log(`  ⏱️ BDNS timeout página ${page}`);
      } else {
        console.log(`  ⚠️ BDNS error página ${page}: ${err.message}`);
      }
      break; // No seguir si hay error
    }
  }

  console.log(`  📋 BDNS: ${resultados.length} convocatorias relevantes (de ${vistos.size} revisadas)`);
  return resultados;
}

module.exports = { buscarBDNS };
