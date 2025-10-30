import { Car, Clock, TrendingUp, Play, Square, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DailyStatsCardProps {
  trips: number;
  workTime: string;
  avgProfitPerTrip: number;
  isWorking: boolean;
  onStartShift: () => void;
  onStopShift: () => void;
  weeklyTotal: string;
  activeSessionStart?: string | null;
  onOpenHistory: () => void;
}

const formatStartTime = (iso?: string | null): string | null => {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const DailyStatsCard = ({
  trips,
  workTime,
  avgProfitPerTrip,
  isWorking,
  onStartShift,
  onStopShift,
  weeklyTotal,
  activeSessionStart,
  onOpenHistory,
}: DailyStatsCardProps) => {
  const startTimeLabel = formatStartTime(activeSessionStart);

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Meu Dia</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe suas corridas e jornada de trabalho
          </p>
        </div>
        <Badge variant={isWorking ? "default" : "secondary"}>
          {isWorking ? "Em andamento" : "Sem expediente"}
        </Badge>
      </div>

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

      <div className="rounded-xl border border-border bg-secondary/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Controle de expediente
            </p>
            <p className="text-sm font-semibold text-foreground">
              {isWorking ? "Expediente em andamento" : "Pronto para iniciar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isWorking
                ? startTimeLabel
                  ? `Iniciado às ${startTimeLabel}`
                  : "Expediente em aberto"
                : "Inicie para começar a contar o tempo de trabalho"}
            </p>
          </div>
          <Button
            size="sm"
            variant={isWorking ? "destructive" : "default"}
            onClick={isWorking ? onStopShift : onStartShift}
            className="inline-flex items-center gap-2"
          >
            {isWorking ? (
              <>
                <Square size={16} />
                Finalizar
              </>
            ) : (
              <>
                <Play size={16} />
                Iniciar
              </>
            )}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-secondary/10 px-3 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <History size={14} />
              Histórico semanal
            </p>
            <p className="text-sm font-semibold text-foreground">Total: {weeklyTotal}</p>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenHistory}>
            Ver histórico
          </Button>
        </div>
      </div>
    </Card>
  );
};
