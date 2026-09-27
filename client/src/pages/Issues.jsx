import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, Map as MapIcon, X } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { CATEGORIES, STATUSES } from '../lib/constants';
import IssueCard from '../components/IssueCard';
import { IssuesMap } from '../components/Maps';
import { Spinner, Empty, Pagination } from '../components/ui';

export default function Issues() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [points, setPoints] = useState([]);
  const [q, setQ] = useState(params.get('q') || '');
  const view = params.get('view') || 'grid';

  const filters = {
    q: params.get('q') || '',
    category: params.get('category') || '',
    status: params.get('status') || '',
    sort: params.get('sort') || 'new',
    page: Number(params.get('page') || 1),
  };

  const update = (patch) => {
    const next = { ...filters, view, ...patch };
    if (!('page' in patch)) next.page = 1;
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'page' && v === 1) && !(k === 'view' && v === 'grid'))));
  };

  useEffect(() => {
    setData(null);
    setError('');
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api
      .get('/issues', { params: { ...clean, limit: 12 } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(errMsg(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  useEffect(() => {
    if (view === 'map' && points.length === 0) api.get('/issues/map').then(({ data }) => setPoints(data));
  }, [view, points.length]);

  const filteredPoints = points.filter(
    (p) => (!filters.category || p.category === filters.category) && (!filters.status || p.status === filters.status)
  );
  const hasFilters = filters.q || filters.category || filters.status;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community Issues</h1>
          <p className="text-sm text-slate-500">{data ? `${data.total} issue${data.total === 1 ? '' : 's'} found` : 'Loading…'}</p>
        </div>
        <div className="flex rounded-lg border border-slate-300 bg-white p-1">
          {[
            ['grid', LayoutGrid, 'List'],
            ['map', MapIcon, 'Map'],
          ].map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => update({ view: v, page: filters.page })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${view === v ? 'bg-brand-600 text-white' : 'text-slate-600'}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-5 grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: q.trim() });
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input className="input pl-9" aria-label="Search issues" placeholder="Search title, description or location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select className="input" aria-label="Filter by category" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">All categories</option>
          {Object.entries(CATEGORIES).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
        <select className="input" aria-label="Filter by status" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(STATUSES).map(([k, s]) => (
            <option key={k} value={k}>{s.label}</option>
          ))}
        </select>
        <select className="input" aria-label="Sort issues" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
          <option value="new">Newest first</option>
          <option value="top">Most upvoted</option>
          <option value="priority">Highest priority</option>
          <option value="old">Oldest first</option>
        </select>
      </div>
      {hasFilters && (
        <button
          onClick={() => {
            setQ('');
            setParams(view === 'map' ? { view } : {});
          }}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600"
        >
          <X className="h-4 w-4" /> Clear filters
        </button>
      )}

      <div className="mt-6">
        {view === 'map' ? (
          <IssuesMap points={filteredPoints} height={560} />
        ) : error ? (
          <Empty title="Could not load issues" text={error} />
        ) : !data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <Empty title="No issues match your filters" text="Try a different search term or clear the filters." />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((i) => (
                <IssueCard key={i._id} issue={i} />
              ))}
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={(p) => update({ page: p })} />
          </>
        )}
      </div>
    </div>
  );
}
