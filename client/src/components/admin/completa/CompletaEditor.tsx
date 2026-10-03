import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eraser, Hand, ImagePlus, Loader2, Paintbrush, Redo2, RotateCcw, Undo2, Wand2 } from 'lucide-react';
import type { AvatarGender, AvatarSlot, ItemRarity } from '../../../lib/avatarApi';
import type { AdminAvatarItem } from '../../../lib/adminAvatarItemsApi';
import { LAYER_ORDER } from '../../avatar/avatarLayers';
import { primaryButton } from '../adminStyles';
import { BODY_NAME, RARITY_NAME, RARITY_SEQUENCE, SLOT_NAMES, SLOT_SEQUENCE } from '../avatarItems/avatarItemsHelpers';
import { CANVAS_H, CANVAS_W } from './completaAnchors';
import {
  SourceError, autoFit, baseClothesMask, canvasToSource, cleanIslands, clearPixels, detectBackground, loadSource,
  magicErase, paintBrush, pivotX, removeBackground, renderLayer, renderThumb, runChecks, visibleBase,
  type BackgroundKind, type FitMode, type QualityCheck, type SourceImage, type Transform,
} from './completaImage';
import { CompletaPreview } from './CompletaPreview';

type Tool = 'move' | 'erase' | 'restore' | 'wand';
type View = 'checker' | 'light' | 'night';
interface Snapshot { mask: Uint8Array; transform: Transform }

export interface CompletaSaveInput {
  png: Blob;
  name: string;
  description: string;
  slot: AvatarSlot;
  gender: AvatarGender;
  rarity: ItemRarity;
  publish: boolean;
}

interface CompletaEditorProps {
  mode: 'new' | 'retouch' | 'replace';
  initial: { slot: AvatarSlot; gender: AvatarGender; rarity: ItemRarity; name: string; description: string };
  lockSlot?: boolean;
  lockGender?: boolean;
  lockRarity?: boolean;
  /** Imagen de partida (retocar la que ya tiene la prenda). */
  initialSource?: Blob | null;
  defaults: AdminAvatarItem[];
  saving: boolean;
  onSave: (input: CompletaSaveInput) => void;
}

const BG_LABEL: Record<BackgroundKind, string> = {
  transparent: 'Transparente', checker: 'Cuadriculado dibujado', solid: 'Color liso', complex: 'Escena (manual)',
};
const FIT_LABEL: Record<FitMode, string> = {
  frame: 'Dibujada sobre la plantilla del cuerpo', loose: 'Prenda suelta: encajada en su zona', cover: 'Fondo: cubre el recuadro',
};
const TOOLS: { id: Tool; label: string; key: string; icon: typeof Hand }[] = [
  { id: 'move', label: 'Mover', key: 'M', icon: Hand },
  { id: 'erase', label: 'Borrador', key: 'B', icon: Eraser },
  { id: 'restore', label: 'Restaurar', key: 'R', icon: Paintbrush },
  { id: 'wand', label: 'Varita', key: 'V', icon: Wand2 },
];
const HISTORY_LIMIT = 30;
const field = 'mt-1 min-h-[2.5rem] w-full rounded-lg border border-[var(--pg-control)] bg-[var(--pg-surface)] px-3';

/**
 * «Completa»: de la imagen de la IA a la capa lista (395×959 con transparencia). Quita el fondo, la ajusta
 * al cuerpo, deja retocar con deshacer y muestra cómo se verá. Todo pasa en el navegador; el servidor solo
 * recibe el PNG final y lo vuelve a revisar.
 */
export const CompletaEditor = ({ mode, initial, lockSlot, lockGender, lockRarity, initialSource, defaults, saving, onSave }: CompletaEditorProps) => {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slot, setSlot] = useState(initial.slot);
  const [gender, setGender] = useState(initial.gender);
  const [rarity, setRarity] = useState(initial.rarity);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [kind, setKind] = useState<BackgroundKind>('checker');
  const [bgColor, setBgColor] = useState<[number, number, number] | null>(null);
  const [tolerance, setTolerance] = useState(30);
  const [stats, setStats] = useState({ removed: 0, holes: 0, islands: 0, pieces: 1 });
  const [fitMode, setFitMode] = useState<FitMode>('frame');
  const [transform, setTransform] = useState<Transform>({ scale: 1, widen: 1, dx: 0, dy: 0 });
  const [autoTransform, setAutoTransform] = useState<Transform | null>(null);
  const [tool, setTool] = useState<Tool>('move');
  const [brush, setBrush] = useState(12);
  const [wandTolerance, setWandTolerance] = useState(34);
  const [view, setView] = useState<View>('checker');
  const [guide, setGuide] = useState(true);
  const [showBase, setShowBase] = useState(false);
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [maskVersion, setMaskVersion] = useState(0);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [baseVersion, setBaseVersion] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Lienzos fuera de pantalla (estables durante toda la vida del editor).
  const [maskedCanvas] = useState(() => document.createElement('canvas'));
  const [layerCanvas] = useState(() => document.createElement('canvas'));
  const [thumbCanvas] = useState(() => document.createElement('canvas'));
  const displayRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<SourceImage | null>(null);
  const maskRef = useRef<Uint8Array | null>(null);
  const maskedImageRef = useRef<ImageData | null>(null);
  const transformRef = useRef(transform);
  const historyRef = useRef<{ stack: Snapshot[]; index: number }>({ stack: [], index: -1 });
  const baseRef = useRef<Partial<Record<AvatarGender, { image: HTMLImageElement; fill: Uint8Array }>>>({});
  const dragRef = useRef<{ tool: Tool; start: { x: number; y: number }; last: { x: number; y: number }; t0: Transform } | null>(null);
  const frameRef = useRef(0);

  const applyTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  const pushHistory = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push({ mask: mask.slice(), transform: { ...transformRef.current } });
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
    h.index = h.stack.length - 1;
    setHistory({ canUndo: h.index > 0, canRedo: false });
  }, []);

  /** Fuente con la máscara aplicada (todo el lienzo o solo un rectángulo, para el pincel). */
  const paintMasked = useCallback((rect?: { x0: number; y0: number; x1: number; y1: number }) => {
    const src = sourceRef.current;
    const mask = maskRef.current;
    if (!src || !mask) return;
    const ctx = maskedCanvas.getContext('2d')!;
    if (!rect || !maskedImageRef.current) {
      maskedCanvas.width = src.width;
      maskedCanvas.height = src.height;
      const image = ctx.createImageData(src.width, src.height);
      image.data.set(src.data);
      for (let i = 0, p = 3; i < mask.length; i += 1, p += 4) image.data[p] = Math.min(src.alpha[i], mask[i]);
      ctx.putImageData(image, 0, 0);
      maskedImageRef.current = image;
      return;
    }
    const image = maskedImageRef.current;
    for (let y = rect.y0; y <= rect.y1; y += 1) {
      for (let x = rect.x0; x <= rect.x1; x += 1) {
        const i = y * src.width + x;
        image.data[i * 4 + 3] = Math.min(src.alpha[i], mask[i]);
      }
    }
    ctx.putImageData(image, 0, 0, rect.x0, rect.y0, rect.x1 - rect.x0 + 1, rect.y1 - rect.y0 + 1);
  }, [maskedCanvas]);

  /** Capa final + vista de trabajo (guía del cuerpo, fondo de revisión, ropa base marcada). */
  const redraw = useCallback(() => {
    if (!sourceRef.current) return;
    renderLayer(layerCanvas, maskedCanvas, transformRef.current, pivotX(gender));
    const display = displayRef.current;
    if (!display) return;
    const ctx = display.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (view === 'light') { ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
    if (view === 'night') {
      const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      sky.addColorStop(0, '#0b1026'); sky.addColorStop(1, '#1e293b');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    const base = baseRef.current[gender];
    const behind = slot !== 'BACKGROUND' && (LAYER_ORDER[slot] ?? 0) < 0;
    const drawGuide = () => {
      if (!guide || !base) return;
      ctx.globalAlpha = slot === 'BACKGROUND' ? 0.6 : 0.35;
      ctx.drawImage(base.image, 0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    };
    if (!behind && slot !== 'BACKGROUND') drawGuide();
    ctx.drawImage(layerCanvas, 0, 0);
    if (behind || slot === 'BACKGROUND') drawGuide();
    if (showBase && base) {
      const out = layerCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, CANVAS_W, CANVAS_H);
      const visible = visibleBase(out, base.fill, gender, slot);
      if (visible) {
        const overlay = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        for (let i = 0; i < visible.length; i += 1) {
          if (!visible[i]) continue;
          overlay.data[i * 4] = 239; overlay.data[i * 4 + 1] = 68; overlay.data[i * 4 + 2] = 68; overlay.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(overlay, 0, 0);
      }
    }
  }, [gender, guide, layerCanvas, maskedCanvas, showBase, slot, view]);

  // Cuerpo base de cada cuerpo (guía + ropa base para el aviso). Mismo origen: se pueden leer sus píxeles.
  useEffect(() => {
    if (baseRef.current[gender]) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0, CANVAS_W, CANVAS_H);
      baseRef.current[gender] = { image, fill: baseClothesMask(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)) };
      setBaseVersion((v) => v + 1);
    };
    image.src = `/avatars/base/${gender === 'MALE' ? 'male' : 'female'}.png`;
  }, [gender]);

  // Dibujo y comprobaciones cuando cambia algo de la capa.
  useEffect(() => {
    if (!source) return;
    redraw();
    renderThumb(thumbCanvas, layerCanvas);
    const timer = window.setTimeout(() => {
      const out = layerCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, CANVAS_W, CANVAS_H);
      setChecks(runChecks({
        out, slot, gender, kind, removed: stats.removed, holes: stats.holes, pieces: stats.pieces,
        islandsRemoved: stats.islands, baseFill: baseRef.current[gender]?.fill ?? null,
      }));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [source, transform, maskVersion, baseVersion, redraw, thumbCanvas, layerCanvas, slot, gender, kind, stats]);

  /** Fondo → restos → (ajuste). Se repite al cambiar la tolerancia o el tipo de fondo. */
  const processBackground = useCallback((src: SourceImage, nextKind: BackgroundKind, color: [number, number, number] | null, tol: number) => {
    const bg = removeBackground(src, nextKind, color, tol);
    clearPixels(bg.mask, bg.holes);
    const islands = cleanIslands(bg.mask, src.width, src.height);
    maskRef.current = bg.mask;
    maskedImageRef.current = null;
    paintMasked();
    setStats({ removed: bg.removed, holes: bg.holes.length, islands: islands.removed, pieces: islands.pieces });
  }, [paintMasked]);

  const refit = useCallback((src: SourceImage, nextSlot: AvatarSlot, nextGender: AvatarGender) => {
    const mask = maskRef.current;
    if (!mask) return;
    const fit = autoFit(src, mask, nextSlot, nextGender);
    setFitMode(fit.mode);
    setAutoTransform(fit.transform);
    applyTransform(fit.transform);
  }, [applyTransform]);

  const loadBlob = useCallback(async (blob: Blob, label: string) => {
    setBusy(true);
    setLoadError(null);
    try {
      const src = await loadSource(blob);
      sourceRef.current = src;
      const guess = detectBackground(src);
      setKind(guess.kind);
      setBgColor(guess.color);
      setTolerance(30);
      processBackground(src, guess.kind, guess.color, 30);
      refit(src, slot, gender);
      historyRef.current = { stack: [], index: -1 };
      pushHistory();
      setSource(src);
      setFileLabel(`${label} · ${src.originalWidth}×${src.originalHeight}`);
      setMaskVersion((v) => v + 1);
      setTool('move');
    } catch (error) {
      setLoadError(error instanceof SourceError ? error.message : 'No se pudo leer la imagen. Usa un JPG, PNG o WebP.');
    } finally {
      setBusy(false);
    }
  }, [gender, processBackground, pushHistory, refit, slot]);

  // Retocar: arranca con la imagen actual de la prenda.
  useEffect(() => {
    if (initialSource) void loadBlob(initialSource, 'Imagen actual');
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSource]);

  // Pegar con Ctrl+V (desde la herramienta de IA).
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const file = [...(event.clipboardData?.items ?? [])].find((entry) => entry.type.startsWith('image/'))?.getAsFile();
      if (file) {
        event.preventDefault();
        void loadBlob(file, 'Imagen pegada');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadBlob]);

  const restoreSnapshot = useCallback((snapshot: Snapshot) => {
    maskRef.current = snapshot.mask.slice();
    maskedImageRef.current = null;
    paintMasked();
    applyTransform({ ...snapshot.transform });
    setMaskVersion((v) => v + 1);
  }, [applyTransform, paintMasked]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    restoreSnapshot(h.stack[h.index]);
    setHistory({ canUndo: h.index > 0, canRedo: true });
  }, [restoreSnapshot]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    restoreSnapshot(h.stack[h.index]);
    setHistory({ canUndo: true, canRedo: h.index < h.stack.length - 1 });
  }, [restoreSnapshot]);

  // Atajos: deshacer/rehacer y herramientas (fuera de los campos de texto).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
      if (mod || event.altKey) return;
      const found = TOOLS.find((entry) => entry.key.toLowerCase() === event.key.toLowerCase());
      if (found && sourceRef.current) setTool(found.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [redo, undo]);

  // Avisa antes de salir con una imagen sin guardar.
  useEffect(() => {
    if (!source || saving) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [source, saving]);

  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) * CANVAS_W) / rect.width, y: ((event.clientY - rect.top) * CANVAS_H) / rect.height };
  };

  const scheduleRedraw = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => redraw());
  };

  /** Pincel entre dos puntos del lienzo (borra o restaura en la fuente). */
  const brushSegment = (from: { x: number; y: number }, to: { x: number; y: number }, brushMode: 'erase' | 'restore') => {
    const src = sourceRef.current;
    const mask = maskRef.current;
    if (!src || !mask) return;
    const t = transformRef.current;
    const pivot = pivotX(gender);
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, brush / 3)));
    let x0 = src.width; let y0 = src.height; let x1 = 0; let y1 = 0;
    for (let s = 0; s <= steps; s += 1) {
      const px = from.x + ((to.x - from.x) * s) / steps;
      const py = from.y + ((to.y - from.y) * s) / steps;
      const p = canvasToSource(px, py, t, pivot);
      const rx = brush * p.rx;
      const ry = brush * p.ry;
      paintBrush(mask, src, p.x, p.y, rx, ry, brushMode);
      x0 = Math.min(x0, Math.floor(p.x - rx)); y0 = Math.min(y0, Math.floor(p.y - ry));
      x1 = Math.max(x1, Math.ceil(p.x + rx)); y1 = Math.max(y1, Math.ceil(p.y + ry));
    }
    const rect = { x0: Math.max(0, x0), y0: Math.max(0, y0), x1: Math.min(src.width - 1, x1), y1: Math.min(src.height - 1, y1) };
    if (rect.x1 >= rect.x0 && rect.y1 >= rect.y0) paintMasked(rect);
    scheduleRedraw();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const src = sourceRef.current;
    const mask = maskRef.current;
    if (!src || !mask) return;
    const point = toCanvasPoint(event);
    if (tool === 'wand') {
      const p = canvasToSource(point.x, point.y, transformRef.current, pivotX(gender));
      if (magicErase(mask, src, p.x, p.y, wandTolerance) > 0) {
        maskedImageRef.current = null;
        paintMasked();
        pushHistory();
        setMaskVersion((v) => v + 1);
      }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { tool, start: point, last: point, t0: { ...transformRef.current } };
    if (tool === 'erase' || tool === 'restore') brushSegment(point, point, tool);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toCanvasPoint(event);
    if (drag.tool === 'move') {
      transformRef.current = { ...drag.t0, dx: drag.t0.dx + (point.x - drag.start.x) / drag.t0.widen, dy: drag.t0.dy + (point.y - drag.start.y) };
      scheduleRedraw();
    } else if (drag.tool === 'erase' || drag.tool === 'restore') {
      brushSegment(drag.last, point, drag.tool);
    }
    drag.last = point;
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.tool === 'move') applyTransform({ ...transformRef.current });
    else setMaskVersion((v) => v + 1);
    pushHistory();
  };

  const nudge = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (tool !== 'move' || !sourceRef.current) return;
    const step = event.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const t = transformRef.current;
    applyTransform({ ...t, dx: t.dx + move[0] / t.widen, dy: t.dy + move[1] });
    pushHistory();
  };

  /** Tamaño y ensanche como porcentaje del ajuste automático. */
  const setScalePercent = (percent: number) => {
    const auto = autoTransform ?? transformRef.current;
    const t = transformRef.current;
    const scale = (auto.scale * percent) / 100;
    // Escala desde el centro de lo que se ve, para que no salte de lugar.
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    const k = scale / t.scale;
    applyTransform({ ...t, scale, dx: cx - (cx - t.dx) * k, dy: cy - (cy - t.dy) * k });
  };

  const changeSlot = (next: AvatarSlot) => {
    setSlot(next);
    if (sourceRef.current) { refit(sourceRef.current, next, gender); pushHistory(); }
  };
  const changeGender = (next: AvatarGender) => {
    setGender(next);
    if (sourceRef.current) { refit(sourceRef.current, slot, next); pushHistory(); }
  };
  const changeTolerance = (next: number) => {
    setTolerance(next);
    const src = sourceRef.current;
    if (!src) return;
    processBackground(src, kind, bgColor, next);
    pushHistory();
    setMaskVersion((v) => v + 1);
  };
  const changeKind = (next: BackgroundKind) => {
    const src = sourceRef.current;
    if (!src) return;
    setKind(next);
    processBackground(src, next, next === 'solid' ? (bgColor ?? [255, 255, 255]) : bgColor, tolerance);
    pushHistory();
    setMaskVersion((v) => v + 1);
  };
  const resetFit = () => {
    if (!autoTransform) return;
    applyTransform({ ...autoTransform });
    pushHistory();
  };

  const save = (publish: boolean) => {
    layerCanvas.toBlob((png) => {
      if (png) onSave({ png, name: name.trim(), description: description.trim(), slot, gender, rarity, publish });
    }, 'image/png');
  };

  const warnings = checks.filter((check) => check.level === 'warn').length;
  const scalePercent = autoTransform ? Math.round((transform.scale / autoTransform.scale) * 100) : 100;
  const canSave = !!source && !saving && !busy && (mode !== 'new' || name.trim().length > 0);
  const pickFile = () => fileInputRef.current?.click();

  return (
    <div className="mx-auto grid max-w-[90rem] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_17rem]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) void loadBlob(file, file.name); e.target.value = ''; }}
      />

      {/* Pasos: imagen, fondo, ajuste, comprobaciones y datos. */}
      <div className="order-2 space-y-4 lg:order-1">
        <section className="pg-surface space-y-3 p-4" aria-labelledby="step-image">
          <h2 id="step-image" className="text-sm font-bold">1 · Imagen</h2>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">
              Ranura
              <select value={slot} disabled={lockSlot} onChange={(e) => changeSlot(e.target.value as AvatarSlot)} className={`${field} px-2`}>
                {SLOT_SEQUENCE.map((value) => <option key={value} value={value}>{SLOT_NAMES[value]}</option>)}
              </select>
            </label>
            <fieldset className="text-sm font-medium">
              <legend>Cuerpo</legend>
              <div className="pg-seg mt-1 w-full" role="group">
                {(['MALE', 'FEMALE'] as AvatarGender[]).map((value) => (
                  <button key={value} type="button" className="pg-seg-item flex-1 justify-center" aria-pressed={gender === value} disabled={lockGender && gender !== value} onClick={() => changeGender(value)}>
                    {BODY_NAME[value]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {fileLabel ? (
            <p className="pg-fg2 break-words text-xs">{fileLabel}</p>
          ) : (
            <p className="pg-fg2 text-xs">Elige primero la ranura y el cuerpo: el ajuste depende de ellos. En las manos, la izquierda del personaje queda a la derecha de la imagen.</p>
          )}
          <button type="button" className="pg-btn w-full" onClick={pickFile} disabled={busy}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> {source ? 'Cambiar imagen' : 'Elegir imagen'}
          </button>
        </section>

        {source && (
          <section className="pg-surface space-y-3 p-4" aria-labelledby="step-bg">
            <h2 id="step-bg" className="text-sm font-bold">2 · Fondo</h2>
            <label className="block text-sm font-medium">
              Tipo de fondo
              <select value={kind} onChange={(e) => changeKind(e.target.value as BackgroundKind)} className={`${field} px-2`}>
                {(Object.keys(BG_LABEL) as BackgroundKind[]).map((value) => <option key={value} value={value}>{BG_LABEL[value]}</option>)}
              </select>
            </label>
            {(kind === 'checker' || kind === 'solid') && (
              <label className="block text-sm font-medium">
                Tolerancia <span className="pg-fg2 font-normal">({tolerance})</span>
                <input type="range" min={0} max={80} value={tolerance} onChange={(e) => changeTolerance(Number(e.target.value))} className="mt-1 w-full accent-blue-600" />
              </label>
            )}
            <p className="pg-fg2 text-xs">Si se comió parte de la prenda, baja la tolerancia; si queda borde claro, súbela.</p>
          </section>
        )}

        {source && (
          <section className="pg-surface space-y-3 p-4" aria-labelledby="step-fit">
            <div className="flex items-center justify-between gap-2">
              <h2 id="step-fit" className="text-sm font-bold">3 · Ajuste al cuerpo</h2>
              <button type="button" className="pg-btn pg-btn-ghost px-2 text-xs" onClick={resetFit}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Automático</button>
            </div>
            <p className="pg-fg2 text-xs">{FIT_LABEL[fitMode]}</p>
            <label className="block text-sm font-medium">
              Tamaño <span className="pg-fg2 font-normal">({scalePercent} %)</span>
              <input type="range" min={60} max={140} value={scalePercent} onChange={(e) => setScalePercent(Number(e.target.value))} onPointerUp={pushHistory} onKeyUp={pushHistory} className="mt-1 w-full accent-blue-600" />
            </label>
            {slot !== 'BACKGROUND' && (
              <label className="block text-sm font-medium">
                Ensanchar <span className="pg-fg2 font-normal">({Math.round(transform.widen * 100)} %)</span>
                <input type="range" min={85} max={130} value={Math.round(transform.widen * 100)} onChange={(e) => applyTransform({ ...transformRef.current, widen: Number(e.target.value) / 100 })} onPointerUp={pushHistory} onKeyUp={pushHistory} className="mt-1 w-full accent-blue-600" />
              </label>
            )}
            <p className="pg-fg2 text-xs">Mover: arrastra la prenda con «Mover» o usa las flechas (Mayús = 10 px).</p>
          </section>
        )}

        {source && (
          <section className="pg-surface space-y-2 p-4" aria-labelledby="step-checks" aria-live="polite">
            <h2 id="step-checks" className="text-sm font-bold">Comprobaciones {warnings > 0 && <span className="text-amber-800 dark:text-amber-300">· {warnings} por revisar</span>}</h2>
            <ul className="space-y-2">
              {checks.map((check) => (
                <li key={check.id} className="flex gap-2 text-sm">
                  {check.level === 'ok'
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-label="Bien" />
                    : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-label="Revisar" />}
                  <span>
                    {check.text}
                    {check.fix === 'show-base' && (
                      <button type="button" className="ml-1 font-semibold text-blue-700 underline dark:text-blue-300" onClick={() => setShowBase((v) => !v)}>
                        {showBase ? 'Ocultar' : 'Ver dónde'}
                      </button>
                    )}
                    {check.fix === 'fit' && (
                      <button type="button" className="ml-1 font-semibold text-blue-700 underline dark:text-blue-300" onClick={resetFit}>Ajuste automático</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {mode === 'new' && (
          <section className="pg-surface space-y-3 p-4" aria-labelledby="step-data">
            <h2 id="step-data" className="text-sm font-bold">4 · Datos</h2>
            <label className="block text-sm font-medium">
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Por ejemplo: Poncho andino" className={field} />
            </label>
            <label className="block text-sm font-medium">
              Rareza {lockRarity && <span className="pg-fg2 font-normal">(la de la otra versión)</span>}
              <select value={rarity} disabled={lockRarity} onChange={(e) => setRarity(e.target.value as ItemRarity)} className={`${field} px-2`}>
                {RARITY_SEQUENCE.map((value) => <option key={value} value={value}>{RARITY_NAME[value]}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Descripción <span className="pg-fg2 font-normal">(opcional)</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} className={`${field} py-2`} />
            </label>
          </section>
        )}
      </div>

      {/* Lienzo de trabajo. */}
      <section className="order-1 space-y-3 lg:order-2" aria-label="Lienzo">
        <div className="pg-surface flex flex-wrap items-center gap-2 p-2">
          <div className="pg-seg" role="group" aria-label="Herramienta">
            {TOOLS.map((entry) => {
              const Icon = entry.icon;
              return (
                <button key={entry.id} type="button" className="pg-seg-item" aria-pressed={tool === entry.id} disabled={!source} onClick={() => setTool(entry.id)} title={`${entry.label} (${entry.key})`}>
                  <Icon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">{entry.label}</span>
                </button>
              );
            })}
          </div>
          {(tool === 'erase' || tool === 'restore') && (
            <label className="flex items-center gap-2 text-sm">
              Pincel
              <input type="range" min={2} max={40} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-24 accent-blue-600" />
            </label>
          )}
          {tool === 'wand' && (
            <label className="flex items-center gap-2 text-sm">
              Parecido
              <input type="range" min={5} max={80} value={wandTolerance} onChange={(e) => setWandTolerance(Number(e.target.value))} className="w-24 accent-blue-600" />
            </label>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="pg-icon-btn" onClick={undo} disabled={!history.canUndo} aria-label="Deshacer (Ctrl+Z)" title="Deshacer (Ctrl+Z)"><Undo2 className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" className="pg-icon-btn" onClick={redo} disabled={!history.canRedo} aria-label="Rehacer (Ctrl+Y)" title="Rehacer (Ctrl+Y)"><Redo2 className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </div>

        <div
          className={`relative mx-auto flex w-full items-center justify-center rounded-xl border-2 ${dragOver ? 'border-blue-500' : 'border-transparent'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void loadBlob(file, file.name);
          }}
        >
          {source ? (
            <canvas
              ref={displayRef}
              width={CANVAS_W}
              height={CANVAS_H}
              tabIndex={0}
              role="img"
              aria-label={`Prenda sobre el cuerpo ${BODY_NAME[gender]}. Con «Mover», las flechas la desplazan.`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={nudge}
              className={`h-[min(78vh,959px)] w-auto max-w-full touch-none rounded-lg shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[var(--pg-ring)] ${tool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
              style={view === 'checker'
                ? { backgroundImage: 'conic-gradient(#ddd6fe 25%, #f5f3ff 0 50%, #ddd6fe 0 75%, #f5f3ff 0)', backgroundSize: '18px 18px' }
                : undefined}
            />
          ) : (
            <button
              type="button"
              onClick={pickFile}
              disabled={busy}
              className="flex aspect-[395/959] h-[min(70vh,800px)] max-w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--pg-control)] bg-[var(--pg-surface)] p-6 text-center hover:bg-[var(--pg-hover)]"
            >
              {busy ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-8 w-8" aria-hidden="true" />}
              <span className="font-semibold">{busy ? 'Preparando la imagen…' : 'Arrastra, pega (Ctrl+V) o elige una imagen'}</span>
              <span className="pg-fg2 text-sm">JPG, PNG o WebP · hasta 15 MB. Puede traer el cuadriculado dibujado: lo quito yo.</span>
            </button>
          )}
          {busy && source && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Procesando" />
            </div>
          )}
        </div>
        {loadError && <p role="alert" className="pg-alert text-center text-sm font-medium">{loadError}</p>}

        {source && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <div className="pg-seg" role="group" aria-label="Fondo de revisión">
              <button type="button" className="pg-seg-item" aria-pressed={view === 'checker'} onClick={() => setView('checker')}>Tablero</button>
              <button type="button" className="pg-seg-item" aria-pressed={view === 'light'} onClick={() => setView('light')}>Blanco</button>
              <button type="button" className="pg-seg-item" aria-pressed={view === 'night'} onClick={() => setView('night')}>Noche</button>
            </div>
            <label className="flex min-h-[2.5rem] items-center gap-2">
              <input type="checkbox" className="pg-check" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
              Cuerpo de guía
            </label>
          </div>
        )}
      </section>

      {/* Vista previa y guardar. */}
      <div className="order-3 space-y-4">
        <CompletaPreview layer={source ? layerCanvas : null} version={`${maskVersion}:${transform.scale}:${transform.widen}:${transform.dx}:${transform.dy}:${baseVersion}:${slot}:${gender}`} thumb={source ? thumbCanvas : null} gender={gender} slot={slot} defaults={defaults} />
        <section className="pg-surface space-y-2 p-4">
          {mode === 'new' ? (
            <>
              <button type="button" className={`${primaryButton} w-full`} disabled={!canSave} onClick={() => save(false)}>
                {saving ? 'Guardando…' : 'Guardar borrador'}
              </button>
              <button type="button" className="pg-btn w-full" disabled={!canSave} onClick={() => save(true)}>Guardar y publicar</button>
              <p className="pg-fg2 text-xs">Un borrador no llega a ninguna clase hasta que lo publiques.</p>
            </>
          ) : (
            <>
              <button type="button" className={`${primaryButton} w-full`} disabled={!canSave} onClick={() => save(false)}>
                {saving ? 'Guardando…' : 'Guardar imagen'}
              </button>
              <p className="pg-fg2 text-xs">La prenda cambia de imagen en todas las clases (quien la tiene verá la nueva).</p>
            </>
          )}
          {mode === 'new' && !name.trim() && source && <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Falta el nombre (paso 4).</p>}
        </section>
      </div>
    </div>
  );
};
