import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Coins,
  Compass,
  FlaskConical,
  GraduationCap,
  Heart,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  Rocket,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';

const teacherBenefits = [
  {
    icon: Target,
    title: 'Haz visible la participación diaria',
    description:
      'Convierte esfuerzo y participación en progreso visible con XP, HP, GP, insignias y rankings.',
    support: 'Puntos, niveles, insignias y rankings',
    accent: 'from-sky-100 via-cyan-50 to-white',
    iconClass: 'bg-sky-100 text-sky-700',
  },
  {
    icon: ClipboardList,
    title: 'Ordena seguimiento y evaluación',
    description:
      'Gestiona estudiantes, asistencia y calificaciones desde un mismo lugar.',
    support: 'Seguimiento, asistencia e historial',
    accent: 'from-emerald-100 via-teal-50 to-white',
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    icon: Rocket,
    title: 'Activa clases memorables en minutos',
    description:
      'Activa actividades, expediciones y preguntas sin preparar cada clase desde cero.',
    support: 'Actividades, expediciones y bancos de preguntas',
    accent: 'from-violet-100 via-fuchsia-50 to-white',
    iconClass: 'bg-violet-100 text-violet-700',
  },
  {
    icon: MessageCircle,
    title: 'Mantén alineada a tu comunidad',
    description:
      'Mantén avisos y conversaciones dentro del mismo ecosistema del aula.',
    support: 'Avisos, chat y experiencia multirol',
    accent: 'from-amber-100 via-orange-50 to-white',
    iconClass: 'bg-amber-100 text-amber-700',
  },
];

const workflowSteps = [
  {
    number: '01',
    title: 'Crea tu clase con onboarding guiado',
    description:
      'Configura el aula y empieza sin una curva de entrada pesada.',
  },
  {
    number: '02',
    title: 'Agrega estudiantes y activa progreso',
    description:
      'Cada estudiante entra con progreso visible desde el primer día.',
  },
  {
    number: '03',
    title: 'Configura tu motor de motivación',
    description:
      'Activa comportamientos, clanes, tienda e insignias según tu estilo de aula.',
  },
  {
    number: '04',
    title: 'Dinamiza y sigue todo desde el mismo lugar',
    description:
      'Mueve clase, seguimiento y comunicación sin salir de Juried.',
  },
];

const moduleGroups = [
  {
    title: 'Operación diaria del aula',
    description: 'Lo esencial para organizar y seguir tu aula.',
    accent: 'from-cyan-100 via-sky-50 to-white',
    items: [
      { icon: Users, name: 'Estudiantes', text: 'Perfiles y progreso.' },
      { icon: CheckCircle2, name: 'Asistencia', text: 'Registro diario.' },
      { icon: ClipboardList, name: 'Calificaciones', text: 'Seguimiento académico.' },
    ],
  },
  {
    title: 'Motivación con economía y equipos',
    description: 'Haz tangible el avance y sostén el interés.',
    accent: 'from-emerald-100 via-teal-50 to-white',
    items: [
      { icon: Trophy, name: 'Insignias y rankings', text: 'Reconoce logros.' },
      { icon: ShoppingBag, name: 'Tienda', text: 'Convierte GP en recompensas.' },
      { icon: Swords, name: 'Clanes y coleccionables', text: 'Activa pertenencia y competencia sana.' },
    ],
  },
  {
    title: 'Experiencias que mueven la clase',
    description: 'Convierte una sesión común en una experiencia activa.',
    accent: 'from-violet-100 via-fuchsia-50 to-white',
    items: [
      { icon: Sparkles, name: 'Actividades gamificadas', text: 'Ruleta, torneos y más.' },
      { icon: MapIcon, name: 'Expediciones', text: 'Mapas, misiones y energía.' },
      { icon: BookOpen, name: 'Preguntas e historia de clase', text: 'Bancos reutilizables y narrativa.' },
    ],
  },
  {
    title: 'Comunicación y continuidad',
    description: 'Comunica y da continuidad fuera de clase.',
    accent: 'from-amber-100 via-orange-50 to-white',
    items: [
      { icon: Megaphone, name: 'Avisos', text: 'Mensajes para toda la comunidad.' },
      { icon: MessageCircle, name: 'Chat grupal', text: 'Conversación dentro del aula.' },
      { icon: GraduationCap, name: 'Experiencia para estudiantes y familias', text: 'Vistas para seguir el proceso.' },
    ],
  },
];

const progressionLoop = [
  {
    icon: Zap,
    token: 'XP',
    title: 'Experiencia',
    description: 'Hace visible aprendizaje y participación.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    icon: Heart,
    token: 'HP',
    title: 'Vida del personaje',
    description: 'Refuerza hábitos y consecuencias.',
    color: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  {
    icon: Coins,
    token: 'GP',
    title: 'Moneda del aula',
    description: 'Conecta esfuerzo con recompensas.',
    color: 'border-amber-200 bg-amber-50 text-amber-700',
  },
];

const characterClasses = [
  {
    name: 'Guardián',
    icon: Shield,
    description: 'Refuerza equipo y pertenencia.',
    accent: 'from-sky-500 to-blue-500',
  },
  {
    name: 'Arcano',
    icon: Wand2,
    description: 'Une curiosidad e identidad.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    name: 'Explorador',
    icon: Compass,
    description: 'Empuja misiones y aventura.',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Alquimista',
    icon: FlaskConical,
    description: 'Da sentido a recursos y recompensas.',
    accent: 'from-amber-500 to-orange-500',
  },
];

const navLinks = [
  { label: 'Beneficios', href: '#beneficios' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Módulos', href: '#modulos' },
];

const revealProps = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
};

export const AboutPage = () => {
  const surfacePanel = 'rounded-[32px] border border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(99,102,241,0.10)] backdrop-blur-sm';
  const heroPills = [
    { icon: Zap, label: 'Puntos y niveles', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    { icon: Swords, label: 'Clanes y retos', className: 'border-violet-200 bg-violet-50 text-violet-700' },
    { icon: MapIcon, label: 'Expediciones', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    { icon: Megaphone, label: 'Avisos y chat', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  ];

  const heroCards = [
    {
      icon: Zap,
      title: '+50 XP',
      subtitle: 'Respuesta correcta',
      className: 'left-0 top-8 sm:left-4',
      palette: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      delay: 0,
    },
    {
      icon: Trophy,
      title: 'Insignia nueva',
      subtitle: 'Explorador Nato',
      className: 'right-2 top-4 sm:right-6',
      palette: 'border-amber-200 bg-amber-50 text-amber-700',
      delay: 0.4,
    },
    {
      icon: Users,
      title: '4 clanes',
      subtitle: 'Competencia sana',
      className: 'left-2 bottom-16 sm:left-6',
      palette: 'border-violet-200 bg-violet-50 text-violet-700',
      delay: 0.2,
    },
    {
      icon: Compass,
      title: 'Expedición lista',
      subtitle: 'Mapa + preguntas',
      className: 'bottom-10 right-0 sm:right-4',
      palette: 'border-sky-200 bg-sky-50 text-sky-700',
      delay: 0.6,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 text-slate-900">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_28%),radial-gradient(circle_at_80%_18%,_rgba(56,189,248,0.14),_transparent_22%),radial-gradient(circle_at_50%_75%,_rgba(99,102,241,0.12),_transparent_30%)]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <nav className="fixed left-0 right-0 top-0 z-50 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-3xl border border-white/85 bg-white/82 px-4 py-3 shadow-[0_18px_45px_rgba(59,130,246,0.10)] backdrop-blur-2xl sm:px-6">
          <Link to="/about" className="flex items-center gap-3">
            <img src="/logo.png" alt="Juried" className="h-10 w-auto" />
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-transform hover:-translate-y-0.5 sm:px-5"
            >
              Comenzar
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        <section className="px-6 pb-20 pt-32 sm:px-8 lg:px-10 lg:pt-36">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm">
                <Sparkles size={16} />
                Gamificación lista para llevar al aula
              </div>

              <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[0.94] text-slate-900 sm:text-5xl lg:text-[64px]">
                Haz que tu clase se sienta como una{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                  aventura con progreso real.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
                Puntos, clanes, expediciones e insignias para motivar y seguir mejor el avance del aula.
              </p>

              <div className="mt-7 flex flex-wrap gap-2.5">
                {heroPills.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm ${item.className}`}
                    >
                      <Icon size={15} />
                      {item.label}
                    </div>
                  );
                })}
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-sky-500 px-7 py-4 text-base font-bold text-white shadow-2xl shadow-blue-500/20 transition-transform hover:-translate-y-0.5"
                >
                  Crear cuenta gratis
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#beneficios"
                  className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-700 shadow-[0_14px_35px_rgba(59,130,246,0.08)] transition-colors hover:border-slate-300 hover:text-slate-900"
                >
                  Ver beneficios para docentes
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 32, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              className="relative"
            >
              <div className="absolute -left-10 top-10 hidden h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl lg:block" />
              <div className="absolute -right-8 bottom-8 hidden h-44 w-44 rounded-full bg-blue-500/20 blur-3xl lg:block" />

              <div className={`relative overflow-hidden p-5 sm:p-7 ${surfacePanel}`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.10),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(56,189,248,0.12),_transparent_28%)]" />
                <div className="absolute left-[12%] top-[20%] hidden h-28 w-28 rounded-full border-2 border-dashed border-sky-200/80 lg:block" />
                <div className="absolute bottom-[18%] right-[18%] hidden h-20 w-20 rounded-full border-2 border-dashed border-violet-200/80 lg:block" />

                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 shadow-sm">
                      Jiro convierte la clase en una aventura visible
                    </div>
                    <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm">
                      1 aula, muchas formas de jugar
                    </div>
                  </div>

                  <div className="relative mt-8 flex min-h-[470px] items-center justify-center">
                    {heroCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <motion.div
                          key={item.title}
                          animate={{ y: [0, -8, 0] }}
                          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: item.delay }}
                          className={`absolute z-20 w-[154px] rounded-3xl border px-4 py-3 shadow-[0_16px_30px_rgba(99,102,241,0.12)] ${item.className} ${item.palette}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/75 shadow-sm">
                              <Icon size={17} />
                            </div>
                            <div>
                              <p className="text-sm font-black leading-tight">{item.title}</p>
                              <p className="text-[11px] font-semibold opacity-75">{item.subtitle}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-100 via-sky-100 to-cyan-100 blur-2xl" />

                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 p-4 shadow-[0_30px_70px_rgba(59,130,246,0.22)]"
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.30),_transparent_30%)]" />
                        <div className="relative rounded-[28px] border border-white/60 bg-white/88 px-5 py-4 text-center backdrop-blur-sm">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-700">Mision del dia</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                            Participar, cooperar y ganar recompensas.
                          </p>
                        </div>
                        <motion.img
                          src="/assets/mascot/jiro.webp"
                          alt="Jiro, la mascota de Juried"
                          className="relative mx-auto mt-4 h-64 w-auto drop-shadow-2xl sm:h-72"
                          animate={{ rotate: [0, -2, 2, 0] }}
                          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </motion.div>

                      <div className="mt-5 grid w-full max-w-[360px] grid-cols-3 gap-3">
                        {[
                          { value: '32', label: 'estudiantes', color: 'text-sky-700 bg-sky-50 border-sky-200' },
                          { value: '4', label: 'clanes', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                          { value: '12', label: 'experiencias', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-2xl border px-3 py-3 text-center shadow-sm ${item.color}`}>
                            <p className="text-2xl font-black leading-none">{item.value}</p>
                            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em]">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="beneficios" className="px-6 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <motion.div {...revealProps} transition={{ duration: 0.5 }} className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-sky-700/70">Beneficios para docentes</p>
              <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-5xl">
                Gestiona mejor. Motiva más.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Juried une seguimiento, motivación y experiencias sin repartir tu clase en varias herramientas.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {teacherBenefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  {...revealProps}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="relative overflow-hidden rounded-[30px] border border-white/80 bg-white/88 p-6 shadow-[0_20px_50px_rgba(99,102,241,0.08)]"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${benefit.accent}`} />
                  <div className="relative">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${benefit.iconClass}`}>
                      <benefit.icon size={24} />
                    </div>
                    <h3 className="mt-5 text-2xl font-black text-slate-900">{benefit.title}</h3>
                    <p className="mt-4 text-base leading-7 text-slate-600">{benefit.description}</p>
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                      {benefit.support}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="px-6 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <motion.div
              {...revealProps}
              transition={{ duration: 0.5 }}
              className={`${surfacePanel} p-6 sm:p-8`}
            >
              <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700/70">Cómo funciona</p>
              <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">
                Empieza rápido y activa más solo cuando lo necesites.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Un docente nuevo puede entrar rápido; uno avanzado puede profundizar después.
              </p>

              <div className="mt-8 rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700/70">Lo que ya contempla Juried</p>
                <ul className="mt-4 space-y-3">
                  {[
                    'Onboarding guiado para crear clase y empezar.',
                    'Módulos activables según el momento del aula.',
                    'Gestión, juego y comunicación en el mismo lugar.',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-emerald-800">
                      <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.number}
                  {...revealProps}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                  className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_45px_rgba(99,102,241,0.08)] sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-lg font-black text-blue-700">
                      {step.number}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{step.title}</h3>
                      <p className="mt-2 text-base leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="modulos" className="px-6 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <motion.div {...revealProps} transition={{ duration: 0.5 }} className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-violet-700/70">Módulos reales de Juried</p>
              <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-5xl">
                Módulos que ya viven dentro de Juried.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                No son promesas: son herramientas reales de la plataforma.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-5 xl:grid-cols-2">
              {moduleGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.title}
                  {...revealProps}
                  transition={{ duration: 0.45, delay: groupIndex * 0.08 }}
                  className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/88 p-6 shadow-[0_20px_50px_rgba(99,102,241,0.08)]"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${group.accent}`} />
                  <div className="relative">
                    <h3 className="text-2xl font-black text-slate-900">{group.title}</h3>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{group.description}</p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      {group.items.map((item, itemIndex) => (
                        <div key={item.name} className={`rounded-2xl border p-4 ${itemIndex % 4 === 0 ? 'border-sky-200 bg-sky-50/85' : itemIndex % 4 === 1 ? 'border-emerald-200 bg-emerald-50/85' : itemIndex % 4 === 2 ? 'border-violet-200 bg-violet-50/85' : 'border-amber-200 bg-amber-50/85'}`}>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/80 text-slate-700 shadow-sm">
                            <item.icon size={19} />
                          </div>
                          <p className="mt-4 text-base font-black text-slate-900">{item.name}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <motion.div
              {...revealProps}
              transition={{ duration: 0.5 }}
              className={`${surfacePanel} p-6 sm:p-8`}
            >
              <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-700/70">Lo que reciben tus estudiantes</p>
              <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">
                Progreso fácil de entender para tus estudiantes.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Para ellos se siente como aventura; para ti, como seguimiento más claro.
              </p>

              <div className="mt-8 space-y-3">
                {progressionLoop.map((item) => (
                  <div key={item.token} className={`rounded-[24px] border p-4 ${item.color}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">{item.token}</p>
                        <p className="text-lg font-black text-slate-900">{item.title}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{item.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...revealProps}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="rounded-[32px] border border-white/80 bg-gradient-to-br from-white to-indigo-50 p-6 shadow-[0_22px_60px_rgba(99,102,241,0.10)] sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.3em] text-sky-700/70">Identidad del estudiante</p>
                  <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">Clases que vuelven más memorable la experiencia</h2>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                  Los personajes suman identidad sin complicar tu gestión.
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {characterClasses.map((charClass, index) => (
                  <motion.div
                    key={charClass.name}
                    {...revealProps}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                    className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${charClass.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.14]`} />
                    <div className="relative">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${charClass.accent} text-white shadow-lg`}>
                        <charClass.icon size={24} />
                      </div>
                      <h3 className="mt-5 text-xl font-black text-slate-900">{charClass.name}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{charClass.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-6 py-20 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <motion.div
              {...revealProps}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden rounded-[36px] border border-slate-800 bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 px-6 py-10 text-center shadow-[0_28px_70px_rgba(37,99,235,0.28)] sm:px-10"
            >
              <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-white/12 blur-3xl" />
              <div className="absolute -bottom-20 left-0 h-48 w-48 rounded-full bg-white/12 blur-3xl" />

              <div className="relative">
                <BookOpen className="mx-auto h-12 w-12 text-white/80" />
                <h2 className="mt-6 text-3xl font-black text-white sm:text-5xl">
                  Más claridad para ti. Más motivación para tu clase.
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/82">
                  Empieza con lo esencial y activa más cuando lo necesites.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-4 text-base font-black text-blue-600 transition-colors hover:bg-slate-100"
                  >
                    Crear cuenta gratis
                    <ChevronRight size={18} />
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-2xl border border-white/35 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Entrar a Juried
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/70 bg-white/45 px-6 py-8 backdrop-blur-sm sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Juried" className="h-9 w-auto opacity-80" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Juried</p>
              <p className="text-xs text-slate-500">Gamificación educativa para el aula.</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Juried. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};
