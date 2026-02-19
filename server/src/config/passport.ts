import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db, users, parentProfiles } from '../db/index.js';
import { eq, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { config_app } from './env.js';
import { OAUTH_STATE_COOKIE_NAME, verifyOAuthState } from '../utils/oauth-state.js';

type UserRole = 'TEACHER' | 'STUDENT' | 'PARENT';

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const normalizeName = (value: string): string => value.trim();
const normalizeAvatarUrl = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const isDuplicateEntryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const dbError = error as { code?: string; errno?: number };
  return dbError.code === 'ER_DUP_ENTRY' || dbError.errno === 1062;
};

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
            return done(new Error('Estado OAuth inválido o expirado'), undefined);
          }

          const selectedRole = stateValidation.role;
          const hasSelectedRole = !!selectedRole;
          
          if (!email) {
            return done(new Error('No se pudo obtener el email de Google'), undefined);
          }

          if (!googleId) {
            return done(new Error('No se pudo obtener el identificador de Google'), undefined);
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
              return done(new Error('Tu cuenta ha sido desactivada'), undefined);
            }

            // Usuario existe - actualizar vínculo con Google si hace falta
            const shouldUpdateProvider = user.provider !== 'GOOGLE';
            const shouldUpdateGoogleId = user.googleId !== googleId;
            const shouldUpdateAvatar = !user.avatarUrl && !!normalizedAvatarUrl;

            if (shouldUpdateProvider || shouldUpdateGoogleId || shouldUpdateAvatar) {
              await db.update(users)
                .set({ 
                  googleId,
                  provider: 'GOOGLE',
                  avatarUrl: user.avatarUrl || normalizedAvatarUrl,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
              
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
              return done(new Error('Error al completar autenticación con Google'), undefined);
            }

            if (!user.isActive) {
              return done(new Error('Tu cuenta ha sido desactivada'), undefined);
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
