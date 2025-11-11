import { Car, Clock, TrendingUp, Play, Square, History, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTutorialAnchor } from "@/contexts/TutorialContext";

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
  summaryPeriod: "today" | "week" | "month";
  onSummaryPeriodChange: (value: "today" | "week" | "month") => void;
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
  summaryPeriod,
  onSummaryPeriodChange,
}: DailyStatsCardProps) => {
  const startTimeLabel = formatStartTime(activeSessionStart);
  const periodLabel =
    summaryPeriod === "today" ? "Hoje" : summaryPeriod === "week" ? "Semana" : "Mês";
  const periodAnchorRef = useTutorialAnchor<HTMLButtonElement>("home-period-toggle");
  const shiftAnchorRef = useTutorialAnchor<HTMLButtonElement>("home-shift-control");

  return (
    <Card className="p-5 space-y-5 glass-card animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Meu Dia</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe suas
            <span className="block">corridas e jornada de trabalho</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex flex-col items-center gap-1 rounded-full border-border/70 bg-background/80 px-3 py-2 text-[10px] font-semibold text-muted-foreground shadow-sm transition hover:bg-muted"
                ref={periodAnchorRef}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                {periodLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 text-xs font-medium">
              <DropdownMenuItem onClick={() => onSummaryPeriodChange("today")} className="text-muted-foreground">
                Hoje
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSummaryPeriodChange("week")} className="text-muted-foreground">
                Semana
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSummaryPeriodChange("month")} className="text-muted-foreground">
                Mês
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant={isWorking ? "default" : "secondary"}>
            {isWorking ? "Em andamento" : "Sem expediente"}
          </Badge>
        </div>
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

      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-4 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
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
            ref={shiftAnchorRef}
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
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border/50 bg-gradient-to-br from-primary/5 to-primary/10 px-3 py-3 hover:border-primary/40 transition-all duration-300">
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
