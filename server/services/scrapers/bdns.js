/**
 * Scraper para BDNS (Base de Datos Nacional de Subvenciones)
 * API REST: https://www.infosubvenciones.es/bdnstrans/api
 * Devuelve JSON con convocatorias de subvenciones
 */

const BDNS_API = 'https://www.infosubvenciones.es/bdnstrans/api/convocatorias/busqueda';

// Términos de búsqueda relevantes para Encom
const TERMINOS_BUSQUEDA = [
  'eventos culturales',
  'festivales',
  'cultura digital',
  'industrias culturales',
  'actividades culturales',
  'turismo',
  'innovación cultural',
  'emprendimiento',
  'gaming',
  'videojuegos',
  'transformación digital',
  'eventos tecnológicos',
];

// Códigos regionales: GE=General/Nacional, VC=Comunitat Valenciana
const REGIONES = ['GE', 'VC'];

async function buscarBDNS() {
  const resultados = [];
  const vistos = new Set();

  for (const region of REGIONES) {
    for (const termino of TERMINOS_BUSQUEDA) {
      try {
        const url = `${BDNS_API}?page=0&pageSize=10&order=fechaIniSolicitud&direccion=desc&vpd=${region}&texto=${encodeURIComponent(termino)}`;

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EncomRadar/1.0'
          },
          signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
          console.log(`  ⚠️ BDNS ${region}/${termino}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const convocatorias = data.content || data.convocatorias || data || [];

        if (!Array.isArray(convocatorias)) continue;

        for (const conv of convocatorias) {
          // Deduplicar por número de convocatoria
          const id = conv.numeroConvocatoria || conv.id || conv.titulo;
          if (vistos.has(id)) continue;
          vistos.add(id);

          // Solo convocatorias abiertas (con plazo futuro)
          const plazo = conv.fechaFinSolicitud || conv.fechaFin || null;
          if (plazo) {
            const fechaPlazo = new Date(plazo);
            if (fechaPlazo < new Date()) continue; // Plazo vencido
          }

          resultados.push({
            titulo: conv.titulo || conv.descripcion || 'Sin título',
            organismo: conv.organo || conv.administracion || conv.organismo || 'No especificado',
            tipo: 'subvención',
            importe: formatImporte(conv),
            plazo_presentacion: plazo ? new Date(plazo).toISOString().split('T')[0] : null,
            url_fuente: conv.numeroConvocatoria
              ? `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatoria/${conv.numeroConvocatoria}`
              : null,
            fuente: 'BDNS',
            datos_raw: {
              numero: conv.numeroConvocatoria,
              region: conv.ccaa || region,
              finalidad: conv.finalidad || '',
              tiposBeneficiario: conv.tiposBeneficiario || '',
              reglamento: conv.reglamento || '',
              baseReguladora: conv.baseReguladora || ''
            }
          });
        }
      } catch (err) {
        if (err.name === 'TimeoutError') {
          console.log(`  ⏱️ BDNS timeout: ${region}/${termino}`);
        } else {
          console.log(`  ⚠️ BDNS error ${region}/${termino}: ${err.message}`);
        }
      }

      // Pausa entre requests para no saturar
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`  📋 BDNS: ${resultados.length} convocatorias encontradas`);
  return resultados;
}

function formatImporte(conv) {
  if (conv.importeTotal) return `${Number(conv.importeTotal).toLocaleString('es-ES')}€`;
  if (conv.presupuestoTotal) return `${Number(conv.presupuestoTotal).toLocaleString('es-ES')}€`;
  if (conv.importeMaxIndividual) return `Hasta ${Number(conv.importeMaxIndividual).toLocaleString('es-ES')}€`;
  return 'No especificado';
}

module.exports = { buscarBDNS };
