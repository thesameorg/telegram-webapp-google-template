import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getInitData } from './lib/telegram';
import { authenticate } from './lib/api';
import { Feed } from './components/Feed';
import { NotFound } from './pages/NotFound';
import { AuthUnavailable } from './pages/AuthUnavailable';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(() => {
    const initData = getInitData();

    if (!initData) {
      setAuthFailed(true);
      setIsAuthenticating(false);
      return;
    }

    const token = localStorage.getItem('jwt');
    const storedInitData = localStorage.getItem('initData');

    if (token && storedInitData === initData) {
      setIsAuthenticated(true);
      setIsAuthenticating(false);
      return;
    }

    if (token && storedInitData !== initData) {
      localStorage.removeItem('jwt');
      localStorage.removeItem('initData');
    }

    authenticate(initData)
      .then(({ token }) => {
        localStorage.setItem('jwt', token);
        localStorage.setItem('initData', initData);
        setIsAuthenticated(true);
      })
      .catch((error) => {
        console.error('Authentication failed:', error);
        localStorage.removeItem('jwt');
        localStorage.removeItem('initData');
        setAuthFailed(true);
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

  if (authFailed) {
    return <Navigate to="/auth-unavailable" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth-unavailable" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-100">
                <Feed />
              </div>
            </ProtectedRoute>
          }
        />
        <Route path="/auth-unavailable" element={<AuthUnavailable />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
