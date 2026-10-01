import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000'),
  API_BASE_URL: z.string().default('http://localhost:3000/api/v1'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  TZ: z.string().default('Asia/Kolkata'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  STORAGE_TYPE: z.string().default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const rawEnv = parsed.data;

export const env = {
  ...rawEnv,
  database: {
    url: rawEnv.DATABASE_URL,
  },
  jwt: {
    secret: rawEnv.JWT_SECRET,
    refreshSecret: rawEnv.JWT_REFRESH_SECRET,
    accessExpiry: rawEnv.JWT_ACCESS_EXPIRY,
    refreshExpiry: rawEnv.JWT_REFRESH_EXPIRY,
  },
  app: {
    env: rawEnv.NODE_ENV,
    port: parseInt(rawEnv.PORT, 10),
    baseUrl: rawEnv.API_BASE_URL,
    frontendUrl: rawEnv.FRONTEND_URL,
    timezone: rawEnv.TZ,
  },
  rateLimit: {
    windowMs: parseInt(rawEnv.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(rawEnv.RATE_LIMIT_MAX_REQUESTS, 10),
  },
  email: {
    host: rawEnv.SMTP_HOST,
    port: rawEnv.SMTP_PORT ? parseInt(rawEnv.SMTP_PORT, 10) : undefined,
    user: rawEnv.SMTP_USER,
    pass: rawEnv.SMTP_PASS,
    from: rawEnv.SMTP_FROM,
  },
  storage: {
    type: rawEnv.STORAGE_TYPE,
    uploadDir: rawEnv.UPLOAD_DIR,
  },
};

export default env;