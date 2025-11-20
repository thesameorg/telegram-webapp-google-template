import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getInitData } from './lib/telegram';
import { authenticate } from './lib/api';
import { Feed } from './components/Feed';
import { NotFound } from './pages/NotFound';
import { AuthUnavailable } from './pages/AuthUnavailable';
import { Loading } from './components/ui';
import { STORAGE_KEYS } from './lib/constants';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const initData = getInitData();

    if (!initData) {
      setIsAuthenticating(false);
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.JWT);
    const storedInitData = localStorage.getItem(STORAGE_KEYS.INIT_DATA);

    if (token && storedInitData === initData) {
      setIsAuthenticated(true);
      setIsAuthenticating(false);
      return;
    }

    if (token && storedInitData !== initData) {
      localStorage.removeItem(STORAGE_KEYS.JWT);
      localStorage.removeItem(STORAGE_KEYS.INIT_DATA);
    }

    authenticate(initData)
      .then(({ token }) => {
        localStorage.setItem(STORAGE_KEYS.JWT, token);
        localStorage.setItem(STORAGE_KEYS.INIT_DATA, initData);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEYS.JWT);
        localStorage.removeItem(STORAGE_KEYS.INIT_DATA);
      })
      .finally(() => {
        setIsAuthenticating(false);
      });
  }, []);

  if (isAuthenticating) return <Loading message="Authenticating..." />;
  if (!isAuthenticated) return <Navigate to="/auth-unavailable" replace />;

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
