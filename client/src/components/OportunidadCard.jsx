import React from 'react';
import RatingBadge from './RatingBadge';
import TipoBadge from './TipoBadge';

function diasRestantes(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const plazo = new Date(fecha);
  return Math.ceil((plazo - hoy) / (1000 * 60 * 60 * 24));
}

function formatFecha(fecha) {
  if (!fecha) return 'No especificado';
  return new Date(fecha).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatImporte(importe) {
  if (!importe || importe === 'No especificado') return null;
  return importe;
}

export default function OportunidadCard({ oportunidad, onSelect, onGuardar, esNueva }) {
  const { id, titulo, organismo, tipo, importe, plazo_presentacion, rating, por_que_encaja, estado, alerta_plazo } = oportunidad;
  const dias = diasRestantes(plazo_presentacion);

  return (
    <div
      onClick={() => onSelect(id)}
      className={`relative bg-superficie border rounded-xl p-5 cursor-pointer transition-all duration-200 hover:border-acento/50 hover:shadow-lg hover:shadow-acento/5 fade-in ${
        esNueva ? 'border-acento/30' : 'border-borde'
      }`}
    >
      {/* Indicador nueva */}
      {esNueva && (
        <div className="absolute top-4 right-4">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-acento opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-acento"></span>
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <TipoBadge tipo={tipo} />
        <RatingBadge rating={rating} />
        {alerta_plazo && dias !== null && dias >= 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
            ⚠️ {dias} días
          </span>
        )}
      </div>

      {/* Título */}
      <h3 className="text-textoP font-semibold text-base mb-2 leading-snug line-clamp-2">
        {titulo}
      </h3>

      {/* Organismo */}
      <p className="text-textoS text-sm mb-3">{organismo}</p>

      {/* Info row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {formatImporte(importe) && (
          <span className="text-textoS">
            <span className="text-textoP font-medium">{importe}</span>
          </span>
        )}
        <span className="text-textoS">
          Plazo: <span className="text-textoP">{formatFecha(plazo_presentacion)}</span>
        </span>
      </div>

      {/* Encaje */}
      {por_que_encaja && (
        <p className="mt-3 text-sm text-textoS/80 line-clamp-2 border-t border-borde pt-3">
          {por_que_encaja}
        </p>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-borde">
        {estado !== 'guardada' && estado !== 'en preparación' && estado !== 'presentada' && estado !== 'resuelta' && (
          <button
            onClick={(e) => { e.stopPropagation(); onGuardar(id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-acento/10 text-acento hover:bg-acento/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Guardar
          </button>
        )}
        {(estado === 'guardada' || estado === 'en preparación') && (
          <span className="text-xs text-emerald-400 font-medium">✓ Guardada</span>
        )}
      </div>
    </div>
  );
}
