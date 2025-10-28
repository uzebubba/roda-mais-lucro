import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTransactions, Transaction } from "@/lib/storage";
import { useNavigate } from "react-router-dom";

const Historico = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    setTransactions(getTransactions());
  }, []);

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-xl font-bold">Histórico</h1>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {transactions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum registro ainda</p>
          </Card>
        ) : (
          transactions.map((transaction) => (
            <Card key={transaction.id} className="p-4">
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
                      <TrendingUp
                        size={20}
                        className="text-primary"
                      />
                    ) : (
                      <TrendingDown
                        size={20}
                        className="text-destructive"
                      />
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
