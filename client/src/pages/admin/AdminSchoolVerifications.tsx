import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  School,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  User,
  Mail,
  Briefcase,
  FileText,
  Shield,
  Users,
} from 'lucide-react';
import { schoolApi, type PendingVerification, type AdminSchoolWithMembers } from '../../lib/schoolApi';
import { useAuthStore } from '../../store/authStore';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type Tab = 'verifications' | 'schools';

export default function AdminSchoolVerifications() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<Tab>('verifications');
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [schoolsWithMembers, setSchoolsWithMembers] = useState<AdminSchoolWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [verificationsData, schoolsData] = await Promise.all([
        schoolApi.getAdminPendingVerifications(),
        schoolApi.getAllSchoolsWithMembers(),
      ]);
      setVerifications(verificationsData);
      setSchoolsWithMembers(schoolsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setReviewingId(id);
      await schoolApi.reviewVerification(id, true);
      setVerifications(verifications.filter(v => v.id !== id));
      toast.success('Verificación aprobada');
      // Recargar escuelas para reflejar cambios
      const schoolsData = await schoolApi.getAllSchoolsWithMembers();
      setSchoolsWithMembers(schoolsData);
    } catch (error) {
      toast.error('Error al aprobar verificación');
    } finally {
      setReviewingId(null);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setReviewingId(id);
      await schoolApi.reviewVerification(id, false, reviewNote);
      setVerifications(verifications.filter(v => v.id !== id));
      setShowRejectModal(null);
      setReviewNote('');
      toast.success('Verificación rechazada');
    } catch (error) {
      toast.error('Error al rechazar verificación');
    } finally {
      setReviewingId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle size={10} /> Verificado</span>;
      case 'PENDING_ADMIN':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={10} /> Pendiente admin</span>;
      case 'PENDING_OWNER':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock size={10} /> Pendiente owner</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/admin"
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100 text-amber-600">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Escuelas</h1>
              <p className="text-gray-600">Verificaciones y seguimiento de escuelas</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setTab('verifications')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'verifications'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Shield size={16} />
            Verificaciones pendientes
            {verifications.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-xs rounded-full">{verifications.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('schools')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'schools'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <School size={16} />
            Escuelas registradas
            <span className="px-1.5 py-0.5 bg-gray-300 text-gray-700 text-xs rounded-full">{schoolsWithMembers.length}</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : tab === 'verifications' ? (
          // ==================== TAB: VERIFICACIONES ====================
          verifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm text-center py-16">
              <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Todo al día</h3>
              <p className="text-gray-600">No hay verificaciones pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {verifications.map((v) => (
                <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <School size={18} className="text-blue-500" />
                        <h3 className="font-semibold text-gray-900">{v.schoolName}</h3>
                      </div>
                      {v.schoolAddress && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                          <MapPin size={14} /> {v.schoolAddress}{v.schoolCity ? `, ${v.schoolCity}` : ''}, {v.schoolCountry}
                        </p>
                      )}

                      <div className="bg-gray-50 rounded-lg p-3 mt-3 space-y-1.5">
                        <p className="text-sm flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="font-medium text-gray-800">{v.userFirstName} {v.userLastName}</span>
                        </p>
                        <p className="text-sm flex items-center gap-2">
                          <Mail size={14} className="text-gray-400" />
                          <span className="text-gray-600">{v.userEmail}</span>
                        </p>
                        <p className="text-sm flex items-center gap-2">
                          <Briefcase size={14} className="text-gray-400" />
                          <span className="text-gray-600">{v.position}</span>
                        </p>
                        {v.details && (
                          <p className="text-sm flex items-start gap-2 mt-1">
                            <FileText size={14} className="text-gray-400 mt-0.5" />
                            <span className="text-gray-600">{v.details}</span>
                          </p>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Clock size={12} /> Enviado el {new Date(v.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleApprove(v.id)}
                      disabled={reviewingId === v.id}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={16} />
                      Aprobar
                    </button>
                    <button
                      onClick={() => setShowRejectModal(v.id)}
                      disabled={reviewingId === v.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={16} />
                      Rechazar
                    </button>
                  </div>

                  {showRejectModal === v.id && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm font-medium text-red-800 mb-2">Motivo del rechazo</p>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Indica el motivo del rechazo..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleReject(v.id)}
                          disabled={reviewingId === v.id}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                        >
                          Confirmar rechazo
                        </button>
                        <button
                          onClick={() => { setShowRejectModal(null); setReviewNote(''); }}
                          className="px-3 py-1.5 text-gray-600 text-xs font-medium hover:bg-gray-100 rounded-lg"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // ==================== TAB: ESCUELAS REGISTRADAS ====================
          schoolsWithMembers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm text-center py-16">
              <School className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Sin escuelas</h3>
              <p className="text-gray-600">No hay escuelas registradas aún</p>
            </div>
          ) : (
            <div className="space-y-4">
              {schoolsWithMembers.map((school) => (
                <div key={school.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <School size={20} className="text-blue-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{school.name}</h3>
                        {school.isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle size={10} /> Verificada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock size={10} /> No verificada
                          </span>
                        )}
                      </div>
                      {school.address && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {school.city ? `${school.city}, ` : ''}{school.country}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Miembros */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Users size={12} /> Miembros ({school.members.length})
                    </p>
                    {school.members.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Sin miembros activos</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {school.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                                <User size={14} className="text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{member.firstName} {member.lastName}</p>
                                <p className="text-xs text-gray-500">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {member.role === 'OWNER' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                                  <Shield size={10} /> Responsable
                                </span>
                              )}
                              {getStatusLabel(member.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-50 flex items-center gap-1">
                    <Clock size={12} /> Registrada el {new Date(school.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
