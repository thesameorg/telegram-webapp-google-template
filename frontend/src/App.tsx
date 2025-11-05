import { useEffect, useState } from 'react';
import { getInitData } from './lib/telegram';
import { authenticate } from './lib/api';
import { Feed } from './components/Feed';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we already have a JWT token
    const token = localStorage.getItem('jwt');
    if (token) {
      setIsAuthenticated(true);
      setIsAuthenticating(false);
      return;
    }

    // Authenticate with Telegram initData
    const initData = getInitData();
    if (!initData) {
      setError('Not running in Telegram WebApp');
      setIsAuthenticating(false);
      return;
    }

    authenticate(initData)
      .then(({ token }) => {
        localStorage.setItem('jwt', token);
        setIsAuthenticated(true);
        setError(null);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      })
      .finally(() => {
        setIsAuthenticating(false);
      });
  }, []);

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-4">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">Please open this app in Telegram</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Feed />
    </div>
  );
}

export default App;
