import type { ReactNode } from "react";
import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import FullPageLoader from "@/components/FullPageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useRealtimeSync(Boolean(user));

  // Restore intended path after OAuth if we were redirected to "/"
  // This complements the storage set in Login's Google handler.
  const OAUTH_REDIRECT_PATH_KEY = "postAuthRedirectPath";

  useEffect(() => {
    if (user && typeof window !== "undefined") {
      const storedRedirect = window.sessionStorage.getItem(OAUTH_REDIRECT_PATH_KEY);
      if (storedRedirect && storedRedirect !== location.pathname) {
        window.sessionStorage.removeItem(OAUTH_REDIRECT_PATH_KEY);
        navigate(storedRedirect, { replace: true });
      }
    }
  }, [user, location.pathname, navigate]);

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
