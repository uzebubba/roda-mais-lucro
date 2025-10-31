import { TrendingUp, TrendingDown, Wallet, Plus, Minus } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { DailyStatsCard } from "@/components/DailyStatsCard";
import { GoalCard } from "@/components/GoalCard";
import { EditGoalDialog } from "@/components/EditGoalDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateTotals,
  getWeeklyProfits,
  getTodayStats,
  getDailyGoal,
  getMonthlyGoal,
  setDailyGoal as persistDailyGoal,
  setMonthlyGoal as persistMonthlyGoal,
  getTransactionsByPeriod,
  getWeeklyWorkHistory,
  startWorkSession,
  endWorkSession,
  getUserProfile,
} from "@/lib/storage";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { toast } from "sonner";
import type { TodayStats, WeeklyWorkSummary, UserProfile } from "@/lib/storage";

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const GREETING_MESSAGES = [
  "{greeting}, {name}! Bora bater a meta hoje?",
  "{greeting}, {name}! Vamos transformar cada corrida em lucro.",
  "{greeting}, {name}! Hora de acelerar rumo ao próximo recorde.",
  "{greeting}, {name}! Energia lá em cima pra dominar o app!",
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
      const nextIndex = (previousIndex + 1 + GREETING_MESSAGES.length) % GREETING_MESSAGES.length;
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

const getTimeOfDayGreeting = (): "Bom dia" | "Boa tarde" | "Boa noite" => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
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
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const Home = () => {
  const [totals, setTotals] = useState({ income: 0, expenses: 0, profit: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const initialTodayStats = (): TodayStats => {
    try {
      return getTodayStats();
    } catch (_error) {
      return {
        trips: 0,
        workMinutes: 0,
        profit: 0,
        avgProfitPerTrip: 0,
        isWorking: false,
        activeSessionStart: null,
      };
    }
  };
  const initialWeeklyWorkHistory = (): WeeklyWorkSummary[] => {
    try {
      return getWeeklyWorkHistory();
    } catch (_error) {
      return [];
    }
  };
  const [userProfile, setUserProfile] = useState<UserProfile>(() => getUserProfile());
  const [todayStats, setTodayStats] = useState<TodayStats>(initialTodayStats);
  const [weeklyWorkHistory, setWeeklyWorkHistory] = useState<WeeklyWorkSummary[]>(initialWeeklyWorkHistory);
  const [dailyGoal, setDailyGoalState] = useState(() => getDailyGoal());
  const [monthlyGoal, setMonthlyGoalState] = useState(() => getMonthlyGoal());
  const [monthlyProgress, setMonthlyProgress] = useState(0);
  const [goalView, setGoalView] = useState<"daily" | "monthly">("daily");
  const [activeType, setActiveType] = useState<"income" | "expense" | null>(null);
  const [isWorkHistoryOpen, setIsWorkHistoryOpen] = useState(false);

  const refreshWorkData = useCallback(() => {
    setTodayStats(getTodayStats());
    setWeeklyWorkHistory(getWeeklyWorkHistory());
  }, []);

  const loadDashboardData = useCallback(() => {
    setTotals(calculateTotals());
    setWeeklyData(getWeeklyProfits());
    refreshWorkData();
    setUserProfile(getUserProfile());
    setDailyGoalState(getDailyGoal());
    setMonthlyGoalState(getMonthlyGoal());
    const monthTransactions = getTransactionsByPeriod("month");
    const monthIncome = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const monthExpenses = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    setMonthlyProgress(monthIncome - monthExpenses);
  }, [refreshWorkData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (!todayStats.isWorking) {
      return;
    }

    const interval = window.setInterval(() => {
      refreshWorkData();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [todayStats.isWorking, refreshWorkData]);

  const handleTransactionSaved = () => {
    loadDashboardData();
    setActiveType(null);
  };

  const handleGoalsUpdated = (daily: number, monthly: number) => {
    persistDailyGoal(daily);
    persistMonthlyGoal(monthly);
    setDailyGoalState(daily);
    setMonthlyGoalState(monthly);
    loadDashboardData();
  };

  const handleStartShift = () => {
    startWorkSession();
    refreshWorkData();
    toast.success("Expediente iniciado!");
  };

  const handleStopShift = () => {
    const session = endWorkSession();
    refreshWorkData();
    if (session) {
      toast.success("Expediente finalizado!");
    } else {
      toast.warning("Nenhum expediente ativo para finalizar.");
    }
  };

  const workTimeLabel = formatMinutesLong(todayStats.workMinutes);
  const weeklyTotalMinutes = weeklyWorkHistory.reduce((sum, entry) => sum + entry.totalMinutes, 0);
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
      dateLabel: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date),
      durationLabel: formatMinutesShort(entry.totalMinutes),
      isToday: isSameDay(date, now),
    };
  });
  const greetingPrefix = getTimeOfDayGreeting();
  const safeName = userProfile.fullName && userProfile.fullName.trim().length > 0
    ? userProfile.fullName.trim()
    : "Motorista Parceiro";
  const firstName = safeName.split(" ").filter(Boolean)[0] ?? safeName;
  const displayName = firstName.length > 0 ? firstName : "Motorista";
  const greetingTemplate = useMemo(() => pickDailyGreetingTemplate(), []);
  const greetingParts = useMemo(
    () => resolveGreetingParts(greetingTemplate, greetingPrefix, displayName),
    [greetingTemplate, greetingPrefix, displayName],
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border/40 px-3 py-0.5">
        <div className="mx-auto w-full max-w-md leading-tight">
          <h1 className="text-lg font-semibold text-foreground">
            {greetingParts.before}
            <span className="font-bold text-primary">{displayName}</span>
            {greetingParts.after}
          </h1>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Seu controle financeiro inteligente
          </p>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* Summary Cards */}
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

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in">
          <Button
            size="lg"
            onClick={() => setActiveType("income")}
            className="h-14 gap-2 bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
          >
            <Plus size={20} />
            Registrar ganho
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setActiveType("expense")}
            className="h-14 gap-2"
          >
            <Minus size={20} />
            Registrar gasto
          </Button>
        </div>

        {/* Daily Stats Card */}
        <DailyStatsCard
          trips={todayStats.trips}
          workTime={workTimeLabel}
          avgProfitPerTrip={todayStats.avgProfitPerTrip}
          isWorking={todayStats.isWorking}
          onStartShift={handleStartShift}
          onStopShift={handleStopShift}
          weeklyTotal={weeklyTotalLabel}
          activeSessionStart={todayStats.activeSessionStart}
          onOpenHistory={() => setIsWorkHistoryOpen(true)}
        />

        {/* Goal Card */}
        <GoalCard
          views={[
            { type: "daily", goal: dailyGoal, current: todayStats.profit },
            { type: "monthly", goal: monthlyGoal, current: monthlyProgress },
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

        {/* Weekly Chart */}
        <Card className="p-5 glass-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp size={18} className="text-primary" />
            </div>
            Lucro dos últimos 7 dias
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <XAxis
                dataKey="day"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                axisLine={false}
              />
              <Bar dataKey="lucro" radius={[12, 12, 0, 0]} maxBarSize={50}>
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.lucro >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    opacity={0.9}
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
              <TransactionForm
                initialType={activeType}
                onSuccess={handleTransactionSaved}
              />
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
