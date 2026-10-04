import { useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ChevronRight, Coins, HeartHandshake, Star } from 'lucide-react';
import { ConstellationArt } from '../components/auth/SpaceScene';
import { AudienceTabs } from '../components/landing/AudienceTabs';
import { HowItWorksDemo } from '../components/landing/HowItWorksDemo';
import { Reveal } from '../components/landing/Reveal';
import type { AudienceId } from '../components/landing/audiences';
import {
  EASE_OUT, btnCompact, btnPrimary, btnSecondary, container, h2, lead, linkQuiet, nightFocus, sectionPad,
} from '../components/landing/landingStyles';

// Landing pública (/about) para docentes, estudiantes y directivos. De día arriba (explica con calma, Jiro nítido);
// anochece una sola vez en el Observatorio y el cierre. Nada se mueve en reposo: cada bloque aparece una vez y la
// única animación con protagonismo es la demostración de «Así funciona».

const navLinks = [
  { label: 'Así funciona', href: '#como-funciona' },
  { label: 'Para quién', href: '#para-quien' },
  { label: 'Observatorio', href: '#observatorio' },
];

const steps = [
  { title: 'Crea tu clase', text: 'A mano o con ayuda de Jiro, que te propone comportamientos, insignias y premios para empezar.' },
  { title: 'Tus estudiantes entran', text: 'Con el código de la clase y un PIN. No necesitan correo.' },
  { title: 'Cada logro se ve', text: 'Cuando reconoces algo, tu estudiante gana experiencia y oro, y ve cómo avanza. Pruébalo en el ejemplo.' },
];

// Las tres «monedas» explicadas sin jerga: la energía es convivencia, nunca una nota.
const currencies = [
  { icon: Star, name: 'Experiencia (XP)', text: 'Se gana al participar y esforzarse. Con ella se sube de nivel.' },
  { icon: Coins, name: 'Oro', text: 'Se gana en clase y se usa en premios, ropa para el personaje o figuritas. No se compra con dinero.' },
  { icon: HeartHandshake, name: 'Energía (HP)', text: 'Muestra cómo va la convivencia; no es una nota. Si llega a cero, el personaje descansa y vuelve con una misión de recuperación.' },
];

const activities = [
  { cover: 'descanso', name: 'Descanso de Jiro', text: 'Si el aula está en calma, Jiro sueña una constelación.' },
  { cover: 'estrellas', name: 'Estrellas en Movimiento', text: 'Verdadero o falso: de pie o agachados.' },
  { cover: 'conquista', name: 'Conquista del Cielo', text: 'Los equipos responden juntos para despejar la Niebla.' },
];

const doors = [
  { who: 'Soy docente', action: 'Crear mi cuenta', to: '/registro/docente' },
  { who: 'Soy estudiante', action: 'Tengo un código de clase', to: '/unirse' },
  { who: 'Soy familia', action: 'Unirme a la clase', to: '/registro/familia' },
];

export const AboutPage = () => {
  const [audience, setAudience] = useState<AudienceId>('docentes');
  const reduce = useReducedMotion();
  // La constelación se monta al verse: su trazo (CSS) corre al montar y respeta «reducir movimiento».
  const constellationRef = useRef<HTMLDivElement>(null);
  const constellationInView = useInView(constellationRef, { once: true, margin: '-100px' });

  const showDirectors = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setAudience('directivos');
    document.getElementById('para-quien')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a href="#contenido" className="sr-only rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <nav aria-label="Principal" className={`${container} flex h-16 items-center justify-between gap-4`}>
          <Link to="/about" className="flex min-h-11 items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <img src="/logo.png" alt="Juried" width={1920} height={631} className="h-8 w-auto" />
          </Link>
          <ul className="hidden items-center gap-8 lg:flex">
            {navLinks.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-slate-600 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 [@media(hover:hover)]:hover:text-slate-900">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className={`${linkQuiet} px-2 text-sm`}>Entrar</Link>
            <Link to="/register" className={btnCompact}>Crear mi cuenta</Link>
          </div>
        </nav>
      </header>

      <main id="contenido">
        {/* Qué es y para quién. El texto no se anima: se lee al instante. */}
        <section aria-labelledby="hero-title">
          <div className={`${container} grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24`}>
            <div className="lg:col-span-7">
              <p className="text-sm font-semibold text-indigo-700">Gamificación educativa para el aula</p>
              <h1 id="hero-title" className="mt-4 max-w-[18ch] text-balance text-4xl font-bold leading-[1.1] tracking-[-0.025em] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
                La clase como una aventura. El avance, a la vista.
              </h1>
              <p className={`${lead} mt-6 text-slate-600 sm:text-xl`}>
                El docente guía la clase, cada estudiante avanza con su propio personaje, y la familia y la dirección ven cómo va.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/registro/docente" className={btnPrimary}>
                  Crear mi cuenta de docente
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
                <Link to="/unirse" className={btnSecondary}>Tengo un código de clase</Link>
              </div>
              <a href="#para-quien" onClick={showDirectors} className={`${linkQuiet} mt-4`}>
                ¿Diriges un colegio? Conoce «Mi Escuela»
              </a>
            </div>
            <motion.div
              className="flex justify-center lg:col-span-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.1 }}
            >
              <img src="/assets/jiro/acceso/login.webp" alt="Jiro, la mascota de Juried, te saluda" width={553} height={900} className="h-64 w-auto sm:h-80 lg:h-[26rem]" />
            </motion.div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="como-title" className="scroll-mt-16 bg-slate-50">
          <div className={`${container} ${sectionPad}`}>
            <Reveal>
              <h2 id="como-title" className={`${h2} text-slate-900`}>Así funciona, en tres pasos</h2>
              <p className={`${lead} text-slate-600`}>Lo esencial se entiende en un minuto. Lo demás se activa cuando lo necesites.</p>
            </Reveal>

            <div className="mt-12 grid items-center gap-12 lg:grid-cols-12">
              <ol className="space-y-8 border-l border-slate-200 pl-6 lg:col-span-6">
                {steps.map((step, index) => (
                  <li key={step.title} className="relative">
                    <span className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" />
                    <Reveal delay={index * 0.05}>
                      <p className="text-sm font-semibold text-indigo-700">Paso {index + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold leading-7 text-slate-900">{step.title}</h3>
                      <p className="mt-1 max-w-prose text-base leading-relaxed text-slate-600">{step.text}</p>
                    </Reveal>
                  </li>
                ))}
              </ol>
              <Reveal delay={0.1} className="lg:col-span-6">
                <HowItWorksDemo />
              </Reveal>
            </div>

            <Reveal className="mt-16">
              <h3 className="text-lg font-semibold leading-7 text-slate-900">Lo que verás en Juried</h3>
              <dl className="mt-6 grid gap-8 sm:grid-cols-3">
                {currencies.map((item) => (
                  <div key={item.name} className="border-t border-slate-200 pt-6">
                    <dt className="flex items-center gap-3 font-semibold text-slate-900">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700" aria-hidden="true">
                        <item.icon size={20} />
                      </span>
                      {item.name}
                    </dt>
                    <dd className="mt-3 text-base leading-relaxed text-slate-600">{item.text}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        <section id="para-quien" aria-labelledby="para-title" className="scroll-mt-16">
          <div className={`${container} ${sectionPad}`}>
            <Reveal>
              <h2 id="para-title" className={`${h2} text-slate-900`}>Una plataforma, tres miradas</h2>
              <p className={`${lead} text-slate-600`}>Elige quién eres y mira lo que Juried hace por ti.</p>
            </Reveal>
            <Reveal className="mt-10">
              <AudienceTabs value={audience} onChange={setAudience} />
            </Reveal>
            <p className="mt-12 text-base text-slate-600">
              ¿Eres familia?{' '}
              <Link to="/registro/familia" className={linkQuiet}>Únete con el código o el QR de la clase</Link>
            </p>
          </div>
        </section>

        {/* Anochece: el cielo del Observatorio sigue hasta el pie de página. */}
        <section id="observatorio" aria-labelledby="obs-title" className="obs-sky scroll-mt-16 text-white">
          <div className={`${container} ${sectionPad}`}>
            <Reveal>
              <p className="text-sm font-semibold text-indigo-200">Observatorio de Jiro</p>
              <h2 id="obs-title" className={`${h2} mt-3 text-white`}>Actividades para jugar juntos en clase</h2>
              <p className={`${lead} text-indigo-100`}>
                Se proyectan en la pizarra y se juegan con el cuerpo, en equipo o en calma, sin preparar nada desde cero.
              </p>
            </Reveal>
            <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {activities.map((activity, index) => (
                <li key={activity.cover}>
                  <Reveal delay={index * 0.05}>
                    <img
                      src={`/assets/jiro/actividades/${activity.cover}.webp`}
                      alt=""
                      width={800}
                      height={600}
                      loading="lazy"
                      className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-white/10"
                    />
                    <h3 className="mt-4 text-lg font-semibold leading-7 text-white">{activity.name}</h3>
                    <p className="mt-1 text-base leading-relaxed text-indigo-100">{activity.text}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
            <p className="mt-10 max-w-2xl text-base leading-relaxed text-indigo-200">
              Y también: El Error de Jiro, Correo Estelar, Pergaminos del Aula y Expediciones por paradas.
            </p>
          </div>
        </section>

        <section aria-labelledby="entrar-title" className="obs-sky border-t border-white/10 text-white">
          <div className={`${container} ${sectionPad} text-center`}>
            <div ref={constellationRef} className="mx-auto h-[90px] w-32" aria-hidden="true">
              {constellationInView && <ConstellationArt id="cruz-del-sur" draw className="h-full w-full" />}
            </div>
            <h2 id="entrar-title" className={`${h2} mx-auto mt-6 text-white`}>¿Por dónde entras?</h2>
            <p className={`${lead} mx-auto text-indigo-100`}>Cada uno tiene su puerta.</p>
            <ul className="mx-auto mt-10 grid max-w-4xl gap-4 text-left md:grid-cols-3">
              {doors.map((door) => (
                <li key={door.to}>
                  <Link
                    to={door.to}
                    className={`flex h-full min-h-[96px] flex-col justify-between gap-3 rounded-2xl border border-white/15 p-5 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] [@media(hover:hover)]:hover:bg-white/5 ${nightFocus}`}
                  >
                    <span className="text-sm font-semibold text-indigo-200">{door.who}</span>
                    <span className="flex items-center justify-between gap-2 text-lg font-semibold text-white">
                      {door.action}
                      <ChevronRight size={18} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-base text-indigo-100">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className={`inline-flex min-h-11 items-center rounded-md font-semibold text-white underline underline-offset-4 ${nightFocus}`}>Entrar</Link>
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-indigo-200">
              ¿Diriges un colegio? Empieza con una cuenta de docente y crea tu escuela en «Mi Escuela».
            </p>
          </div>
        </section>
      </main>

      <footer className="obs-sky border-t border-white/10">
        <div className={`${container} flex flex-col items-center justify-between gap-4 py-8 text-center sm:flex-row sm:text-left`}>
          <div className="flex items-center gap-3">
            <img src="/logo-solo.png" alt="" width={400} height={400} className="h-8 w-8" />
            <p className="text-sm text-indigo-200">
              <span className="font-semibold text-white">Juried</span> · Gamificación educativa para el aula
            </p>
          </div>
          <nav aria-label="Pie de página" className="flex items-center gap-6">
            <Link to="/privacy" className={`inline-flex min-h-11 items-center rounded-md text-sm text-indigo-200 [@media(hover:hover)]:hover:text-white ${nightFocus}`}>Privacidad</Link>
            <Link to="/login" className={`inline-flex min-h-11 items-center rounded-md text-sm text-indigo-200 [@media(hover:hover)]:hover:text-white ${nightFocus}`}>Entrar</Link>
          </nav>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} Juried</p>
        </div>
      </footer>
    </div>
  );
};
