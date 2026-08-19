import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root or backend
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Database & Redis
  DATABASE_URL: z.string().default('postgresql://postgres:postgrespassword@localhost:5432/reachinbox'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Session & Security
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters').default('reachinbox_super_secret_session_key_32chars_min'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  ENCRYPTION_KEY: z.string().optional().default('reachinbox_aes256_encryption_key_32chars'),

  // Google OAuth 2.0
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/google/callback'),

  // Ethereal SMTP Settings
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASSWORD: z.string().optional().default(''),

  // Queue & Worker Controls
  WORKER_CONCURRENCY: z.coerce.number().min(1).default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().min(0).default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().min(1).default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().min(1).default(200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ FATAL: Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

// In production, warn if Google OAuth secrets are missing but don't crash server boot
if (parsed.data.NODE_ENV === 'production') {
  if (!parsed.data.GOOGLE_CLIENT_ID || !parsed.data.GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️ WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google OAuth login will be disabled until configured.');
  }
}

export const env = parsed.data;
