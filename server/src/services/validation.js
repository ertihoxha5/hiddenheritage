import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');

export const registerSchema = z.object({
  full_name: z.string().trim().min(1).max(150),
  email,
  password,
  role: z.enum(['tourist', 'teacher', 'guide']).default('tourist'),
});
export const loginSchema = z.object({ email, password });
export const contactSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email,
  message: z.string().trim().min(1).max(10000),
});
