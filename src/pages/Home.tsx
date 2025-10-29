import { TrendingUp, TrendingDown, Wallet, Plus, Minus } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { DailyStatsCard } from "@/components/DailyStatsCard";
import { GoalCard } from "@/components/GoalCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { calculateTotals, getWeeklyProfits, getTodayStats, getDailyGoal } from "@/lib/storage";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { useState, useEffect, useCallback } from "react";
import TransactionForm from "@/components/TransactionForm";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const Home = () => {
  const [totals, setTotals] = useState({ income: 0, expenses: 0, profit: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ trips: 0, workTime: "0h 0min", profit: 0, avgProfitPerTrip: 0 });
  const [dailyGoal, setDailyGoal] = useState(0);
  const [activeType, setActiveType] = useState<"income" | "expense" | null>(null);

  const loadDashboardData = useCallback(() => {
    setTotals(calculateTotals());
    setWeeklyData(getWeeklyProfits());
    setTodayStats(getTodayStats());
    setDailyGoal(getDailyGoal());
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleTransactionSaved = () => {
    loadDashboardData();
    setActiveType(null);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground">Roda+ Controle</h1>
        <p className="text-sm text-muted-foreground">Seu controle financeiro</p>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
          <Button
            size="lg"
            onClick={() => setActiveType("income")}
            className="h-14 gap-2 bg-primary hover:bg-primary/90"
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
          workTime={todayStats.workTime}
          avgProfitPerTrip={todayStats.avgProfitPerTrip}
        />

        {/* Goal Card */}
        <GoalCard
          goal={dailyGoal}
          current={todayStats.profit}
          type="daily"
        />

        {/* Weekly Chart */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
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
              <Bar dataKey="lucro" radius={[8, 8, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.lucro >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
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
    </div>
  );
};

export default Home;
