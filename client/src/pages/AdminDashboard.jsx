import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ListChecks, AlertCircle, CheckCircle2, Clock, UserPlus, Search } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import api, { errMsg } from '../lib/api';
import { CATEGORIES, STATUSES } from '../lib/constants';
import IssueTable from '../components/IssueTable';
import { Spinner, Empty, StatCard, Pagination } from '../components/ui';

function ChartCard({ title, children }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-slate-900">{title}</h3>
      <div className="h-64">{children}</div>
    </div>
  );
}

function Analytics({ stats }) {
  const statusData = Object.entries(STATUSES).map(([k, s]) => ({ name: s.label, value: stats.byStatus[k] || 0, color: s.color })).filter((d) => d.value);
  const catData = stats.byCategory.map((c) => ({ name: CATEGORIES[c.category]?.label.split(' ')[0], count: c.count, color: CATEGORIES[c.category]?.color }));
  const trend = stats.trend.map((d) => ({ ...d, day: new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Issues by status">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {statusData.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Issues by category">
        <ResponsiveContainer>
          <BarChart data={catData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {catData.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Reported vs resolved (last 14 days)">
        <ResponsiveContainer>
          <AreaChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="reported" stroke="#ef4444" fill="#ef444433" />
            <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="#10b98133" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Hotspot areas">
        <ResponsiveContainer>
          <BarChart data={stats.byArea} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="area" tick={{ fontSize: 12 }} width={90} />
            <Tooltip />
            <Bar dataKey="count" fill="#0d9488" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function AllIssues() {
  const [filters, setFilters] = useState({ q: '', status: 'open', category: '', page: 1 });
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setData(null);
    const params = Object.fromEntries(Object.entries({ ...filters, sort: 'priority', limit: 10 }).filter(([, v]) => v));
    api.get('/issues', { params }).then(({ data }) => setData(data)).catch((err) => setError(errMsg(err)));
  }, [filters, reload]);

  const set = (patch) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  return (
    <div>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <form onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() }); }} className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className="input pl-9" aria-label="Search issues" placeholder="Search issues…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="input" aria-label="Filter by status" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="open">Open (needs action)</option>
          <option value="">All statuses</option>
          {Object.entries(STATUSES).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select className="input" aria-label="Filter by category" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
      </div>
      {error ? (
        <Empty title="Could not load issues" text={error} />
      ) : !data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty title="No issues found" />
      ) : (
        <>
          <IssueTable issues={data.items} onChanged={() => setReload((r) => r + 1)} />
          <Pagination page={data.page} pages={data.pages} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', department: 'roads' });
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/users').then(({ data }) => setUsers(data)).catch((err) => toast.error(errMsg(err)));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Name must be at least 2 characters');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return toast.error('Enter a valid email');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setBusy(true);
    try {
      await api.post('/users', { ...form, role: 'authority' });
      toast.success('Authority account created');
      setForm({ name: '', email: '', password: '', department: 'roads' });
      load();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u._id}`, { active: !u.active });
      toast.success(u.active ? 'User deactivated' : 'User activated');
      load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card overflow-x-auto">
        {!users ? <Spinner /> : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned / Resolved</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u._id} className={u.active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3">{CATEGORIES[u.department]?.label || '—'}</td>
                  <td className="px-4 py-3">{u.role === 'authority' ? `${u.assigned} / ${u.resolved}` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'admin' && (
                      <button onClick={() => toggle(u)} className={`rounded-full px-3 py-1 text-xs font-semibold ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <form onSubmit={create} className="card h-fit space-y-3 p-5" noValidate>
        <h3 className="flex items-center gap-2 font-semibold text-slate-900"><UserPlus className="h-5 w-5 text-brand-600" /> Add authority officer</h3>
        <input className="input" aria-label="Full name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" type="email" aria-label="Official email" placeholder="Official email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="password" aria-label="Temporary password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="input" aria-label="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create officer'}</button>
      </form>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/stats').then(({ data }) => setStats(data)).catch((err) => toast.error(errMsg(err)));
  }, [tab]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Admin dashboard</h1>
      <p className="text-sm text-slate-500">City-wide overview of civic issues, department performance and users.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ListChecks} label="Total issues" value={stats?.total} />
        <StatCard icon={AlertCircle} label="Open issues" value={stats?.open} tone="text-rose-600 bg-rose-50" />
        <StatCard icon={CheckCircle2} label="Resolution rate" value={stats ? `${stats.resolutionRate}%` : null} tone="text-emerald-600 bg-emerald-50" />
        <StatCard icon={Clock} label="Avg. resolution time" value={stats?.avgResolutionHours != null ? `${stats.avgResolutionHours} hrs` : '—'} tone="text-blue-600 bg-blue-50" />
      </div>

      <div className="mt-8 flex gap-1 border-b border-slate-200">
        {[['overview', 'Analytics'], ['issues', 'Manage issues'], ['users', 'Users & officers']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (stats ? <Analytics stats={stats} /> : <Spinner />)}
        {tab === 'issues' && <AllIssues />}
        {tab === 'users' && <Users />}
      </div>
    </div>
  );
}
