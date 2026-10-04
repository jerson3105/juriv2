import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db, users, parentProfiles } from '../db/index.js';
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { config_app } from './env.js';
import { OAUTH_STATE_COOKIE_NAME, verifyOAuthState } from '../utils/oauth-state.js';
import { isDuplicateEntry } from '../utils/errors.js';
import { revokeAllUserTokens } from '../utils/jwt.js';
import { teacherVerificationService } from '../services/teacherVerification.service.js';
import { recordAudit } from '../utils/audit.js';

type UserRole = 'TEACHER' | 'STUDENT' | 'PARENT';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeName = (value: string): string => value.trim();
const normalizeAvatarUrl = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const isDuplicateEntryError = isDuplicateEntry;

// Fallos esperados: la ruta del callback redirige a /login?error=<code> y la pantalla lo explica.
const fail = (code: string) => ({ code });

export const configurePassport = () => {
  // Solo configurar si las credenciales están disponibles
  if (!config_app.google.clientId || !config_app.google.clientSecret) {
    console.log('⚠️ Google OAuth no configurado (faltan credenciales)');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config_app.google.clientId,
        clientSecret: config_app.google.clientSecret,
        callbackURL: config_app.google.callbackUrl || '/api/auth/google/callback',
        scope: ['profile', 'email'],
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = typeof profile.id === 'string' ? profile.id.trim() : '';
          const stateToken = typeof req.query.state === 'string' ? req.query.state : undefined;
          const stateNonce = (req as any).cookies?.[OAUTH_STATE_COOKIE_NAME] as string | undefined;
          const stateValidation = verifyOAuthState(stateToken, stateNonce);

          if (!stateValidation.isValid) {
            return done(null, false, fail('google_state_invalid'));
          }

          const selectedRole = stateValidation.role;
          const hasSelectedRole = !!selectedRole;
          
          if (!email) {
            return done(null, false, fail('google_email_missing'));
          }

          if (!googleId) {
            return done(null, false, fail('google_auth_failed'));
          }

          // Solo emails verificados por Google: la cuenta se vincula por email con cualquier
          // cuenta local existente, así que un email no verificado permitiría suplantar a su dueño.
          const emailVerified =
            (profile.emails?.[0] as { verified?: boolean | string } | undefined)?.verified ??
            (profile as any)._json?.email_verified;
          if (emailVerified !== true && emailVerified !== 'true') {
            return done(null, false, fail('google_email_unverified'));
          }

          const normalizedEmail = normalizeEmail(email);
          const normalizedFirstName =
            normalizeName(profile.name?.givenName || profile.displayName?.split(' ')[0] || '') || 'Usuario';
          const normalizedLastName = normalizeName(
            profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || ''
          );
          const normalizedAvatarUrl = normalizeAvatarUrl(profile.photos?.[0]?.value || null);

          // Buscar usuario existente por email
          let user = await db.query.users.findFirst({
            where: or(
              eq(users.email, normalizedEmail),
              eq(users.googleId, googleId)
            ),
          });

          if (user) {
            if (!user.isActive) {
              return done(null, false, fail('account_disabled'));
            }

            // La cuenta de administración no se vincula a Google por el correo: quien controle ese buzón
            // entraría sin contraseña. Solo pasa si ya estaba vinculada a esta misma cuenta de Google.
            if (user.role === 'ADMIN' && (user.provider !== 'GOOGLE' || user.googleId !== googleId)) {
              await recordAudit({ action: 'auth.admin_login_failed', target: { type: 'user', id: user.id }, metadata: { provider: 'GOOGLE' }, ip: req.ip ?? null });
              return done(null, false, fail('admin_google_disabled'));
            }

            // Usuario existe - actualizar vínculo con Google si hace falta
            const shouldUpdateProvider = user.provider !== 'GOOGLE';
            const shouldUpdateGoogleId = user.googleId !== googleId;
            const shouldUpdateAvatar = !user.avatarUrl && !!normalizedAvatarUrl;

            if (shouldUpdateProvider || shouldUpdateGoogleId || shouldUpdateAvatar) {
              // Primera vez con Google sobre una cuenta con contraseña: el correo nunca se verificó, así que
              // otra persona pudo registrarlo antes. Se cierran sus sesiones para que no conserve acceso.
              if (shouldUpdateProvider || shouldUpdateGoogleId) {
                await revokeAllUserTokens(user.id);
              }
              await db.update(users)
                .set({ 
                  googleId,
                  provider: 'GOOGLE',
                  avatarUrl: user.avatarUrl || normalizedAvatarUrl,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
              // Ahora Google comprobó su correo: un docente sin verificar con dominio institucional queda verificado.
              if (user.role === 'TEACHER' && user.teacherStatus !== 'VERIFIED') {
                await teacherVerificationService.verifyByGoogleDomain(user.id, user.email);
              }

              user = await db.query.users.findFirst({
                where: eq(users.id, user.id),
              });
            }
            // Usuario existente, continuar normalmente
            return done(null, user || undefined);
          } else {
            // Usuario nuevo
            if (!hasSelectedRole) {
              // No tiene rol seleccionado - devolver datos para selección de rol
              // Usamos un objeto especial que el callback detectará
              return done(null, {
                isNewUser: true,
                needsRoleSelection: true,
                googleData: {
                  googleId,
                  email: normalizedEmail,
                  firstName: normalizedFirstName,
                  lastName: normalizedLastName,
                  avatarUrl: normalizedAvatarUrl,
                }
              } as any);
            }
            
            // Tiene rol seleccionado - crear usuario
            const newUserId = uuidv4();
            const now = new Date();
            const teacherFields = selectedRole === 'TEACHER' ? await teacherVerificationService.initialStatusFor(normalizedEmail, 'GOOGLE') : {};

            try {
              await db.transaction(async (tx) => {
                await tx.insert(users).values({
                  id: newUserId,
                  email: normalizedEmail,
                  googleId,
                  firstName: normalizedFirstName,
                  lastName: normalizedLastName,
                  password: '', // No password para usuarios de Google
                  role: selectedRole as UserRole,
                  ...teacherFields,
                  provider: 'GOOGLE',
                  avatarUrl: normalizedAvatarUrl,
                  isActive: true,
                  notifyBadges: true,
                  notifyLevelUp: true,
                  createdAt: now,
                  updatedAt: now,
                });

                if (selectedRole === 'PARENT') {
                  await tx.insert(parentProfiles).values({
                    id: uuidv4(),
                    userId: newUserId,
                    relationship: 'GUARDIAN',
                    notifyByEmail: true,
                    notifyWeeklySummary: true,
                    notifyAlerts: true,
                    createdAt: now,
                    updatedAt: now,
                  });
                }
              });
            } catch (error) {
              if (!isDuplicateEntryError(error)) {
                throw error;
              }
            }

            user = await db.query.users.findFirst({
              where: or(
                eq(users.id, newUserId),
                eq(users.email, normalizedEmail),
                eq(users.googleId, googleId)
              ),
            });

            if (!user) {
              return done(null, false, fail('google_auth_failed'));
            }

            if (!user.isActive) {
              return done(null, false, fail('account_disabled'));
            }

            return done(null, user);
          }
        } catch (error) {
          console.error('Error en Google OAuth:', error);
          return done(error as Error, undefined);
        }
      }
    )
  );

  // Serialización (no usamos sesiones, pero Passport lo requiere)
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      done(null, user || undefined);
    } catch (error) {
      done(error, undefined);
    }
  });

  console.log('✅ Google OAuth configurado');
};
