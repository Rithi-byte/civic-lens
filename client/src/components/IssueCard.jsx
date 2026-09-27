import { Link } from 'react-router-dom';
import { MapPin, ThumbsUp, MessageSquare } from 'lucide-react';
import { CATEGORIES, timeAgo } from '../lib/constants';
import api from '../lib/api';
import { StatusBadge, CategoryBadge, PriorityBadge } from './ui';

export default function IssueCard({ issue }) {
  const cat = CATEGORIES[issue.category] || CATEGORIES.other;
  const Icon = cat.icon;

  return (
    <Link
      to={`/issues/${issue._id}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-40 overflow-hidden bg-slate-100">
        {issue.hasImage ? (
          <img
            src={`${api.defaults.baseURL}/issues/${issue._id}/image`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}55)` }}
          >
            <Icon className="h-12 w-12" style={{ color: cat.color }} />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={issue.status} />
        </div>
        {(issue.priority === 'critical' || issue.priority === 'high') && (
          <div className="absolute right-3 top-3">
            <PriorityBadge priority={issue.priority} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <CategoryBadge category={issue.category} />
        <h3 className="mt-2 line-clamp-2 font-semibold text-slate-900">{issue.title}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {issue.location?.area ? `${issue.location.area} · ` : ''}
            {issue.location?.address}
          </span>
        </p>
        <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
          <span>{timeAgo(issue.createdAt)}</span>
          <span className="flex items-center gap-3">
            <span className={`flex items-center gap-1 ${issue.upvoted ? 'font-semibold text-brand-600' : ''}`}>
              <ThumbsUp className="h-3.5 w-3.5" /> {issue.upvoteCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> {issue.commentCount ?? 0}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
