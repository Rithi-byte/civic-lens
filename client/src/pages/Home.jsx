import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Building2, CheckCircle2, ArrowRight, Users, ListChecks, Clock, TrendingUp } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import IssueCard from '../components/IssueCard';
import { IssuesMap } from '../components/Maps';
import { StatCard, Spinner } from '../components/ui';

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState(null);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    api.get('/stats').then(({ data }) => setStats(data)).catch(() => {});
    api.get('/issues', { params: { limit: 6, sort: 'top' } }).then(({ data }) => setRecent(data.items)).catch(() => setRecent([]));
    api.get('/issues/map').then(({ data }) => setPoints(data)).catch(() => {});
  }, []);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 text-white">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Civic issue reporting &amp; resolution
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl">
              See a problem? <br />
              <span className="text-brand-100">Report it. Track it. Fix it.</span>
            </h1>
            <p className="mt-4 max-w-lg text-brand-50/90">
              CivicLens connects citizens directly with the authorities who can act, making potholes, broken
              streetlights, garbage and water issues visible, trackable and accountable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {(!user || user.role === 'citizen') && (
                <Link to="/report" className="bg-white px-5 py-3 text-brand-700 hover:bg-brand-50 inline-flex items-center gap-2 rounded-lg font-semibold">
                  <Camera className="h-4 w-4" /> Report an issue
                </Link>
              )}
              <Link to="/issues" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
                Browse issues <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 self-center">
            {[
              ['Issues reported', stats?.total],
              ['Resolved', stats?.resolved],
              ['Resolution rate', stats ? `${stats.resolutionRate}%` : null],
              ['Avg. fix time', stats?.avgResolutionHours != null ? `${Math.round(stats.avgResolutionHours / 24)} days` : null],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                <p className="text-3xl font-extrabold">{value ?? '–'}</p>
                <p className="text-sm text-brand-100">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-slate-900">How CivicLens works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            [Camera, '1. Report', 'Snap a photo, pin the location on the map and describe the problem in under a minute.'],
            [Building2, '2. Route & act', 'The issue goes straight to the responsible department, which acknowledges it and starts work.'],
            [CheckCircle2, '3. Track & resolve', 'Follow every status change on a public timeline and get notified when it is fixed.'],
          ].map(([Icon, title, text]) => (
            <div key={title} className="card p-6">
              <Icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Live issue map</h2>
            <p className="text-sm text-slate-500">Every reported problem across the city, colored by status.</p>
          </div>
        </div>
        <IssuesMap points={points} height={420} />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Most supported issues</h2>
            <p className="text-sm text-slate-500">Upvote issues that affect you so they get prioritised.</p>
          </div>
          <Link to="/issues" className="text-sm font-semibold text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        {!recent ? (
          <Spinner />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((i) => (
              <IssueCard key={i._id} issue={i} />
            ))}
          </div>
        )}
      </section>

      {stats && (
        <section className="border-t border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Registered citizens" value={stats.citizens} />
            <StatCard icon={ListChecks} label="Open issues" value={stats.open} tone="text-rose-600 bg-rose-50" />
            <StatCard icon={TrendingUp} label="Resolved issues" value={stats.resolved} tone="text-emerald-600 bg-emerald-50" />
            <StatCard icon={Clock} label="Avg. resolution time (hrs)" value={stats.avgResolutionHours} tone="text-blue-600 bg-blue-50" />
          </div>
        </section>
      )}
    </>
  );
}
