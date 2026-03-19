import React, { useState, useEffect } from 'react';
import { api } from '../api';
import RatingBadge from './RatingBadge';
import TipoBadge from './TipoBadge';
import EstadoSelector from './EstadoSelector';
import Informe from './Informe';

function formatFecha(fecha) {
  if (!fecha) return 'No especificado';
  return new Date(fecha).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function diasRestantes(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const plazo = new Date(fecha);
  return Math.ceil((plazo - hoy) / (1000 * 60 * 60 * 24));
}

export default function DetalleOportunidad({ id, onBack }) {
  const [op, setOp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generandoInforme, setGenerandoInforme] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [nota, setNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { cargar(); }, [id]);

  async function cargar() {
    setLoading(true);
    try {
      const data = await api.getOportunidad(id);
      setOp(data);
      setNota(data.nota_interna || '');
      if (data.share_token) {
        setShareUrl(`${window.location.origin}/share/${data.share_token}`);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleGenerarInforme() {
    setGenerandoInforme(true);
    try {
      const informe = await api.generarInforme(id);
      setOp(prev => ({
        ...prev,
        informe,
        // Si el informe trae URL exacta, actualizar
        url_fuente: informe.url_convocatoria || prev.url_fuente
      }));
    } catch (err) {
      setError('Error generando informe: ' + err.message);
    }
    setGenerandoInforme(false);
  }

  async function handleCompartir() {
    setCompartiendo(true);
    try {
      const { token } = await api.compartir(id);
      const url = `${window.location.origin}/share/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setError('Error compartiendo: ' + err.message);
    }
    setCompartiendo(false);
  }

  async function handleGuardar() {
    try {
      const data = await api.actualizarOportunidad(id, { estado: 'guardada' });
      setOp(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEstado(nuevoEstado) {
    try {
      const data = await api.actualizarOportunidad(id, { estado: nuevoEstado });
      setOp(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGuardarNota() {
    setGuardandoNota(true);
    try {
      await api.actualizarOportunidad(id, { nota_interna: nota });
    } catch (err) {
      setError(err.message);
    }
    setGuardandoNota(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-acento border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error && !op) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={onBack} className="text-acento hover:underline">Volver</button>
      </div>
    );
  }

  if (!op) return null;

  const dias = diasRestantes(op.plazo_presentacion);

  return (
    <div className="max-w-4xl mx-auto fade-in">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-2 text-textoS hover:text-acento mb-6 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver al feed
      </button>

      {/* Alerta de plazo */}
      {op.alerta_plazo && dias !== null && dias >= 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-400 font-semibold">¡Plazo próximo!</p>
            <p className="text-red-400/80 text-sm">Quedan {dias} días para presentar (hasta {formatFecha(op.plazo_presentacion)})</p>
          </div>
        </div>
      )}

      {/* Card principal */}
      <div className="bg-superficie border border-borde rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <TipoBadge tipo={op.tipo} />
          <RatingBadge rating={op.rating} />
          {['guardada', 'en preparación', 'presentada', 'resuelta'].includes(op.estado) && (
            <EstadoSelector estado={op.estado} onChange={handleEstado} />
          )}
        </div>

        <h1 className="text-textoP text-xl md:text-2xl font-bold mb-2">{op.titulo}</h1>
        <p className="text-textoS text-lg mb-6">{op.organismo}</p>

        {/* Datos clave */}
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

        {/* Justificación y encaje */}
        <div className="space-y-4 mb-6">
          {op.justificacion_rating && (
            <div>
              <h3 className="text-textoS text-xs uppercase tracking-wider mb-2">Justificación del rating</h3>
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

        {/* URL fuente */}
        {op.url_fuente && (
          <a
            href={op.url_fuente}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-acento text-sm hover:underline mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Ver convocatoria original
          </a>
        )}

        {/* Nota interna */}
        {['guardada', 'en preparación', 'presentada', 'resuelta'].includes(op.estado) && (
          <div className="mb-6">
            <h3 className="text-textoS text-xs uppercase tracking-wider mb-2">Nota interna</h3>
            <div className="flex gap-2">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Añade notas sobre esta oportunidad..."
                rows={3}
                className="flex-1 bg-fondo border border-borde rounded-xl p-3 text-textoP text-sm resize-none focus:outline-none focus:border-acento"
              />
              <button
                onClick={handleGuardarNota}
                disabled={guardandoNota}
                className="self-end px-4 py-2 bg-superficie border border-borde rounded-xl text-textoP text-sm hover:border-acento transition-colors disabled:opacity-50"
              >
                {guardandoNota ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-borde">
          {!['guardada', 'en preparación', 'presentada', 'resuelta'].includes(op.estado) && (
            <button
              onClick={handleGuardar}
              className="flex items-center gap-2 px-5 py-2.5 bg-acento/10 text-acento rounded-xl text-sm font-medium hover:bg-acento/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Guardar
            </button>
          )}

          <button
            onClick={handleGenerarInforme}
            disabled={generandoInforme}
            className="flex items-center gap-2 px-5 py-2.5 bg-acento text-white rounded-xl text-sm font-medium hover:bg-acentoHover transition-colors disabled:opacity-50"
          >
            {generandoInforme ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {op.informe ? 'Regenerar informe' : 'Generar informe'}
              </>
            )}
          </button>

          <button
            onClick={handleCompartir}
            disabled={compartiendo}
            className="flex items-center gap-2 px-5 py-2.5 bg-superficie border border-borde text-textoP rounded-xl text-sm font-medium hover:border-acento transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {compartiendo ? 'Copiando...' : 'Compartir'}
          </button>
        </div>

        {/* URL compartida */}
        {shareUrl && (
          <div className="mt-4 bg-fondo border border-borde rounded-xl p-3 flex items-center gap-3">
            <span className="text-emerald-400 text-sm">✓ Enlace copiado</span>
            <code className="text-textoS text-xs flex-1 truncate">{shareUrl}</code>
          </div>
        )}
      </div>

      {/* Informe */}
      {op.informe && (
        <div className="mt-6">
          <Informe informe={op.informe} />
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
