import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Micrófono → nivel de ruido (RMS suavizado) escrito en una ref en cada cuadro. La barra se mueve
 * con transform directo sobre el DOM (sin renders de React); quien la use lee `levelRef` a su ritmo.
 */
export const useNoiseMeter = () => {
  const levelRef = useRef(0);
  const thresholdRef = useRef(0.05);
  const meterRef = useRef<HTMLDivElement | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'on' | 'denied' | 'unsupported'>('idle');

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    levelRef.current = 0;
  }, []);

  const start = useCallback(async () => {
    if (cleanup.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return false;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let frame = 0;
      const loop = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        // Sube rápido y baja despacio: un golpe se nota, el silencio se asienta.
        const prev = levelRef.current;
        levelRef.current = rms > prev ? prev * 0.6 + rms * 0.4 : prev * 0.92 + rms * 0.08;
        const meter = meterRef.current;
        if (meter) meter.style.transform = `scaleX(${Math.min(1, levelRef.current / (thresholdRef.current * 2))})`;
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      cleanup.current = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      setStatus('on');
      return true;
    } catch {
      setStatus('denied');
      return false;
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Ref por callback: la barra se registra sin leer refs durante el render.
  const setMeter = useCallback((el: HTMLDivElement | null) => {
    meterRef.current = el;
  }, []);

  return { start, stop, status, levelRef, thresholdRef, setMeter };
};
