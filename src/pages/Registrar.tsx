import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Fuel, Gauge, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addFuelEntry,
  getFuelEntries,
  getFuelStats,
  getVehicleState,
  setVehicleKm,
  type FuelEntry,
} from "@/lib/storage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatNumber = (value: number, minimumFractionDigits = 2) =>
  value
    .toLocaleString("pt-BR", {
      minimumFractionDigits,
      maximumFractionDigits: minimumFractionDigits,
    })
    .replace("NaN", "0,00");

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const Registrar = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [manualLiters, setManualLiters] = useState("");
  const [kmCurrent, setKmCurrent] = useState("");
  const [kmUpdate, setKmUpdate] = useState("");
  const [entries, setEntries] = useState<FuelEntry[]>([]);
  const [stats, setStats] = useState(() => getFuelStats());

  useEffect(() => {
    const vehicle = getVehicleState();
    const allEntries = getFuelEntries();
    setEntries(allEntries);
    setStats(getFuelStats());
    setKmCurrent(vehicle.currentKm ? vehicle.currentKm.toString() : "");
    setKmUpdate(vehicle.currentKm ? vehicle.currentKm.toString() : "");
    if (allEntries.length > 0) {
      setMode(allEntries[0].mode);
    }
  }, []);

  const lastEntry = entries[0];

  const parseNumber = (raw: string) => {
    if (!raw) return 0;
    const normalized = raw.replace(/\s/g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const derived = useMemo(() => {
    const price = parseNumber(pricePerLiter);
    const total = parseNumber(totalCost);
    const km = parseNumber(kmCurrent);
    const litersFromAuto = price > 0 ? total / price : 0;
    const litersValue = mode === "automatic" ? litersFromAuto : parseNumber(manualLiters);
    const kmSinceLast =
      lastEntry && km > lastEntry.kmCurrent ? km - lastEntry.kmCurrent : 0;
    const consumption = kmSinceLast > 0 && litersValue > 0 ? kmSinceLast / litersValue : 0;
    const costPerKm = kmSinceLast > 0 ? total / kmSinceLast : 0;

    return {
      price,
      total,
      km,
      litersValue,
      kmSinceLast,
      consumption,
      costPerKm,
      litersFromAuto,
    };
  }, [pricePerLiter, totalCost, kmCurrent, manualLiters, mode, lastEntry]);

  const handleSaveFuel = () => {
    if (derived.price <= 0 || derived.total <= 0) {
      toast.error("Informe preço por litro e valor total válidos.");
      return;
    }

    if (derived.km <= 0) {
      toast.error("Informe o KM atual do veículo.");
      return;
    }

    if (lastEntry && derived.km <= lastEntry.kmCurrent) {
      toast.error("O KM atual deve ser maior que o último registro.");
      return;
    }

    if (mode === "manual" && derived.litersValue <= 0) {
      toast.error("Informe a quantidade de litros abastecidos.");
      return;
    }

    const saved = addFuelEntry({
      mode,
      pricePerLiter: derived.price,
      totalCost: derived.total,
      liters: mode === "manual" ? derived.litersValue : undefined,
      kmCurrent: derived.km,
    });

    toast.success("Abastecimento registrado!");
    const allEntries = getFuelEntries();
    setEntries(allEntries);
    setStats(getFuelStats());
    setKmCurrent(saved.kmCurrent.toString());
    setKmUpdate(saved.kmCurrent.toString());
    setPricePerLiter("");
    setTotalCost("");
    setManualLiters("");
  };

  const handleUpdateKm = () => {
    const kmValue = parseNumber(kmUpdate);
    if (!kmValue || kmValue <= 0) {
      toast.error("Informe um KM válido.");
      return;
    }

    const current = lastEntry?.kmCurrent ?? 0;
    if (kmValue < current) {
      toast.error("O KM atual não pode ser menor que o último abastecimento.");
      return;
    }

    setVehicleKm(kmValue);
    setKmCurrent(kmValue.toString());
    toast.success("KM atualizado!");
  };

  const kmFromUpdate = useMemo(() => {
    const kmValue = parseNumber(kmUpdate);
    const lastKm = lastEntry?.kmCurrent ?? 0;
    const distance = kmValue > lastKm ? kmValue - lastKm : 0;
    const estimatedCost = distance * (stats.averageCostPerKm || 0);
    return {
      distance,
      estimatedCost,
    };
  }, [kmUpdate, lastEntry, stats.averageCostPerKm]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center gap-3 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full hover:bg-accent"
        >
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Combustível</h1>
          <p className="text-sm text-muted-foreground">
            Registre abastecimentos e acompanhe o consumo.
          </p>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6">
        <Card className="p-5 space-y-5 glass-card animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Combustível
              </p>
              <h2 className="text-lg font-semibold">Registro de Abastecimento</h2>
            </div>
            <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
              {mode === "automatic" ? "Modo automático" : "Modo manual"}
            </span>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "automatic" | "manual")}>
            <TabsList className="grid w-full grid-cols-2 h-10 bg-secondary/50 backdrop-blur-sm">
              <TabsTrigger value="automatic" className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300">
                Automático
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300">
                Manual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pricePerLiter">Preço por litro (R$)</Label>
              <Input
                id="pricePerLiter"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={pricePerLiter}
                onChange={(e) => setPricePerLiter(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="totalCost">Valor total (R$)</Label>
              <Input
                id="totalCost"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="liters">
                {mode === "automatic" ? "Litros calculados" : "Litros abastecidos (L)"}
              </Label>
              <Input
                id="liters"
                type="text"
                placeholder="0,00"
                value={
                  mode === "automatic"
                    ? derived.litersFromAuto > 0
                      ? formatNumber(derived.litersFromAuto)
                      : ""
                    : manualLiters
                }
                onChange={(e) => setManualLiters(e.target.value)}
                readOnly={mode === "automatic"}
                inputMode="decimal"
                pattern="[0-9]+([\\.,][0-9]+)?"
                className={mode === "automatic" ? "bg-muted/40" : ""}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kmCurrent">
                KM atual do veículo{" "}
                <span className="text-xs text-muted-foreground">
                  • Último registro: {lastEntry ? formatNumber(lastEntry.kmCurrent, 0) : "--"} km
                </span>
              </Label>
              <Input
                id="kmCurrent"
                type="number"
                step="1"
                placeholder="0"
                value={kmCurrent}
                onChange={(e) => setKmCurrent(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">KM rodados</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.kmSinceLast > 0 ? formatNumber(derived.kmSinceLast, 0) : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Último: {lastEntry ? formatNumber(lastEntry.kmSinceLast, 0) : "--"} km
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">Consumo (km/L)</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.consumption > 0 ? formatNumber(derived.consumption) : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Média histórica: {stats.averageConsumption > 0 ? formatNumber(stats.averageConsumption) : "--"} km/L
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">Custo por km</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.costPerKm > 0 ? formatCurrency(derived.costPerKm) : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Média histórica:{" "}
                {stats.averageCostPerKm > 0 ? formatCurrency(stats.averageCostPerKm) : "--"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveFuel}
            size="lg"
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
          >
            Salvar abastecimento
          </Button>
        </Card>

        <Card className="p-5 space-y-5 glass-card animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Quilometragem
              </p>
              <h2 className="text-lg font-semibold">Controle de KM Rodado</h2>
            </div>
            <Fuel size={20} className="text-primary" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="kmUpdate">
              KM atual{" "}
              <span className="text-xs text-muted-foreground">
                • Último registro: {lastEntry ? formatNumber(lastEntry.kmCurrent, 0) : "--"} km
              </span>
            </Label>
            <Input
              id="kmUpdate"
              type="number"
              step="1"
              placeholder="0"
              value={kmUpdate}
              onChange={(e) => setKmUpdate(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                <Gauge size={16} />
                <span>Resumo do último abastecimento</span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">KM rodados:</span>{" "}
                  {lastEntry ? formatNumber(lastEntry.kmSinceLast, 0) : "--"} km
                </p>
                <p>
                  <span className="text-muted-foreground">Consumo médio:</span>{" "}
                  {lastEntry && lastEntry.consumption > 0 ? formatNumber(lastEntry.consumption) : "--"} km/L
                </p>
                <p>
                  <span className="text-muted-foreground">Custo por km:</span>{" "}
                  {lastEntry && lastEntry.costPerKm > 0 ? formatCurrency(lastEntry.costPerKm) : "--"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
                <CircleDollarSign size={16} />
                <span>Projeção atual</span>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">KM desde último abastecimento:</span>{" "}
                  {kmFromUpdate.distance > 0 ? formatNumber(kmFromUpdate.distance, 0) : "--"} km
                </p>
                <p>
                  <span className="text-muted-foreground">Consumo médio da frota:</span>{" "}
                  {stats.averageConsumption > 0 ? formatNumber(stats.averageConsumption) : "--"} km/L
                </p>
                <p>
                  <span className="text-muted-foreground">Gasto estimado:</span>{" "}
                  {kmFromUpdate.distance > 0 && kmFromUpdate.estimatedCost > 0
                    ? formatCurrency(kmFromUpdate.estimatedCost)
                    : "--"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-secondary/10 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Resumo do dia</p>
            {entries.length === 0 ? (
              <p>Nenhum abastecimento registrado ainda.</p>
            ) : (
              <ul className="space-y-1">
                <li>
                  • Litros: {formatNumber(entries[0].liters)}
                </li>
                <li>
                  • KM: {formatNumber(entries[0].kmCurrent, 0)} km
                </li>
                <li>
                  • Gasto: {formatCurrency(entries[0].totalCost)}
                </li>
              </ul>
            )}
          </div>

          <Button
            onClick={handleUpdateKm}
            variant="secondary"
            className="w-full h-12 text-base font-semibold"
          >
            Atualizar KM
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Registrar;
