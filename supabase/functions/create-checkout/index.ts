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
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const resolveOrigin = (req: Request) => {
  const headerOrigin = req.headers.get("origin");
  if (headerOrigin && headerOrigin !== "null") {
    return headerOrigin;
  }
  return Deno.env.get("SITE_URL") ?? "http://localhost:5173";
};

const resolveReturnUrl = (candidate: unknown, origin: string, fallbackPath: string) => {
  const buildUrl = (path: string) => new URL(path, origin).toString();

  if (!candidate || typeof candidate !== "string") {
    return buildUrl(fallbackPath);
  }

  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) {
      return buildUrl(fallbackPath);
    }
    return url.toString();
  } catch (_error) {
    return buildUrl(fallbackPath);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const body = await req.json();
    const { priceId, successUrl: requestedSuccessUrl, cancelUrl: requestedCancelUrl } = body ?? {};
    if (!priceId) throw new Error("priceId is required");
    logStep("Price ID received", { priceId });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    let eligibleForTrial = false;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create during checkout");
      eligibleForTrial = true;
    }

    const origin = resolveOrigin(req);
    const successUrl = resolveReturnUrl(requestedSuccessUrl, origin, "/assinatura?checkout=success");
    const cancelUrl = resolveReturnUrl(requestedCancelUrl, origin, "/assinatura");
    const trialingParams = eligibleForTrial
      ? {
          subscription_data: {
            trial_period_days: 7,
          },
        }
      : undefined;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...trialingParams,
    });
    logStep("Checkout session created", {
      sessionId: session.id,
      url: session.url,
      successUrl,
      cancelUrl,
      eligibleForTrial,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
