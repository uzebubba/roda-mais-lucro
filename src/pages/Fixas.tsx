import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Plus, Droplet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getFixedExpenses,
  addFixedExpense,
  toggleFixedExpensePaid,
  FixedExpense,
  getVehicleState,
  getOilReminderSettings,
  updateOilReminderSettings,
  registerOilChange,
  VehicleState,
  OilReminderSettings,
} from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const Fixas = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [vehicle, setVehicle] = useState<VehicleState>(() => getVehicleState());
  const [oilSettings, setOilSettings] = useState<OilReminderSettings>(() => getOilReminderSettings());
  const [intervalInput, setIntervalInput] = useState(oilSettings.intervalKm.toString());
  const [lastChangeInput, setLastChangeInput] = useState(
    oilSettings.lastChangeKm ? oilSettings.lastChangeKm.toString() : "",
  );

  useEffect(() => {
    loadExpenses();
    refreshOilData();
  }, []);

  const loadExpenses = () => {
    setExpenses(getFixedExpenses());
  };

  const refreshOilData = () => {
    const vehicleState = getVehicleState();
    const settings = getOilReminderSettings();
    setVehicle(vehicleState);
    setOilSettings(settings);
    setIntervalInput(settings.intervalKm.toString());
    setLastChangeInput(settings.lastChangeKm ? settings.lastChangeKm.toString() : "");
  };

  const handleToggle = (id: string) => {
    toggleFixedExpensePaid(id);
    loadExpenses();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !amount || !dueDay) {
      toast.error("Preencha todos os campos");
      return;
    }

    addFixedExpense({
      name,
      amount: parseFloat(amount),
      dueDay: parseInt(dueDay),
      paid: false,
    });

    toast.success("Despesa fixa adicionada!");
    setName("");
    setAmount("");
    setDueDay("");
    setDialogOpen(false);
    loadExpenses();
  };

  const handleSaveOilSettings = () => {
    const intervalKm = parseInt(intervalInput, 10);
    const lastChangeKm = parseInt(lastChangeInput || "0", 10);

    if (!intervalKm || intervalKm <= 0) {
      toast.error("Informe um intervalo válido (em km).");
      return;
    }

    if (lastChangeInput && (isNaN(lastChangeKm) || lastChangeKm < 0)) {
      toast.error("Informe um KM válido para a última troca.");
      return;
    }

    const updated = updateOilReminderSettings({
      intervalKm,
      lastChangeKm: lastChangeInput ? lastChangeKm : oilSettings.lastChangeKm,
    });
    setOilSettings(updated);
    setIntervalInput(updated.intervalKm.toString());
    setLastChangeInput(updated.lastChangeKm ? updated.lastChangeKm.toString() : "");
    toast.success("Configurações de troca de óleo salvas!");
  };

  const handleRegisterOilChange = () => {
    if (!vehicle.currentKm || vehicle.currentKm <= 0) {
      toast.error("Atualize o KM do veículo antes de registrar a troca.");
      return;
    }

    const updated = registerOilChange(vehicle.currentKm);
    setOilSettings(updated);
    setLastChangeInput(updated.lastChangeKm.toString());
    toast.success("Troca de óleo registrada!");
  };

  const formatAmount = (amount: number) => {
    return amount.toFixed(2).replace(".", ",");
  };

  const formatKm = (value: number) => {
    return Math.abs(Math.round(value)).toLocaleString("pt-BR");
  };

  const formatDate = (iso: string) => {
    if (!iso) return "--";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat("pt-BR").format(date);
  };

  const nextChangeKm = oilSettings.lastChangeKm + oilSettings.intervalKm;
  const kmSinceLast = Math.max(0, vehicle.currentKm - oilSettings.lastChangeKm);
  const kmRemaining = nextChangeKm - vehicle.currentKm;
  const overdue = kmRemaining <= 0;
  const kmStatus = overdue
    ? `Troca atrasada em ${formatKm(kmRemaining)} km`
    : `Faltam ${formatKm(kmRemaining)} km`;
  const progressPercent =
    oilSettings.intervalKm > 0 ? Math.min(100, Math.max(0, (kmSinceLast / oilSettings.intervalKm) * 100)) : 0;

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
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Contas Fixas</h1>
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
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setAmount(e.target.value)}
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
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex: 10"
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3 animate-fade-in">
        <Card className="p-4 space-y-4 glass-card animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Manutenção
              </p>
              <h2 className="text-base font-semibold">Troca de óleo</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Configure o intervalo e acompanhe quando será a próxima troca.
              </p>
            </div>
            <Droplet size={20} className="text-primary shrink-0" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="intervalKm" className="text-xs">
                Intervalo de troca (km)
              </Label>
              <Input
                id="intervalKm"
                type="number"
                min="100"
                step="100"
                value={intervalInput}
                onChange={(e) => setIntervalInput(e.target.value)}
                placeholder="Ex: 5000"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lastChangeKm" className="text-xs">
                Última troca (km)
                <span className="block text-[11px] text-muted-foreground">
                  Registrada em {formatDate(oilSettings.lastChangeDate)}
                </span>
              </Label>
              <Input
                id="lastChangeKm"
                type="number"
                min="0"
                step="100"
                value={lastChangeInput}
                onChange={(e) => setLastChangeInput(e.target.value)}
                placeholder="Ex: 42.000"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
                <p className="text-muted-foreground">KM atual</p>
                <p className="text-base font-semibold text-foreground">
                  {vehicle.currentKm ? formatKm(vehicle.currentKm) : "--"}
                </p>
                <p className="text-[11px] text-muted-foreground">Atualizado em {formatDate(vehicle.lastUpdated)}</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
                <p className="text-muted-foreground">Próxima troca</p>
                <p className="text-base font-semibold text-foreground">
                  {oilSettings.intervalKm > 0 ? formatKm(nextChangeKm) : "--"}
                </p>
                <p className={`text-[11px] leading-tight ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {kmStatus}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1 col-span-2">
                <p className="text-muted-foreground">Rodados desde a troca</p>
                <p className="text-base font-semibold text-foreground">
                  {formatKm(kmSinceLast)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Intervalo configurado: {formatKm(oilSettings.intervalKm)} km
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Progress value={progressPercent} />
              <p className="text-[11px] text-muted-foreground">
                {progressPercent.toFixed(0)}% do intervalo percorrido
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveOilSettings} className="flex-1 min-w-[140px]">
                Salvar configurações
              </Button>
              <Button
                variant="outline"
                onClick={handleRegisterOilChange}
                className="flex-1 min-w-[140px]"
              >
                Registrar troca agora
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={refreshOilData}
              className="w-full text-[11px] text-muted-foreground hover:text-foreground"
            >
              Sincronizar dados de KM
            </Button>
          </div>
        </Card>

        {expenses.length === 0 ? (
          <Card className="p-8 text-center glass-card animate-fade-in">
            <p className="text-muted-foreground">Nenhuma conta fixa cadastrada</p>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id} className="p-4 glass-card animate-fade-in">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-muted rounded-lg">
                    <Calendar size={20} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{expense.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        Vence dia {expense.dueDay}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-destructive mt-1">
                      R$ {formatAmount(expense.amount)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={expense.paid}
                    onCheckedChange={() => handleToggle(expense.id)}
                  />
                  <span
                    className={`text-xs font-medium ${
                      expense.paid ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {expense.paid ? "Pago" : "Pendente"}
                  </span>
                </div>
              </div>
            </Card>
          ))
        )}
      </main>
    </div>
  );
};

export default Fixas;
