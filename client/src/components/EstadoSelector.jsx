import React from 'react';

const ESTADOS_GUARDADA = [
  { value: 'guardada', label: 'Sin empezar', color: 'text-gray-400' },
  { value: 'en preparación', label: 'En preparación', color: 'text-yellow-400' },
  { value: 'presentada', label: 'Presentada', color: 'text-blue-400' },
  { value: 'resuelta', label: 'Resuelta', color: 'text-emerald-400' },
];

export default function EstadoSelector({ estado, onChange }) {
  return (
    <select
      value={estado}
      onChange={(e) => onChange(e.target.value)}
      className="bg-superficie border border-borde rounded-lg px-3 py-1.5 text-sm text-textoP focus:outline-none focus:border-acento cursor-pointer"
    >
      {ESTADOS_GUARDADA.map(e => (
        <option key={e.value} value={e.value}>{e.label}</option>
      ))}
    </select>
  );
}
