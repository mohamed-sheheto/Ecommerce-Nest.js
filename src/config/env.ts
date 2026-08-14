const REQUIRED_ENV = [
  'JWT_SECRET',
  'JWT_SECRET_REFRESHTOKEN',
  'MAIL_USER',
  'EMAIL_USERNAME',
  'EMAIL_PASSWORD',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CLOUDINARY_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
] as const;

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(
      ', ',
    )}. Create a .env file from .env.example before starting the app.`,
  );
}

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_SECRET_REFRESHTOKEN: process.env.JWT_SECRET_REFRESHTOKEN!,
  MAIL_USER: process.env.MAIL_USER!,
  EMAIL_USERNAME: process.env.EMAIL_USERNAME!,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD!,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
  CLOUDINARY_NAME: process.env.CLOUDINARY_NAME!,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL!,
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS ?? 10),
} as const;
