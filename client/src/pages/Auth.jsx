import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ScanSearch } from 'lucide-react';
import { useAuth, homeFor } from '../context/AuthContext';
import { errMsg } from '../lib/api';

const DEMO = [
  ['Citizen', 'citizen@civiclens.in'],
  ['Authority (Roads)', 'roads@civiclens.in'],
  ['Admin', 'admin@civiclens.in'],
];

function Shell({ title, subtitle, children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <div className="mb-6 text-center">
        <span className="inline-flex rounded-xl bg-brand-600 p-2.5 text-white">
          <ScanSearch className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="card p-6">{children}</div>
    </div>
  );
}

const validateEmail = (v) => (/^\S+@\S+\.\S+$/.test(v) ? '' : 'Enter a valid email');

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    const errs = { email: validateEmail(creds.email), password: creds.password ? '' : 'Password is required' };
    setErrors(errs);
    if (errs.email || errs.password) return;
    setBusy(true);
    try {
      const user = await login(creds.email, creds.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Log in to CivicLens" subtitle="Report and track issues in your neighbourhood">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here? <Link to="/register" className="font-semibold text-brand-600">Create a citizen account</Link>
      </p>
      <div className="mt-6 border-t border-slate-100 pt-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Demo accounts (one click)</p>
        <div className="grid grid-cols-3 gap-2">
          {DEMO.map(([label, email]) => (
            <button
              key={email}
              type="button"
              disabled={busy}
              onClick={() => submit(null, { email, password: 'password123' })}
              className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:border-brand-500 hover:bg-brand-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', area: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {
      name: form.name.trim().length >= 2 ? '' : 'Name must be at least 2 characters',
      email: validateEmail(form.email),
      password: form.password.length >= 6 ? '' : 'Password must be at least 6 characters',
      confirm: form.password === form.confirm ? '' : 'Passwords do not match',
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      await register(payload);
      toast.success('Account created! You can now report issues.');
      navigate('/report', { replace: true });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, type = 'text', extra = {}) => (
    <div>
      <label className="label" htmlFor={key}>{label}</label>
      <input id={key} type={type} className="input" value={form[key]} onChange={set(key)} {...extra} />
      {errors[key] && <p className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <Shell title="Create your account" subtitle="Join citizens making their city better">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field('name', 'Full name')}
        {field('email', 'Email', 'email')}
        {field('area', 'Your area / locality (optional)', 'text', { placeholder: 'e.g. Tambaram' })}
        <div className="grid grid-cols-2 gap-3">
          {field('password', 'Password', 'password')}
          {field('confirm', 'Confirm', 'password')}
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already registered? <Link to="/login" className="font-semibold text-brand-600">Log in</Link>
      </p>
    </Shell>
  );
}
