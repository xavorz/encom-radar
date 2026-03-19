import React from 'react';

export default function RatingBadge({ rating }) {
  let bg, text;
  if (rating >= 9) {
    bg = 'bg-emerald-500/20 border-emerald-500/40';
    text = 'text-emerald-400';
  } else if (rating >= 7) {
    bg = 'bg-orange-500/20 border-orange-500/40';
    text = 'text-orange-400';
  } else {
    bg = 'bg-red-500/20 border-red-500/40';
    text = 'text-red-400';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold border ${bg} ${text}`}>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {rating}/10
    </span>
  );
}
