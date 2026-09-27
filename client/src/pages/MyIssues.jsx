import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Clock, Hammer, CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { STATUSES } from '../lib/constants';
import IssueCard from '../components/IssueCard';
import { Spinner, Empty, StatCard, Pagination } from '../components/ui';

export default function MyIssues() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [all, setAll] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/issues', { params: { mine: true, limit: 50 } }).then(({ data }) => setAll(data.items)).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .get('/issues', { params: { mine: true, status: status || undefined, page, limit: 9 } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(errMsg(err)));
  }, [status, page]);

  const count = (s) => all.filter((i) => (Array.isArray(s) ? s.includes(i.status) : i.status === s)).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hi {user.name.split(' ')[0]}, here are your reports</h1>
          <p className="text-sm text-slate-500">Track every issue you have raised and see how the authorities are responding.</p>
        </div>
        <Link to="/report" className="btn-primary">
          <Plus className="h-4 w-4" /> New report
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total reported" value={all.length} />
        <StatCard icon={Clock} label="Awaiting action" value={count(['reported', 'acknowledged'])} tone="text-amber-600 bg-amber-50" />
        <StatCard icon={Hammer} label="In progress" value={count('in_progress')} tone="text-blue-600 bg-blue-50" />
        <StatCard icon={CheckCircle2} label="Resolved" value={count('resolved')} tone="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(STATUSES).map(([k, s]) => [k, s.label])].map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setStatus(k);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${status === k ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {error ? (
          <Empty title="Could not load your reports" text={error} />
        ) : !data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty
            title={status ? 'No reports with this status' : 'You have not reported anything yet'}
            text="Spotted a pothole, broken streetlight or garbage pile? Report it in under a minute."
            action={<Link to="/report" className="btn-primary">Report an issue</Link>}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((i) => (
                <IssueCard key={i._id} issue={i} />
              ))}
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
