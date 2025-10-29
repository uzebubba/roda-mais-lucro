import { Car, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface DailyStatsCardProps {
  trips: number;
  workTime: string;
  avgProfitPerTrip: number;
}

export const DailyStatsCard = ({ trips, workTime, avgProfitPerTrip }: DailyStatsCardProps) => {
  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4 text-foreground">Meu Dia</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Car size={18} />
            <span className="text-sm">Nº de viagens</span>
          </div>
          <span className="font-semibold text-foreground">{trips}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={18} />
            <span className="text-sm">Tempo rodado</span>
          </div>
          <span className="font-semibold text-foreground">{workTime}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp size={18} />
            <span className="text-sm">Lucro médio/viagem</span>
          </div>
          <span className="font-semibold text-primary">
            R$ {avgProfitPerTrip.toFixed(2).replace(".", ",")}
          </span>
        </div>
      </div>
    </Card>
  );
};
