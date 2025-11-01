import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import HistoryFilters from "@/components/HistoryFilters";
import HistorySummary from "@/components/HistorySummary";
import {
  getTransactions,
  filterTransactionsByPeriod,
  getTransactionsByType,
  getTransactionsByCategory,
  getCategoryTotals,
  type Transaction,
} from "@/lib/supabase-storage";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const Historico = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);
  const [periodFilter, setPeriodFilter] =
    useState<"today" | "week" | "month" | "all">("all");
  const [typeFilter, setTypeFilter] =
    useState<"income" | "expense" | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: getTransactions,
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (transactionsQuery.error) {
      const error = transactionsQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o histórico.";
      toast.error(message);
    }
  }, [transactionsQuery.error]);

  const transactions = transactionsQuery.data ?? [];

  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    transactions.forEach((transaction) => {
      if (
        transaction.type === "expense" &&
        transaction.category &&
        transaction.category.length > 0
      ) {
        categories.add(transaction.category);
      }
      if (
        transaction.type === "income" &&
        transaction.platform &&
        transaction.platform.length > 0
      ) {
        categories.add(transaction.platform);
      }
    });
    return Array.from(categories).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let scoped = filterTransactionsByPeriod(transactions, periodFilter);
    scoped = getTransactionsByType(scoped, typeFilter);
    if (categoryFilter !== "all") {
      scoped = getTransactionsByCategory(scoped, categoryFilter);
    }
    return scoped;
  }, [transactions, periodFilter, typeFilter, categoryFilter]);

  const { totalIncome, totalExpenses, categoryBreakdown } = useMemo(() => {
    const income = filteredTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const expenses = filteredTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const breakdown = getCategoryTotals(filteredTransactions);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      categoryBreakdown: breakdown,
    };
  }, [filteredTransactions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatAmount = (amount: number) => {
    return amount.toFixed(2).replace(".", ",");
  };

  if (transactionsQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center gap-3 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Histórico
        </h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4 animate-fade-in">
        <HistoryFilters
          periodFilter={periodFilter}
          typeFilter={typeFilter}
          categoryFilter={categoryFilter}
          categories={allCategories}
          onPeriodChange={setPeriodFilter}
          onTypeChange={setTypeFilter}
          onCategoryChange={setCategoryFilter}
        />

        <HistorySummary
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          categoryBreakdown={categoryBreakdown}
        />

        <p className="text-sm text-muted-foreground text-center">
          Mostrando {filteredTransactions.length} registro
          {filteredTransactions.length !== 1 ? "s" : ""}
        </p>

        {filteredTransactions.length === 0 ? (
          <Card className="p-8 text-center glass-card">
            <p className="text-muted-foreground">Nenhum registro encontrado</p>
          </Card>
        ) : (
          filteredTransactions.map((transaction: Transaction) => (
            <Card
              key={transaction.id}
              className="p-4 glass-card hover:border-border transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`p-2 rounded-lg ${
                      transaction.type === "income"
                        ? "bg-primary/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    {transaction.type === "income" ? (
                      <TrendingUp size={20} className="text-primary" />
                    ) : (
                      <TrendingDown size={20} className="text-destructive" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {transaction.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(transaction.date)}
                      </p>
                      {transaction.platform && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {transaction.platform}
                          </span>
                        </>
                      )}
                      {transaction.category && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {transaction.category}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <p
                  className={`text-lg font-bold ${
                    transaction.type === "income"
                      ? "text-primary"
                      : "text-destructive"
                  }`}
                >
                  {transaction.type === "income" ? "+" : "-"}R${" "}
                  {formatAmount(transaction.amount)}
                </p>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default Historico;
