import { useEffect, useMemo, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Minus,
  Loader2,
  AlertTriangle,
  X,
  CalendarClock,
} from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { DailyStatsCard } from "@/components/DailyStatsCard";
import { GoalCard } from "@/components/GoalCard";
import { EditGoalDialog } from "@/components/EditGoalDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TransactionForm from "@/components/TransactionForm";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  filterTransactionsByPeriod,
  getTransactions,
  getTodayStats,
  getWeeklyWorkHistory,
  getWeeklyProfits,
  startWorkSession,
  endWorkSession,
  getUserProfile,
  setDailyGoal as persistDailyGoal,
  setMonthlyGoal as persistMonthlyGoal,
  getWorkSessions,
  getFixedExpenses,
  type TodayStats,
  type WeeklyWorkSummary,
  type UserProfile,
  type WorkSession,
  type Transaction,
  type FixedExpense,
} from "@/lib/supabase-storage";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, CartesianGrid, Tooltip } from "recharts";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { hasLegacyData } from "@/lib/local-migration";

const EMPTY_TRANSACTIONS: Transaction[] = [];

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type SummaryPeriod = "today" | "week" | "month";

const GREETING_MESSAGES = [
  "{greeting}, {name}! Bora bater a meta hoje?",
  "{greeting}, {name}! Vamos transformar cada corrida em lucro.",
  "{greeting}, {name}! Hora de acelerar rumo ao próximo recorde.",
  "{greeting}, {name}! Vamos fazer esse app trabalhar a favor do seu bolso!",
  "{greeting}, {name}! Vamos fazer esse dia valer cada quilômetro.",
  "{greeting}, {name}! Confio no seu talento — partiu lucrar?",
];

const GREETING_STATE_KEY = "roda_plus_greeting_state";

const pickDailyGreetingTemplate = (): string => {
  if (typeof window === "undefined") {
    return GREETING_MESSAGES[0];
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const stored = window.localStorage.getItem(GREETING_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { index?: number; date?: string };
      if (parsed?.date === today && typeof parsed.index === "number") {
        const safeIndex = Math.abs(parsed.index) % GREETING_MESSAGES.length;
        return GREETING_MESSAGES[safeIndex];
      }

      const previousIndex = typeof parsed?.index === "number" ? parsed.index : -1;
      const nextIndex =
        (previousIndex + 1 + GREETING_MESSAGES.length) % GREETING_MESSAGES.length;
      window.localStorage.setItem(
        GREETING_STATE_KEY,
        JSON.stringify({ index: nextIndex, date: today }),
      );
      return GREETING_MESSAGES[nextIndex];
    }
  } catch (_error) {
    // Ignore storage issues and fall back to default below
  }

  try {
    window.localStorage.setItem(
      GREETING_STATE_KEY,
      JSON.stringify({ index: 0, date: today }),
    );
  } catch (_error) {
    // Ignore write failures
  }

  return GREETING_MESSAGES[0];
};

const resolveGreetingParts = (template: string, greeting: string, name: string) => {
  const placeholder = "__NAME_PLACEHOLDER__";
  const withGreeting = template.replace("{greeting}", greeting);
  const prepared = withGreeting.replace("{name}", placeholder);
  const [before = "", after = ""] = prepared.split(placeholder);
  return { before, after };
};

const getTimeOfDayGreeting = (): "Oii" => {
  return "Oii";
};

const formatMinutesLong = (totalMinutes: number): string => {
  if (totalMinutes <= 0) {
    return "0min";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}min`;
};

const formatMinutesShort = (totalMinutes: number): string => {
  if (totalMinutes <= 0) {
    return "--";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) {
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}min`;
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const defaultTodayStats: TodayStats = {
  trips: 0,
  workMinutes: 0,
  profit: 0,
  avgProfitPerTrip: 0,
  isWorking: false,
  activeSessionStart: null,
};

const Home = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);
  const navigate = useNavigate();
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("today");
  const [goalView, setGoalView] = useState<"daily" | "monthly">("daily");
  const [activeType, setActiveType] = useState<"income" | "expense" | null>(null);
  const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);
  const [todayStats, setTodayStatsState] = useState<TodayStats>(defaultTodayStats);
  const [weeklyWorkHistory, setWeeklyWorkHistoryState] = useState<WeeklyWorkSummary[]>([]);
  const [weeklyData, setWeeklyData] = useState<Array<{ day: string; lucro: number }>>([]);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const [dayKey, setDayKey] = useState(() => new Date().toISOString().slice(0, 10));

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
    enabled: isAuthenticated,
    retry: false,
  });

  const workSessionsQuery = useQuery({
    queryKey: ["workSessions"],
    queryFn: getWorkSessions,
    enabled: isAuthenticated,
    retry: false,
  });

  const profileQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    enabled: isAuthenticated,
    retry: false,
  });

  const fixedExpensesQuery = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: getFixedExpenses,
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (transactionsQuery.error) {
      const error = transactionsQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar suas transações.";
      toast.error(message);
    }
  }, [transactionsQuery.error]);

  useEffect(() => {
    if (workSessionsQuery.error) {
      const error = workSessionsQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar seus turnos de trabalho.";
      toast.error(message);
    }
  }, [workSessionsQuery.error]);

  useEffect(() => {
    if (profileQuery.error) {
      const error = profileQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o perfil do usuário.";
      toast.error(message);
    }
  }, [profileQuery.error]);

  useEffect(() => {
    if (fixedExpensesQuery.error) {
      const error = fixedExpensesQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar suas despesas fixas.";
      toast.error(message);
    }
  }, [fixedExpensesQuery.error]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      setShowMigrationBanner(false);
      return;
    }
    setShowMigrationBanner(hasLegacyData());
  }, [isAuthenticated]);

  const transactions = transactionsQuery.data ?? EMPTY_TRANSACTIONS;
  const workSessions = workSessionsQuery.data ?? [];
  const userProfile = profileQuery.data;
  const dueTodayExpenses = useMemo(() => {
    const expenses = fixedExpensesQuery.data ?? [];
    const today = new Date().getDate();
    return expenses.filter((expense) => !expense.paid && expense.dueDay === today);
  }, [fixedExpensesQuery.data]);

  const formatCurrency = useCallback(
    (value: number) =>
      value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    [],
  );

  const refreshDerivedData = useCallback(
    async (currentTransactions: Transaction[], sessions: WorkSession[]) => {
      try {
        const [stats, history, profits] = await Promise.all([
          getTodayStats(currentTransactions, sessions),
          getWeeklyWorkHistory(sessions),
          getWeeklyProfits(currentTransactions),
        ]);
        setTodayStatsState(stats);
        setWeeklyWorkHistoryState(history);
        setWeeklyData(profits);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar os indicadores do dashboard.";
        toast.error(message);
      }
    },
    [],
  );

  useEffect(() => {
    if (transactionsQuery.data && workSessionsQuery.data) {
      void refreshDerivedData(transactionsQuery.data, workSessionsQuery.data);
    }
  }, [transactionsQuery.data, workSessionsQuery.data, refreshDerivedData]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      transactionsQuery.data === undefined ||
      workSessionsQuery.data === undefined
    ) {
      return;
    }

    let currentDayKey = new Date().toISOString().slice(0, 10);

    const interval = window.setInterval(() => {
      const nowKey = new Date().toISOString().slice(0, 10);
      if (nowKey !== currentDayKey) {
        currentDayKey = nowKey;
        setDayKey(nowKey);
        void refreshDerivedData(
          transactionsQuery.data ?? [],
          workSessionsQuery.data ?? [],
        );
      }
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [transactionsQuery.data, workSessionsQuery.data, refreshDerivedData]);

  useEffect(() => {
    if (!todayStats.isWorking) {
      return;
    }

    const interval = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["workSessions"] });
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [todayStats.isWorking, queryClient]);

  const totals = useMemo(() => {
    const scoped = filterTransactionsByPeriod(transactions, summaryPeriod);
    const income = scoped
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = scoped
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      income,
      expenses,
      profit: income - expenses,
    };
  }, [transactions, summaryPeriod]);

  const monthTotals = useMemo(() => {
    const scoped = filterTransactionsByPeriod(transactions, "month");
    const income = scoped
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = scoped
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    return {
      income,
      expenses,
      profit: income - expenses,
    };
  }, [transactions]);

  const dailyGoal = userProfile?.dailyGoal ?? 300;
  const monthlyGoal = userProfile?.monthlyGoal ?? 6000;

  const weeklyTotalMinutes = weeklyWorkHistory.reduce(
    (sum, entry) => sum + entry.totalMinutes,
    0,
  );
  const weeklyTotalLabel = formatMinutesLong(weeklyTotalMinutes);

  const now = new Date();
  const weeklyHistoryItems = weeklyWorkHistory.map((entry) => {
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) {
      return {
        key: entry.date,
        dayLabel: "--",
        dateLabel: "--/--",
        durationLabel: formatMinutesShort(entry.totalMinutes),
        isToday: false,
      };
    }

    return {
      key: entry.date,
      dayLabel: DAY_NAMES[date.getDay()],
      dateLabel: new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }).format(date),
      durationLabel: formatMinutesShort(entry.totalMinutes),
      isToday: isSameDay(date, now),
    };
  });

  const greetingPrefix = getTimeOfDayGreeting();
  const greetingTemplate = useMemo(() => pickDailyGreetingTemplate(), []);
  const safeName =
    userProfile?.fullName && userProfile.fullName.trim().length > 0
      ? userProfile.fullName.trim()
      : "Motorista Parceiro";
  const firstName = safeName.split(" ").filter(Boolean)[0] ?? safeName;
  const displayName = firstName.length > 0 ? firstName : "Motorista";
  const greetingParts = useMemo(
    () => resolveGreetingParts(greetingTemplate, greetingPrefix, displayName),
    [greetingTemplate, greetingPrefix, displayName],
  );

  const startShiftMutation = useMutation({
    mutationFn: startWorkSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workSessions"] });
      toast.success("Expediente iniciado!");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o expediente.";
      toast.error(message);
    },
  });

  const stopShiftMutation = useMutation({
    mutationFn: endWorkSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workSessions"] });
      toast.success("Expediente finalizado!");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar o expediente.";
      toast.error(message);
    },
  });

  const setDailyGoalMutation = useMutation({
    mutationFn: persistDailyGoal,
  });

  const setMonthlyGoalMutation = useMutation({
    mutationFn: persistMonthlyGoal,
  });

  const handleTransactionSaved = (transaction: Transaction) => {
    const updatedTransactions =
      queryClient.setQueryData<Transaction[]>(["transactions"], (previous) => {
        const existing = Array.isArray(previous) ? previous : [];
        const withoutDuplicate = existing.filter((item) => item.id !== transaction.id);
        const next = [transaction, ...withoutDuplicate];
        return next.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
      }) ?? [];

    const cachedSessions =
      queryClient.getQueryData<WorkSession[]>(["workSessions"]) ?? [];

    void refreshDerivedData(updatedTransactions, cachedSessions);

    setActiveType(null);
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const handleGoalsUpdated = (daily: number, monthly: number) => {
    void (async () => {
      try {
        await Promise.all([
          setDailyGoalMutation.mutateAsync(daily),
          setMonthlyGoalMutation.mutateAsync(monthly),
        ]);
        await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
        toast.success("Metas atualizadas com sucesso!");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar as metas.";
        toast.error(message);
      }
    })();
  };

  const handleStartShift = () => {
    startShiftMutation.mutate(undefined);
  };

  const handleStopShift = () => {
    stopShiftMutation.mutate(undefined);
  };

  const handleSummaryPeriodChange = (value: SummaryPeriod) => {
    setSummaryPeriod(value);
  };

  const resolvedTodayStats = todayStats ?? defaultTodayStats;
  const workTimeLabel = formatMinutesLong(resolvedTodayStats.workMinutes);

  const weeklyChartData = weeklyData.length > 0 ? weeklyData : DAY_NAMES.map((day) => ({
    day,
    lucro: 0,
  }));

  if (
    transactionsQuery.isLoading ||
    workSessionsQuery.isLoading ||
    profileQuery.isLoading
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border/30 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto w-full max-w-md px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {greetingParts.before}
                <span className="text-primary">{displayName}</span>
                {greetingParts.after}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                Seu controle financeiro inteligente
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {showMigrationBanner && (
          <div className="flex flex-col gap-3 rounded-2xl border border-yellow-400/40 bg-yellow-50/80 px-4 py-3 text-yellow-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">
                  Detectamos dados salvos localmente.
                </p>
                <p className="text-xs leading-relaxed">
                  Migre para a nuvem e mantenha todas as informações sincronizadas com a sua
                  conta.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-8" onClick={() => navigate("/migrate")}>
                    Migrar agora
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-yellow-900 hover:text-yellow-900"
                    onClick={() => setShowMigrationBanner(false)}
                  >
                    Agora não
                  </Button>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-yellow-900/80 transition hover:bg-yellow-200/40"
                onClick={() => setShowMigrationBanner(false)}
                aria-label="Fechar aviso de migração"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {dueTodayExpenses.length > 0 && (
          <Card className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 via-background/92 to-background/95 p-4 sm:p-5 animate-fade-in">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(251,191,36,0.4),transparent_55%),radial-gradient(circle_at_90%_90%,rgba(245,158,11,0.3),transparent_60%)]" />
            <div className="relative z-10 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-100 shadow-[0_12px_32px_-24px_rgba(251,191,36,0.8)]">
                    <CalendarClock className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">
                      Atenção
                    </p>
                    <h2 className="mt-1 text-base font-semibold leading-tight text-foreground">
                      {dueTodayExpenses.length === 1
                        ? "Você tem 1 despesa vencendo hoje"
                        : `Você tem ${dueTodayExpenses.length} despesas vencendo hoje`}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Revise as contas e marque como pagas para manter o controle em dia.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full sm:w-auto border-amber-300/60 bg-background/60 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                  onClick={() => navigate("/fixas")}
                >
                  Ver despesas
                </Button>
              </div>
              <ul className="space-y-2 text-sm">
                {dueTodayExpenses.map((expense: FixedExpense) => (
                  <li
                    key={expense.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-amber-400/20 bg-background/70 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {expense.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hoje • {formatCurrency(expense.amount)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-amber-100">
                      {`Dia ${String(expense.dueDay).padStart(2, "0")}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          <SummaryCard
            title="Ganhei"
            value={totals.income}
            icon={TrendingUp}
            variant="success"
          />
          <SummaryCard
            title="Gastei"
            value={totals.expenses}
            icon={TrendingDown}
            variant="danger"
          />
          <SummaryCard
            title="Sobrou"
            value={totals.profit}
            icon={Wallet}
            variant="neutral"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          <Button
            size="lg"
            onClick={() => setActiveType("income")}
            className="h-14 gap-2 justify-center bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
          >
            <Plus size={20} />
            Registrar ganho
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setActiveType("expense")}
            className="h-14 gap-2 justify-center"
          >
            <Minus size={20} />
            Registrar gasto
          </Button>
        </div>

        <DailyStatsCard
          trips={resolvedTodayStats.trips}
          workTime={workTimeLabel}
          avgProfitPerTrip={resolvedTodayStats.avgProfitPerTrip}
          isWorking={resolvedTodayStats.isWorking}
          onStartShift={handleStartShift}
          onStopShift={handleStopShift}
          weeklyTotal={weeklyTotalLabel}
          activeSessionStart={resolvedTodayStats.activeSessionStart}
          onOpenHistory={() => setIsWorkHistoryOpen(true)}
          summaryPeriod={summaryPeriod}
          onSummaryPeriodChange={handleSummaryPeriodChange}
        />

        <GoalCard
          views={[
            { type: "daily", goal: dailyGoal, current: resolvedTodayStats.profit },
            { type: "monthly", goal: monthlyGoal, current: monthTotals.profit },
          ]}
          activeType={goalView}
          onTypeChange={(type) => setGoalView(type)}
          actionSlot={
            <EditGoalDialog
              initialDaily={dailyGoal}
              initialMonthly={monthlyGoal}
              onSave={handleGoalsUpdated}
            />
          }
        />

        <Card className="p-5 glass-card overflow-hidden">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shadow-sm">
              <TrendingUp size={18} className="text-primary" />
            </div>
            Lucro dos últimos 7 dias
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={weeklyChartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fill: "hsl(var(--foreground))", fontSize: 13, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `R$ ${value}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value as number;
                    return (
                      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          {payload[0].payload.day}
                        </p>
                        <p className={`text-sm font-bold ${value >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          R$ {value.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.1 }}
              />
              <Bar 
                dataKey="lucro" 
                radius={[8, 8, 0, 0]} 
                maxBarSize={45}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {weeklyChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.lucro >= 0 ? "url(#profitGradient)" : "url(#lossGradient)"}
                    className="drop-shadow-sm"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </main>

      <Drawer
        open={activeType !== null}
        shouldScaleBackground={false}
        onOpenChange={(open) => {
          if (!open) {
            setActiveType(null);
          }
        }}
      >
        {activeType && (
          <DrawerContent className="mx-auto w-full max-w-md border-border">
            <DrawerHeader className="px-6 pt-6 pb-3 text-left">
              <DrawerTitle>
                {activeType === "income" ? "Registrar ganho" : "Registrar gasto"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-6 pb-6">
              <TransactionForm initialType={activeType} onSuccess={handleTransactionSaved} />
            </div>
          </DrawerContent>
        )}
      </Drawer>

      <Dialog open={isWorkHistoryOpen} onOpenChange={setIsWorkHistoryOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Histórico de horas</DialogTitle>
            <DialogDescription>Últimos 7 dias de expediente</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-lg border border-secondary px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total da semana</span>
            <span className="font-semibold text-foreground">{weeklyTotalLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {weeklyHistoryItems.length === 0 ? (
              <div className="col-span-3 rounded-lg border border-dashed border-border bg-secondary/10 py-6 text-center text-xs text-muted-foreground">
                Sem registros ainda
              </div>
            ) : (
              weeklyHistoryItems.map((item) => (
                <div
                  key={item.key}
                  className={`rounded-lg border border-border bg-secondary/10 p-2 text-center ${
                    item.isToday ? "border-primary bg-primary/10 text-foreground" : ""
                  }`}
                >
                  <p className="text-[11px] font-medium text-foreground">{item.dayLabel}</p>
                  <p className="text-[10px] text-muted-foreground">{item.dateLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.durationLabel}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
