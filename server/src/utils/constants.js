export const ROLES = ['citizen', 'authority', 'admin'];

export const CATEGORIES = ['roads', 'water', 'electricity', 'sanitation', 'drainage', 'other'];

export const STATUSES = ['reported', 'acknowledged', 'in_progress', 'resolved', 'rejected'];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Workflow an authority must follow. Admins may set any status.
export const TRANSITIONS = {
  reported: ['acknowledged', 'rejected'],
  acknowledged: ['in_progress', 'rejected'],
  in_progress: ['resolved'],
  resolved: [],
  rejected: [],
};

export const STATUS_LABELS = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
};
