import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { StudioAppBar } from './components/StudioAppBar';
import { useAuth } from './contexts/useAuth';
import { StudioChromeProvider } from './contexts/StudioChrome';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectPage } from './pages/ProjectPage';
import './App.css';

function ProtectedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const wideMain = location.pathname.startsWith('/projects/');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <StudioChromeProvider>
      <div className="shell shell--studio">
        <StudioAppBar />
        <main className={`main${wideMain ? ' main-wide' : ''}`}>
          <Outlet />
        </main>
      </div>
    </StudioChromeProvider>
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
