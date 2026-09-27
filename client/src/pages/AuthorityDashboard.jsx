import { useEffect, useState } from 'react';
import { Inbox, Clock, Hammer, CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, STATUSES } from '../lib/constants';
import IssueTable from '../components/IssueTable';
import { Spinner, Empty, StatCard, Pagination } from '../components/ui';

const TABS = [
  ['open', 'Needs action'],
  ['reported', 'New'],
  ['acknowledged', 'Acknowledged'],
  ['in_progress', 'In Progress'],
  ['resolved', 'Resolved'],
  ['', 'All'],
];

export default function AuthorityDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const dept = CATEGORIES[user.department];

  useEffect(() => {
    api.get('/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, [reload]);

  useEffect(() => {
    setData(null);
    api
      .get('/issues', { params: { scope: 'department', sort: 'priority', page, limit: 10, status: tab || undefined } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(errMsg(err)));
  }, [tab, page, reload]);

  const s = stats?.byStatus || {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        {dept && (
          <span className="rounded-xl p-3" style={{ background: `${dept.color}22` }}>
            <dept.icon className="h-6 w-6" style={{ color: dept.color }} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{dept?.label || 'Department'} queue</h1>
          <p className="text-sm text-slate-500">Welcome, {user.name}. Acknowledge, work on and resolve issues in your department.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label="New reports" value={s.reported || 0} tone="text-rose-600 bg-rose-50" />
        <StatCard icon={Clock} label="Acknowledged" value={s.acknowledged || 0} tone="text-amber-600 bg-amber-50" />
        <StatCard icon={Hammer} label="In progress" value={s.in_progress || 0} tone="text-blue-600 bg-blue-50" />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={s.resolved || 0}
          tone="text-emerald-600 bg-emerald-50"
          hint={stats?.avgResolutionHours != null ? `Avg ${stats.avgResolutionHours} hrs to resolve` : undefined}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {error ? (
          <Empty title="Could not load the queue" text={error} />
        ) : !data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty title="Queue is clear" text={`No ${tab && tab !== 'open' ? STATUSES[tab].label.toLowerCase() : 'pending'} issues right now. Great work!`} />
        ) : (
          <>
            <IssueTable issues={data.items} onChanged={() => setReload((r) => r + 1)} showCategory={false} />
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
