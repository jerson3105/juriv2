import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';

export const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/login"
            className="flex items-center gap-2 text-primary-200 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Volver</span>
          </Link>
          <img src="/logo.png" alt="Juried" className="h-10" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 md:p-12"
        >
          {/* Title */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Política de Privacidad
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Plataforma Juried
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Última actualización: 11/12/2025
          </p>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            {/* 1. Introducción */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                1. Introducción
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                La presente Política de Privacidad describe cómo Plataforma Juried (en adelante, "la Plataforma", "nosotros" o "nuestro") recopila, utiliza, almacena y protege los datos personales de sus usuarios: docentes y estudiantes, incluidos aquellos que pueden ser menores de edad.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-4">
                El uso de la Plataforma implica la aceptación de esta Política. Nos comprometemos a respetar la confidencialidad y seguridad de la información conforme a las normas de protección de datos aplicables.
              </p>
            </section>

            {/* 2. Datos que recopilamos */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                2. Datos que recopilamos
              </h2>
              
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
                2.1. Datos de docentes
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Para crear y gestionar las cuentas de los docentes, recolectamos:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Nombre y apellidos</li>
                <li>Correo electrónico</li>
                <li>Contraseña</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 mt-6">
                2.2. Datos de estudiantes (incluidos menores de edad)
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Para el funcionamiento educativo de la Plataforma, recolectamos:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Nombre y apellidos</li>
                <li>Correo electrónico</li>
                <li>Contraseña</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <strong className="text-amber-700 dark:text-amber-400">Importante:</strong> Los datos de estudiantes son registrados únicamente bajo autorización del docente o institución educativa responsable.
              </p>
            </section>

            {/* 3. Finalidades del tratamiento */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                3. Finalidades del tratamiento
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Los datos recopilados se utilizan para:
              </p>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3">
                3.1. Funcionamiento de la Plataforma
              </h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Crear y gestionar cuentas de usuario.</li>
                <li>Permitir el acceso seguro al sistema.</li>
                <li>Registrar y mostrar el progreso, logros y actividades dentro de las dinámicas de gamificación educativa.</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 mt-6">
                3.2. Comunicación
              </h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Enviar notificaciones sobre actividades, eventos o actualizaciones relevantes del servicio.</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-3 mt-6">
                3.3. Mejora del servicio
              </h3>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Analizar el uso de la Plataforma para perfeccionar su rendimiento y experiencia.</li>
              </ul>

              <p className="text-gray-600 dark:text-gray-300 mt-4 font-medium">
                Plataforma Juried no vende ni comparte datos con fines publicitarios.
              </p>
            </section>

            {/* 4. Base legal */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                4. Base legal del tratamiento
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Tratamos los datos personales bajo las siguientes bases legales:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>Consentimiento explícito:</strong> otorgado por el docente y, en el caso de estudiantes menores de edad, por la institución o tutor responsable.</li>
                <li><strong>Ejecución del servicio educativo:</strong> necesaria para operar la Plataforma.</li>
              </ul>
            </section>

            {/* 5. Seguridad */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                5. Seguridad de la información
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Aplicamos medidas técnicas y organizativas para proteger los datos frente a accesos no autorizados, pérdida, uso indebido o alteración, tales como:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Cifrado seguro de contraseñas (como bcrypt o equivalente).</li>
                <li>Servidores protegidos por protocolos de seguridad.</li>
                <li>Controles de acceso basados en roles (docente/estudiante).</li>
              </ul>
            </section>

            {/* 6. Almacenamiento */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                6. Almacenamiento y conservación
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Los datos personales se almacenan en bases de datos seguras y se conservan mientras:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>La cuenta del usuario esté activa, o</li>
                <li>Exista una relación educativa con la institución o docente que administra el grupo.</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                Si un usuario solicita la eliminación de su cuenta, los datos serán eliminados o anonimizados de manera segura.
              </p>
            </section>

            {/* 7. Compartición */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                7. Compartición de datos con terceros
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Plataforma Juried no comparte datos con terceros, salvo en las siguientes situaciones:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Para garantizar el funcionamiento del servicio, con proveedores tecnológicos que cumplan con medidas de seguridad equivalentes.</li>
                <li>Si una ley, autoridad educativa o judicial así lo exige.</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4 font-medium">
                En ningún caso se ceden datos para fines comerciales.
              </p>
            </section>

            {/* 8. Derechos */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                8. Derechos de los usuarios
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Docentes, estudiantes y, en caso de menores, sus tutores legales, pueden ejercer los siguientes derechos:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-2 ml-4">
                <li><strong>Acceso:</strong> conocer qué datos están almacenados.</li>
                <li><strong>Rectificación:</strong> corregir información incorrecta o desactualizada.</li>
                <li><strong>Eliminación:</strong> solicitar la eliminación de su información personal.</li>
                <li><strong>Oposición:</strong> limitar o cancelar el uso de sus datos cuando corresponda.</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                Las solicitudes pueden realizarse a través de: <a href="mailto:hola@plataformajuried.com" className="text-primary-600 hover:text-primary-700 font-medium">hola@plataformajuried.com</a>
              </p>
            </section>

            {/* 9. Cookies */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                9. Uso de cookies y tecnologías similares
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Plataforma Juried puede utilizar cookies o tecnologías similares únicamente para:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
                <li>Mantener sesiones activas.</li>
                <li>Mejorar la experiencia de navegación.</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                No se utilizan cookies con fines de seguimiento comercial.
              </p>
            </section>

            {/* 10. Menores */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                10. Tratamiento de datos de menores de edad
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                El registro de estudiantes menores solo se realiza bajo supervisión y autorización del docente o institución educativa. Nos comprometemos a proteger estrictamente esta información y a evitar cualquier tratamiento no autorizado.
              </p>
            </section>

            {/* 11. Modificaciones */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                11. Modificaciones a esta Política
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Plataforma Juried podrá actualizar esta Política cuando sea necesario. Las modificaciones serán publicadas y la fecha de actualización se mostrará en la parte superior.
              </p>
            </section>

            {/* 12. Contacto */}
            <section className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                12. Contacto
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Si tienes preguntas sobre esta Política o deseas ejercer tus derechos, puedes contactarnos en:
              </p>
              <a 
                href="mailto:hola@plataformajuried.com" 
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                hola@plataformajuried.com
              </a>
            </section>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-primary-300 text-sm">
            © {new Date().getFullYear()} Juried. Todos los derechos reservados.
          </p>
        </div>
      </main>
    </div>
  );
};
