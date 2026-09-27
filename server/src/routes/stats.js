import { Router } from 'express';
import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

const countBy = (field, match = {}) =>
  Issue.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1 } }]);

// Public transparency stats. Authorities get their department's numbers.
router.get('/', optionalAuth, async (req, res) => {
  const match = req.user?.role === 'authority' ? { category: req.user.department } : {};
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [byStatus, byCategory, byArea, resolution, trend, citizens] = await Promise.all([
    countBy('status', match),
    countBy('category', match),
    Issue.aggregate([
      { $match: { ...match, 'location.area': { $ne: '' } } },
      { $group: { _id: '$location.area', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Issue.aggregate([
      { $match: { ...match, status: 'resolved', resolvedAt: { $ne: null } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } },
    ]),
    Issue.aggregate([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          reported: { $sum: 1 },
        },
      },
    ]),
    User.countDocuments({ role: 'citizen' }),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const total = byStatus.reduce((n, s) => n + s.count, 0);

  const resolvedTrend = await Issue.aggregate([
    { $match: { ...match, resolvedAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt' } }, resolved: { $sum: 1 } } },
  ]);
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      reported: trend.find((t) => t._id === key)?.reported || 0,
      resolved: resolvedTrend.find((t) => t._id === key)?.resolved || 0,
    });
  }

  res.json({
    total,
    open: (statusMap.reported || 0) + (statusMap.acknowledged || 0) + (statusMap.in_progress || 0),
    resolved: statusMap.resolved || 0,
    byStatus: statusMap,
    byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
    byArea: byArea.map((a) => ({ area: a._id, count: a.count })),
    avgResolutionHours: resolution[0] ? Math.round(resolution[0].avgMs / 36e5) : null,
    resolutionRate: total ? Math.round(((statusMap.resolved || 0) / total) * 100) : 0,
    trend: days,
    citizens,
  });
});

export default router;
