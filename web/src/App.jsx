import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import AppPage from './pages/AppPage';

function RequireSetup({ children }) {
  const url = localStorage.getItem('kugiConvexUrl');
  if (!url) return <Navigate to="/setup" replace />;
  return children;
}

function LandingRoute() {
  const navigate = useNavigate();
  function handleGetStarted() {
    localStorage.setItem('kugiVisited', '1');
    navigate('/setup');
  }
  return <Landing onGetStarted={handleGetStarted} />;
}

function SetupRoute() {
  const navigate = useNavigate();
  return <Setup onComplete={() => navigate('/app')} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/setup" element={<SetupRoute />} />
        <Route path="/app" element={
          <RequireSetup>
            <AppPage />
          </RequireSetup>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
