import { useState, useMemo, Component } from 'react';
import { HashRouter, BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 40, color: '#fff', fontFamily: 'system-ui', background: '#080808', minHeight: '100dvh' }}>
        <h2 style={{ color: '#f43f5e', marginBottom: 12 }}>Something went wrong</h2>
        <pre style={{ fontSize: 12, color: '#888', whiteSpace: 'pre-wrap', marginBottom: 24 }}>
          {this.state.error?.message}
        </pre>
        <button onClick={() => { localStorage.removeItem('kugiConvexUrl'); window.location.href = '/setup'; }}
          style={{ padding: '10px 20px', background: '#4f7cff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          Reset & go to setup
        </button>
      </div>
    );
  }
}
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import AppPage from './pages/AppPage';

// Use HashRouter when loaded as a local file (Electron production),
// BrowserRouter otherwise (web, Electron dev via localhost).
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

function getStoredUrl() {
  return localStorage.getItem('kugiConvexUrl') ?? null;
}

function PreSetupApp() {
  const navigate = useNavigate();
  return (
    <Routes>
      <Route path="/" element={
        <Landing onGetStarted={() => { localStorage.setItem('kugiVisited', '1'); navigate('/setup'); }} />
      } />
      <Route path="/setup" element={
        <Setup onComplete={() => { window.location.href = window.location.protocol === 'file:' ? '#/app' : '/app'; }} />
      } />
      {/* Unknown paths (e.g. Electron loading /app before setup) → setup, not landing */}
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

function MainApp() {
  return (
    <Routes>
      <Route path="/app" element={<AppPage />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default function App() {
  const [convexUrl] = useState(getStoredUrl);

  const convexClient = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    [convexUrl],
  );

  if (!convexClient) {
    return (
      <Router>
        <PreSetupApp />
      </Router>
    );
  }

  return (
    <ErrorBoundary>
      <ConvexProvider client={convexClient}>
        <Router>
          <MainApp />
        </Router>
      </ConvexProvider>
    </ErrorBoundary>
  );
}
