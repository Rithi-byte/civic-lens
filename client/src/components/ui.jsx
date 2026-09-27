import { Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { CATEGORIES, STATUSES, PRIORITIES } from '../lib/constants';

export const Spinner = ({ className = '' }) => (
  <div className={`flex justify-center py-12 ${className}`}>
    <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
  </div>
);

export const Empty = ({ title = 'Nothing here yet', text, action }) => (
  <div className="card flex flex-col items-center px-6 py-14 text-center">
    <Inbox className="mb-3 h-10 w-10 text-slate-300" />
    <p className="font-semibold text-slate-700">{title}</p>
    {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const Pill = ({ className, children }) => (
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
    {children}
  </span>
);

export const StatusBadge = ({ status }) => {
  const s = STATUSES[status] || STATUSES.reported;
  return (
    <Pill className={s.bg}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Pill>
  );
};

export const CategoryBadge = ({ category }) => {
  const c = CATEGORIES[category] || CATEGORIES.other;
  const Icon = c.icon;
  return (
    <Pill className={c.bg}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Pill>
  );
};

export const PriorityBadge = ({ priority }) => {
  const p = PRIORITIES[priority] || PRIORITIES.medium;
  return <Pill className={p.bg}>{p.label}</Pill>;
};

export const Pagination = ({ page, pages, onChange }) =>
  pages > 1 && (
    <div className="mt-6 flex items-center justify-center gap-3">
      <button className="btn-outline px-3" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm text-slate-600">
        Page {page} of {pages}
      </span>
      <button className="btn-outline px-3" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

export const StatCard = ({ label, value, icon: Icon, tone = 'text-brand-600 bg-brand-50', hint }) => (
  <div className="card flex items-center gap-4 p-5">
    {Icon && (
      <div className={`rounded-lg p-3 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
    )}
    <div>
      <p className="text-2xl font-bold text-slate-900">{value ?? '–'}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  </div>
);
