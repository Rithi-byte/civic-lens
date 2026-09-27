import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { validate, HttpError } from '../middleware/error.js';

const router = Router();

// Brute-force protection: 10 failed logins per IP per 15 minutes (successful logins don't count)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many failed login attempts. Please try again in 15 minutes.' },
});

// Spam protection: 20 new accounts per IP per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many accounts created from this network. Please try again later.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  area: z.string().trim().max(80).optional().default(''),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// Public sign-up always creates a citizen. Authorities are created by admins.
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const user = await User.create({ ...req.body, role: 'citizen' });
  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  if (!user.active) throw new HttpError(403, 'This account has been deactivated');
  res.json({ token: signToken(user), user: user.toSafeJSON() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toSafeJSON() });
});

export default router;
