import { Router } from 'express';
import { z } from 'zod';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { validate, HttpError } from '../middleware/error.js';
import { CATEGORIES, STATUSES, PRIORITIES, TRANSITIONS, STATUS_LABELS } from '../utils/constants.js';

const router = Router();

const USER_FIELDS = 'name role department';

const createSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(120),
  description: z.string().trim().min(15, 'Please describe the issue in at least 15 characters').max(2000),
  category: z.enum(CATEGORIES, { message: 'Choose a valid category' }),
  priority: z.enum(PRIORITIES).optional().default('medium'),
  location: z.object({
    address: z.string().trim().min(3, 'Address / landmark is required').max(200),
    area: z.string().trim().max(80).optional().default(''),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
  image: z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/, 'Image must be PNG, JPG or WEBP')
    .max(4_000_000, 'Image is too large')
    .optional()
    .or(z.literal('')),
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum([...STATUSES, 'open']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  area: z.string().trim().max(80).optional(),
  mine: z.enum(['true', 'false']).optional(),
  scope: z.enum(['all', 'department']).optional(),
  sort: z.enum(['new', 'old', 'top', 'priority']).optional().default('new'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
});

const statusSchema = z.object({
  status: z.enum(STATUSES, { message: 'Invalid status' }),
  note: z.string().trim().max(500).optional().default(''),
});

const assignSchema = z.object({
  assignedTo: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
});

const commentSchema = z.object({
  text: z.string().trim().min(1, 'Comment cannot be empty').max(500),
});

const notify = (users, message, issue) => {
  const ids = [...new Set(users.filter(Boolean).map(String))];
  if (!ids.length) return;
  return Notification.insertMany(ids.map((user) => ({ user, message, issue })));
};

const canManage = (user, issue) =>
  user.role === 'admin' ||
  (user.role === 'authority' &&
    (issue.category === user.department || String(issue.assignedTo?._id || issue.assignedTo) === String(user._id)));

function buildFilter(query, user) {
  const filter = {};
  if (query.q) filter.$text = { $search: query.q };
  if (query.category) filter.category = query.category;
  if (query.status === 'open') filter.status = { $in: ['reported', 'acknowledged', 'in_progress'] };
  else if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.area) filter['location.area'] = new RegExp(query.area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (query.mine === 'true') {
    if (!user) throw new HttpError(401, 'Please log in to see your reports');
    filter.reporter = user._id;
  }
  if (query.scope === 'department') {
    if (!user || user.role !== 'authority') throw new HttpError(403, 'Only authorities have a department queue');
    filter.$or = [{ category: user.department }, { assignedTo: user._id }];
  }
  return filter;
}

const SORTS = {
  new: { createdAt: -1 },
  old: { createdAt: 1 },
  top: { upvoteCount: -1, createdAt: -1 },
  priority: { priorityRank: -1, createdAt: -1 },
};

// GET /api/issues - public list with search, filters, sort and pagination
router.get('/', optionalAuth, validate(listSchema, 'query'), async (req, res) => {
  const q = req.validated;
  const filter = buildFilter(q, req.user);
  const skip = (q.page - 1) * q.limit;

  const [items, total] = await Promise.all([
    Issue.aggregate([
      { $match: filter },
      {
        $addFields: {
          upvoteCount: { $size: '$upvotes' },
          commentCount: { $size: '$comments' },
          priorityRank: { $indexOfArray: [PRIORITIES, '$priority'] },
        },
      },
      { $sort: SORTS[q.sort] },
      { $skip: skip },
      { $limit: q.limit },
      { $project: { comments: 0, history: 0 } },
      { $lookup: { from: 'users', localField: 'reporter', foreignField: '_id', as: 'reporter', pipeline: [{ $project: { name: 1 } }] } },
      { $lookup: { from: 'users', localField: 'assignedTo', foreignField: '_id', as: 'assignedTo', pipeline: [{ $project: { name: 1, department: 1 } }] } },
      { $addFields: { reporter: { $first: '$reporter' }, assignedTo: { $first: '$assignedTo' } } },
    ]),
    Issue.countDocuments(filter),
  ]);

  const userId = req.user?._id?.toString();
  res.json({
    items: items.map(({ upvotes, ...i }) => ({ ...i, upvoted: userId ? upvotes.some((u) => String(u) === userId) : false })),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  });
});

// GET /api/issues/map - lightweight points for the map view
router.get('/map', async (_req, res) => {
  const points = await Issue.find({ 'location.lat': { $ne: null }, 'location.lng': { $ne: null } })
    .select('title category status priority location')
    .limit(1000)
    .lean();
  res.json(points);
});

router.get('/:id', optionalAuth, async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate('reporter', USER_FIELDS)
    .populate('assignedTo', USER_FIELDS)
    .populate('comments.user', USER_FIELDS)
    .populate('history.by', USER_FIELDS)
    .lean();
  if (!issue) throw new HttpError(404, 'Issue not found');
  const userId = req.user?._id?.toString();
  res.json({
    ...issue,
    upvoteCount: issue.upvotes.length,
    upvoted: userId ? issue.upvotes.some((u) => String(u) === userId) : false,
    upvotes: undefined,
    canManage: req.user ? canManage(req.user, issue) : false,
    allowedStatuses: req.user?.role === 'admin' ? STATUSES.filter((s) => s !== issue.status) : TRANSITIONS[issue.status],
  });
});

router.post('/', requireAuth, requireRole('citizen'), validate(createSchema), async (req, res) => {
  const issue = await Issue.create({
    ...req.body,
    reporter: req.user._id,
    upvotes: [req.user._id],
    history: [{ status: 'reported', note: 'Issue reported', by: req.user._id }],
  });
  const authorities = await User.find({ role: 'authority', department: issue.category, active: true }).select('_id');
  await notify(authorities.map((a) => a._id), `New ${issue.category} issue reported: "${issue.title}"`, issue._id);
  res.status(201).json(issue);
});

router.patch('/:id/status', requireAuth, requireRole('authority', 'admin'), validate(statusSchema), async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new HttpError(404, 'Issue not found');
  if (!canManage(req.user, issue)) throw new HttpError(403, 'This issue is outside your department');

  const { status, note } = req.body;
  if (status === issue.status) throw new HttpError(400, `Issue is already ${STATUS_LABELS[status]}`);
  if (req.user.role !== 'admin' && !TRANSITIONS[issue.status].includes(status)) {
    throw new HttpError(400, `Cannot move from ${STATUS_LABELS[issue.status]} to ${STATUS_LABELS[status]}`);
  }
  if ((status === 'rejected' || status === 'resolved') && !note) {
    throw new HttpError(400, 'Please add a note explaining the resolution or rejection');
  }

  issue.status = status;
  issue.resolvedAt = status === 'resolved' ? new Date() : null;
  if (!issue.assignedTo && req.user.role === 'authority') issue.assignedTo = req.user._id;
  issue.history.push({ status, note, by: req.user._id });
  await issue.save();

  await notify(
    [issue.reporter, ...issue.upvotes].filter((u) => String(u) !== String(req.user._id)),
    `"${issue.title}" is now ${STATUS_LABELS[status]}${note ? `: ${note}` : ''}`,
    issue._id
  );
  res.json({ message: 'Status updated', status: issue.status });
});

router.patch('/:id/assign', requireAuth, requireRole('admin'), validate(assignSchema), async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new HttpError(404, 'Issue not found');

  if (req.body.assignedTo !== undefined) {
    if (req.body.assignedTo) {
      const officer = await User.findOne({ _id: req.body.assignedTo, role: 'authority' });
      if (!officer) throw new HttpError(400, 'Selected officer does not exist');
      issue.assignedTo = officer._id;
      await notify([officer._id], `You were assigned: "${issue.title}"`, issue._id);
    } else {
      issue.assignedTo = null;
    }
  }
  if (req.body.priority) issue.priority = req.body.priority;
  await issue.save();
  res.json({ message: 'Issue updated' });
});

router.post('/:id/upvote', requireAuth, async (req, res) => {
  const issue = await Issue.findById(req.params.id).select('upvotes');
  if (!issue) throw new HttpError(404, 'Issue not found');
  const has = issue.upvotes.some((u) => String(u) === String(req.user._id));
  await Issue.updateOne({ _id: issue._id }, has ? { $pull: { upvotes: req.user._id } } : { $addToSet: { upvotes: req.user._id } });
  res.json({ upvoted: !has, upvoteCount: issue.upvotes.length + (has ? -1 : 1) });
});

router.post('/:id/comments', requireAuth, validate(commentSchema), async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new HttpError(404, 'Issue not found');
  issue.comments.push({ user: req.user._id, text: req.body.text });
  await issue.save();
  if (String(issue.reporter) !== String(req.user._id)) {
    await notify([issue.reporter], `${req.user.name} commented on "${issue.title}"`, issue._id);
  }
  const saved = issue.comments.at(-1);
  res.status(201).json({ ...saved.toObject(), user: { _id: req.user._id, name: req.user.name, role: req.user.role } });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw new HttpError(404, 'Issue not found');
  const isOwner = String(issue.reporter) === String(req.user._id);
  if (!(req.user.role === 'admin' || (isOwner && issue.status === 'reported'))) {
    throw new HttpError(403, 'You can only delete your own issues before they are acknowledged');
  }
  await issue.deleteOne();
  await Notification.deleteMany({ issue: issue._id });
  res.json({ message: 'Issue deleted' });
});

export default router;
