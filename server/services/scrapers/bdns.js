/**
 * Scraper para BDNS (Base de Datos Nacional de Subvenciones)
 * API REST: https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda
 *
 * Estructura real: content[].{ id, numeroConvocatoria, descripcion, nivel1/2/3, fechaRecepcion }
 * NO acepta búsqueda por texto → obtenemos las últimas y filtramos + puntuamos localmente
 *
 * FILTRO ESTRICTO: solo convocatorias abiertas a concurrencia competitiva
 * que encajen con el perfil de Encom (eventos, cultura, turismo, innovación).
 * Excluimos: nominativas, convenios, deportes, ganadería, escuelas, etc.
 */

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda';

// === FILTROS DE EXCLUSIÓN ===
// Si la descripción contiene alguna de estas, la descartamos directamente
const EXCLUIR_KEYWORDS = [
  // Subvenciones directas/nominativas (no son concurrencia competitiva)
  'subv. nom.', 'subv nom', 'subvención nominativa', 'subvencion nominativa',
  'concesión directa', 'concesion directa', 'nominativa a favor',
  'nominativa al ayuntamiento', 'nominativa a la',
  // Convenios específicos (no son convocatorias abiertas)
  'convenio entre', 'convenio de colaboración entre', 'convenio con',
  'convenio de subvención entre',
  // Sectores claramente fuera de perfil
  'ganadería', 'ganadero', 'ganaderas', 'bovino', 'bovina', 'porcino',
  'ovino', 'avícola', 'apícola', 'agrícola', 'explotaciones agrarias',
  'regadío', 'riego', 'fertilizante',
  // Deportes (salvo esports/gaming que ya se capturan en TIER1)
  'club deportivo', 'club balonmano', 'club baloncesto', 'club tenis',
  'club de fútbol', 'futsal', 'federación de deporte', 'federación de balonmano',
  'federación de baloncesto', 'liga acb', 'liga femenina',
  'balonmano', 'baloncesto', 'fútbol sala',
  // Educación/colegios
  'ceip ', 'colegio ', 'mantenimiento del edif', 'escuela infantil',
  // Partidos políticos / sindicatos
  'secciones sindicales', 'grupo político', 'aportaciones secciones',
  'asignación grupo', 'plan actuación icasel',
  // Bancos de alimentos / asistencia social directa
  'banco de alimentos',
  // Obras municipales e infraestructura pura
  'reparación de muro', 'rehabilitació camí', 'plan provincial de obras',
  'tratamiento de aguas', 'residuos sólidos', 'recogida de residuos',
  // Cooperación internacional (fuera de perfil)
  'cooperación internacional',
  // Premios literarios / poesía / cómic (muy nicho)
  'premio narrativa', 'premio de poesía', 'premio de poesia',
  'premio cómic', 'premio literario',
  // Sanidad
  'enfermos y familiar', 'personas diagnost', 'cirugía',
  'medicina', 'sanitario', 'sanitaria',
  // Concursos muy nicho
  'concurso de escaparates', 'concurso de carteles',
  'concurso de fotografía', 'concurso de pintura',
  // Resoluciones administrativas genéricas (no convocatorias)
  'resolución de presidencia', 'decreto de alcaldía',
  // Subvenciones directas a entidades concretas
  'subvención directa a', 'subvencion directa a',
  'concesión directa de subvención', 'asistencia económica directa',
  // Asociaciones muy específicas
  'parroquia de', 'cofradía', 'hermandad',
  // Control de plagas/animales
  'control de poblac', 'tuberculosis',
  // Equipos/clubs específicos
  'club de tiro', 'club de golf', 'club de natación',
  'club de atletismo', 'club de ciclismo', 'club de remo',
  'club de rugby', 'club de hockey', 'club de voleibol',
  // Mantenimiento/obras específicas
  'mantenimiento del', 'reparación de', 'rehabilitación de camino',
  'pavimentación', 'saneamiento',
  // Administración pública genérica
  'instituto nacional de administración', 'formación de empleados públicos',
  'cuota anual', 'aportación anual',
  // Internacionalización genérica (sin relación con eventos)
  'xpande', 'pyme global',
  'visita a la feria internacional', // ferias comerciales genéricas, no gestión de eventos
];

// === SISTEMA DE SCORING LOCAL (sin IA) ===

// Tier 1: encaje DIRECTO con Encom → +4 puntos cada match
const TIER1 = [
  'organización de eventos', 'producción de eventos', 'festival de',
  'festivales', 'gaming', 'videojuego', 'esports',
  'startup', 'ecosistema emprendedor',
  'cultura digital', 'eventos culturales', 'eventos tecnológic',
  'industrias creativas', 'industria cultural',
  'own festival', 'valencia digital summit',
  'innovation capital', 'valencia innovation',
  'eventos, ferias', 'ferias, exposiciones',
  'actividades divulgativas', 'eventos tecnológicos',
];

// Tier 2: encaje alto → +2 puntos cada match
const TIER2 = [
  'feria de', 'congreso de', 'jornadas de',
  'espectáculo', 'artes escénic',
  'música en vivo', 'promoción turística', 'turismo cultural',
  'actividades culturales', 'transformación digital',
  'audiovisual', 'producción artística', 'producción audiovisual',
  'sector cultural', 'programación cultural',
  'digitalización de empresas', 'digitalización de pyme',
];

// Tier 3: keywords de sector SUELTAS
// A nivel nacional son ruido, pero combinadas con Valencia son relevantes
const SECTOR_KEYWORDS = [
  'cultural', 'cultura', 'turismo', 'turístic', 'innovación', 'innovacion',
  'digital', 'creativ', 'juventud', 'emprendimiento', 'emprendedores',
  'ocio', 'patrimonio', 'tecnológic', 'tecnologic',
];

// Valencia identifiers
const VALENCIA = [
  'valencia', 'valencian', 'ivace', 'ivaj', 'gva', 'generalitat',
  'diputació de valencia', 'diputacion de valencia', 'feria valencia',
  'comunitat valenciana', 'conselleria', 'ivc',
];

function esExcluida(descripcion) {
  const desc = descripcion.toLowerCase();
  return EXCLUIR_KEYWORDS.some(kw => desc.includes(kw));
}

function calcularScore(descripcion, organismo) {
  const texto = `${descripcion} ${organismo}`.toLowerCase();
  let puntos = 0;

  for (const kw of TIER1) { if (texto.includes(kw)) puntos += 4; }
  for (const kw of TIER2) { if (texto.includes(kw)) puntos += 2; }

  const esValenciana = VALENCIA.some(kw => texto.includes(kw));
  const tieneSector = SECTOR_KEYWORDS.some(kw => texto.includes(kw));

  // REGLA CLAVE: Valencia + cualquier keyword de sector → siempre relevante
  if (esValenciana && tieneSector) {
    puntos += 5; // garantiza mínimo rating 7
  } else if (esValenciana) {
    puntos += 3; // Valencia sin sector → bonus menor
  }
  // Keywords de sector SOLAS (sin Valencia) no suman nada → evita ruido nacional

  // Convertir puntos a rating
  if (puntos <= 1) return { rating: 0, esValenciana };  // no llega
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
  else parts.push('Oportunidad relevante para el sector de Encom');

  if (esValenciana) parts.push('Comunitat Valenciana (territorio prioritario)');

  const desc = descripcion.toLowerCase();
  if (desc.includes('festival') || desc.includes('evento')) parts.push('Relacionada con eventos/festivales');
  if (desc.includes('cultura')) parts.push('Sector cultural');
  if (desc.includes('turismo') || desc.includes('turístic')) parts.push('Sector turístico');
  if (desc.includes('digital') || desc.includes('innovación')) parts.push('Innovación/digitalización');
  if (desc.includes('gaming') || desc.includes('videojuego')) parts.push('Gaming/videojuegos');
  if (desc.includes('audiovisual')) parts.push('Sector audiovisual');

  return parts.join('. ') + '.';
}

async function buscarBDNS() {
  const resultados = [];
  const vistos = new Set();
  const PAGINAS = 5;
  const PAGE_SIZE = 100;
  let totalRevisadas = 0;
  let totalExcluidas = 0;

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
        totalRevisadas++;

        const descripcion = conv.descripcion || '';
        const org = conv.nivel3 || conv.nivel2 || conv.nivel1 || 'No especificado';
        const organismo = `${conv.nivel1 || ''} ${conv.nivel2 || ''} ${conv.nivel3 || ''}`;

        // PASO 1: Excluir basura antes de puntuar
        if (esExcluida(descripcion)) {
          totalExcluidas++;
          continue;
        }

        // PASO 2: Scoring
        const { rating, esValenciana } = calcularScore(descripcion, organismo);

        // Solo rating >= 6 (más estricto que antes)
        if (rating < 6) continue;

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

  console.log(`  📋 BDNS: ${resultados.length} convocatorias relevantes (de ${totalRevisadas} revisadas, ${totalExcluidas} excluidas por filtros)`);
  return resultados;
}

module.exports = { buscarBDNS };
