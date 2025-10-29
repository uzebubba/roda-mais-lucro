import { Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface GoalCardProps {
  goal: number;
  current: number;
  type: "daily" | "monthly";
}

export const GoalCard = ({ goal, current, type }: GoalCardProps) => {
  const remaining = Math.max(0, goal - current);
  const progress = Math.min(100, (current / goal) * 100);
  const isGoalReached = current >= goal;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Target size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Meta {type === "daily" ? "Diária" : "Mensal"}
        </h2>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-foreground">
            R$ {current.toFixed(2).replace(".", ",")} / R$ {goal.toFixed(2).replace(".", ",")}
          </span>
        </div>
        
        <Progress value={progress} className="h-2" />
        
        <p className={`text-sm font-medium ${isGoalReached ? "text-primary" : "text-muted-foreground"}`}>
          {isGoalReached 
            ? "🎉 Meta batida!" 
            : `Falta R$ ${remaining.toFixed(2).replace(".", ",")} para bater sua meta`
          }
        </p>
      </div>
    </Card>
  );
};
