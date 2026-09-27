import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, LocateFixed, X } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, PRIORITIES } from '../lib/constants';
import { compressImage } from '../lib/image';
import { LocationPicker } from '../components/Maps';

export default function ReportIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    address: '',
    area: user?.area || '',
  });
  const [coords, setCoords] = useState(null);
  const [image, setImage] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImage(await compressImage(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported by your browser');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success('Location captured');
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location. Tap the map instead.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 5) e.title = 'Title must be at least 5 characters';
    if (form.description.trim().length < 15) e.description = 'Please describe the issue in at least 15 characters';
    if (!form.category) e.category = 'Choose a category';
    if (form.address.trim().length < 3) e.address = 'Address or landmark is required';
    if (!coords) e.coords = 'Tap on the map or use your current location';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return toast.error('Please fix the highlighted fields');
    setBusy(true);
    try {
      const { data } = await api.post('/issues', {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
        image,
        location: { address: form.address, area: form.area, ...coords },
      });
      toast.success('Issue reported! The department has been notified.');
      navigate(`/issues/${data._id}`);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Report a civic issue</h1>
      <p className="text-sm text-slate-500">Your report goes straight to the responsible department and is visible to the public.</p>

      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-2" noValidate>
        <div className="card space-y-4 p-6">
          <div>
            <label className="label">Category *</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(CATEGORIES).map(([k, c]) => {
                const Icon = c.icon;
                const active = form.category === k;
                return (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setForm({ ...form, category: k })}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition ${
                      active ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" style={{ color: c.color }} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            {errors.category && <p className="field-error">{errors.category}</p>}
          </div>
          <div>
            <label className="label" htmlFor="title">Title *</label>
            <input id="title" className="input" maxLength={120} placeholder="e.g. Deep pothole near bus stop" value={form.title} onChange={set('title')} />
            {errors.title && <p className="field-error">{errors.title}</p>}
          </div>
          <div>
            <label className="label" htmlFor="desc">Description *</label>
            <textarea id="desc" className="input" rows={4} maxLength={2000} placeholder="What is the problem, since when, and how does it affect people?" value={form.description} onChange={set('description')} />
            <div className="flex justify-between">
              {errors.description ? <p className="field-error">{errors.description}</p> : <span />}
              <span className="text-xs text-slate-400">{form.description.length}/2000</span>
            </div>
          </div>
          <div>
            <label className="label">How urgent is it?</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRIORITIES).map(([k, p]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setForm({ ...form, priority: k })}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${form.priority === k ? p.bg + ' ring-2 ring-offset-1 ring-slate-300' : 'bg-slate-100 text-slate-500'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Photo (recommended)</label>
            {image ? (
              <div className="relative">
                <img src={image} alt="Preview" className="h-48 w-full rounded-lg object-cover" />
                <button type="button" onClick={() => setImage('')} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow" aria-label="Remove photo">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-500 hover:bg-brand-50">
                <Camera className="mb-1 h-6 w-6" />
                Click to upload or take a photo
                <span className="text-xs text-slate-400">PNG, JPG or WEBP</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="hidden" onChange={pickImage} />
              </label>
            )}
          </div>
        </div>

        <div className="card space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="address">Address / landmark *</label>
              <input id="address" className="input" placeholder="e.g. Near SRM main gate" value={form.address} onChange={set('address')} />
              {errors.address && <p className="field-error">{errors.address}</p>}
            </div>
            <div>
              <label className="label" htmlFor="area">Area / locality</label>
              <input id="area" className="input" placeholder="e.g. Potheri" value={form.area} onChange={set('area')} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0">Pin the exact location *</label>
              <button type="button" onClick={useMyLocation} disabled={locating} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 disabled:opacity-50">
                <LocateFixed className="h-4 w-4" /> {locating ? 'Locating…' : 'Use my location'}
              </button>
            </div>
            <LocationPicker value={coords} onChange={setCoords} height={340} />
            {coords ? (
              <p className="mt-1 text-xs text-slate-500">Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}. Tap elsewhere to move it.</p>
            ) : (
              <p className={errors.coords ? 'field-error' : 'mt-1 text-xs text-slate-500'}>{errors.coords || 'Tap on the map to drop a pin.'}</p>
            )}
          </div>
          <button className="btn-primary w-full py-3" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  );
}
