import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

type ChannelDescriptor = {
  key: string;
  table: string;
  events?: Array<"INSERT" | "UPDATE" | "DELETE">;
  queryKey: Parameters<QueryClient["invalidateQueries"]>[0];
};

const CHANNELS: ChannelDescriptor[] = [
  {
    key: "transactions",
    table: "transactions",
    queryKey: { queryKey: ["transactions"] },
  },
  {
    key: "fixed-expenses",
    table: "fixed_expenses",
    queryKey: { queryKey: ["fixedExpenses"] },
  },
  {
    key: "fuel-entries",
    table: "fuel_entries",
    queryKey: { queryKey: ["fuelEntries"] },
  },
  {
    key: "vehicle-states",
    table: "vehicle_states",
    queryKey: { queryKey: ["vehicleState"] },
  },
  {
    key: "oil-reminders",
    table: "oil_reminders",
    queryKey: { queryKey: ["oilSettings"] },
  },
  {
    key: "work-sessions",
    table: "work_sessions",
    queryKey: { queryKey: ["workSessions"] },
  },
  {
    key: "user-profiles",
    table: "user_profiles",
    queryKey: { queryKey: ["userProfile"] },
  },
];

export const useRealtimeSync = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const activeChannels = CHANNELS.map((descriptor) => {
      const channel = supabase
        .channel(`${descriptor.key}-realtime`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: descriptor.table,
          },
          () => {
            queryClient.invalidateQueries(descriptor.queryKey);
          },
        )
        .subscribe();
      return channel;
    });

    return () => {
      activeChannels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [enabled, queryClient]);
};
