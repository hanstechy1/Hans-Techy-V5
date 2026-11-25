import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  BOT_NAME: 'HANS TECHY V5',
  VERSION: '5.0.0',
  PREFIX: process.env.PREFIX || '.',
  PORT: process.env.PORT || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*'
};
