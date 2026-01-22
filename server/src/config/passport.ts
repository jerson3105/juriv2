import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { config_app } from './env.js';

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
          // Obtener rol del state (pasado desde la ruta inicial)
          // Si no hay rol o es vacío, significa que viene del login sin rol seleccionado
          const stateRole = req.query.state as string;
          const hasSelectedRole = stateRole && stateRole !== '' && stateRole !== 'undefined';
          
          if (!email) {
            return done(new Error('No se pudo obtener el email de Google'), undefined);
          }

          // Buscar usuario existente por email
          let user = await db.query.users.findFirst({
            where: eq(users.email, email),
          });

          if (user) {
            // Usuario existe - actualizar provider si era LOCAL
            if (user.provider === 'LOCAL') {
              await db.update(users)
                .set({ 
                  provider: 'GOOGLE',
                  avatarUrl: user.avatarUrl || profile.photos?.[0]?.value || null,
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
                  email,
                  firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'Usuario',
                  lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
                  avatarUrl: profile.photos?.[0]?.value || null,
                }
              } as any);
            }
            
            // Tiene rol seleccionado - crear usuario
            const newUserId = uuidv4();
            const now = new Date();
            
            await db.insert(users).values({
              id: newUserId,
              email,
              firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'Usuario',
              lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
              password: '', // No password para usuarios de Google
              role: stateRole as 'TEACHER' | 'STUDENT' | 'PARENT',
              provider: 'GOOGLE',
              avatarUrl: profile.photos?.[0]?.value || null,
              createdAt: now,
              updatedAt: now,
            });

            user = await db.query.users.findFirst({
              where: eq(users.id, newUserId),
            });
            
            return done(null, user || undefined);
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
