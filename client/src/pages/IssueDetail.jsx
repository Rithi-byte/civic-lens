import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, MapPin, ThumbsUp, User, Calendar, Send, Trash2, ShieldCheck, Clock } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, STATUSES, PRIORITIES, timeAgo } from '../lib/constants';
import { StatusBadge, CategoryBadge, PriorityBadge, Spinner, Empty } from '../components/ui';
import { SinglePointMap } from '../components/Maps';

function StatusTimeline({ history }) {
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200">
      {history.map((h, i) => (
        <li key={i} className="mb-5 ml-5 last:mb-0">
          <span
            className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white"
            style={{ background: STATUSES[h.status]?.color }}
          />
          <p className="text-sm font-semibold text-slate-900">{STATUSES[h.status]?.label}</p>
          {h.note && <p className="text-sm text-slate-600">{h.note}</p>}
          <p className="text-xs text-slate-400">
            {h.by?.name ? `${h.by.name} · ` : ''}
            {new Date(h.at).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ManagePanel({ issue, onDone }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(issue.allowedStatuses[0] || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [officers, setOfficers] = useState([]);
  const needsNote = status === 'resolved' || status === 'rejected';

  useEffect(() => {
    if (user.role === 'admin') api.get('/users', { params: { role: 'authority' } }).then(({ data }) => setOfficers(data));
  }, [user.role]);

  const updateStatus = async (e) => {
    e.preventDefault();
    if (needsNote && !note.trim()) return toast.error('Please add a note for this status');
    setBusy(true);
    try {
      await api.patch(`/issues/${issue._id}/status`, { status, note });
      toast.success(`Marked as ${STATUSES[status].label}`);
      setNote('');
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (patch) => {
    try {
      await api.patch(`/issues/${issue._id}/assign`, patch);
      toast.success('Issue updated');
      onDone();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="card border-brand-200 bg-brand-50/40 p-5">
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <ShieldCheck className="h-5 w-5 text-brand-600" /> Take action
      </h3>
      {issue.allowedStatuses.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">This issue is closed. No further status changes are possible.</p>
      ) : (
        <form onSubmit={updateStatus} className="mt-3 space-y-3">
          <div>
            <label className="label">Move status to</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {issue.allowedStatuses.map((s) => (
                <option key={s} value={s}>{STATUSES[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Note to citizen {needsNote ? '(required)' : '(optional)'}</label>
            <textarea
              className="input"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={status === 'resolved' ? 'What was done to fix it?' : 'e.g. Crew scheduled for Monday'}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Updating…' : 'Update status'}</button>
        </form>
      )}

      {user.role === 'admin' && (
        <div className="mt-5 space-y-3 border-t border-brand-100 pt-4">
          <div>
            <label className="label">Assigned officer</label>
            <select className="input" value={issue.assignedTo?._id || ''} onChange={(e) => assign({ assignedTo: e.target.value || null })}>
              <option value="">Unassigned</option>
              {officers.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name} · {CATEGORIES[o.department]?.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={issue.priority} onChange={(e) => assign({ priority: e.target.value })}>
              {Object.entries(PRIORITIES).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssueDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const load = () =>
    api
      .get(`/issues/${id}`)
      .then(({ data }) => setIssue(data))
      .catch((err) => setError(errMsg(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const requireLogin = () => {
    toast('Please log in first');
    navigate('/login', { state: { from: `/issues/${id}` } });
  };

  const upvote = async () => {
    if (!user) return requireLogin();
    try {
      const { data } = await api.post(`/issues/${id}/upvote`);
      setIssue((i) => ({ ...i, ...data }));
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!user) return requireLogin();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/issues/${id}/comments`, { text: comment });
      setIssue((i) => ({ ...i, comments: [...i.comments, data] }));
      setComment('');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPosting(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this issue permanently?')) return;
    try {
      await api.delete(`/issues/${id}`);
      toast.success('Issue deleted');
      navigate(user.role === 'admin' ? '/admin' : '/my-issues');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  if (error) return <div className="mx-auto max-w-3xl px-4 py-10"><Empty title="Issue not found" text={error} action={<Link to="/issues" className="btn-primary">Browse issues</Link>} /></div>;
  if (!issue) return <Spinner className="py-24" />;

  const cat = CATEGORIES[issue.category] || CATEGORIES.other;
  const CatIcon = cat.icon;
  const isOwner = user && issue.reporter?._id === user._id;
  const canDelete = user && (user.role === 'admin' || (isOwner && issue.status === 'reported'));
  const hasCoords = issue.location?.lat != null && issue.location?.lng != null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            {issue.image ? (
              <img src={issue.image} alt={issue.title} className="max-h-[420px] w-full object-cover" />
            ) : (
              <div className="flex h-48 items-center justify-center" style={{ background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}55)` }}>
                <CatIcon className="h-16 w-16" style={{ color: cat.color }} />
              </div>
            )}
            <div className="p-6">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={issue.status} />
                <CategoryBadge category={issue.category} />
                <PriorityBadge priority={issue.priority} />
              </div>
              <h1 className="mt-3 text-2xl font-bold text-slate-900">{issue.title}</h1>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{issue.location.area ? `${issue.location.area}, ` : ''}{issue.location.address}</span>
                <span className="flex items-center gap-1"><User className="h-4 w-4" />{issue.reporter?.name}</span>
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{timeAgo(issue.createdAt)}</span>
              </div>
              <p className="mt-4 whitespace-pre-line text-slate-700">{issue.description}</p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button onClick={upvote} className={issue.upvoted ? 'btn-primary' : 'btn-outline'}>
                  <ThumbsUp className="h-4 w-4" /> {issue.upvoted ? 'Upvoted' : 'I face this too'} · {issue.upvoteCount}
                </button>
                {canDelete && (
                  <button onClick={remove} className="btn-outline text-rose-600">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-slate-900">Discussion ({issue.comments.length})</h2>
            <div className="mt-4 space-y-4">
              {issue.comments.length === 0 && <p className="text-sm text-slate-500">No comments yet. Be the first to add details.</p>}
              {issue.comments.map((c) => (
                <div key={c._id} className="flex gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${c.user?.role === 'citizen' ? 'bg-slate-200 text-slate-700' : 'bg-brand-600 text-white'}`}>
                    {c.user?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-50 px-4 py-2.5">
                    <p className="text-sm font-semibold">
                      {c.user?.name || 'Deleted user'}
                      {c.user && c.user.role !== 'citizen' && (
                        <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">Official</span>
                      )}
                      <span className="ml-2 text-xs font-normal text-slate-400">{timeAgo(c.createdAt)}</span>
                    </p>
                    <p className="text-sm text-slate-700">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} className="mt-5 flex gap-2">
              <input
                className="input"
                placeholder={user ? 'Add a comment or update…' : 'Log in to comment'}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button className="btn-primary" disabled={posting} aria-label="Post comment">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <aside className="space-y-6">
          {issue.canManage && <ManagePanel key={issue.status} issue={issue} onDone={load} />}

          <div className="card p-5">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <Clock className="h-5 w-5 text-brand-600" /> Status timeline
            </h3>
            <StatusTimeline history={issue.history} />
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold text-slate-900">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Department</dt><dd className="text-right font-medium">{cat.label}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Assigned to</dt><dd className="text-right font-medium">{issue.assignedTo?.name || 'Not yet assigned'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Reported on</dt><dd className="text-right font-medium">{new Date(issue.createdAt).toLocaleDateString()}</dd></div>
              {issue.resolvedAt && (
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Resolved on</dt><dd className="text-right font-medium">{new Date(issue.resolvedAt).toLocaleDateString()}</dd></div>
              )}
            </dl>
            {hasCoords && (
              <div className="mt-4">
                <SinglePointMap lat={issue.location.lat} lng={issue.location.lng} color={STATUSES[issue.status]?.color} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
