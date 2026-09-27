import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth, homeFor } from './context/AuthContext';
import Navbar from './components/Navbar';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import Issues from './pages/Issues';
import IssueDetail from './pages/IssueDetail';
import ReportIssue from './pages/ReportIssue';
import MyIssues from './pages/MyIssues';
import AuthorityDashboard from './pages/AuthorityDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Login, Register } from './pages/Auth';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

const NotFound = () => (
  <div className="py-24 text-center">
    <p className="text-6xl font-extrabold text-brand-600">404</p>
    <p className="mt-2 text-slate-600">This page does not exist.</p>
    <Link to="/" className="btn-primary mt-6">
      Go home
    </Link>
  </div>
);

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/issues/:id" element={<IssueDetail />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/report" element={<Protected roles={['citizen']}><ReportIssue /></Protected>} />
          <Route path="/my-issues" element={<Protected roles={['citizen']}><MyIssues /></Protected>} />
          <Route path="/dashboard" element={<Protected roles={['authority']}><AuthorityDashboard /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        CivicLens &middot; Making local problems visible, trackable and actionable.
      </footer>
    </div>
  );
}
