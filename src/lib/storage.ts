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
}

export interface WorkSession {
  id: string;
  startTime: string;
  endTime?: string;
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

const TRANSACTIONS_KEY = "roda_plus_transactions";
const FIXED_EXPENSES_KEY = "roda_plus_fixed_expenses";
const FUEL_ENTRIES_KEY = "roda_plus_fuel_entries";
const VEHICLE_STATE_KEY = "roda_plus_vehicle_state";
const OIL_REMINDER_KEY = "roda_plus_oil_reminder";
const WORK_SESSIONS_KEY = "roda_plus_work_sessions";
const USER_PROFILE_KEY = "roda_plus_user_profile";

const nowIso = () => new Date().toISOString();

const getWorkSessionsList = (): WorkSession[] => {
  const data = localStorage.getItem(WORK_SESSIONS_KEY);
  if (!data) {
    return [];
  }
  try {
    const parsed = JSON.parse(data) as WorkSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const saveWorkSessions = (sessions: WorkSession[]): void => {
  localStorage.setItem(WORK_SESSIONS_KEY, JSON.stringify(sessions));
};

const sortSessionsByStartDesc = (sessions: WorkSession[]): WorkSession[] =>
  sessions.slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

const getWorkSessionsSorted = (): WorkSession[] => sortSessionsByStartDesc(getWorkSessionsList());

const generateWorkSessionId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const calculateMinutesForDate = (sessions: WorkSession[], date: Date, now: Date): number => {
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

const getFuelEntriesRaw = (): FuelEntry[] => {
  const data = localStorage.getItem(FUEL_ENTRIES_KEY);
  return data ? JSON.parse(data) : [];
};

// Initialize with mock data if empty
const initializeMockData = () => {
  const existingTransactions = localStorage.getItem(TRANSACTIONS_KEY);
  const existingExpenses = localStorage.getItem(FIXED_EXPENSES_KEY);
  const existingFuelEntries = localStorage.getItem(FUEL_ENTRIES_KEY);
  const existingVehicleState = localStorage.getItem(VEHICLE_STATE_KEY);
  const existingOilReminder = localStorage.getItem(OIL_REMINDER_KEY);
  const existingProfile = localStorage.getItem(USER_PROFILE_KEY);

  if (!existingTransactions) {
    const mockTransactions: Transaction[] = [
      {
        id: "1",
        type: "income",
        amount: 250.0,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "Uber",
      },
      {
        id: "2",
        type: "expense",
        amount: 80.0,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Gasolina",
        category: "Combustível",
      },
      {
        id: "3",
        type: "income",
        amount: 320.0,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "99",
      },
      {
        id: "4",
        type: "expense",
        amount: 25.0,
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Almoço",
        category: "Alimentação",
      },
      {
        id: "5",
        type: "income",
        amount: 280.0,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Corridas do dia",
        platform: "InDriver",
      },
      {
        id: "6",
        type: "expense",
        amount: 15.0,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Pedágio",
        category: "Pedágio",
      },
    ];
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(mockTransactions));
  }

  if (!existingExpenses) {
    const mockExpenses: FixedExpense[] = [
      { id: "1", name: "Financiamento do Carro", amount: 890.0, dueDay: 10, paid: true },
      { id: "2", name: "Seguro", amount: 250.0, dueDay: 15, paid: false },
      { id: "3", name: "Celular", amount: 79.9, dueDay: 5, paid: true },
    ];
    localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(mockExpenses));
  }

  if (!existingFuelEntries) {
    const now = new Date();
    const mockFuelEntries: FuelEntry[] = [
      {
        id: "fuel-1",
        mode: "automatic",
        pricePerLiter: 5.82,
        totalCost: 280.0,
        liters: 48.11,
        kmCurrent: 42600,
        kmSinceLast: 320,
        consumption: 6.65,
        costPerKm: 0.87,
        createdAt: now.toISOString(),
      },
    ];
    localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(mockFuelEntries));
  }

  if (!existingVehicleState) {
    const fuelEntries = existingFuelEntries ? JSON.parse(existingFuelEntries) as FuelEntry[] : [];
    const currentKm = fuelEntries.length > 0 ? fuelEntries[0].kmCurrent : 42000;
    const mockVehicleState: VehicleState = {
      currentKm,
      lastUpdated: nowIso(),
    };
    localStorage.setItem(VEHICLE_STATE_KEY, JSON.stringify(mockVehicleState));
  }

  if (!existingOilReminder) {
    const vehicleState = existingVehicleState
      ? (JSON.parse(existingVehicleState) as VehicleState)
      : null;
    const fallbackKm = vehicleState?.currentKm ?? (() => {
      const fuelEntries = existingFuelEntries ? JSON.parse(existingFuelEntries) as FuelEntry[] : [];
      return fuelEntries.length > 0 ? fuelEntries[0].kmCurrent : 42000;
    })();
    const mockOilReminder: OilReminderSettings = {
      intervalKm: 5000,
      lastChangeKm: fallbackKm,
      lastChangeDate: nowIso(),
    };
    localStorage.setItem(OIL_REMINDER_KEY, JSON.stringify(mockOilReminder));
  }

  if (!existingProfile) {
    const mockProfile: UserProfile = {
      fullName: "João Motorista",
      email: "joao@email.com",
      avatarInitials: "JM",
    };
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(mockProfile));
  }
};

initializeMockData();

export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addTransaction = (transaction: Omit<Transaction, "id">): Transaction => {
  const transactions = getTransactions();
  const newTransaction = {
    ...transaction,
    id: Date.now().toString(),
  };
  transactions.unshift(newTransaction);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  return newTransaction;
};

export const getFixedExpenses = (): FixedExpense[] => {
  const data = localStorage.getItem(FIXED_EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
};

export const addFixedExpense = (expense: Omit<FixedExpense, "id">): FixedExpense => {
  const expenses = getFixedExpenses();
  const newExpense = {
    ...expense,
    id: Date.now().toString(),
  };
  expenses.push(newExpense);
  localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(expenses));
  return newExpense;
};

export const toggleFixedExpensePaid = (id: string): void => {
  const expenses = getFixedExpenses();
  const updated = expenses.map((exp) =>
    exp.id === id ? { ...exp, paid: !exp.paid } : exp
  );
  localStorage.setItem(FIXED_EXPENSES_KEY, JSON.stringify(updated));
};

export const getFuelEntries = (): FuelEntry[] => getFuelEntriesRaw();

export const addFuelEntry = (entry: {
  mode: "automatic" | "manual";
  pricePerLiter: number;
  totalCost: number;
  liters?: number;
  kmCurrent: number;
}): FuelEntry => {
  const entries = getFuelEntriesRaw();
  const previousEntry = entries[0];

  const liters =
    entry.mode === "automatic"
      ? entry.pricePerLiter > 0 ? entry.totalCost / entry.pricePerLiter : 0
      : entry.liters ?? 0;

  const kmSinceLast =
    previousEntry && entry.kmCurrent > previousEntry.kmCurrent
      ? entry.kmCurrent - previousEntry.kmCurrent
      : 0;

  const consumption = kmSinceLast > 0 && liters > 0 ? kmSinceLast / liters : 0;
  const costPerKm = kmSinceLast > 0 ? entry.totalCost / kmSinceLast : 0;

  const newEntry: FuelEntry = {
    id: Date.now().toString(),
    mode: entry.mode,
    pricePerLiter: entry.pricePerLiter,
    totalCost: entry.totalCost,
    liters,
    kmCurrent: entry.kmCurrent,
    kmSinceLast,
    consumption,
    costPerKm,
    createdAt: nowIso(),
  };

  const updated = [newEntry, ...entries];
  localStorage.setItem(FUEL_ENTRIES_KEY, JSON.stringify(updated));
  setVehicleKm(entry.kmCurrent);
  return newEntry;
};

export const getFuelStats = () => {
  const entries = getFuelEntriesRaw();
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
    (acc, entry) => {
      if (entry.kmSinceLast > 0 && entry.liters > 0) {
        acc.totalKm += entry.kmSinceLast;
        acc.totalLiters += entry.liters;
      }
      acc.totalSpent += entry.totalCost;
      return acc;
    },
    { totalKm: 0, totalLiters: 0, totalSpent: 0 },
  );

  return {
    averageConsumption:
      totals.totalKm > 0 && totals.totalLiters > 0 ? totals.totalKm / totals.totalLiters : 0,
    averageCostPerKm: totals.totalKm > 0 ? totals.totalSpent / totals.totalKm : 0,
    totalKm: totals.totalKm,
    totalLiters: totals.totalLiters,
    totalSpent: totals.totalSpent,
  };
};

export const getVehicleState = (): VehicleState => {
  const data = localStorage.getItem(VEHICLE_STATE_KEY);
  if (data) return JSON.parse(data);
  const entries = getFuelEntriesRaw();
  const fallback: VehicleState = {
    currentKm: entries.length > 0 ? entries[0].kmCurrent : 0,
    lastUpdated: nowIso(),
  };
  localStorage.setItem(VEHICLE_STATE_KEY, JSON.stringify(fallback));
  return fallback;
};

export const setVehicleKm = (km: number): void => {
  const vehicleState: VehicleState = {
    currentKm: km,
    lastUpdated: nowIso(),
  };
  localStorage.setItem(VEHICLE_STATE_KEY, JSON.stringify(vehicleState));
};

export const getOilReminderSettings = (): OilReminderSettings => {
  const data = localStorage.getItem(OIL_REMINDER_KEY);
  if (data) {
    return JSON.parse(data);
  }
  const vehicle = getVehicleState();
  const settings: OilReminderSettings = {
    intervalKm: 5000,
    lastChangeKm: vehicle.currentKm,
    lastChangeDate: nowIso(),
  };
  localStorage.setItem(OIL_REMINDER_KEY, JSON.stringify(settings));
  return settings;
};

export const updateOilReminderSettings = (
  updates: Partial<Pick<OilReminderSettings, "intervalKm" | "lastChangeKm" | "lastChangeDate">>,
): OilReminderSettings => {
  const current = getOilReminderSettings();
  const merged: OilReminderSettings = {
    intervalKm: updates.intervalKm ?? current.intervalKm,
    lastChangeKm: updates.lastChangeKm ?? current.lastChangeKm,
    lastChangeDate: updates.lastChangeDate ?? current.lastChangeDate,
  };
  localStorage.setItem(OIL_REMINDER_KEY, JSON.stringify(merged));
  return merged;
};

export const registerOilChange = (km: number): OilReminderSettings => {
  return updateOilReminderSettings({
    lastChangeKm: km,
    lastChangeDate: nowIso(),
  });
};

export const getWorkSessions = (): WorkSession[] => getWorkSessionsSorted();

export const getActiveWorkSession = (): WorkSession | null => {
  const sessions = getWorkSessionsSorted();
  return sessions.find((session) => !session.endTime) ?? null;
};

export const startWorkSession = (startTime: Date = new Date()): WorkSession => {
  const sessions = getWorkSessionsSorted();
  const active = sessions.find((session) => !session.endTime);
  if (active) {
    return active;
  }

  const newSession: WorkSession = {
    id: generateWorkSessionId(),
    startTime: startTime.toISOString(),
  };

  const updated = sortSessionsByStartDesc([newSession, ...sessions]);
  saveWorkSessions(updated);
  return newSession;
};

export const endWorkSession = (endTime: Date = new Date()): WorkSession | null => {
  const sessions = getWorkSessionsSorted();
  const index = sessions.findIndex((session) => !session.endTime);

  if (index === -1) {
    return null;
  }

  const updatedSession: WorkSession = {
    ...sessions[index],
    endTime: endTime.toISOString(),
  };

  const updated = sessions.slice();
  updated[index] = updatedSession;
  saveWorkSessions(sortSessionsByStartDesc(updated));
  return updatedSession;
};

export const getWorkDurationForDate = (date: Date): number => {
  const sessions = getWorkSessionsSorted();
  return calculateMinutesForDate(sessions, date, new Date());
};

export const getWeeklyWorkHistory = (): WeeklyWorkSummary[] => {
  const sessions = getWorkSessionsSorted();
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

export const calculateTotals = () => {
  const transactions = getTransactions();
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

export const getWeeklyProfits = () => {
  const transactions = getTransactions();
  const days = [];
  
  for (let i = 6; i >= 0; i--) {
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

const DAILY_GOAL_KEY = "roda_plus_daily_goal";
const MONTHLY_GOAL_KEY = "roda_plus_monthly_goal";

export const getTodayStats = (): TodayStats => {
  const transactions = getTransactions();
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

  const sessions = getWorkSessionsSorted();
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

export const getDailyGoal = (): number => {
  const goal = localStorage.getItem(DAILY_GOAL_KEY);
  return goal ? parseFloat(goal) : 300;
};

export const setDailyGoal = (amount: number): void => {
  localStorage.setItem(DAILY_GOAL_KEY, amount.toString());
};

export const getMonthlyGoal = (): number => {
  const goal = localStorage.getItem(MONTHLY_GOAL_KEY);
  return goal ? parseFloat(goal) : 6000;
};

export const setMonthlyGoal = (amount: number): void => {
  localStorage.setItem(MONTHLY_GOAL_KEY, amount.toString());
};

// Filtering functions for history page
export const getTransactionsByPeriod = (period: 'today' | 'week' | 'month' | 'all'): Transaction[] => {
  const transactions = getTransactions();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  switch (period) {
    case 'today': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= now && tDate < tomorrow;
      });
    }
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= weekAgo;
      });
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return transactions.filter((t) => {
        const tDate = new Date(t.date);
        return tDate >= monthAgo;
      });
    }
    case 'all':
    default:
      return transactions;
  }
};

export const getTransactionsByType = (
  transactions: Transaction[],
  type: 'income' | 'expense' | 'all'
): Transaction[] => {
  if (type === 'all') return transactions;
  return transactions.filter((t) => t.type === type);
};

export const getTransactionsByCategory = (
  transactions: Transaction[],
  category: string
): Transaction[] => {
  return transactions.filter((t) => {
    if (t.type === 'expense' && t.category) {
      return t.category === category;
    }
    if (t.type === 'income' && t.platform) {
      return t.platform === category;
    }
    return false;
  });
};

export const getCategoryTotals = (transactions: Transaction[]) => {
  const expenses: { [key: string]: number } = {};
  const income: { [key: string]: number } = {};
  
  transactions.forEach((t) => {
    if (t.type === 'expense' && t.category) {
      expenses[t.category] = (expenses[t.category] || 0) + t.amount;
    }
    if (t.type === 'income' && t.platform) {
      income[t.platform] = (income[t.platform] || 0) + t.amount;
    }
  });
  
  return { expenses, income };
};

export const getUniqueCategories = (): string[] => {
  const transactions = getTransactions();
  const categories = new Set<string>();
  
  transactions.forEach((t) => {
    if (t.type === 'expense' && t.category) {
      categories.add(t.category);
    }
  });
  
  return Array.from(categories).sort();
};

export const getUniquePlatforms = (): string[] => {
  const transactions = getTransactions();
  const platforms = new Set<string>();
  
  transactions.forEach((t) => {
    if (t.type === 'income' && t.platform) {
      platforms.add(t.platform);
    }
  });
  
  return Array.from(platforms).sort();
};

export const getUserProfile = (): UserProfile => {
  const data = localStorage.getItem(USER_PROFILE_KEY);
  if (data) {
    try {
      return JSON.parse(data) as UserProfile;
    } catch (_error) {
      // ignore invalid data
    }
  }

  const fallback: UserProfile = {
    fullName: "João Motorista",
    email: "joao@email.com",
    avatarInitials: "JM",
  };
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(fallback));
  return fallback;
};

export const updateUserProfile = (updates: Partial<UserProfile>): UserProfile => {
  const current = getUserProfile();
  const merged: UserProfile = {
    ...current,
    ...updates,
  };

  if (!merged.avatarInitials || merged.avatarInitials.trim().length === 0) {
    merged.avatarInitials = merged.fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(merged));
  return merged;
};
