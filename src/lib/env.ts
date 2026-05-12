export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production',
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? '',
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  FROM_EMAIL: process.env.FROM_EMAIL ?? 'noreply@datafever.com',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
}
