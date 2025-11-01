import type {
  Transaction,
  FixedExpense,
  FuelEntry,
  VehicleState,
  OilReminderSettings,
  WorkSession,
  UserProfile,
} from "@/lib/supabase-storage";

type LegacyProfile = Pick<UserProfile, "fullName" | "email" | "avatarInitials">;

export type LegacyDataSummary = {
  transactions: Transaction[];
  fixedExpenses: FixedExpense[];
  fuelEntries: FuelEntry[];
  vehicleState: VehicleState | null;
  oilReminder: OilReminderSettings | null;
  workSessions: WorkSession[];
  dailyGoal: number | null;
  monthlyGoal: number | null;
  profile: LegacyProfile | null;
};

export const LEGACY_STORAGE_KEYS = {
  transactions: "roda_plus_transactions",
  fixedExpenses: "roda_plus_fixed_expenses",
  fuelEntries: "roda_plus_fuel_entries",
  vehicleState: "roda_plus_vehicle_state",
  oilReminder: "roda_plus_oil_reminder",
  workSessions: "roda_plus_work_sessions",
  dailyGoal: "roda_plus_daily_goal",
  monthlyGoal: "roda_plus_monthly_goal",
  profile: "roda_plus_user_profile",
} as const;

const EMPTY_SUMMARY: LegacyDataSummary = {
  transactions: [],
  fixedExpenses: [],
  fuelEntries: [],
  vehicleState: null,
  oilReminder: null,
  workSessions: [],
  dailyGoal: null,
  monthlyGoal: null,
  profile: null,
};

const isBrowser = typeof window !== "undefined";

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (_error) {
    return fallback;
  }
};

const parseNumber = (raw: string | null): number | null => {
  if (raw === null) {
    return null;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
};

export const collectLegacyData = (): LegacyDataSummary => {
  if (!isBrowser) {
    return EMPTY_SUMMARY;
  }

  const transactions = parseJson<Transaction[]>(
    window.localStorage.getItem(LEGACY_STORAGE_KEYS.transactions),
    [],
  );
  const fixedExpenses = parseJson<FixedExpense[]>(
    window.localStorage.getItem(LEGACY_STORAGE_KEYS.fixedExpenses),
    [],
  );
  const fuelEntries = parseJson<FuelEntry[]>(
    window.localStorage.getItem(LEGACY_STORAGE_KEYS.fuelEntries),
    [],
  );
  const vehicleState =
    parseJson<VehicleState | null>(
      window.localStorage.getItem(LEGACY_STORAGE_KEYS.vehicleState),
      null,
    ) ?? null;
  const oilReminder =
    parseJson<OilReminderSettings | null>(
      window.localStorage.getItem(LEGACY_STORAGE_KEYS.oilReminder),
      null,
    ) ?? null;
  const workSessions = parseJson<WorkSession[]>(
    window.localStorage.getItem(LEGACY_STORAGE_KEYS.workSessions),
    [],
  );
  const dailyGoal = parseNumber(window.localStorage.getItem(LEGACY_STORAGE_KEYS.dailyGoal));
  const monthlyGoal = parseNumber(window.localStorage.getItem(LEGACY_STORAGE_KEYS.monthlyGoal));
  const profile =
    parseJson<LegacyProfile | null>(
      window.localStorage.getItem(LEGACY_STORAGE_KEYS.profile),
      null,
    ) ?? null;

  return {
    transactions: Array.isArray(transactions) ? transactions : [],
    fixedExpenses: Array.isArray(fixedExpenses) ? fixedExpenses : [],
    fuelEntries: Array.isArray(fuelEntries) ? fuelEntries : [],
    vehicleState: vehicleState ?? null,
    oilReminder: oilReminder ?? null,
    workSessions: Array.isArray(workSessions) ? workSessions : [],
    dailyGoal,
    monthlyGoal,
    profile,
  };
};

export const hasLegacyData = (summary?: LegacyDataSummary): boolean => {
  const data = summary ?? collectLegacyData();
  return (
    data.transactions.length > 0 ||
    data.fixedExpenses.length > 0 ||
    data.fuelEntries.length > 0 ||
    data.workSessions.length > 0 ||
    data.vehicleState !== null ||
    data.oilReminder !== null ||
    data.dailyGoal !== null ||
    data.monthlyGoal !== null ||
    data.profile !== null
  );
};

export const clearLegacyData = () => {
  if (!isBrowser) {
    return;
  }
  Object.values(LEGACY_STORAGE_KEYS).forEach((key) => {
    window.localStorage.removeItem(key);
  });
};

