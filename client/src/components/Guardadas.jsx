import React, { useState, useEffect } from 'react';
import { api } from '../api';
import RatingBadge from './RatingBadge';
import TipoBadge from './TipoBadge';
import EstadoSelector from './EstadoSelector';

function formatFecha(fecha) {
  if (!fecha) return 'No especificado';
  return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function diasRestantes(fecha) {
  if (!fecha) return null;
  return Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function Guardadas({ onSelect }) {
  const [guardadas, setGuardadas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    try {
      const data = await api.getGuardadas();
      setGuardadas(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  async function handleEstado(id, nuevoEstado) {
    try {
      await api.actualizarOportunidad(id, { estado: nuevoEstado });
      cargar();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-acento border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (guardadas.length === 0) {
    return (
      <div className="text-center py-16 fade-in">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-textoS text-lg mb-2">No tienes oportunidades guardadas</p>
        <p className="text-textoS/60 text-sm">Guarda oportunidades desde el feed para hacer seguimiento</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in">
      <p className="text-textoS text-sm mb-4">{guardadas.length} oportunidad{guardadas.length !== 1 ? 'es' : ''} guardada{guardadas.length !== 1 ? 's' : ''}</p>

      {guardadas.map(op => {
        const dias = diasRestantes(op.plazo_presentacion);
        return (
          <div
            key={op.id}
            className={`bg-superficie border rounded-xl p-5 transition-all hover:border-acento/50 ${
              op.alerta_plazo ? 'border-red-500/30' : 'border-borde'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(op.id)}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <TipoBadge tipo={op.tipo} />
                  <RatingBadge rating={op.rating} />
                  {op.alerta_plazo && dias !== null && dias >= 0 && (
                    <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded-full">
                      ⚠️ {dias} días restantes
                    </span>
                  )}
                </div>
                <h3 className="text-textoP font-semibold text-sm mb-1 line-clamp-1">{op.titulo}</h3>
                <p className="text-textoS text-xs">{op.organismo} · Plazo: {formatFecha(op.plazo_presentacion)}</p>
                {op.nota_interna && (
                  <p className="text-textoS/60 text-xs mt-2 italic line-clamp-1">{op.nota_interna}</p>
                )}
              </div>

              <div className="shrink-0">
                <EstadoSelector estado={op.estado} onChange={(v) => handleEstado(op.id, v)} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
