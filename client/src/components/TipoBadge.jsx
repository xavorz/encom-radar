import React from 'react';

const COLORES = {
  'licitación': { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400', icon: '📋' },
  'subvención': { bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400', icon: '💰' },
  'fondo europeo': { bg: 'bg-yellow-500/15 border-yellow-500/30', text: 'text-yellow-400', icon: '🇪🇺' },
};

export default function TipoBadge({ tipo }) {
  const c = COLORES[tipo] || COLORES['subvención'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.text}`}>
      <span>{c.icon}</span>
      {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
    </span>
  );
}
