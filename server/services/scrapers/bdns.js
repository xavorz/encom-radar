/**
 * Scraper para BDNS (Base de Datos Nacional de Subvenciones)
 * API REST: https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda
 *
 * Estructura real: content[].{ id, numeroConvocatoria, descripcion, nivel1/2/3, fechaRecepcion }
 * NO acepta búsqueda por texto → obtenemos las últimas y filtramos + puntuamos localmente
 */

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda';

// === SISTEMA DE SCORING LOCAL (sin IA) ===

// Tier 1: encaje directo con Encom → +4 puntos cada match
const TIER1 = [
  'organización de eventos', 'producción de eventos', 'festival',
  'gaming', 'videojuego', 'startup', 'ecosistema emprendedor',
  'cultura digital', 'eventos culturales', 'eventos tecnológic',
  'industrias creativas', 'industria cultural',
];

// Tier 2: encaje alto → +2 puntos cada match
const TIER2 = [
  'feria', 'congreso', 'espectáculo', 'artes escénic',
  'música en vivo', 'promoción turística', 'turismo cultural',
  'actividades culturales', 'transformación digital',
  'audiovisual', 'producción artística',
];

// Tier 3: encaje parcial → +1 punto cada match
const TIER3 = [
  'cultural', 'cultura', 'turismo', 'innovación', 'digital',
  'creativ', 'juventud', 'emprendimiento', 'ocio', 'patrimonio',
];

// Bonus Valencia → +3 puntos
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
  for (const kw of TIER3) { if (texto.includes(kw)) puntos += 1; }

  const esValenciana = VALENCIA.some(kw => texto.includes(kw));
  if (esValenciana) puntos += 3;

  // Convertir puntos a rating 1-10
  // 1-2 puntos → rating 5 | 3-4 → 6 | 5-6 → 7 | 7-9 → 8 | 10-12 → 9 | 13+ → 10
  if (puntos <= 0) return { rating: 0, esValenciana };
  if (puntos <= 2) return { rating: 5, esValenciana };
  if (puntos <= 4) return { rating: 6, esValenciana };
  if (puntos <= 6) return { rating: 7, esValenciana };
  if (puntos <= 9) return { rating: 8, esValenciana };
  if (puntos <= 12) return { rating: 9, esValenciana };
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
  if (desc.includes('gaming') || desc.includes('videojuego')) parts.push('Gaming/videojuegos');

  return parts.join('. ') + '.';
}

async function buscarBDNS() {
  const resultados = [];
  const vistos = new Set();
  const PAGINAS = 5;
  const PAGE_SIZE = 100;

  for (let page = 0; page < PAGINAS; page++) {
    try {
      const url = `${BDNS_API}?page=${page}&pageSize=${PAGE_SIZE}`;
      console.log(`  📥 BDNS página ${page + 1}/${PAGINAS}...`);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'EncomRadar/1.0' },
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

        const descripcion = conv.descripcion || '';
        const org = conv.nivel3 || conv.nivel2 || conv.nivel1 || 'No especificado';
        const organismo = `${conv.nivel1 || ''} ${conv.nivel2 || ''} ${conv.nivel3 || ''}`;

        const { rating, esValenciana } = calcularScore(descripcion, organismo);

        // Solo rating >= 5
        if (rating < 5) continue;

        resultados.push({
          titulo: descripcion,
          organismo: org,
          tipo: 'subvención',
          importe: 'Ver convocatoria',
          plazo_presentacion: null,
          rating,
          justificacion_rating: generarJustificacion(descripcion, rating, esValenciana),
          por_que_encaja: esValenciana
            ? `Subvención de ámbito valenciano detectada en BDNS. Verificar requisitos y plazos en la convocatoria.`
            : `Subvención nacional relevante para el sector de Encom. Verificar requisitos y plazos.`,
          url_fuente: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${id}`,
          fuente: 'BDNS'
        });
      }

      await new Promise(r => setTimeout(r, 800));
    } catch (err) {
      console.log(`  ⚠️ BDNS error página ${page}: ${err.message}`);
      break;
    }
  }

  // Ordenar por rating descendente
  resultados.sort((a, b) => b.rating - a.rating);

  console.log(`  📋 BDNS: ${resultados.length} convocatorias con rating >= 5 (de ${vistos.size} revisadas)`);
  return resultados;
}

module.exports = { buscarBDNS };
