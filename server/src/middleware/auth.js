import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from './error.js';

export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);
    return user && user.active ? user : null;
  } catch {
    return null;
  }
}

// Attaches req.user when a valid token is present, but never blocks
export async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

export async function requireAuth(req, _res, next) {
  req.user = await resolveUser(req);
  if (!req.user) throw new HttpError(401, 'Please log in to continue');
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new HttpError(403, 'You do not have permission to do this');
  }
  next();
};
