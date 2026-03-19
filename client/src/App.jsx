import React, { useState, useEffect } from 'react';
import { api } from './api';
import Feed from './components/Feed';
import Guardadas from './components/Guardadas';
import DetalleOportunidad from './components/DetalleOportunidad';
import ShareView from './components/ShareView';

const VISTAS = {
  FEED: 'feed',
  GUARDADAS: 'guardadas',
  DETALLE: 'detalle',
  SHARE: 'share',
};

export default function App() {
  const [vista, setVista] = useState(VISTAS.FEED);
  const [selectedId, setSelectedId] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [mensajeBusqueda, setMensajeBusqueda] = useState(null);

  // Detectar URL de share
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/share/')) {
      const token = path.split('/share/')[1];
      setShareToken(token);
      setVista(VISTAS.SHARE);
    }
  }, []);

  // Cargar resumen
  useEffect(() => {
    if (vista !== VISTAS.SHARE) {
      api.getResumen().then(setResumen).catch(console.error);
    }
  }, [vista]);

  function handleSelect(id) {
    setSelectedId(id);
    setVista(VISTAS.DETALLE);
  }

  function handleBack() {
    setSelectedId(null);
    setVista(VISTAS.FEED);
  }

  async function handleBusquedaManual() {
    setBuscando(true);
    setMensajeBusqueda(null);
    try {
      const res = await api.ejecutarBusqueda();
      setMensajeBusqueda(res.mensaje);
      // Recargar resumen
      const nuevoResumen = await api.getResumen();
      setResumen(nuevoResumen);
    } catch (err) {
      setMensajeBusqueda('Error: ' + err.message);
    }
    setBuscando(false);
  }

  // Vista compartida (sin layout)
  if (vista === VISTAS.SHARE) {
    return <ShareView token={shareToken} />;
  }

  return (
    <div className="min-h-screen bg-fondo font-inter">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-fondo/80 backdrop-blur-xl border-b border-borde">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-acento rounded-xl flex items-center justify-center shadow-lg shadow-acento/20">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-textoP font-bold text-lg leading-none">Encom Radar</h1>
                <p className="text-textoS text-[10px] tracking-wider uppercase">Licitaciones y subvenciones</p>
              </div>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setVista(VISTAS.FEED); setSelectedId(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  vista === VISTAS.FEED ? 'bg-acento/15 text-acento' : 'text-textoS hover:text-textoP hover:bg-superficie'
                }`}
              >
                Feed
              </button>
              <button
                onClick={() => { setVista(VISTAS.GUARDADAS); setSelectedId(null); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  vista === VISTAS.GUARDADAS ? 'bg-acento/15 text-acento' : 'text-textoS hover:text-textoP hover:bg-superficie'
                }`}
              >
                Guardadas
              </button>

              {/* Botón búsqueda manual */}
              <button
                onClick={handleBusquedaManual}
                disabled={buscando}
                className="ml-2 flex items-center gap-2 px-4 py-2 bg-acento text-white rounded-lg text-sm font-medium hover:bg-acentoHover transition-colors disabled:opacity-50"
              >
                {buscando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Buscando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="hidden sm:inline">Buscar ahora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mensaje de búsqueda */}
      {mensajeBusqueda && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className={`rounded-xl p-3 text-sm flex items-center justify-between ${
            mensajeBusqueda.startsWith('Error')
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}>
            <span>{mensajeBusqueda}</span>
            <button onClick={() => setMensajeBusqueda(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {vista === VISTAS.FEED && (
          <Feed onSelect={handleSelect} resumen={resumen} />
        )}
        {vista === VISTAS.GUARDADAS && (
          <Guardadas onSelect={handleSelect} />
        )}
        {vista === VISTAS.DETALLE && selectedId && (
          <DetalleOportunidad id={selectedId} onBack={handleBack} />
        )}
      </main>
    </div>
  );
}
