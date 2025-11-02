/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type SubscriptionStatus = {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
  loading: boolean;
  initialized: boolean;
  lastCheckedUserId: string | null;
};

type SubscriptionContextValue = Omit<SubscriptionStatus, "lastCheckedUserId"> & {
  checkSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

const SUBSCRIPTION_TIERS = {
  MENSAL: {
    price_id: "price_1SP36rFjEgMAqKc1KqkVAjrJ",
    product_id: "prod_TLkcPzdXlwKhGv",
    name: "Plano Mensal",
    price: "R$ 29,90/mês",
  },
  ANUAL: {
    price_id: "price_1SP5H1FjEgMAqKc1xSvUBUbH",
    product_id: "prod_TLkcPzdXlwKhGv",
    name: "Plano Anual",
    price: "R$ 199,90/ano",
  },
};

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    subscribed: false,
    product_id: null,
    price_id: null,
    subscription_end: null,
    loading: true,
    initialized: false,
    lastCheckedUserId: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionStatus({
        subscribed: false,
        product_id: null,
        price_id: null,
        subscription_end: null,
        loading: false,
        initialized: true,
        lastCheckedUserId: null,
      });
      return;
    }

    try {
      setSubscriptionStatus(prev => ({
        ...prev,
        loading: true,
        initialized: prev.lastCheckedUserId === user.id ? prev.initialized : false,
      }));
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("No active session");
      }

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscriptionStatus({
        subscribed: data.subscribed ?? false,
        product_id: data.product_id ?? null,
        price_id: data.price_id ?? null,
        subscription_end: data.subscription_end ?? null,
        loading: false,
        initialized: true,
        lastCheckedUserId: user.id,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
      setSubscriptionStatus({
        subscribed: false,
        product_id: null,
        price_id: null,
        subscription_end: null,
        loading: false,
        initialized: true,
        lastCheckedUserId: user.id,
      });
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Recheck subscription on page visibility change (e.g., returning from Stripe checkout)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        checkSubscription();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkSubscription, user]);

  const value = useMemo<SubscriptionContextValue>(() => {
    const initializedForUser = !user
      ? true
      : subscriptionStatus.initialized && subscriptionStatus.lastCheckedUserId === user.id;

    return {
      subscribed: subscriptionStatus.subscribed,
      product_id: subscriptionStatus.product_id,
      price_id: subscriptionStatus.price_id,
      subscription_end: subscriptionStatus.subscription_end,
      loading: subscriptionStatus.loading,
      initialized: initializedForUser,
      checkSubscription,
    };
  }, [checkSubscription, subscriptionStatus, user]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

export { SUBSCRIPTION_TIERS };
