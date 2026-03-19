const API_BASE = process.env.REACT_APP_API_URL || '/api';

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error de red' }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Oportunidades
  getOportunidades: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJSON(`/oportunidades${qs ? '?' + qs : ''}`);
  },
  getOportunidad: (id) => fetchJSON(`/oportunidades/${id}`),
  getResumen: () => fetchJSON('/oportunidades/resumen'),
  getGuardadas: () => fetchJSON('/oportunidades/guardadas'),
  actualizarOportunidad: (id, data) =>
    fetchJSON(`/oportunidades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Informes
  generarInforme: (id) =>
    fetchJSON(`/oportunidades/${id}/informe`, { method: 'POST' }),

  // Compartir
  compartir: (id) =>
    fetchJSON(`/compartir/${id}`, { method: 'POST' }),
  verCompartida: (token) =>
    fetchJSON(`/compartir/ver/${token}`),
  eliminarCompartida: (id) =>
    fetchJSON(`/compartir/${id}`, { method: 'DELETE' }),

  // Búsqueda
  ejecutarBusqueda: () =>
    fetchJSON('/busqueda/ejecutar', { method: 'POST' }),
  getHistorial: () => fetchJSON('/busqueda/historial'),
};
