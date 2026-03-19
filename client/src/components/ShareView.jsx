import React, { useState, useEffect } from 'react';
import { api } from '../api';
import RatingBadge from './RatingBadge';
import TipoBadge from './TipoBadge';
import Informe from './Informe';

function formatFecha(fecha) {
  if (!fecha) return 'No especificado';
  return new Date(fecha).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

export default function ShareView({ token }) {
  const [op, setOp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await api.verCompartida(token);
        setOp(data);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    cargar();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-acento border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Enlace no válido</p>
          <p className="text-textoS text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fondo py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-acento rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="text-textoP font-semibold">Encom Radar</span>
          <span className="text-textoS text-sm">· Oportunidad compartida</span>
        </div>

        {/* Contenido */}
        <div className="bg-superficie border border-borde rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <TipoBadge tipo={op.tipo} />
            <RatingBadge rating={op.rating} />
          </div>

          <h1 className="text-textoP text-xl md:text-2xl font-bold mb-2">{op.titulo}</h1>
          <p className="text-textoS text-lg mb-6">{op.organismo}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-fondo rounded-xl p-4">
              <p className="text-textoS text-xs uppercase tracking-wider mb-1">Importe</p>
              <p className="text-textoP font-semibold">{op.importe || 'No especificado'}</p>
            </div>
            <div className="bg-fondo rounded-xl p-4">
              <p className="text-textoS text-xs uppercase tracking-wider mb-1">Plazo</p>
              <p className="text-textoP font-semibold">{formatFecha(op.plazo_presentacion)}</p>
            </div>
            <div className="bg-fondo rounded-xl p-4">
              <p className="text-textoS text-xs uppercase tracking-wider mb-1">Detectada</p>
              <p className="text-textoP font-semibold">{formatFecha(op.fecha_deteccion)}</p>
            </div>
          </div>

          {op.justificacion_rating && (
            <div className="mb-4">
              <h3 className="text-textoS text-xs uppercase tracking-wider mb-2">Justificación</h3>
              <p className="text-textoP text-sm leading-relaxed">{op.justificacion_rating}</p>
            </div>
          )}

          {op.por_que_encaja && (
            <div>
              <h3 className="text-textoS text-xs uppercase tracking-wider mb-2">Por qué encaja con Encom</h3>
              <p className="text-textoP text-sm leading-relaxed">{op.por_que_encaja}</p>
            </div>
          )}
        </div>

        {/* Informe */}
        {op.informe && <Informe informe={op.informe} />}

        {/* Footer */}
        <p className="text-center text-textoS/40 text-xs mt-8">
          Generado por Encom Radar
        </p>
      </div>
    </div>
  );
}
