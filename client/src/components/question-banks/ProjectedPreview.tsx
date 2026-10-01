import type { EditorState } from './bankHelpers';

const CORNERS = [
  { letter: 'A', className: 'border-rose-300 bg-rose-400/20' },
  { letter: 'B', className: 'border-sky-300 bg-sky-400/20' },
  { letter: 'C', className: 'border-emerald-300 bg-emerald-400/20' },
  { letter: 'D', className: 'border-amber-300 bg-amber-400/20' },
];

/** Cómo se verá la pregunta en el escenario del Observatorio (sin la respuesta revelada). */
export const ProjectedPreview = ({ state }: { state: EditorState }) => {
  const options = state.options.filter((o) => o.text.trim());
  const text = state.questionText.trim() || 'Aquí va la pregunta';

  return (
    <div className="rounded-2xl bg-[#0b1026] p-4 text-white" aria-label="Vista previa en el proyector">
      {state.kind === 'ERROR' ? (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200">¿En qué paso está el error?</p>
          <p className="mt-1 text-lg font-black">{text}</p>
          <ol className="mt-3 space-y-1.5">
            {options.map((o, i) => (
              <li key={i} className="rounded-xl border-2 border-white/30 bg-white/5 px-3 py-2 text-sm font-bold">Paso {i + 1}: {o.text}</li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="text-center text-lg font-black">{text}</p>
          {state.kind === 'TRUE_FALSE' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border-4 border-emerald-300 bg-emerald-400/15 p-2 text-center text-sm font-black">🧍 De pie<br /><span className="font-bold text-indigo-50">Verdadero</span></div>
              <div className="rounded-2xl border-4 border-rose-300 bg-rose-400/15 p-2 text-center text-sm font-black">🧎 Agachados<br /><span className="font-bold text-indigo-50">Falso</span></div>
            </div>
          )}
          {state.kind === 'SINGLE_CHOICE' && options.length <= 4 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.map((o, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-2xl border-4 px-3 py-2 ${CORNERS[i].className}`}>
                  <span className="text-lg font-black">{CORNERS[i].letter}</span>
                  <span className="text-sm font-bold">{o.text}</span>
                </div>
              ))}
            </div>
          )}
          {(state.kind === 'MULTIPLE_CHOICE' || state.kind === 'MATCHING' || (state.kind === 'SINGLE_CHOICE' && options.length > 4)) && (
            <p className="mt-3 text-center text-sm font-semibold text-amber-100">Este tipo no se proyecta en Estrellas ni en Conquista.</p>
          )}
        </>
      )}
    </div>
  );
};
