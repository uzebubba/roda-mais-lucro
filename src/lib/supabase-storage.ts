import { supabase } from "@/integrations/supabase/client";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description: string;
  category?: string;
  platform?: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  paid: boolean;
}

export interface FuelEntry {
  id: string;
  mode: "automatic" | "manual";
  pricePerLiter: number;
  totalCost: number;
  liters: number;
  kmCurrent: number;
  kmSinceLast: number;
  consumption: number;
  costPerKm: number;
  createdAt: string;
}

export interface VehicleState {
  currentKm: number;
  lastUpdated: string;
}

export interface OilReminderSettings {
  intervalKm: number;
  lastChangeKm: number;
  lastChangeDate: string;
}

export interface UserProfile {
  fullName: string;
  email: string;
  avatarInitials?: string;
  dailyGoal?: number;
  monthlyGoal?: number;
}

export interface WorkSession {
  id: string;
  startTime: string;
  endTime?: string | null;
}

export interface WeeklyWorkSummary {
  date: string;
  totalMinutes: number;
}

export interface TodayStats {
  trips: number;
  workMinutes: number;
  profit: number;
  avgProfitPerTrip: number;
  isWorking: boolean;
  activeSessionStart: string | null;
}

const nowIso = () => new Date().toISOString();

type PostgrestErrorLike = {
  code?: string;
  status?: number;
  message?: string;
  details?: string;
  hint?: string;
};

const isPermissionDenied = (error: unknown): error is PostgrestErrorLike => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as PostgrestErrorLike & { statusCode?: number };
  const status = err.status ?? err.statusCode;
  if (typeof status === "number" && status === 403) {
    return true;
  }
  const code = err.code?.toUpperCase();
  if (code === "42501" || code === "PGRST301" || code === "PGRST302") {
    return true;
  }
  const message = err.message?.toLowerCase() ?? "";
  return (
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("not allowed")
  );
};

const logPermissionFallback = (resource: string, error: unknown) => {
  console.warn(
    `[Supabase permissions] Falling back to safe defaults for "${resource}". Configure RLS policies to remove this warning.`,
    error,
  );
};

const requireUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
};

const mapTransaction = (row: Tables<"transactions">): Transaction => ({
  id: row.id,
  type: row.type as Transaction["type"],
  amount: row.amount,
  date: row.date,
  description: row.description,
  category: row.category ?? undefined,
  platform: row.platform ?? undefined,
});

const mapFixedExpense = (row: Tables<"fixed_expenses">): FixedExpense => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  dueDay: row.due_day,
  paid: row.paid,
});

const mapFuelEntry = (row: Tables<"fuel_entries">): FuelEntry => ({
  id: row.id,
  mode: row.mode as FuelEntry["mode"],
  pricePerLiter: row.price_per_liter,
  totalCost: row.total_cost,
  liters: row.liters,
  kmCurrent: row.km_current,
  kmSinceLast: row.km_since_last,
  consumption: row.consumption ?? 0,
  costPerKm: row.cost_per_km ?? 0,
  createdAt: row.created_at,
});

const mapVehicleState = (row: Tables<"vehicle_states">): VehicleState => ({
  currentKm: row.current_km,
  lastUpdated: row.last_updated,
});

const mapWorkSession = (row: Tables<"work_sessions">): WorkSession => ({
  id: row.id,
  startTime: row.start_time,
  endTime: row.end_time,
});

const calculateMinutesForDate = (
  sessions: WorkSession[],
  date: Date,
  now: Date,
): number => {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  return sessions.reduce((total, session) => {
    const startMs = new Date(session.startTime).getTime();
    const endMs = session.endTime ? new Date(session.endTime).getTime() : nowMs;

    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return total;
    }

    if (endMs <= dayStartMs || startMs >= dayEndMs) {
      return total;
    }

    const effectiveStart = Math.max(startMs, dayStartMs);
    const effectiveEnd = Math.min(endMs, dayEndMs);
    if (effectiveEnd <= effectiveStart) {
      return total;
    }

    return total + Math.floor((effectiveEnd - effectiveStart) / (1000 * 60));
  }, 0);
};

const sortSessionsByStartDesc = (sessions: WorkSession[]) =>
  sessions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );

export const getTransactions = async (): Promise<Transaction[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("transactions", error);
      return [];
    }
    throw error;
  }
  return (data ?? []).map(mapTransaction);
};

export const addTransaction = async (
  transaction: Omit<Transaction, "id">,
): Promise<Transaction> => {
  const user = await requireUser();
  const payload: TablesInsert<"transactions"> = {
    user_id: user.id,
    type: transaction.type,
    amount: transaction.amount,
    date: transaction.date,
    description: transaction.description,
    category: transaction.category ?? null,
    platform: transaction.platform ?? null,
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapTransaction(data);
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const user = await requireUser();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) {
    throw error;
  }
};

export const getFixedExpenses = async (): Promise<FixedExpense[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("due_day", { ascending: true });
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("fixed_expenses", error);
      return [];
    }
    throw error;
  }
  return (data ?? []).map(mapFixedExpense);
};

export const addFixedExpense = async (
  expense: Omit<FixedExpense, "id">,
): Promise<FixedExpense> => {
  const user = await requireUser();
  const payload: TablesInsert<"fixed_expenses"> = {
    user_id: user.id,
    name: expense.name,
    amount: expense.amount,
    due_day: expense.dueDay,
    paid: expense.paid ?? false,
  };

  const { data, error } = await supabase
    .from("fixed_expenses")
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapFixedExpense(data);
};

export const toggleFixedExpensePaid = async (
  id: string,
): Promise<FixedExpense> => {
  const user = await requireUser();
  const { data: current, error: fetchError } = await supabase
    .from("fixed_expenses")
    .select("paid")
    .eq("user_id", user.id)
    .eq("id", id)
    .single();
  if (fetchError) {
    throw fetchError;
  }
  const { data, error } = await supabase
    .from("fixed_expenses")
    .update({
      paid: !current?.paid,
      updated_at: nowIso(),
    })
    .eq("user_id", user.id)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return mapFixedExpense(data);
};

export const deleteFixedExpense = async (id: string): Promise<void> => {
  const user = await requireUser();
  const { error } = await supabase
    .from("fixed_expenses")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);
  if (error) {
    throw error;
  }
};

export const getFuelEntries = async (): Promise<FuelEntry[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("fuel_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("fuel_entries", error);
      return [];
    }
    throw error;
  }
  return (data ?? []).map(mapFuelEntry);
};

export const addFuelEntry = async (entry: {
  mode: "automatic" | "manual";
  pricePerLiter: number;
  totalCost: number;
  liters?: number;
  kmCurrent: number;
}): Promise<FuelEntry> => {
  const user = await requireUser();

  const { data: lastEntryData, error: lastError } = await supabase
    .from("fuel_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (lastError) {
    throw lastError;
  }
  const previous = lastEntryData?.[0];

  const liters =
    entry.mode === "automatic"
      ? entry.pricePerLiter > 0
        ? entry.totalCost / entry.pricePerLiter
        : 0
      : entry.liters ?? 0;

  const kmSinceLast =
    previous && entry.kmCurrent > previous.km_current
      ? entry.kmCurrent - previous.km_current
      : 0;

  const consumption =
    kmSinceLast > 0 && liters > 0 ? kmSinceLast / liters : 0;
  const costPerKm = kmSinceLast > 0 ? entry.totalCost / kmSinceLast : 0;

  const payload: TablesInsert<"fuel_entries"> = {
    user_id: user.id,
    mode: entry.mode,
    price_per_liter: entry.pricePerLiter,
    total_cost: entry.totalCost,
    liters,
    km_current: entry.kmCurrent,
    km_since_last: kmSinceLast,
    consumption,
    cost_per_km: costPerKm,
  };

  const { data, error } = await supabase
    .from("fuel_entries")
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw error;
  }

  await setVehicleKm(entry.kmCurrent);

  return mapFuelEntry(data);
};

export const getFuelStats = async (
  existingEntries?: FuelEntry[],
) => {
  const entries = existingEntries ?? (await getFuelEntries());
  if (entries.length === 0) {
    return {
      averageConsumption: 0,
      averageCostPerKm: 0,
      totalKm: 0,
      totalLiters: 0,
      totalSpent: 0,
    };
  }

  const totals = entries.reduce(
    (acc, item) => {
      if (item.kmSinceLast > 0 && item.liters > 0) {
        acc.totalKm += item.kmSinceLast;
        acc.totalLiters += item.liters;
      }
      acc.totalSpent += item.totalCost;
      return acc;
    },
    { totalKm: 0, totalLiters: 0, totalSpent: 0 },
  );

  return {
    averageConsumption:
      totals.totalKm > 0 && totals.totalLiters > 0
        ? totals.totalKm / totals.totalLiters
        : 0,
    averageCostPerKm:
      totals.totalKm > 0 ? totals.totalSpent / totals.totalKm : 0,
    totalKm: totals.totalKm,
    totalLiters: totals.totalLiters,
    totalSpent: totals.totalSpent,
  };
};

export const getVehicleState = async (): Promise<VehicleState> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("vehicle_states")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("vehicle_states", error);
      return {
        currentKm: 0,
        lastUpdated: nowIso(),
      };
    }
    throw error;
  }

  if (data) {
    return mapVehicleState(data);
  }

  const entries = await getFuelEntries();
  const fallbackKm = entries.length > 0 ? entries[0].kmCurrent : 0;
  const payload: TablesInsert<"vehicle_states"> = {
    user_id: user.id,
    current_km: fallbackKm,
    last_updated: nowIso(),
  };

  const { data: created, error: createError } = await supabase
    .from("vehicle_states")
    .insert(payload)
    .select()
    .single();
  if (createError) {
    if (isPermissionDenied(createError)) {
      logPermissionFallback("vehicle_states", createError);
      return {
        currentKm: fallbackKm,
        lastUpdated: nowIso(),
      };
    }
    throw createError;
  }
  return mapVehicleState(created);
};

export const setVehicleKm = async (km: number): Promise<void> => {
  const user = await requireUser();
  const payload: TablesInsert<"vehicle_states"> = {
    user_id: user.id,
    current_km: km,
    last_updated: nowIso(),
  };
  const { error } = await supabase
    .from("vehicle_states")
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    throw error;
  }
};

export const getOilReminderSettings =
  async (): Promise<OilReminderSettings> => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("oil_reminders")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      if (isPermissionDenied(error)) {
        logPermissionFallback("oil_reminders", error);
        return {
          intervalKm: 5000,
          lastChangeKm: 0,
          lastChangeDate: nowIso(),
        };
      }
      throw error;
    }

    if (data) {
      return {
        intervalKm: data.interval_km,
        lastChangeKm: data.last_change_km,
        lastChangeDate: data.last_change_date,
      };
    }

    const vehicle = await getVehicleState();
    const payload: TablesInsert<"oil_reminders"> = {
      user_id: user.id,
      interval_km: 5000,
      last_change_km: vehicle.currentKm,
      last_change_date: nowIso(),
    };

    const { data: created, error: createError } = await supabase
      .from("oil_reminders")
      .insert(payload)
      .select()
      .single();
    if (createError) {
      if (isPermissionDenied(createError)) {
        logPermissionFallback("oil_reminders", createError);
        return {
          intervalKm: payload.interval_km ?? 5000,
          lastChangeKm: payload.last_change_km ?? 0,
          lastChangeDate: payload.last_change_date ?? nowIso(),
        };
      }
      throw createError;
    }

    return {
      intervalKm: created.interval_km,
      lastChangeKm: created.last_change_km,
      lastChangeDate: created.last_change_date,
    };
  };

export const updateOilReminderSettings = async (
  updates: Partial<
    Pick<OilReminderSettings, "intervalKm" | "lastChangeKm" | "lastChangeDate">
  >,
): Promise<OilReminderSettings> => {
  const user = await requireUser();
  const current = await getOilReminderSettings();
  const payload: TablesUpdate<"oil_reminders"> = {
    interval_km: updates.intervalKm ?? current.intervalKm,
    last_change_km: updates.lastChangeKm ?? current.lastChangeKm,
    last_change_date: updates.lastChangeDate ?? current.lastChangeDate,
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("oil_reminders")
    .update(payload)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("oil_reminders", error);
      return current;
    }
    throw error;
  }

  return {
    intervalKm: data.interval_km,
    lastChangeKm: data.last_change_km,
    lastChangeDate: data.last_change_date,
  };
};

export const registerOilChange = async (
  km: number,
): Promise<OilReminderSettings> => {
  return updateOilReminderSettings({
    lastChangeKm: km,
    lastChangeDate: nowIso(),
  });
};

export const getWorkSessions = async (): Promise<WorkSession[]> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("start_time", { ascending: false });
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("work_sessions", error);
      return [];
    }
    throw error;
  }
  return sortSessionsByStartDesc((data ?? []).map(mapWorkSession));
};

export const getActiveWorkSession = async (): Promise<WorkSession | null> => {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", user.id)
    .is("end_time", null)
    .order("start_time", { ascending: false })
    .limit(1);
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("work_sessions", error);
      return null;
    }
    throw error;
  }
  const row = data?.[0];
  return row ? mapWorkSession(row) : null;
};

export const startWorkSession = async (
  startTime: Date = new Date(),
): Promise<WorkSession> => {
  const user = await requireUser();
  const active = await getActiveWorkSession();
  if (active) {
    return active;
  }

  const payload: TablesInsert<"work_sessions"> = {
    user_id: user.id,
    start_time: startTime.toISOString(),
  };

  const { data, error } = await supabase
    .from("work_sessions")
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw error;
  }

  return mapWorkSession(data);
};

export const endWorkSession = async (
  endTime: Date = new Date(),
): Promise<WorkSession | null> => {
  const user = await requireUser();
  const active = await getActiveWorkSession();
  if (!active) {
    return null;
  }

  const payload: TablesUpdate<"work_sessions"> = {
    end_time: endTime.toISOString(),
  };

  const { data, error } = await supabase
    .from("work_sessions")
    .update(payload)
    .eq("user_id", user.id)
    .eq("id", active.id)
    .select()
    .single();
  if (error) {
    throw error;
  }

  return mapWorkSession(data);
};

export const getWorkDurationForDate = async (
  date: Date,
  existingSessions?: WorkSession[],
): Promise<number> => {
  const sessions = existingSessions ?? (await getWorkSessions());
  return calculateMinutesForDate(sessions, date, new Date());
};

export const getWeeklyWorkHistory = async (
  existingSessions?: WorkSession[],
): Promise<WeeklyWorkSummary[]> => {
  const sessions = existingSessions ?? (await getWorkSessions());
  const now = new Date();
  const history: WeeklyWorkSummary[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    history.push({
      date: day.toISOString(),
      totalMinutes: calculateMinutesForDate(sessions, day, now),
    });
  }
  return history;
};

export const calculateTotals = async (
  existingTransactions?: Transaction[],
) => {
  const transactions = existingTransactions ?? (await getTransactions());
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    income,
    expenses,
    profit: income - expenses,
  };
};

export const getWeeklyProfits = async (
  existingTransactions?: Transaction[],
) => {
  const transactions = existingTransactions ?? (await getTransactions());
  const days = [];

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayTransactions = transactions.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= date && tDate < nextDay;
    });

    const income = dayTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = dayTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    days.push({
      day: dayNames[date.getDay()],
      lucro: income - expenses,
    });
  }

  return days;
};

export const getTodayStats = async (
  existingTransactions?: Transaction[],
  existingSessions?: WorkSession[],
): Promise<TodayStats> => {
  const [transactions, sessions] = await Promise.all([
    existingTransactions ? Promise.resolve(existingTransactions) : getTransactions(),
    existingSessions ? Promise.resolve(existingSessions) : getWorkSessions(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTransactions = transactions.filter((t) => {
    const tDate = new Date(t.date);
    return tDate >= today && tDate < tomorrow;
  });

  const trips = todayTransactions.filter((t) => t.type === "income").length;
  const income = todayTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = todayTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const profit = income - expenses;
  const avgProfitPerTrip = trips > 0 ? profit / trips : 0;

  const now = new Date();
  const workMinutes = calculateMinutesForDate(sessions, today, now);
  const activeSession = sessions.find((session) => !session.endTime) ?? null;

  return {
    trips,
    workMinutes,
    profit,
    avgProfitPerTrip,
    isWorking: Boolean(activeSession),
    activeSessionStart: activeSession?.startTime ?? null,
  };
};

const DEFAULT_DAILY_GOAL = 300;
const DEFAULT_MONTHLY_GOAL = 6000;

const mergeMetadataGoals = (
  metadata: Record<string, unknown> | null | undefined,
) => {
  const record = (metadata ?? {}) as {
    dailyGoal?: number;
    monthlyGoal?: number;
  };
  return {
    dailyGoal: typeof record.dailyGoal === "number" ? record.dailyGoal : DEFAULT_DAILY_GOAL,
    monthlyGoal:
      typeof record.monthlyGoal === "number"
        ? record.monthlyGoal
        : DEFAULT_MONTHLY_GOAL,
  };
};

const getOrCreateProfileRow = async () => {
  const user = await requireUser();
  const fallbackProfile = (): Tables<"user_profiles"> => ({
    id: user.id,
    email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? user.email ?? "",
    metadata: {
      dailyGoal: DEFAULT_DAILY_GOAL,
      monthlyGoal: DEFAULT_MONTHLY_GOAL,
    } as Tables<"user_profiles">["metadata"],
    is_active: true,
    created_at: nowIso(),
    updated_at: nowIso(),
    role: "driver",
    last_sign_in_at: user.last_sign_in_at ?? null,
    phone: (user.user_metadata?.phone as string | null | undefined) ?? null,
  });
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("user_profiles", error);
      return fallbackProfile();
    }
    throw error;
  }

  if (data) {
    return data;
  }

  const payload: TablesInsert<"user_profiles"> = {
    id: user.id,
    email: user.email ?? "",
    full_name: user.user_metadata?.full_name ?? user.email ?? "",
    is_active: true,
    metadata: {},
    role: "driver",
  };

  const { data: created, error: createError } = await supabase
    .from("user_profiles")
    .insert(payload)
    .select()
    .single();
  if (createError) {
    if (isPermissionDenied(createError)) {
      logPermissionFallback("user_profiles", createError);
      return fallbackProfile();
    }
    throw createError;
  }
  return created;
};

export const getDailyGoal = async (): Promise<number> => {
  const profile = await getOrCreateProfileRow();
  return mergeMetadataGoals(profile.metadata as Record<string, unknown>).dailyGoal;
};

export const setDailyGoal = async (amount: number): Promise<void> => {
  const profile = await getOrCreateProfileRow();
  const goals = mergeMetadataGoals(profile.metadata as Record<string, unknown>);
  const metadata = {
    ...(profile.metadata as Record<string, unknown>),
    dailyGoal: amount,
    monthlyGoal: goals.monthlyGoal,
  };
  const { error } = await supabase
    .from("user_profiles")
    .update({ metadata })
    .eq("id", profile.id);
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("user_profiles.metadata (dailyGoal)", error);
      return;
    }
    throw error;
  }
};

export const getMonthlyGoal = async (): Promise<number> => {
  const profile = await getOrCreateProfileRow();
  return mergeMetadataGoals(profile.metadata as Record<string, unknown>).monthlyGoal;
};

export const setMonthlyGoal = async (amount: number): Promise<void> => {
  const profile = await getOrCreateProfileRow();
  const goals = mergeMetadataGoals(profile.metadata as Record<string, unknown>);
  const metadata = {
    ...(profile.metadata as Record<string, unknown>),
    monthlyGoal: amount,
    dailyGoal: goals.dailyGoal,
  };
  const { error } = await supabase
    .from("user_profiles")
    .update({ metadata })
    .eq("id", profile.id);
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("user_profiles.metadata (monthlyGoal)", error);
      return;
    }
    throw error;
  }
};

export const filterTransactionsByPeriod = (
  transactions: Transaction[],
  period: "today" | "week" | "month" | "all",
): Transaction[] => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (period) {
    case "today": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= now && tDate < tomorrow;
      });
    }
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= weekAgo;
      });
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= monthAgo;
      });
    }
    case "all":
    default:
      return transactions;
  }
};

export const getTransactionsByPeriod = async (
  period: "today" | "week" | "month" | "all",
  transactions?: Transaction[],
): Promise<Transaction[]> => {
  const source = transactions ?? (await getTransactions());
  return filterTransactionsByPeriod(source, period);
};

export const getTransactionsByType = (
  transactions: Transaction[],
  type: "income" | "expense" | "all",
): Transaction[] => {
  if (type === "all") return transactions;
  return transactions.filter((t) => t.type === type);
};

export const getTransactionsByCategory = (
  transactions: Transaction[],
  category: string,
): Transaction[] => {
  return transactions.filter((t) => {
    if (t.type === "expense" && t.category) {
      return t.category === category;
    }
    if (t.type === "income" && t.platform) {
      return t.platform === category;
    }
    return false;
  });
};

export const getCategoryTotals = (transactions: Transaction[]) => {
  const expenses: { [key: string]: number } = {};
  const income: { [key: string]: number } = {};

  transactions.forEach((t) => {
    if (t.type === "expense" && t.category) {
      expenses[t.category] = (expenses[t.category] || 0) + t.amount;
    }
    if (t.type === "income" && t.platform) {
      income[t.platform] = (income[t.platform] || 0) + t.amount;
    }
  });

  return { expenses, income };
};

export const getUniqueCategories = async (): Promise<string[]> => {
  const transactions = await getTransactions();
  const categories = new Set<string>();

  transactions.forEach((t) => {
    if (t.type === "expense" && t.category) {
      categories.add(t.category);
    }
  });

  return Array.from(categories).sort();
};

export const getUniquePlatforms = async (): Promise<string[]> => {
  const transactions = await getTransactions();
  const platforms = new Set<string>();

  transactions.forEach((t) => {
    if (t.type === "income" && t.platform) {
      platforms.add(t.platform);
    }
  });

  return Array.from(platforms).sort();
};

const buildAvatarInitials = (fullName: string) =>
  fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const getUserProfile = async (): Promise<UserProfile> => {
  const profile = await getOrCreateProfileRow();
  const goals = mergeMetadataGoals(profile.metadata as Record<string, unknown>);
  const fullName =
    profile.full_name ?? profile.email ?? "Motorista Roda+";
  return {
    fullName,
    email: profile.email,
    avatarInitials: buildAvatarInitials(fullName),
    dailyGoal: goals.dailyGoal,
    monthlyGoal: goals.monthlyGoal,
  };
};

export const updateUserProfile = async (
  updates: Partial<UserProfile>,
): Promise<UserProfile> => {
  const profile = await getOrCreateProfileRow();
  const nextFullName = updates.fullName ?? profile.full_name ?? "";
  const metadata = {
    ...(profile.metadata as Record<string, unknown>),
  };
  if (typeof updates.dailyGoal === "number") {
    metadata.dailyGoal = updates.dailyGoal;
  }
  if (typeof updates.monthlyGoal === "number") {
    metadata.monthlyGoal = updates.monthlyGoal;
  }

  const payload: TablesUpdate<"user_profiles"> = {
    full_name: nextFullName,
    email: updates.email ?? profile.email,
    metadata: metadata as any,
    updated_at: nowIso(),
  };

  const { error } = await supabase
    .from("user_profiles")
    .update(payload)
    .eq("id", profile.id);
  if (error) {
    if (isPermissionDenied(error)) {
      logPermissionFallback("user_profiles.update", error);
      const goals = mergeMetadataGoals(profile.metadata as Record<string, unknown>);
      const fallbackFullName =
        nextFullName.length > 0 ? nextFullName : profile.full_name ?? "";
      const initialsSource = fallbackFullName || profile.email || "Motorista";
      return {
        fullName: fallbackFullName || profile.email,
        email: payload.email ?? profile.email,
        avatarInitials: buildAvatarInitials(initialsSource),
        dailyGoal: goals.dailyGoal,
        monthlyGoal: goals.monthlyGoal,
      };
    }
    throw error;
  }

  const { data, error: fetchError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", profile.id)
    .maybeSingle();
  if (fetchError) {
    if (isPermissionDenied(fetchError)) {
      logPermissionFallback("user_profiles.select", fetchError);
      const goals = mergeMetadataGoals(profile.metadata as Record<string, unknown>);
      const fallbackFullName =
        nextFullName.length > 0 ? nextFullName : profile.full_name ?? "";
      const initialsSource = fallbackFullName || profile.email || "Motorista";
      return {
        fullName: fallbackFullName || profile.email,
        email: payload.email ?? profile.email,
        avatarInitials: buildAvatarInitials(initialsSource),
        dailyGoal: goals.dailyGoal,
        monthlyGoal: goals.monthlyGoal,
      };
    }
    throw fetchError;
  }

  const goals = mergeMetadataGoals((data?.metadata ?? {}) as Record<string, unknown>);
  const fullName =
    data?.full_name ??
    updates.fullName ??
    data?.email ??
    "Motorista Roda+";

  return {
    fullName,
    email: data?.email ?? profile.email,
    avatarInitials: buildAvatarInitials(fullName),
    dailyGoal: goals.dailyGoal,
    monthlyGoal: goals.monthlyGoal,
  };
};
