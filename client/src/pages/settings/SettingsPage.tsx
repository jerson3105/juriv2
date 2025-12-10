import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { 
  Settings, 
  User, 
  Bell, 
  Palette, 
  Shield, 
  Info,
  Moon,
  Sun,
  Mail,
  Lock,
  Save,
  Check,
  Camera,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { userApi } from '../../lib/userApi';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

export const SettingsPage = () => {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState({
    badges: (user as any)?.notifyBadges ?? true,
    levelUp: (user as any)?.notifyLevelUp ?? true,
  });
  
  // Helper para construir URL de avatar
  const getAvatarUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');
    return `${baseUrl}${url}`;
  };

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(getAvatarUrl(user?.avatarUrl));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'preferences', label: 'Preferencias', icon: Palette },
    { id: 'notifications', label: 'Notificaciones', icon: Bell },
    { id: 'security', label: 'Seguridad', icon: Shield },
    { id: 'about', label: 'Acerca de', icon: Info },
  ];

  // Mutations
  const updateProfileMutation = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (data) => {
      updateUser({ firstName: data.firstName, lastName: data.lastName });
      toast.success('Perfil actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al actualizar perfil');
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: userApi.uploadAvatar,
    onSuccess: (data) => {
      updateUser({ avatarUrl: data.avatarUrl });
      setAvatarFile(null);
      toast.success('Avatar actualizado');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al subir avatar');
    },
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: userApi.updateNotifications,
    onSuccess: () => {
      toast.success('Preferencias de notificaciones guardadas');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al guardar preferencias');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      toast.success('Contraseña actualizada. Por favor, inicia sesión nuevamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Error al cambiar contraseña');
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      firstName,
      lastName,
    });
    // Si hay archivo de avatar, subirlo
    if (avatarFile) {
      uploadAvatarMutation.mutate(avatarFile);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen debe ser menor a 2MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNotifications = () => {
    updateNotificationsMutation.mutate({
      notifyBadges: notifications.badges,
      notifyLevelUp: notifications.levelUp,
    });
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <Settings size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">Configuración</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Personaliza tu experiencia en Juried</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar de tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-l-4 border-violet-500'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                }`}
              >
                <tab.icon size={18} />
                <span className="font-medium text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="lg:col-span-3">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            {/* Perfil */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Información del Perfil</h2>
                
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    {avatarPreview ? (
                      <img 
                        src={avatarPreview} 
                        alt="Avatar" 
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </div>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Camera size={24} className="text-white" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-white">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-medium rounded">
                      {user?.role === 'TEACHER' ? 'Profesor' : user?.role === 'ADMIN' ? 'Administrador' : 'Estudiante'}
                    </span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Apellido
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      <Mail size={14} className="inline mr-1" />
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">El email no se puede cambiar</p>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Guardar cambios
                </Button>
              </div>
            )}

            {/* Preferencias */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Preferencias</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white mb-3">Tema de la aplicación</h3>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                          theme === 'light'
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Sun size={20} className={theme === 'light' ? 'text-violet-500' : 'text-gray-400'} />
                        <span className={`font-medium ${theme === 'light' ? 'text-violet-600' : 'text-gray-600 dark:text-gray-400'}`}>
                          Claro
                        </span>
                        {theme === 'light' && <Check size={16} className="text-violet-500" />}
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                          theme === 'dark'
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Moon size={20} className={theme === 'dark' ? 'text-violet-500' : 'text-gray-400'} />
                        <span className={`font-medium ${theme === 'dark' ? 'text-violet-600 dark:text-violet-400' : 'text-gray-600 dark:text-gray-400'}`}>
                          Oscuro
                        </span>
                        {theme === 'dark' && <Check size={16} className="text-violet-500" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="font-medium text-gray-800 dark:text-white mb-3">Idioma</h3>
                    <select className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                      <option value="es">Español</option>
                      <option value="en" disabled>English (próximamente)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Notificaciones */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Notificaciones</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl opacity-50">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">Notificaciones por email</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Recibe resúmenes de actividad (próximamente)</p>
                    </div>
                    <button
                      disabled
                      className="w-12 h-6 rounded-full transition-colors bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                    >
                      <div className="w-5 h-5 bg-white rounded-full shadow transition-transform translate-x-0.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">Insignias desbloqueadas</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Notificar cuando un estudiante desbloquea una insignia</p>
                    </div>
                    <button
                      onClick={() => setNotifications(n => ({ ...n, badges: !n.badges }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        notifications.badges ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifications.badges ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div>
                      <h4 className="font-medium text-gray-800 dark:text-white">Subidas de nivel</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Notificar cuando un estudiante sube de nivel</p>
                    </div>
                    <button
                      onClick={() => setNotifications(n => ({ ...n, levelUp: !n.levelUp }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        notifications.levelUp ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        notifications.levelUp ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} className="flex items-center gap-2">
                  <Save size={16} />
                  Guardar preferencias
                </Button>
              </div>
            )}

            {/* Seguridad */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Seguridad</h2>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                      <Lock size={16} />
                      Cambiar contraseña
                    </h3>
                    <div className="space-y-3">
                      <input
                        type="password"
                        placeholder="Contraseña actual"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                      <input
                        type="password"
                        placeholder="Nueva contraseña"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                      <input
                        type="password"
                        placeholder="Confirmar nueva contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <Button 
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending}
                      className="mt-4 flex items-center gap-2"
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : null}
                      Actualizar contraseña
                    </Button>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-gray-700">
                    <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">Zona de peligro</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Una vez que elimines tu cuenta, no hay vuelta atrás. Por favor, ten cuidado.
                    </p>
                    <Button 
                      variant="secondary" 
                      className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                      onClick={() => toast.error('Esta función estará disponible próximamente')}
                    >
                      Eliminar mi cuenta
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Acerca de */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Acerca de Juried</h2>
                
                <div className="text-center py-6">
                  <img 
                    src="/logo.png" 
                    alt="Juried" 
                    className="w-24 h-24 mx-auto mb-4 object-contain"
                  />
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">Juried</h3>
                  <p className="text-gray-500 dark:text-gray-400">Plataforma de Gamificación Educativa</p>
                  <p className="text-sm text-violet-600 dark:text-violet-400 font-medium mt-1">Versión 0.5 (MVP)</p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <h4 className="font-medium text-gray-800 dark:text-white mb-1">¿Qué es Juried?</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Juried es una plataforma que permite a los profesores gamificar sus clases, 
                      motivando a los estudiantes a través de puntos, niveles, insignias y recompensas.
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <h4 className="font-medium text-gray-800 dark:text-white mb-1">Características principales</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>• Sistema de puntos y niveles</li>
                      <li>• Insignias y logros</li>
                      <li>• Tienda de recompensas</li>
                      <li>• Eventos aleatorios</li>
                      <li>• Avatares personalizables</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                    <h4 className="font-medium text-violet-700 dark:text-violet-400 mb-1">Contacto y soporte</h4>
                    <p className="text-sm text-violet-600 dark:text-violet-300">
                      ¿Tienes preguntas o sugerencias? Escríbenos a{' '}
                      <a href="mailto:soporte@juried.app" className="underline">soporte@juried.app</a>
                    </p>
                  </div>
                </div>

                <p className="text-center text-xs text-gray-400">
                  © 2024 Juried. Todos los derechos reservados.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};
