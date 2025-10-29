import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

interface HistorySummaryProps {
  totalIncome: number;
  totalExpenses: number;
  categoryBreakdown: {
    expenses: { [key: string]: number };
    income: { [key: string]: number };
  };
}

const HistorySummary = ({
  totalIncome,
  totalExpenses,
  categoryBreakdown,
}: HistorySummaryProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const profit = totalIncome - totalExpenses;

  const formatAmount = (amount: number) => {
    return amount.toFixed(2).replace(".", ",");
  };

  const getPercentage = (amount: number, total: number) => {
    return total > 0 ? (amount / total) * 100 : 0;
  };

  const sortedExpenses = Object.entries(categoryBreakdown.expenses).sort(
    ([, a], [, b]) => b - a
  );
  const sortedIncome = Object.entries(categoryBreakdown.income).sort(
    ([, a], [, b]) => b - a
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-muted/50">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h3 className="font-semibold">Resumo do Período</h3>
          </div>
          <ChevronDown
            size={20}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Totals */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Ganhos</p>
                <p className="text-lg font-bold text-primary">
                  R$ {formatAmount(totalIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gastos</p>
                <p className="text-lg font-bold text-destructive">
                  R$ {formatAmount(totalExpenses)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Lucro</p>
                <p
                  className={`text-lg font-bold ${
                    profit >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  R$ {formatAmount(profit)}
                </p>
              </div>
            </div>

            {/* Expenses Breakdown */}
            {sortedExpenses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Gastos por categoria:
                </p>
                {sortedExpenses.map(([category, amount]) => {
                  const percentage = getPercentage(amount, totalExpenses);
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium">
                          R$ {formatAmount(amount)}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({percentage.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Income Breakdown */}
            {sortedIncome.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Ganhos por plataforma:
                </p>
                {sortedIncome.map(([platform, amount]) => {
                  const percentage = getPercentage(amount, totalIncome);
                  return (
                    <div key={platform} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{platform}</span>
                        <span className="font-medium">
                          R$ {formatAmount(amount)}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({percentage.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default HistorySummary;
