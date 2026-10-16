import { useAuth } from '../../context/AuthContext.jsx';
import { Navigate, useLocation } from 'react-router-dom';
import { RETURN_TO_KEY } from '../../lib/returnTo.js';


export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    try { sessionStorage.setItem(RETURN_TO_KEY, location.pathname + location.search); } catch { /* storage unavailable */ }
    return <Navigate to="/login" replace />;
  }
  try { sessionStorage.removeItem(RETURN_TO_KEY); } catch { /* storage unavailable */ }
  return children;
}
