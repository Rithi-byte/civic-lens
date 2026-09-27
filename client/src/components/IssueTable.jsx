import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ThumbsUp } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { STATUSES, timeAgo } from '../lib/constants';
import { StatusBadge, CategoryBadge, PriorityBadge } from './ui';

// Next step in the standard workflow, for the one-click action button
const NEXT = {
  reported: 'acknowledged',
  acknowledged: 'in_progress',
  in_progress: 'resolved',
};

export default function IssueTable({ issues, onChanged, showCategory = true }) {
  const [busyId, setBusyId] = useState(null);

  const advance = async (issue) => {
    const status = NEXT[issue.status];
    let note = '';
    if (status === 'resolved') {
      note = prompt('Describe how the issue was resolved:');
      if (!note?.trim()) return;
    }
    setBusyId(issue._id);
    try {
      await api.patch(`/issues/${issue._id}/status`, { status, note });
      toast.success(`Moved to ${STATUSES[status].label}`);
      onChanged();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Issue</th>
            {showCategory && <th className="px-4 py-3">Category</th>}
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Assigned</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {issues.map((i) => (
            <tr key={i._id} className="hover:bg-slate-50">
              <td className="max-w-xs px-4 py-3">
                <Link to={`/issues/${i._id}`} className="font-semibold text-slate-900 hover:text-brand-600">
                  {i.title}
                </Link>
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{i.location?.area || i.location?.address}</span> · {timeAgo(i.createdAt)} ·
                  <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{i.upvoteCount}</span>
                </p>
              </td>
              {showCategory && <td className="px-4 py-3"><CategoryBadge category={i.category} /></td>}
              <td className="px-4 py-3"><PriorityBadge priority={i.priority} /></td>
              <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
              <td className="px-4 py-3 text-slate-600">{i.assignedTo?.name || <span className="text-slate-500">—</span>}</td>
              <td className="px-4 py-3 text-right">
                {NEXT[i.status] ? (
                  <button onClick={() => advance(i)} disabled={busyId === i._id} className="btn-outline whitespace-nowrap px-3 py-1.5 text-xs">
                    {busyId === i._id ? '…' : `Mark ${STATUSES[NEXT[i.status]].label}`}
                  </button>
                ) : (
                  <Link to={`/issues/${i._id}`} className="text-xs font-semibold text-brand-600">View</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
