import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const MAX_TRANSACTIONS_PER_MINUTE = 60;

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ allowed: false, reason: "missing_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const accessToken = authHeader.replace("Bearer ", "").trim();
  if (!accessToken) {
    return new Response(JSON.stringify({ allowed: false, reason: "invalid_token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase credentials in Edge Function environment");
    return new Response(
      JSON.stringify({ allowed: false, reason: "server_not_configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return new Response(JSON.stringify({ allowed: false, reason: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const since = new Date(Date.now() - 60_000).toISOString();

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (countError) {
    console.error("Failed to count transactions", countError);
    return new Response(JSON.stringify({ allowed: false, reason: "count_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if ((count ?? 0) >= MAX_TRANSACTIONS_PER_MINUTE) {
    return new Response(
      JSON.stringify({
        allowed: false,
        reason: "rate_limited",
        limit: MAX_TRANSACTIONS_PER_MINUTE,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({
      allowed: true,
      limit: MAX_TRANSACTIONS_PER_MINUTE,
      remaining: MAX_TRANSACTIONS_PER_MINUTE - (count ?? 0),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

serve(handler);

