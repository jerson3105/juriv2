// Landing pública (/about): curva de movimiento y clases compartidas.
// Un solo acento (índigo); de día arriba, de noche en el Observatorio y el cierre.

/** Curva de salida fuerte: arranca rápido y se asienta suave (skills de Emil Kowalski). */
export const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const button =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

// El hover solo cambia color y solo con puntero fino: en celular, tocar no deja el botón «pegado».
export const btnPrimary = `${button} bg-indigo-600 text-white focus-visible:outline-indigo-600 [@media(hover:hover)]:hover:bg-indigo-700`;
export const btnSecondary = `${button} border border-slate-300 bg-white text-slate-800 focus-visible:outline-indigo-600 [@media(hover:hover)]:hover:bg-slate-50`;
export const btnCompact = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [@media(hover:hover)]:hover:bg-indigo-700';
export const linkQuiet = 'inline-flex min-h-11 items-center gap-1 rounded-md font-semibold text-indigo-700 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [@media(hover:hover)]:hover:underline';

// Noche: el foco ámbar contrasta con el cielo (13:1).
export const nightFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

export const h2 = 'max-w-2xl text-balance text-3xl font-bold leading-[1.15] tracking-[-0.02em] sm:text-4xl';
export const lead = 'mt-4 max-w-xl text-lg leading-relaxed';
export const container = 'mx-auto max-w-6xl px-4 sm:px-6 lg:px-8';
export const sectionPad = 'py-20 sm:py-24 lg:py-28';
