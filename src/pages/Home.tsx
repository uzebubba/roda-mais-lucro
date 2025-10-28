import { TrendingUp, TrendingDown, Wallet, Plus, Minus, Wrench } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { calculateTotals, getWeeklyProfits } from "@/lib/storage";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { useState, useEffect } from "react";

const Home = () => {
  const navigate = useNavigate();
  const [totals, setTotals] = useState({ income: 0, expenses: 0, profit: 0 });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  useEffect(() => {
    setTotals(calculateTotals());
    setWeeklyData(getWeeklyProfits());
  }, []);

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
            onClick={() => navigate("/registrar?type=income")}
            className="h-14 gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus size={20} />
            Registrar ganho
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => navigate("/registrar?type=expense")}
            className="h-14 gap-2"
          >
            <Minus size={20} />
            Registrar gasto
          </Button>
        </div>

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

        {/* Reminder Card */}
        <Card className="p-4 bg-secondary border-primary/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wrench size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Manutenção preventiva</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Troca de óleo em 300 km
              </p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Home;
