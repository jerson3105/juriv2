import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Trophy, 
  Shield, 
  Wand2, 
  Compass, 
  FlaskConical,
  Swords,
  ShoppingBag,
  Target,
  Sparkles,
  ChevronRight,
  Zap,
  Heart,
  Coins,
  BookOpen,
  TrendingUp
} from 'lucide-react';

export const AboutPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden">
      
      {/* Navbar flotante */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between bg-slate-900/80 backdrop-blur-xl rounded-2xl px-6 py-3 border border-slate-700/50">
          <Link to="/login" className="flex items-center gap-3">
            <img src="/logo.png" alt="Juried" className="h-10 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-5 py-2.5 text-slate-300 hover:text-white font-medium transition-colors"
            >
              Entrar
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl transition-all"
            >
              Comenzar
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16">
        {/* Fondo con formas orgánicas - colores del logo */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 -left-32 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-80 h-80 bg-sky-400/15 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 bg-blue-500/15 text-sky-400 px-4 py-2 rounded-full text-sm font-medium mb-6 border border-blue-500/20">
              <Sparkles size={16} />
              Gamificación para el aula
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Convierte el aprendizaje en una{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-sky-400">
                aventura épica
              </span>
            </h1>
            
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Juried transforma tu clase en un mundo de juego donde cada logro cuenta. 
              Tus estudiantes ganan experiencia, suben de nivel y desbloquean recompensas 
              mientras aprenden.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2 px-7 py-4 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
              >
                Empezar gratis
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#como-funciona"
                className="px-7 py-4 text-slate-400 hover:text-white font-medium transition-colors"
              >
                Ver cómo funciona
              </a>
            </div>
          </motion.div>

          {/* Visual - Cards flotantes */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full h-[500px]">
              {/* Card principal */}
              <motion.div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-gradient-to-br from-blue-500 to-sky-500 rounded-3xl p-6 shadow-2xl shadow-blue-500/20"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs">¡Nuevo logro!</p>
                    <p className="text-white font-bold">Explorador Nato</p>
                  </div>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-amber-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: '75%' }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                  />
                </div>
              </motion.div>

              {/* Card XP */}
              <motion.div 
                className="absolute top-8 left-4 bg-slate-800/95 backdrop-blur rounded-2xl p-4 shadow-xl border border-slate-700"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Experiencia</p>
                    <p className="text-white font-bold">+50 XP</p>
                  </div>
                </div>
              </motion.div>

              {/* Card Nivel */}
              <motion.div 
                className="absolute bottom-16 right-4 bg-slate-800/95 backdrop-blur rounded-2xl p-4 shadow-xl border border-slate-700"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Nivel actual</p>
                    <p className="text-white font-bold">Nivel 12</p>
                  </div>
                </div>
              </motion.div>

              {/* Card GP */}
              <motion.div 
                className="absolute top-24 right-8 bg-slate-800/95 backdrop-blur rounded-2xl p-4 shadow-xl border border-slate-700"
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Coins className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Oro ganado</p>
                    <p className="text-white font-bold">230 GP</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats rápidos */}
      <section className="py-12 border-y border-slate-800">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8">
            {[
              { icon: Zap, value: 'XP', label: 'Experiencia para subir de nivel', color: 'text-emerald-400 bg-emerald-500/10' },
              { icon: Heart, value: 'HP', label: 'Vida del personaje', color: 'text-rose-400 bg-rose-500/10' },
              { icon: Coins, value: 'GP', label: 'Moneda para la tienda', color: 'text-amber-400 bg-amber-500/10' },
            ].map((stat) => (
              <div key={stat.value} className="text-center">
                <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon size={28} />
                </div>
                <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Características */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Todo para motivar a tus estudiantes
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Herramientas diseñadas para convertir cada clase en una experiencia memorable
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Users, title: 'Perfiles de Héroe', desc: 'Cada estudiante tiene su propio personaje con stats y progreso único', color: 'bg-blue-500/10 text-blue-400' },
              { icon: Target, title: 'Comportamientos', desc: 'Asigna puntos positivos o negativos según el desempeño en clase', color: 'bg-sky-500/10 text-sky-400' },
              { icon: Trophy, title: 'Insignias', desc: 'Logros automáticos y manuales que celebran cada victoria', color: 'bg-amber-500/10 text-amber-400' },
              { icon: Swords, title: 'Boss Battles', desc: 'Batallas cooperativas donde la clase enfrenta desafíos juntos', color: 'bg-rose-500/10 text-rose-400' },
              { icon: Users, title: 'Clanes', desc: 'Equipos que compiten y colaboran por el ranking', color: 'bg-emerald-500/10 text-emerald-400' },
              { icon: ShoppingBag, title: 'Tienda', desc: 'Items y personalización que los estudiantes compran con su oro', color: 'bg-orange-500/10 text-orange-400' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Clases de personaje */}
      <section className="py-24 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Elige tu clase
            </h2>
            <p className="text-slate-500">
              Cada estudiante selecciona su camino y personaliza su aventura
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Guardián', icon: Shield, desc: 'Protector del equipo', color: 'from-blue-500 to-blue-600', emoji: '🛡️' },
              { name: 'Arcano', icon: Wand2, desc: 'Maestro del conocimiento', color: 'from-violet-500 to-purple-600', emoji: '✨' },
              { name: 'Explorador', icon: Compass, desc: 'Buscador de aventuras', color: 'from-emerald-500 to-teal-600', emoji: '🧭' },
              { name: 'Alquimista', icon: FlaskConical, desc: 'Creador de recursos', color: 'from-amber-500 to-orange-600', emoji: '⚗️' },
            ].map((charClass, i) => (
              <motion.div
                key={charClass.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -8 }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${charClass.color} rounded-3xl opacity-0 group-hover:opacity-20 blur-xl transition-opacity`} />
                <div className="relative bg-slate-800/80 border border-slate-700 group-hover:border-slate-600 rounded-3xl p-8 text-center transition-all">
                  <span className="text-5xl mb-4 block">{charClass.emoji}</span>
                  <div className={`w-16 h-16 mx-auto bg-gradient-to-br ${charClass.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                    <charClass.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{charClass.name}</h3>
                  <p className="text-slate-500 text-sm">{charClass.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Empieza en minutos
            </h2>
          </div>

          <div className="space-y-6">
            {[
              { num: '01', title: 'Crea tu clase', desc: 'Regístrate como profesor y configura tu primera clase virtual en segundos.' },
              { num: '02', title: 'Invita estudiantes', desc: 'Comparte el código único y tus estudiantes se unen eligiendo su personaje.' },
              { num: '03', title: 'Gamifica todo', desc: 'Asigna XP por participación, HP por comportamiento, GP como recompensa.' },
              { num: '04', title: 'Observa la magia', desc: 'Mira cómo aumenta la motivación y el compromiso de tus estudiantes.' },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-6 items-start"
              >
                <div className="shrink-0 w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center">
                  <span className="text-blue-400 font-bold">{step.num}</span>
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-slate-500">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-blue-600 to-sky-500 rounded-[2rem] p-12 text-center overflow-hidden"
          >
            {/* Decoración */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <BookOpen className="w-12 h-12 text-white/80 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                ¿Listo para la aventura?
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
                Únete a los profesores que ya transformaron sus clases con Juried
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-2xl hover:bg-blue-50 transition-all shadow-xl"
              >
                Crear cuenta gratis
                <ChevronRight size={20} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer simple */}
      <footer className="py-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src="/logo.png" alt="Juried" className="h-8 w-auto opacity-60" />
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Juried. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};
