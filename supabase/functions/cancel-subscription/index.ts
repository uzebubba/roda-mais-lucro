import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LogDetails = Record<string, unknown>;

const logStep = (step: string, details?: LogDetails) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

const getIsoFromUnix = (timestamp?: number | null) => {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    let immediate = false;
    try {
      const body = await req.json();
      immediate = Boolean(body?.immediate);
    } catch {
      immediate = false;
    }
    logStep("Cancel mode resolved", { immediate });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found for this user");
    }
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found");
    }

    const subscription = subscriptions.data[0];
    logStep("Found active subscription", { subscriptionId: subscription.id });

    let canceledSubscription;
    if (immediate) {
      canceledSubscription = await stripe.subscriptions.cancel(subscription.id);
      logStep("Subscription canceled immediately", { subscriptionId: subscription.id });
    } else {
      canceledSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
      logStep("Subscription set to cancel at period end", {
        subscriptionId: subscription.id,
        cancelAt: getIsoFromUnix(
          canceledSubscription.cancel_at ??
            canceledSubscription.current_period_end ??
            subscription.current_period_end
        ),
      });
    }

    const cancelAtIso = immediate
      ? null
      : getIsoFromUnix(
          canceledSubscription.cancel_at ??
            canceledSubscription.current_period_end ??
            subscription.current_period_end
        );

    return new Response(
      JSON.stringify({
        success: true,
        canceled: true,
        immediate,
        subscription_id: subscription.id,
        cancel_at: cancelAtIso,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in cancel-subscription", { message: errorMessage });

    const normalizedMessage = (() => {
      if (errorMessage === "No active subscription found") {
        return "No active subscription found";
      }
      if (errorMessage === "No Stripe customer found for this user") {
        return "No Stripe customer found for this user";
      }
      if (errorMessage.startsWith("Authentication error")) {
        return "Authentication error";
      }
      if (errorMessage === "No authorization header provided") {
        return "No authorization header provided";
      }
      return "Unexpected error while canceling subscription";
    })();

    return new Response(JSON.stringify({ error: normalizedMessage, canceled: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: normalizedMessage === "Unexpected error while canceling subscription" ? 500 : 400,
    });
  }
});
