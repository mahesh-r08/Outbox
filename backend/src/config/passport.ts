import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma.js';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export function configurePassport(): void {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'), undefined);
            }

            const googleId = profile.id;
            const name = profile.displayName || email.split('@')[0];
            const avatarUrl = profile.photos?.[0]?.value || null;

            // Find or create user
            let user = await prisma.user.findFirst({
              where: {
                OR: [{ googleId }, { email }],
              },
            });

            if (user) {
              // Update googleId & avatar if missing
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: user.googleId || googleId,
                  avatarUrl: user.avatarUrl || avatarUrl,
                  name: user.name || name,
                },
              });
            } else {
              user = await prisma.user.create({
                data: {
                  googleId,
                  email,
                  name,
                  avatarUrl,
                },
              });

              logger.info({ userId: user.id, email: user.email }, 'New user registered via Google OAuth');
            }

            return done(null, user);
          } catch (err: any) {
            logger.error({ err: err.message }, 'Google OAuth Strategy error');
            return done(err, undefined);
          }
        }
      )
    );
    logger.info('Google OAuth 2.0 Passport Strategy initialized');
  } else {
    logger.warn('Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google login.');
  }
}
