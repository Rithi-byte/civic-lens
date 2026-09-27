import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Menu, X, ScanSearch, LogOut, Plus } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext';
import api from '../lib/api';
import { timeAgo } from '../lib/constants';

function Notifications() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });
  const ref = useRef(null);
  const location = useLocation();

  const load = () => api.get('/notifications').then(({ data }) => setData(data)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [location.pathname]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && data.unread) {
      await api.patch('/notifications/read-all').catch(() => {});
      setData((d) => ({ ...d, unread: 0 }));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-[1000] mt-2 max-h-96 w-80 overflow-y-auto">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Notifications</p>
          {data.items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up</p>}
          {data.items.map((n) => (
            <Link
              key={n._id}
              to={n.issue ? `/issues/${n.issue}` : '#'}
              onClick={() => setOpen(false)}
              className={`block border-b border-slate-50 px-4 py-3 text-sm hover:bg-slate-50 ${n.read ? 'text-slate-600' : 'bg-brand-50/60 text-slate-900'}`}
            >
              {n.message}
              <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: '/issues', label: 'Browse Issues' },
    user?.role === 'citizen' && { to: '/my-issues', label: 'My Reports' },
    user?.role === 'authority' && { to: '/dashboard', label: 'Department Queue' },
    user?.role === 'admin' && { to: '/admin', label: 'Admin Dashboard' },
  ].filter(Boolean);

  const linkCls = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

  const doLogout = () => {
    logout();
    setMobile(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to={homeFor(user)} className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <span className="rounded-lg bg-brand-600 p-1.5 text-white">
            <ScanSearch className="h-5 w-5" />
          </span>
          Civic<span className="-ml-2 text-brand-600">Lens</span>
        </Link>

        <div className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkCls}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(!user || user.role === 'citizen') && (
            <Link to="/report" className="btn-primary hidden sm:inline-flex">
              <Plus className="h-4 w-4" /> Report Issue
            </Link>
          )}
          {user ? (
            <>
              <Notifications />
              <div className="hidden items-center gap-3 md:flex">
                <div className="text-right leading-tight">
                  <p className="text-sm font-semibold">{user.name}</p>
                  <p className="text-xs capitalize text-slate-500">{user.role}</p>
                </div>
                <button onClick={doLogout} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" title="Log out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : (
            <Link to="/login" className="btn-outline hidden md:inline-flex">
              Log in
            </Link>
          )}
          <button className="rounded-lg p-2 md:hidden" onClick={() => setMobile((m) => !m)} aria-label="Menu">
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {mobile && (
        <div className="space-y-1 border-t border-slate-200 bg-white px-4 py-3 md:hidden" onClick={() => setMobile(false)}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={(s) => `block ${linkCls(s)}`}>
              {l.label}
            </NavLink>
          ))}
          {(!user || user.role === 'citizen') && (
            <NavLink to="/report" className={(s) => `block ${linkCls(s)}`}>
              Report Issue
            </NavLink>
          )}
          {user ? (
            <button onClick={doLogout} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
              Log out ({user.name})
            </button>
          ) : (
            <NavLink to="/login" className={(s) => `block ${linkCls(s)}`}>
              Log in / Sign up
            </NavLink>
          )}
        </div>
      )}
    </header>
  );
}
