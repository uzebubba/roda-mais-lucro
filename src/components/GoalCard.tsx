import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReactNode } from "react";

type GoalType = "daily" | "monthly";

interface GoalView {
  type: GoalType;
  goal: number;
  current: number;
}

interface GoalCardProps {
  views: GoalView[];
  activeType: GoalType;
  onTypeChange: (type: GoalType) => void;
  actionSlot?: ReactNode;
}

const typeLabels: Record<GoalType, string> = {
  daily: "Diária",
  monthly: "Mensal",
};

export const GoalCard = ({ views, activeType, onTypeChange, actionSlot }: GoalCardProps) => {
  const currentView = views.find((view) => view.type === activeType) ?? views[0];

  if (!currentView) {
    return null;
  }

  const safeGoal = currentView.goal > 0 ? currentView.goal : 0;
  const currentAmount = currentView.current;
  const clampedCurrent = Math.max(0, currentAmount);
  const remaining = safeGoal > 0 ? Math.max(0, safeGoal - currentAmount) : 0;
  const progress = safeGoal > 0 ? Math.min(100, Math.max(0, (clampedCurrent / safeGoal) * 100)) : 0;
  const isGoalReached = safeGoal > 0 && clampedCurrent >= safeGoal;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Meta {typeLabels[currentView.type]}
          </h2>
        </div>
        <div className="flex items-center gap-2 justify-end flex-wrap">
          <ToggleGroup
            type="single"
            value={currentView.type}
            onValueChange={(value) => value && onTypeChange(value as GoalType)}
            className="bg-muted/40 rounded-lg px-1"
            size="sm"
            variant="outline"
          >
            {views.map((view) => (
              <ToggleGroupItem key={view.type} value={view.type} className="text-xs">
                {typeLabels[view.type]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {actionSlot}
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-foreground">
            R$ {currentAmount.toFixed(2).replace(".", ",")} / R$ {safeGoal.toFixed(2).replace(".", ",")}
          </span>
        </div>
        
        <Progress value={progress} className="h-2" />

        <p className={`text-sm font-medium ${isGoalReached ? "text-primary" : "text-muted-foreground"}`}>
          {safeGoal === 0
            ? "Defina uma meta para acompanhar seu progresso"
            : isGoalReached
              ? "🎉 Meta batida!"
              : `Falta R$ ${remaining.toFixed(2).replace(".", ",")} para bater sua meta`}
        </p>
      </div>
    </Card>
  );
};
