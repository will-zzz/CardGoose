import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/useAuth';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectPage } from './pages/ProjectPage';
import './App.css';

function ProtectedLayout() {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="shell">
      <nav className="top-nav">
        <span className="brand">CardboardForge</span>
        <span className="user-pill">{user.username}</span>
        <button type="button" className="link-btn" onClick={logout}>
          Log out
        </button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
