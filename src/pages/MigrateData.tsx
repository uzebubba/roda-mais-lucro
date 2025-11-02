import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Database, CheckCircle2, AlertTriangle, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  collectLegacyData,
  clearLegacyData,
  hasLegacyData,
  type LegacyDataSummary,
} from "@/lib/local-migration";
import { supabase } from "@/integrations/supabase/client";
import {
  setDailyGoal,
  setMonthlyGoal,
  updateUserProfile,
  setVehicleKm,
  updateOilReminderSettings,
  type Transaction,
  type FixedExpense,
  type FuelEntry,
  type VehicleState,
  type OilReminderSettings,
  type WorkSession,
} from "@/lib/supabase-storage";
import { useAuth } from "@/contexts/AuthContext";

type StepKey =
  | "transactions"
  | "fixedExpenses"
  | "fuelEntries"
  | "vehicleState"
  | "oilReminder"
  | "workSessions"
  | "goals"
  | "profile";

type StepStatus = "idle" | "pending" | "in_progress" | "success" | "error" | "skipped";

type StepState = {
  status: StepStatus;
  message?: string;
};

const STEP_LABELS: Record<StepKey, string> = {
  transactions: "Transações",
  fixedExpenses: "Despesas fixas",
  fuelEntries: "Abastecimentos",
  vehicleState: "Estado do veículo",
  oilReminder: "Lembrete de óleo",
  workSessions: "Sessões de trabalho",
  goals: "Metas financeiras",
  profile: "Perfil do usuário",
};

const EMPTY_STATES: Record<StepKey, StepState> = {
  transactions: { status: "idle" },
  fixedExpenses: { status: "idle" },
  fuelEntries: { status: "idle" },
  vehicleState: { status: "idle" },
  oilReminder: { status: "idle" },
  workSessions: { status: "idle" },
  goals: { status: "idle" },
  profile: { status: "idle" },
};

const MIGRATION_ORDER: StepKey[] = [
  "transactions",
  "fixedExpenses",
  "fuelEntries",
  "vehicleState",
  "oilReminder",
  "workSessions",
  "goals",
  "profile",
];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const countLabel = (count: number, singular: string, plural: string) => {
  if (count === 0) return "nenhum registro";
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
};

const chunkInsert = async (table: string, rows: any[], chunkSize = 500) => {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await (supabase.from(table as any) as any).insert(chunk);
    if (error) {
      throw error;
    }
  }
};

const sanitizeTransactions = (transactions: Transaction[], userId: string) =>
  transactions.map((transaction) => {
    const { id: _ignoreId, ...rest } = transaction;
    return {
      user_id: userId,
      type: rest.type,
      amount: rest.amount,
      date: rest.date,
      description: rest.description,
      category: rest.category ?? null,
      platform: rest.platform ?? null,
    };
  });

const sanitizeFixedExpenses = (expenses: FixedExpense[], userId: string) =>
  expenses.map((expense) => {
    const { id: _ignoreId, dueDay, ...rest } = expense;
    return {
      user_id: userId,
      name: rest.name,
      amount: rest.amount,
      due_day: dueDay,
      paid: rest.paid,
    };
  });

const sanitizeFuelEntries = (entries: FuelEntry[], userId: string) =>
  entries.map((entry) => {
    const { id: _ignoreId, ...rest } = entry;
    return {
      user_id: userId,
      mode: rest.mode,
      price_per_liter: rest.pricePerLiter,
      total_cost: rest.totalCost,
      liters: rest.liters ?? 0,
      km_current: rest.kmCurrent,
      km_since_last: rest.kmSinceLast ?? 0,
      consumption: rest.consumption ?? null,
      cost_per_km: rest.costPerKm ?? null,
      created_at: rest.createdAt ?? new Date().toISOString(),
    };
  });

const sanitizeWorkSessions = (sessions: WorkSession[], userId: string) =>
  sessions.map((session) => {
    const { id: _ignoreId, ...rest } = session;
    return {
      user_id: userId,
      start_time: rest.startTime,
      end_time: rest.endTime ?? null,
    };
  });

const createInitialStates = (summary: LegacyDataSummary): Record<StepKey, StepState> => ({
  transactions: { status: summary.transactions.length > 0 ? "pending" : "skipped" },
  fixedExpenses: { status: summary.fixedExpenses.length > 0 ? "pending" : "skipped" },
  fuelEntries: { status: summary.fuelEntries.length > 0 ? "pending" : "skipped" },
  vehicleState: { status: summary.vehicleState ? "pending" : "skipped" },
  oilReminder: { status: summary.oilReminder ? "pending" : "skipped" },
  workSessions: { status: summary.workSessions.length > 0 ? "pending" : "skipped" },
  goals: {
    status:
      summary.dailyGoal !== null || summary.monthlyGoal !== null ? "pending" : "skipped",
  },
  profile: { status: summary.profile ? "pending" : "skipped" },
});

const MigrateData = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [legacyData, setLegacyData] = useState<LegacyDataSummary>(collectLegacyData);
  const [stepStates, setStepStates] = useState<Record<StepKey, StepState>>(() =>
    createInitialStates(collectLegacyData()),
  );
  const [isMigrating, setIsMigrating] = useState(false);
  const [hasRunMigration, setHasRunMigration] = useState(false);

  const refreshLegacyData = useCallback(() => {
    const snapshot = collectLegacyData();
    setLegacyData(snapshot);
    setStepStates((prev) =>
      hasRunMigration ? prev : createInitialStates(snapshot),
    );
    return snapshot;
  }, [hasRunMigration]);

  useEffect(() => {
    refreshLegacyData();
  }, [refreshLegacyData]);

  const hasDataToMigrate = useMemo(() => hasLegacyData(legacyData), [legacyData]);

  const updateStepState = (key: StepKey, update: StepState) => {
    setStepStates((previous) => ({
      ...previous,
      [key]: { ...previous[key], ...update },
    }));
  };

  const handleMigration = async () => {
    if (!user) {
      toast.error("É necessário estar autenticado para migrar os dados.");
      return;
    }
    const snapshot = collectLegacyData();
    if (!hasLegacyData(snapshot)) {
      toast.info("Nenhum dado local foi encontrado para migrar.");
      return;
    }

    setIsMigrating(true);
    setHasRunMigration(true);
    const freshStates = createInitialStates(snapshot);
    setStepStates(freshStates);

    let encounteredError = false;

    const runStep = async (key: StepKey, action: () => Promise<void>, shouldRun: boolean) => {
      if (!shouldRun) {
        updateStepState(key, { status: "skipped" });
        return;
      }
      updateStepState(key, { status: "in_progress", message: undefined });
      try {
        await action();
        updateStepState(key, { status: "success" });
      } catch (error) {
        encounteredError = true;
        let message = "Falha inesperada na migração.";
        if (error instanceof Error) {
          const raw = error.message ?? "";
          if (raw.trim().length > 0) {
            message = raw;
          }
        } else if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
        ) {
          const candidate = (error as { message?: string }).message ?? "";
          if (candidate.trim().length > 0) {
            message = candidate;
          }
        }
        if (/permission/i.test(message) || /RLS/i.test(message)) {
          message =
            "Permissão negada pelo Supabase. Ajuste as políticas de RLS para permitir esta operação.";
        }
        updateStepState(key, { status: "error", message });
        console.error(`Migration step "${key}" failed`, error);
      }
    };

    await runStep(
      "transactions",
      async () => {
        const rows = sanitizeTransactions(snapshot.transactions, user.id);
        await chunkInsert("transactions", rows);
      },
      snapshot.transactions.length > 0,
    );

    await runStep(
      "fixedExpenses",
      async () => {
        const rows = sanitizeFixedExpenses(snapshot.fixedExpenses, user.id);
        await chunkInsert("fixed_expenses", rows);
      },
      snapshot.fixedExpenses.length > 0,
    );

    await runStep(
      "fuelEntries",
      async () => {
        const rows = sanitizeFuelEntries(snapshot.fuelEntries, user.id);
        await chunkInsert("fuel_entries", rows);
      },
      snapshot.fuelEntries.length > 0,
    );

    await runStep(
      "vehicleState",
      async () => {
        const state = snapshot.vehicleState as VehicleState;
        await setVehicleKm(state.currentKm);
      },
      Boolean(snapshot.vehicleState),
    );

    await runStep(
      "oilReminder",
      async () => {
        const reminder = snapshot.oilReminder as OilReminderSettings;
        await updateOilReminderSettings({
          intervalKm: reminder.intervalKm,
          lastChangeKm: reminder.lastChangeKm,
          lastChangeDate: reminder.lastChangeDate,
        });
      },
      Boolean(snapshot.oilReminder),
    );

    await runStep(
      "workSessions",
      async () => {
        const rows = sanitizeWorkSessions(snapshot.workSessions, user.id);
        await chunkInsert("work_sessions", rows);
      },
      snapshot.workSessions.length > 0,
    );

    await runStep(
      "goals",
      async () => {
        if (snapshot.dailyGoal !== null) {
          await setDailyGoal(snapshot.dailyGoal);
        }
        if (snapshot.monthlyGoal !== null) {
          await setMonthlyGoal(snapshot.monthlyGoal);
        }
      },
      snapshot.dailyGoal !== null || snapshot.monthlyGoal !== null,
    );

    await runStep(
      "profile",
      async () => {
        const profile = snapshot.profile!;
        await updateUserProfile({
          fullName: profile.fullName,
          email: profile.email,
        });
      },
      Boolean(snapshot.profile),
    );

    setIsMigrating(false);

    if (!encounteredError) {
      clearLegacyData();
      refreshLegacyData();
      toast.success("Dados migrados com sucesso para a nuvem!");
    } else {
      toast.warning("Algumas etapas da migração falharam. Verifique os detalhes e tente novamente.");
    }
  };

  const stepDetails = useMemo(
    () =>
      MIGRATION_ORDER.map((key) => ({
        key,
        label: STEP_LABELS[key],
        status: stepStates[key]?.status ?? "idle",
        message: stepStates[key]?.message,
      })),
    [stepStates],
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <XCircle size={20} />
        </Button>
        <h1 className="flex-1 text-center text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Migrar dados locais
        </h1>
        <div className="w-10" />
      </header>

      <main className="p-4 max-w-lg mx-auto space-y-6">
        <Card className="p-5 space-y-4 glass-card">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Database size={24} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                Migre seus dados para a nuvem
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Detectamos registros armazenados localmente no dispositivo. Migre para o
                Supabase para acessar seus dados com segurança em qualquer lugar.
              </p>
              {!hasDataToMigrate && (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado local foi encontrado. Nada para migrar!
                </p>
              )}
            </div>
          </div>

          {hasDataToMigrate && (
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Transações</span>
                <span className="font-semibold text-foreground">
                  {countLabel(legacyData.transactions.length, "registro", "registros")}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Despesas fixas</span>
                <span className="font-semibold text-foreground">
                  {countLabel(legacyData.fixedExpenses.length, "despesa", "despesas")}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Abastecimentos</span>
                <span className="font-semibold text-foreground">
                  {countLabel(legacyData.fuelEntries.length, "registro", "registros")}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Sessões de trabalho</span>
                <span className="font-semibold text-foreground">
                  {countLabel(legacyData.workSessions.length, "sessão", "sessões")}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Estado do veículo</span>
                <span className="font-semibold text-foreground">
                  {legacyData.vehicleState
                    ? `${legacyData.vehicleState.currentKm} km (atualizado em ${formatDateTime(
                        legacyData.vehicleState.lastUpdated,
                      )})`
                    : "não encontrado"}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Lembrete de óleo</span>
                <span className="font-semibold text-foreground">
                  {legacyData.oilReminder
                    ? `${legacyData.oilReminder.lastChangeKm} km • intervalo ${legacyData.oilReminder.intervalKm} km`
                    : "não encontrado"}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Metas financeiras</span>
                <span className="font-semibold text-foreground">
                  {legacyData.dailyGoal || legacyData.monthlyGoal
                    ? `Diária: R$ ${legacyData.dailyGoal?.toFixed(2) ?? "--"} • Mensal: R$ ${
                        legacyData.monthlyGoal?.toFixed(2) ?? "--"
                      }`
                    : "não configuradas"}
                </span>
              </div>
              <div className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">Perfil</span>
                <span className="font-semibold text-foreground">
                  {legacyData.profile
                    ? legacyData.profile.fullName ?? legacyData.profile.email ?? "dados encontrados"
                    : "não encontrado"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleMigration}
              disabled={isMigrating || !hasDataToMigrate}
            >
              {isMigrating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Migrando dados...
                </>
              ) : (
                "Migrar agora"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Os dados são inseridos com o seu usuário no Supabase. Após migração concluída,
              o armazenamento local é limpo automaticamente.
            </p>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert size={18} className="text-primary" />
            Progresso da migração
          </h2>
          <div className="space-y-3">
            {stepDetails.map((step) => {
              const status = step.status;
              const isSuccess = status === "success";
              const isError = status === "error";
              const isInProgress = status === "in_progress";
              const isSkipped = status === "skipped";
              const icon = isSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : isError ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : isInProgress ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : isSkipped ? (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              );

              const statusLabel: Record<StepStatus, string> = {
                idle: "Aguardando",
                pending: "Pronto para migrar",
                in_progress: "Migrando...",
                success: "Concluído",
                error: "Erro",
                skipped: "Sem dados",
              };

              return (
                <div
                  key={step.key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{statusLabel[status]}</p>
                    {step.message && (
                      <p className="mt-1 text-xs text-destructive">{step.message}</p>
                    )}
                  </div>
                  {icon}
                </div>
              );
            })}
          </div>
        </Card>

        {hasDataToMigrate && (
          <Card className="p-4 border border-yellow-400/40 bg-yellow-50/80 text-yellow-900">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Dica
            </p>
            <p className="text-xs mt-2 leading-relaxed">
              Para garantir que não haja duplicidade de registros, execute a migração apenas
              uma vez. Se algum passo falhar, revise a mensagem de erro acima antes de
              tentar novamente.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MigrateData;
