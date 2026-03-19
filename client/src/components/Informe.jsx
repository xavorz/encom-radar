import React from 'react';

export default function Informe({ informe }) {
  if (!informe) return null;

  return (
    <div className="bg-superficie border border-borde rounded-2xl overflow-hidden fade-in">
      <div className="px-6 py-4 border-b border-borde bg-acento/5">
        <h2 className="text-textoP font-bold text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-acento" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Informe de oportunidad
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Resumen ejecutivo */}
        <div>
          <h3 className="text-textoS text-xs uppercase tracking-wider mb-3 font-semibold">Resumen ejecutivo</h3>
          <p className="text-textoP text-sm leading-relaxed bg-fondo rounded-xl p-4">
            {informe.resumen_ejecutivo}
          </p>
        </div>

        {/* Plan de tareas */}
        {informe.plan_tareas && informe.plan_tareas.length > 0 && (
          <div>
            <h3 className="text-textoS text-xs uppercase tracking-wider mb-3 font-semibold">Plan de tareas</h3>
            <div className="space-y-2">
              {informe.plan_tareas.map((tarea, i) => (
                <div key={i} className="bg-fondo rounded-xl p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    tarea.prioridad === 'alta' ? 'bg-red-500/20 text-red-400' :
                    tarea.prioridad === 'media' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {tarea.orden || i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-textoP text-sm font-medium">{tarea.tarea}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-textoS">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {tarea.responsable_sugerido}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {tarea.tiempo_estimado}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertas críticas */}
        {informe.alertas_criticas && informe.alertas_criticas.length > 0 && (
          <div>
            <h3 className="text-textoS text-xs uppercase tracking-wider mb-3 font-semibold">Alertas críticas</h3>
            <div className="space-y-2">
              {informe.alertas_criticas.map((alerta, i) => (
                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 flex items-start gap-3">
                  <span className="text-red-400 mt-0.5">⚠️</span>
                  <p className="text-textoP text-sm">{alerta}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
