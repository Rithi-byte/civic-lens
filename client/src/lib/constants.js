import { Construction, Droplets, Zap, Trash2, Waves, CircleHelp } from 'lucide-react';

export const CATEGORIES = {
  roads: { label: 'Roads & Potholes', icon: Construction, color: '#f59e0b', bg: 'bg-amber-100 text-amber-800' },
  water: { label: 'Water Supply', icon: Droplets, color: '#3b82f6', bg: 'bg-blue-100 text-blue-800' },
  electricity: { label: 'Electricity & Lights', icon: Zap, color: '#eab308', bg: 'bg-yellow-100 text-yellow-800' },
  sanitation: { label: 'Garbage & Sanitation', icon: Trash2, color: '#16a34a', bg: 'bg-green-100 text-green-800' },
  drainage: { label: 'Drainage & Sewage', icon: Waves, color: '#8b5cf6', bg: 'bg-violet-100 text-violet-800' },
  other: { label: 'Other', icon: CircleHelp, color: '#64748b', bg: 'bg-slate-100 text-slate-700' },
};

export const STATUSES = {
  reported: { label: 'Reported', color: '#ef4444', bg: 'bg-rose-100 text-rose-700' },
  acknowledged: { label: 'Acknowledged', color: '#f59e0b', bg: 'bg-amber-100 text-amber-800' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'bg-blue-100 text-blue-700' },
  resolved: { label: 'Resolved', color: '#10b981', bg: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', color: '#64748b', bg: 'bg-slate-200 text-slate-700' },
};

export const PRIORITIES = {
  low: { label: 'Low', bg: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Medium', bg: 'bg-sky-100 text-sky-700' },
  high: { label: 'High', bg: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', bg: 'bg-red-600 text-white' },
};

export const DEFAULT_CENTER = [12.98, 80.2];

export const timeAgo = (date) => {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  const units = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [secs, name] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
};
