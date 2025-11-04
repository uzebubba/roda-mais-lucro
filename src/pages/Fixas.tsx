import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Plus,
  Droplet,
  Loader2,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  addFixedExpense,
  getFixedExpenses,
  toggleFixedExpensePaid,
  getVehicleState,
  getOilReminderSettings,
  updateOilReminderSettings,
  registerOilChange,
  deleteFixedExpense,
  type FixedExpense,
  type VehicleState,
  type OilReminderSettings,
} from "@/lib/supabase-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const Fixas = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);

  const expensesQuery = useQuery({
    queryKey: ["fixedExpenses"],
    queryFn: getFixedExpenses,
    enabled: isAuthenticated,
    retry: false,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicleState"],
    queryFn: getVehicleState,
    enabled: isAuthenticated,
    retry: false,
  });

  const oilSettingsQuery = useQuery({
    queryKey: ["oilSettings"],
    queryFn: getOilReminderSettings,
    enabled: isAuthenticated,
    retry: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [intervalInput, setIntervalInput] = useState("");
  const [lastChangeInput, setLastChangeInput] = useState("");

  const addExpenseMutation = useMutation({
    mutationFn: addFixedExpense,
  });

  const toggleExpenseMutation = useMutation({
    mutationFn: toggleFixedExpensePaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] });
    },
  });

  const updateOilSettingsMutation = useMutation({
    mutationFn: updateOilReminderSettings,
  });

  const registerOilChangeMutation = useMutation({
    mutationFn: registerOilChange,
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteFixedExpense,
  });

  useEffect(() => {
    const settings = oilSettingsQuery.data;
    if (settings) {
      setIntervalInput(settings.intervalKm.toString());
      setLastChangeInput(
        settings.lastChangeKm ? settings.lastChangeKm.toString() : "",
      );
    }
  }, [oilSettingsQuery.data]);

  useEffect(() => {
    if (expensesQuery.error) {
      const error = expensesQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as despesas fixas.";
      toast.error(message);
    }
  }, [expensesQuery.error]);

  useEffect(() => {
    if (vehicleQuery.error) {
      const error = vehicleQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o estado do veículo.";
      toast.error(message);
    }
  }, [vehicleQuery.error]);

  useEffect(() => {
    if (oilSettingsQuery.error) {
      const error = oilSettingsQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as configurações de óleo.";
      toast.error(message);
    }
  }, [oilSettingsQuery.error]);

  const expenses = expensesQuery.data ?? [];
  const vehicle = vehicleQuery.data ?? ({
    currentKm: 0,
    lastUpdated: "",
  } as VehicleState);
  const oilSettings = oilSettingsQuery.data ?? ({
    intervalKm: 5000,
    lastChangeKm: 0,
    lastChangeDate: "",
  } as OilReminderSettings);

  const loading =
    expensesQuery.isLoading || vehicleQuery.isLoading || oilSettingsQuery.isLoading;

  const handleToggle = (id: string) => {
    toggleExpenseMutation.mutate(id, {
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o status da despesa.";
        toast.error(message);
      },
      onSuccess: () => {
        toast.success("Status atualizado!");
      },
    });
  };

  const handleDeleteExpense = (id: string, name: string) => {
    const shouldDelete = window.confirm(
      `Tem certeza que deseja excluir "${name}"?`,
    );
    if (!shouldDelete) {
      return;
    }

    deleteExpenseMutation.mutate(id, {
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível remover a despesa fixa.";
        toast.error(message);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] });
        toast.success("Despesa fixa removida.");
      },
    });
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name || !amount || !dueDay) {
      toast.error("Preencha todos os campos");
      return;
    }

    const parsedAmount = parseFloat(amount);
    const parsedDay = parseInt(dueDay, 10);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    if (Number.isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      toast.error("Informe um dia de vencimento válido.");
      return;
    }

    try {
      await addExpenseMutation.mutateAsync({
        name,
        amount: parsedAmount,
        dueDay: parsedDay,
        paid: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["fixedExpenses"] });
      toast.success("Despesa fixa adicionada!");
      setName("");
      setAmount("");
      setDueDay("");
      setDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar a despesa fixa.";
      toast.error(message);
    }
  };

  const handleSaveOilSettings = async () => {
    const intervalKm = parseInt(intervalInput, 10);
    const lastChangeKm = parseInt(lastChangeInput || "0", 10);

    if (!intervalKm || intervalKm <= 0) {
      toast.error("Informe um intervalo válido (em km).");
      return;
    }

    if (lastChangeInput && (Number.isNaN(lastChangeKm) || lastChangeKm < 0)) {
      toast.error("Informe um KM válido para a última troca.");
      return;
    }

    try {
      const updated = await updateOilSettingsMutation.mutateAsync({
        intervalKm,
        lastChangeKm: lastChangeInput ? lastChangeKm : oilSettings.lastChangeKm,
      });
      queryClient.setQueryData(["oilSettings"], updated);
      setIntervalInput(updated.intervalKm.toString());
      setLastChangeInput(
        updated.lastChangeKm ? updated.lastChangeKm.toString() : "",
      );
      toast.success("Configurações de troca de óleo salvas!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar as configurações de óleo.";
      toast.error(message);
    }
  };

  const handleRegisterOilChange = async () => {
    if (!vehicle.currentKm || vehicle.currentKm <= 0) {
      toast.error("Atualize o KM do veículo antes de registrar a troca.");
      return;
    }

    try {
      const updated = await registerOilChangeMutation.mutateAsync(
        vehicle.currentKm,
      );
      queryClient.setQueryData(["oilSettings"], updated);
      setLastChangeInput(updated.lastChangeKm.toString());
      toast.success("Troca de óleo registrada!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a troca de óleo.";
      toast.error(message);
    }
  };

  const formatAmount = (value: number) =>
    value.toFixed(2).replace(".", ",");

  const formatKm = (value: number) =>
    Math.abs(Math.round(value)).toLocaleString("pt-BR");

  const formatDate = (iso: string) => {
    if (!iso) return "--";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  const { nextChangeKm, kmSinceLast, kmRemaining, overdue, progressPercent } =
    useMemo(() => {
      const nextKm = oilSettings.lastChangeKm + oilSettings.intervalKm;
      const since = Math.max(0, vehicle.currentKm - oilSettings.lastChangeKm);
      const remaining = nextKm - vehicle.currentKm;
      const isOverdue = remaining <= 0;
      const progress =
        oilSettings.intervalKm > 0
          ? Math.min(
              100,
              Math.max(0, (since / oilSettings.intervalKm) * 100),
            )
          : 0;

      return {
        nextChangeKm: nextKm,
        kmSinceLast: since,
        kmRemaining: remaining,
        overdue: isOverdue,
        progressPercent: progress,
      };
    }, [oilSettings.intervalKm, oilSettings.lastChangeKm, vehicle.currentKm]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-full"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Contas Fixas
          </h1>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus size={16} />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Despesa Fixa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ex: Financiamento"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dueDay">Dia do vencimento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  placeholder="Ex: 15"
                  className="mt-1"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addExpenseMutation.isPending}
              >
                {addExpenseMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar despesa"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6">
        {/* Oil reminder */}
        <Card className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-background/92 via-background/80 to-background/95 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(16,185,129,0.55)] glass-card animate-fade-in">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(34,197,94,0.22),transparent_60%),radial-gradient(circle_at_90%_85%,rgba(16,185,129,0.18),transparent_68%)]"
            aria-hidden
          />
          <div className="relative z-10 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_12px_32px_-28px_rgba(16,185,129,0.75)]">
                  <Droplet size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                    Manutenção
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                    Troca de Óleo
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Controle o intervalo de troca do óleo do veículo.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                onClick={handleRegisterOilChange}
                disabled={registerOilChangeMutation.isPending}
              >
                {registerOilChangeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Droplet size={16} />
                )}
                Registrar troca
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
                <p className="text-[11px] uppercase tracking-wide text-emerald-200/80">
                  Última troca
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(oilSettings.lastChangeDate)}
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {oilSettings.lastChangeKm
                    ? `${formatKm(oilSettings.lastChangeKm)} km`
                    : "--"}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
                <p className="text-[11px] uppercase tracking-wide text-emerald-200/80">
                  Próxima troca estimada
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Intervalo atual: {formatKm(oilSettings.intervalKm)} km
                </p>
                <p className="mt-1 text-xl font-semibold text-foreground">
                  {formatKm(nextChangeKm)} km
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-2 bg-background/40" />
              <div className="text-sm">
                <span
                  className={
                    overdue
                      ? "text-destructive font-semibold"
                      : "text-emerald-200/90 font-semibold"
                  }
                >
                  {overdue
                    ? `Troca atrasada em ${formatKm(Math.abs(kmRemaining))} km`
                    : `Faltam ${formatKm(kmRemaining)} km`}
                </span>
                <p className="text-xs text-muted-foreground">
                  Você rodou {formatKm(kmSinceLast)} km desde a última troca.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="intervalKm"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Intervalo (km)
                </Label>
                <Input
                  id="intervalKm"
                  type="number"
                  min="500"
                  step="100"
                  value={intervalInput}
                  onChange={(event) => setIntervalInput(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="lastChangeKm"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Última troca (km)
                </Label>
                <Input
                  id="lastChangeKm"
                  type="number"
                  min="0"
                  value={lastChangeInput}
                  onChange={(event) => setLastChangeInput(event.target.value)}
                />
              </div>
              <Button
                className="sm:col-span-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 text-base font-semibold hover:shadow-glow"
                onClick={handleSaveOilSettings}
                disabled={updateOilSettingsMutation.isPending}
              >
                {updateOilSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Calendar size={18} />
                    Salvar configurações
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Fixed expenses */}
        <Card className="relative overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-b from-background/92 via-background/82 to-background/96 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(16,185,129,0.55)] glass-card animate-fade-in">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_5%,rgba(34,197,94,0.18),transparent_60%),radial-gradient(circle_at_92%_95%,rgba(16,185,129,0.16),transparent_65%)]"
            aria-hidden
          />
          <div className="relative z-10 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_12px_32px_-28px_rgba(16,185,129,0.75)]">
                  <Wallet size={20} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                    Planejamento
                  </p>
                  <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                    Despesas Fixas
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Visualize e controle os custos recorrentes do seu negócio.
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {expenses.length} registro{expenses.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-emerald-400/25 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
                  Cadastre suas despesas fixas para acompanhar vencimentos e manter o fluxo em dia.
                </div>
              ) : (
                expenses.map((expense: FixedExpense) => {
                  const isPaid = expense.paid;
                  return (
                    <div
                      key={expense.id}
                      className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)] transition-colors duration-200 hover:border-emerald-400/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-semibold text-foreground capitalize">
                            {expense.name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isPaid
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-muted/50 text-muted-foreground"
                            }`}
                          >
                            {isPaid ? "Ativa" : "Pausada"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            R$ {formatAmount(expense.amount)}
                          </span>
                          <span className="text-muted-foreground/60">•</span>
                          <span>Vence dia {expense.dueDay}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                        <Switch
                          checked={isPaid}
                          onCheckedChange={() => handleToggle(expense.id)}
                          disabled={toggleExpenseMutation.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => handleDeleteExpense(expense.id, expense.name)}
                          disabled={deleteExpenseMutation.isPending}
                          aria-label={`Remover ${expense.name}`}
                        >
                          {deleteExpenseMutation.isPending &&
                          deleteExpenseMutation.variables === expense.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Fixas;
