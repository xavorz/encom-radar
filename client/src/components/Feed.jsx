import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import OportunidadCard from './OportunidadCard';

function extraerFecha(fecha) {
  if (!fecha) return 'sin-fecha';
  return fecha.substring(0, 10);
}

function agruparPorFecha(oportunidades) {
  const grupos = {};
  for (const op of oportunidades) {
    const fecha = extraerFecha(op.fecha_deteccion);
    if (!grupos[fecha]) grupos[fecha] = [];
    grupos[fecha].push(op);
  }
  return Object.entries(grupos).sort(([a], [b]) => b.localeCompare(a));
}

function formatFechaGrupo(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';

  return d.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

export default function Feed({ onSelect, resumen }) {
  const [oportunidades, setOportunidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandidos, setExpandidos] = useState({});

  // Filtros
  const [dias, setDias] = useState(10);
  const [tipo, setTipo] = useState('');
  const [ratingMin, setRatingMin] = useState(5);
  const [estado, setEstado] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { dias };
      if (tipo) params.tipo = tipo;
      if (ratingMin > 5) params.rating_min = ratingMin;
      if (estado) params.estado = estado;
      const data = await api.getOportunidades(params);
      setOportunidades(data);
      // Expandir todos los grupos por defecto
      const grupos = {};
      for (const op of data) {
        grupos[extraerFecha(op.fecha_deteccion)] = true;
      }
      setExpandidos(grupos);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [dias, tipo, ratingMin, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  async function handleGuardar(id) {
    try {
      await api.actualizarOportunidad(id, { estado: 'guardada' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleGrupo(fecha) {
    setExpandidos(prev => ({ ...prev, [fecha]: !prev[fecha] }));
  }

  const grupos = agruparPorFecha(oportunidades);

  return (
    <div className="fade-in">
      {/* Resumen */}
      {resumen && resumen.nuevas > 0 && (
        <div className="bg-acento/10 border border-acento/20 rounded-xl p-4 mb-6">
          <p className="text-textoP text-sm">
            Desde tu última visita hace <strong>{resumen.dias_sin_visita} día{resumen.dias_sin_visita !== 1 ? 's' : ''}</strong>:{' '}
            <span className="text-acento font-semibold">{resumen.nuevas} nueva{resumen.nuevas !== 1 ? 's' : ''}</span>
            {resumen.altas_rating > 0 && (
              <>, <span className="text-emerald-400 font-semibold">{resumen.altas_rating} con rating 8+</span></>
            )}
            {resumen.alertas_plazo > 0 && (
              <>, <span className="text-red-400 font-semibold">{resumen.alertas_plazo} con plazo próximo</span></>
            )}
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={dias} onChange={e => setDias(Number(e.target.value))}
          className="bg-superficie border border-borde rounded-lg px-3 py-2 text-sm text-textoP focus:outline-none focus:border-acento">
          <option value={3}>Últimos 3 días</option>
          <option value={7}>Últimos 7 días</option>
          <option value={10}>Últimos 10 días</option>
        </select>

        <select value={tipo} onChange={e => setTipo(e.target.value)}
          className="bg-superficie border border-borde rounded-lg px-3 py-2 text-sm text-textoP focus:outline-none focus:border-acento">
          <option value="">Todos los tipos</option>
          <option value="licitación">Licitaciones</option>
          <option value="subvención">Subvenciones</option>
          <option value="fondo europeo">Fondos europeos</option>
        </select>

        <select value={ratingMin} onChange={e => setRatingMin(Number(e.target.value))}
          className="bg-superficie border border-borde rounded-lg px-3 py-2 text-sm text-textoP focus:outline-none focus:border-acento">
          <option value={5}>Rating 5+</option>
          <option value={7}>Rating 7+</option>
          <option value={9}>Rating 9+</option>
        </select>

        <select value={estado} onChange={e => setEstado(e.target.value)}
          className="bg-superficie border border-borde rounded-lg px-3 py-2 text-sm text-textoP focus:outline-none focus:border-acento">
          <option value="">Todos los estados</option>
          <option value="nueva">Nuevas</option>
          <option value="vista">Vistas</option>
          <option value="guardada">Guardadas</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-acento border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
          <button onClick={cargar} className="ml-3 underline">Reintentar</button>
        </div>
      )}

      {/* Sin resultados */}
      {!loading && oportunidades.length === 0 && (
        <div className="text-center py-16">
          <p className="text-textoS text-lg mb-2">No hay oportunidades</p>
          <p className="text-textoS/60 text-sm">Ajusta los filtros o ejecuta una búsqueda manual</p>
        </div>
      )}

      {/* Grupos por fecha */}
      {!loading && grupos.map(([fecha, ops]) => (
        <div key={fecha} className="mb-4">
          <button
            onClick={() => toggleGrupo(fecha)}
            className="flex items-center gap-3 w-full text-left py-3 px-1 group"
          >
            <svg
              className={`w-4 h-4 text-textoS transition-transform ${expandidos[fecha] ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-textoP font-semibold capitalize">{formatFechaGrupo(fecha)}</span>
            <span className="text-textoS text-sm">
              {ops.length} oportunidad{ops.length !== 1 ? 'es' : ''}
            </span>
            {ops.some(o => o.estado === 'nueva') && (
              <span className="bg-acento text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {ops.filter(o => o.estado === 'nueva').length} nueva{ops.filter(o => o.estado === 'nueva').length !== 1 ? 's' : ''}
              </span>
            )}
          </button>

          {expandidos[fecha] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7 pb-4">
              {ops.map(op => (
                <OportunidadCard
                  key={op.id}
                  oportunidad={op}
                  onSelect={onSelect}
                  onGuardar={handleGuardar}
                  esNueva={op.estado === 'nueva'}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
