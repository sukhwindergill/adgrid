import { useAuth } from '../../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

export function RequirePlatformOwner({ children }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile?.is_platform_owner) return <Navigate to="/app" replace />;
  return children;
}
