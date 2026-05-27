import { Navigate } from 'react-router-dom';

export function SplashPage() {
  return <Navigate to="/login" replace />;
}