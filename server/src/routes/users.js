import { Router } from 'express';
import { z } from 'zod';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, HttpError } from '../middleware/error.js';
import { CATEGORIES, ROLES } from '../utils/constants.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['authority', 'admin']).default('authority'),
  department: z.enum(CATEGORIES).nullable().optional(),
});

const updateSchema = z.object({
  active: z.boolean().optional(),
  department: z.enum(CATEGORIES).nullable().optional(),
});

router.get('/', async (req, res) => {
  const role = ROLES.includes(req.query.role) ? req.query.role : undefined;
  const users = await User.find(role ? { role } : {}).sort({ role: 1, name: 1 }).lean();
  const counts = await Issue.aggregate([
    { $match: { assignedTo: { $ne: null } } },
    { $group: { _id: '$assignedTo', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } },
  ]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  res.json(users.map(({ password, ...u }) => ({ ...u, assigned: byId[u._id]?.total || 0, resolved: byId[u._id]?.resolved || 0 })));
});

router.post('/', validate(createSchema), async (req, res) => {
  if (req.body.role === 'authority' && !req.body.department) {
    throw new HttpError(400, 'Authority users need a department');
  }
  const user = await User.create(req.body);
  res.status(201).json(user.toSafeJSON());
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  if (String(req.params.id) === String(req.user._id) && req.body.active === false) {
    throw new HttpError(400, 'You cannot deactivate your own account');
  }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user.toSafeJSON());
});

export default router;
