import type { ReactNode } from "react";
import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import FullPageLoader from "@/components/FullPageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useSubscription } from "@/contexts/SubscriptionContext";

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { subscribed, loading: subscriptionLoading } = useSubscription();
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

  if (loading || subscriptionLoading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check if user has active subscription
  if (!subscribed) {
    return <Navigate to="/assinatura" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
