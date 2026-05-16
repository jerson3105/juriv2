import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type FinalBossRaidTheme = {
  id: string;
  bossName: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  badge: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary: string;
    arena: string;
    fog: string;
  };
};

type ScenePulseType = 'idle' | 'hit' | 'boss' | 'victory' | 'defeat';

type FinalBossRaidSceneProps = {
  theme: FinalBossRaidTheme;
  bossHealthPercent: number;
  resolvePercent: number;
  furyPercent: number;
  bossPhase: number;
  pulseToken: number;
  pulseType: ScenePulseType;
  className?: string;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const flashStyles: Record<Exclude<ScenePulseType, 'idle'>, { overlay: string; ring: string; core: string }> = {
  hit: {
    overlay: 'from-emerald-400/28 via-cyan-300/10 to-transparent',
    ring: 'border-emerald-200/60',
    core: 'border-cyan-200/45',
  },
  boss: {
    overlay: 'from-rose-500/30 via-orange-400/12 to-transparent',
    ring: 'border-rose-200/60',
    core: 'border-orange-200/45',
  },
  victory: {
    overlay: 'from-emerald-300/30 via-teal-300/12 to-transparent',
    ring: 'border-emerald-100/70',
    core: 'border-cyan-100/50',
  },
  defeat: {
    overlay: 'from-fuchsia-500/28 via-rose-500/12 to-transparent',
    ring: 'border-fuchsia-200/60',
    core: 'border-rose-200/45',
  },
};

export const FinalBossRaidScene = ({
  theme,
  bossHealthPercent,
  resolvePercent,
  furyPercent,
  bossPhase,
  pulseToken,
  pulseType,
  className,
}: FinalBossRaidSceneProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [flashState, setFlashState] = useState<{ active: boolean; type: ScenePulseType }>({ active: false, type: 'idle' });

  const stateRef = useRef({
    bossHealthPercent: clampPercent(bossHealthPercent),
    resolvePercent: clampPercent(resolvePercent),
    furyPercent: clampPercent(furyPercent),
    bossPhase,
    pulseToken,
    pulseType,
  });

  useEffect(() => {
    stateRef.current = {
      bossHealthPercent: clampPercent(bossHealthPercent),
      resolvePercent: clampPercent(resolvePercent),
      furyPercent: clampPercent(furyPercent),
      bossPhase,
      pulseToken,
      pulseType,
    };
  }, [bossHealthPercent, resolvePercent, furyPercent, bossPhase, pulseToken, pulseType]);

  useEffect(() => {
    if (pulseType === 'idle') {
      return;
    }

    setFlashState({ active: true, type: pulseType });
    const timeoutId = window.setTimeout(() => {
      setFlashState((current) => ({ ...current, active: false }));
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [pulseToken, pulseType]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
    } catch {
      setFallbackMode(true);
      return;
    }

    const container = containerRef.current;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(theme.colors.fog, 0.055);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.25, 7.2);

    const referenceAspect = 3.1;
    const cameraTilt = THREE.MathUtils.degToRad(8.2);
    const subjectRadius = 3.05;
    let cameraBaseY = 1.2;
    let cameraBaseZ = 7.2;
    let cameraDrift = 0.18;
    let dangerDrift = 0.08;
    let cameraFocusX = 0;
    let cameraFocusY = 0.2;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(theme.colors.primary, 18, 30, 2);
    keyLight.position.set(4.5, 3.2, 4.5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(theme.colors.secondary, 14, 24, 2);
    rimLight.position.set(-4.5, 2.5, -3);
    scene.add(rimLight);

    const arenaLight = new THREE.PointLight(theme.colors.tertiary, 10, 18, 2);
    arenaLight.position.set(0, -1.4, 1.8);
    scene.add(arenaLight);

    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.2, 72),
      new THREE.MeshStandardMaterial({
        color: theme.colors.arena,
        roughness: 0.8,
        metalness: 0.12,
        emissive: theme.colors.secondary,
        emissiveIntensity: 0.08,
        transparent: true,
        opacity: 0.96,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.95;
    arenaGroup.add(floor);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: theme.colors.primary, transparent: true, opacity: 0.55 });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.08, 20, 100), ringMaterial);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -1.88;
    arenaGroup.add(outerRing);

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.7, 0.06, 18, 72),
      new THREE.MeshBasicMaterial({ color: theme.colors.tertiary, transparent: true, opacity: 0.45 }),
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -1.86;
    arenaGroup.add(innerRing);

    const bossGroup = new THREE.Group();
    scene.add(bossGroup);

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: theme.colors.primary,
      emissive: theme.colors.primary,
      emissiveIntensity: 1.5,
      roughness: 0.15,
      metalness: 0.8,
      transmission: 0.9, // Da efecto de cristal
      thickness: 2.0,
      ior: 1.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      flatShading: true,
    });

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), coreMaterial);
    core.position.y = 0.2;
    bossGroup.add(core);

    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.78, 0),
      new THREE.MeshBasicMaterial({ color: theme.colors.secondary, wireframe: true, transparent: true, opacity: 0.18 }),
    );
    shell.position.y = 0.2;
    bossGroup.add(shell);

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: theme.colors.tertiary });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), eyeMaterial);
    leftEye.position.set(-0.35, 0.25, 1.1);
    bossGroup.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.35;
    bossGroup.add(rightEye);

    const hornMaterial = new THREE.MeshPhysicalMaterial({
      color: theme.colors.primary,
      emissive: theme.colors.tertiary,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.8,
      thickness: 1.0,
      clearcoat: 1.0,
      flatShading: true,
    });
    const hornGeometry = new THREE.ConeGeometry(0.26, 1.25, 6);
    const leftHorn = new THREE.Mesh(hornGeometry, hornMaterial);
    leftHorn.position.set(-0.8, 1.45, 0.1);
    leftHorn.rotation.z = -0.62;
    leftHorn.rotation.x = 0.35;
    bossGroup.add(leftHorn);

    const rightHorn = leftHorn.clone();
    rightHorn.position.x = 0.8;
    rightHorn.rotation.z = 0.62;
    bossGroup.add(rightHorn);

    const shardGroup = new THREE.Group();
    scene.add(shardGroup);
    const shardGeometry = new THREE.OctahedronGeometry(0.24, 0);
    const shardMaterial = new THREE.MeshPhysicalMaterial({
      color: theme.colors.tertiary,
      emissive: theme.colors.secondary,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8,
      transmission: 0.7,
      thickness: 0.8,
      clearcoat: 1.0,
      flatShading: true,
    });

    const shards: THREE.Mesh[] = [];
    for (let index = 0; index < 10; index += 1) {
      const shard = new THREE.Mesh(shardGeometry, shardMaterial.clone());
      const angle = (index / 10) * Math.PI * 2;
      const radius = 2.2 + (index % 2) * 0.45;
      shard.position.set(Math.cos(angle) * radius, -0.1 + (index % 3) * 0.35, Math.sin(angle) * radius);
      shard.scale.setScalar(0.8 + (index % 4) * 0.18);
      shardGroup.add(shard);
      shards.push(shard);
    }

    const energyHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.03, 16, 100),
      new THREE.MeshBasicMaterial({ color: theme.colors.primary, transparent: true, opacity: 0.8 })
    );
    energyHalo.rotation.x = Math.PI / 2.7;
    energyHalo.position.y = 0.45;
    scene.add(energyHalo);

    const innerEnergyHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.015, 12, 80),
      new THREE.MeshBasicMaterial({ color: theme.colors.secondary, transparent: true, opacity: 0.9 })
    );
    innerEnergyHalo.rotation.x = Math.PI / 2.7;
    innerEnergyHalo.position.y = 0.45;
    scene.add(innerEnergyHalo);

    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(400 * 3);
    for (let index = 0; index < 400; index += 1) {
      particlePositions[index * 3] = (Math.random() - 0.5) * 14;
      particlePositions[index * 3 + 1] = Math.random() * 8 - 2;
      particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: theme.colors.tertiary,
        size: 0.08,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(particles);
    const particleMaterial = particles.material as THREE.PointsMaterial;

    const energyParticlesGeometry = new THREE.BufferGeometry();
    const energyParticlesPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      energyParticlesPositions[index * 3] = (Math.random() - 0.5) * 6;
      energyParticlesPositions[index * 3 + 1] = Math.random() * 6 - 2;
      energyParticlesPositions[index * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    energyParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(energyParticlesPositions, 3));
    const energyParticles = new THREE.Points(
      energyParticlesGeometry,
      new THREE.PointsMaterial({
        color: theme.colors.primary,
        size: 0.04,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(energyParticles);
    const energyParticleMaterial = energyParticles.material as THREE.PointsMaterial;

    const clock = new THREE.Clock();
    const smoothState = {
      bossHealthPercent: clampPercent(bossHealthPercent),
      resolvePercent: clampPercent(resolvePercent),
      furyPercent: clampPercent(furyPercent),
      bossPhase,
    };
    let impactPulse = 0;
    let dangerPulse = 0;
    let winPulse = 0;
    let handledToken = pulseToken;

    const resize = () => {
      if (!renderer || !container) return;
      const { clientWidth, clientHeight } = container;
      const width = Math.max(clientWidth, 1);
      const height = Math.max(clientHeight, 1);
      const aspect = width / height;
      const narrowFactor = THREE.MathUtils.clamp((referenceAspect - aspect) / 1.15, 0, 1);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
      const fitDistance = Math.max(
        subjectRadius / Math.tan(verticalFov / 2),
        subjectRadius / Math.tan(horizontalFov / 2),
      );

      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      cameraFocusX = narrowFactor * 0.34;
      cameraFocusY = 0.2 + narrowFactor * 0.04;
      cameraBaseY = cameraFocusY + Math.sin(cameraTilt) * fitDistance + narrowFactor * 0.12;
      cameraBaseZ = Math.cos(cameraTilt) * fitDistance + narrowFactor * 0.18;
      cameraDrift = 0.16 - narrowFactor * 0.03;
      dangerDrift = 0.07 - narrowFactor * 0.01;
      camera.updateProjectionMatrix();
    };

    resize();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resize);
    }

    const animate = () => {
      if (disposed || !renderer) {
        return;
      }

      frameId = window.requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();
      const state = stateRef.current;

      smoothState.bossHealthPercent += (state.bossHealthPercent - smoothState.bossHealthPercent) * 0.05;
      smoothState.resolvePercent += (state.resolvePercent - smoothState.resolvePercent) * 0.05;
      smoothState.furyPercent += (state.furyPercent - smoothState.furyPercent) * 0.05;
      smoothState.bossPhase += (state.bossPhase - smoothState.bossPhase) * 0.08;

      if (state.pulseToken !== handledToken) {
        handledToken = state.pulseToken;
        if (state.pulseType === 'hit') {
          impactPulse = 1.35;
        } else if (state.pulseType === 'boss' || state.pulseType === 'defeat') {
          dangerPulse = state.pulseType === 'defeat' ? 1.35 : 1.15;
        } else if (state.pulseType === 'victory') {
          winPulse = 1.45;
        }
      }

      impactPulse *= prefersReducedMotion ? 0.82 : 0.9;
      dangerPulse *= prefersReducedMotion ? 0.84 : 0.92;
      winPulse *= prefersReducedMotion ? 0.88 : 0.94;

      const healthFactor = smoothState.bossHealthPercent / 100;
      const furyFactor = smoothState.furyPercent / 100;
      const resolveFactor = smoothState.resolvePercent / 100;
      const baseSpeed = prefersReducedMotion ? 0.25 : 1;
      const floatOffset = Math.sin(elapsed * 1.4 * baseSpeed) * 0.18;
      const shake = impactPulse * 0.34 + dangerPulse * 0.26 + winPulse * 0.08;
      const bossScale = 0.92 + healthFactor * 0.1 + furyFactor * 0.18 + winPulse * 0.1 - impactPulse * 0.05;

      bossGroup.position.set(
        Math.sin(elapsed * 9) * shake,
        0.2 + floatOffset + winPulse * 0.08,
        0,
      );
      bossGroup.rotation.y += (0.004 + furyFactor * 0.005) * baseSpeed;
      bossGroup.rotation.x = Math.sin(elapsed * 0.9 * baseSpeed) * 0.05 + impactPulse * 0.08 - dangerPulse * 0.04;
      bossGroup.rotation.z = Math.sin(elapsed * 0.7 * baseSpeed) * 0.08 + dangerPulse * 0.04;
      bossGroup.scale.setScalar(bossScale);

      coreMaterial.emissiveIntensity = 0.9 + furyFactor * 1.5 + impactPulse * 1.4 + winPulse * 1.6;
      hornMaterial.emissiveIntensity = 0.35 + furyFactor * 0.8 + dangerPulse * 0.5;
      eyeMaterial.color.set(furyFactor > 0.6 ? theme.colors.secondary : theme.colors.tertiary);

      shell.rotation.y -= 0.005 * baseSpeed;
      shell.scale.setScalar(1 + impactPulse * 0.09 + winPulse * 0.05);
      (shell.material as THREE.MeshBasicMaterial).opacity = 0.18 + impactPulse * 0.18 + dangerPulse * 0.16 + winPulse * 0.12;

      shards.forEach((shard, index) => {
        const angle = elapsed * (0.45 + index * 0.03) * baseSpeed + index;
        const radius = 2.1 + Math.sin(elapsed + index) * 0.22 + furyFactor * 0.35;
        shard.position.x = Math.cos(angle) * radius;
        shard.position.z = Math.sin(angle) * radius;
        shard.position.y = -0.2 + Math.sin(elapsed * 1.2 + index) * 0.5 + (index % 3) * 0.22;
        shard.rotation.x += 0.01;
        shard.rotation.y += 0.018;
        shard.scale.setScalar(0.75 + (index % 4) * 0.12 + impactPulse * 0.08);
        const shardMesh = shard.material as THREE.MeshStandardMaterial;
        shardMesh.emissiveIntensity = 0.65 + furyFactor * 0.7 + winPulse * 0.45;
      });

      energyHalo.rotation.z += 0.012 * baseSpeed;
      energyHalo.rotation.y = Math.sin(elapsed * 0.6) * 0.35;
      energyHalo.scale.setScalar(1 + furyFactor * 0.12 + impactPulse * 0.12 + winPulse * 0.08);
      (energyHalo.material as THREE.MeshBasicMaterial).opacity = 0.45 + furyFactor * 0.35 + winPulse * 0.2;

      innerEnergyHalo.rotation.z -= 0.018 * baseSpeed;
      innerEnergyHalo.rotation.y = Math.cos(elapsed * 0.7) * 0.25;
      innerEnergyHalo.scale.setScalar(1 + furyFactor * 0.18 + impactPulse * 0.08 + winPulse * 0.12);
      (innerEnergyHalo.material as THREE.MeshBasicMaterial).opacity = 0.55 + furyFactor * 0.3 + winPulse * 0.2;

      outerRing.rotation.z += 0.005 * baseSpeed;
      innerRing.rotation.z -= 0.008 * baseSpeed;
      outerRing.scale.setScalar(1 + dangerPulse * 0.08 + winPulse * 0.06);
      innerRing.scale.setScalar(1 + impactPulse * 0.08 + winPulse * 0.04);
      ringMaterial.opacity = 0.28 + resolveFactor * 0.3 + winPulse * 0.18;
      (innerRing.material as THREE.MeshBasicMaterial).opacity = 0.22 + furyFactor * 0.24;

      arenaGroup.rotation.z = Math.sin(elapsed * 0.3) * 0.02 + dangerPulse * 0.03;
      particles.rotation.y += 0.0015 * baseSpeed;
      particles.rotation.x = Math.sin(elapsed * 0.1) * 0.15;
      particleMaterial.opacity = 0.4 + furyFactor * 0.22 + impactPulse * 0.25 + winPulse * 0.22;
      particleMaterial.size = 0.06 + impactPulse * 0.04 + dangerPulse * 0.02 + winPulse * 0.04;

      energyParticles.rotation.y -= 0.002 * baseSpeed;
      energyParticles.position.y = (elapsed * 0.5) % 3;
      energyParticleMaterial.opacity = 0.5 + furyFactor * 0.4 + impactPulse * 0.3;
      energyParticleMaterial.size = 0.04 + furyFactor * 0.05 + dangerPulse * 0.03;

      keyLight.intensity = 12 + furyFactor * 9 + impactPulse * 8 + winPulse * 5;
      rimLight.intensity = 8 + dangerPulse * 6 + furyFactor * 5;
      arenaLight.intensity = 5 + resolveFactor * 5 + winPulse * 3;

      camera.position.x = Math.sin(elapsed * 0.6) * cameraDrift + dangerPulse * dangerDrift;
      camera.position.y = cameraBaseY + Math.cos(elapsed * 0.5) * 0.08;
      camera.position.z = cameraBaseZ - impactPulse * 0.2 + dangerPulse * 0.22 - winPulse * 0.1;
      camera.lookAt(cameraFocusX, cameraFocusY, 0);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', resize);
      }

      scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;
        if ('geometry' in mesh && mesh.geometry) {
          mesh.geometry.dispose();
        }
        if ('material' in mesh && mesh.material) {
          const material = mesh.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry.dispose());
          } else {
            material.dispose();
          }
        }
      });

      particleGeometry.dispose();
      energyParticlesGeometry.dispose();
      renderer?.dispose();
      container.innerHTML = '';
    };
  }, [theme, bossHealthPercent, resolvePercent, furyPercent, bossPhase, pulseToken]);

  return (
    <div className={`relative overflow-hidden rounded-[28px] bg-slate-950 ${className || ''}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.24),_transparent_55%)]" />
      <div className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(140deg, ${theme.colors.primary}22 0%, ${theme.colors.secondary}12 48%, ${theme.colors.fog} 100%)` }} />
      {flashState.type !== 'idle' && (
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${flashState.active ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${flashStyles[flashState.type].overlay}`} />
          <div className={`absolute inset-[8%] rounded-[34px] border transition-all duration-500 ${flashStyles[flashState.type].ring} ${flashState.active ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`} />
          <div className={`absolute inset-[18%] rounded-full border transition-all duration-500 ${flashStyles[flashState.type].core} ${flashState.active ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} />
        </div>
      )}
      {fallbackMode ? (
        <div className="relative flex h-full items-center justify-center px-6 text-center text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/60">Arena del jefe</p>
            <h3 className="mt-3 text-3xl font-black">{theme.bossName}</h3>
            <p className="mt-2 max-w-md text-sm text-white/75">{theme.subtitle}. Tu navegador no pudo abrir la escena 3D, pero el combate sigue disponible.</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="absolute inset-0" />
      )}
    </div>
  );
};