import { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Setup from './pages/Setup';
import AppPage from './pages/AppPage';

export default function App() {
  const [screen, setScreen] = useState('loading');

  useEffect(() => {
    const url = localStorage.getItem('kugiConvexUrl');
    if (url) {
      setScreen('app');
    } else {
      const visited = localStorage.getItem('kugiVisited');
      setScreen(visited ? 'setup' : 'landing');
    }
  }, []);

  function handleGetStarted() {
    localStorage.setItem('kugiVisited', '1');
    setScreen('setup');
  }

  function handleSetupComplete() {
    setScreen('app');
  }

  if (screen === 'loading') return null;
  if (screen === 'landing') return <Landing onGetStarted={handleGetStarted} />;
  if (screen === 'setup') return <Setup onComplete={handleSetupComplete} />;
  return <AppPage />;
}
