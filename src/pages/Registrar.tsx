import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  Fuel,
  Gauge,
  CircleDollarSign,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addFuelEntry,
  getFuelEntries,
  getVehicleState,
  setVehicleKm,
  type FuelEntry,
} from "@/lib/supabase-storage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSpeechRecognition } from "@/hooks/useSpeech";
import { parseFuelSpeech } from "@/lib/fuel-speech-parser";

const EMPTY_FUEL_ENTRIES: FuelEntry[] = [];

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

const formatDecimalNumber = (value: number, fractionDigits: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

const formatPricePerLiterNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return "";
  }

  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });

  if (!formatted.includes(",")) {
    return `${formatted},00`;
  }

  const [integerPart, fractionPart = ""] = formatted.split(",");
  if (fractionPart.length < 2) {
    return `${integerPart},${fractionPart.padEnd(2, "0")}`;
  }
  return formatted;
};

const computeFuelStats = (entries: FuelEntry[]) => {
  if (entries.length === 0) {
    return {
      averageConsumption: 0,
      averageCostPerKm: 0,
      totalKm: 0,
      totalLiters: 0,
      totalSpent: 0,
    };
  }

  const totals = entries.reduce(
    (acc, entry) => {
      if (entry.kmSinceLast > 0 && entry.liters > 0) {
        acc.totalKm += entry.kmSinceLast;
        acc.totalLiters += entry.liters;
      }
      acc.totalSpent += entry.totalCost;
      return acc;
    },
    { totalKm: 0, totalLiters: 0, totalSpent: 0 },
  );

  return {
    averageConsumption:
      totals.totalKm > 0 && totals.totalLiters > 0
        ? totals.totalKm / totals.totalLiters
        : 0,
    averageCostPerKm:
      totals.totalKm > 0 ? totals.totalSpent / totals.totalKm : 0,
    totalKm: totals.totalKm,
    totalLiters: totals.totalLiters,
    totalSpent: totals.totalSpent,
  };
};

const Registrar = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user?.id);
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [manualLiters, setManualLiters] = useState("");
  const [kmCurrent, setKmCurrent] = useState("");
  const [kmUpdate, setKmUpdate] = useState("");
  const speech = useSpeechRecognition();
  const micSupported = speech.supported;
  const [lastHeard, setLastHeard] = useState("");

  const fuelEntriesQuery = useQuery({
    queryKey: ["fuelEntries"],
    queryFn: getFuelEntries,
    enabled: isAuthenticated,
    retry: false,
  });

  const vehicleQuery = useQuery({
    queryKey: ["vehicleState"],
    queryFn: getVehicleState,
    enabled: isAuthenticated,
    retry: false,
  });

  const addFuelEntryMutation = useMutation({
    mutationFn: addFuelEntry,
  });

  const setVehicleKmMutation = useMutation({
    mutationFn: setVehicleKm,
  });

  useEffect(() => {
    const vehicle = vehicleQuery.data;
    if (vehicle) {
      const kmText = vehicle.currentKm ? vehicle.currentKm.toString() : "";
      setKmCurrent(kmText);
      setKmUpdate(kmText);
    }
  }, [vehicleQuery.data]);

  useEffect(() => {
    if (fuelEntriesQuery.error) {
      const error = fuelEntriesQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os abastecimentos.";
      toast.error(message);
    }
  }, [fuelEntriesQuery.error]);

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

  const entries = fuelEntriesQuery.data ?? EMPTY_FUEL_ENTRIES;
  const lastEntry = entries[0];

  useEffect(() => {
    if (entries.length > 0) {
      setMode(entries[0].mode);
    }
  }, [entries]);

  const stats = useMemo(() => computeFuelStats(entries), [entries]);

  useEffect(() => {
    const transcript = speech.transcript ? speech.transcript.trim() : "";

    if (transcript.length === 0) {
      return;
    }

    const updateIfChanged = (
      setter: Dispatch<SetStateAction<string>>,
      nextValue: string,
    ) => {
      if (!nextValue) {
        return false;
      }
      let changed = false;
      setter((prev) => {
        if (prev === nextValue) {
          return prev;
        }
        changed = true;
        return nextValue;
      });
      return changed;
    };

    if (!/\d/.test(transcript)) {
      if (!speech.listening) {
        setLastHeard(transcript);
      }
      return;
    }

    const parsed = parseFuelSpeech(transcript);

    if (!parsed) {
      if (!speech.listening) {
        setLastHeard(transcript);
        toast.warning(
          "Não consegui entender. Tente dizer algo como: 'Abasteci 120 reais a 5,99 o litro e rodei até 85 mil KM'.",
        );
      }
      return;
    }

    let updated = false;
    let hadApplicableData = false;

    if (parsed.totalCost !== undefined && parsed.totalCost > 0) {
      hadApplicableData = true;
      const formatted = formatDecimalNumber(parsed.totalCost, 2);
      updated = updateIfChanged(setTotalCost, formatted) || updated;
    }

    if (parsed.pricePerLiter !== undefined && parsed.pricePerLiter > 0) {
      hadApplicableData = true;
      const formatted = formatPricePerLiterNumber(parsed.pricePerLiter);
      updated = updateIfChanged(setPricePerLiter, formatted) || updated;
    }

    if (mode === "manual" && parsed.liters !== undefined && parsed.liters > 0) {
      hadApplicableData = true;
      const formatted = formatDecimalNumber(parsed.liters, 3);
      updated = updateIfChanged(setManualLiters, formatted) || updated;
    }

    if (parsed.kmCurrent !== undefined && parsed.kmCurrent > 0) {
      hadApplicableData = true;
      const kmValue = Math.round(parsed.kmCurrent);
      if (kmValue > 0) {
        const kmString = kmValue.toString();
        const changedCurrent = updateIfChanged(setKmCurrent, kmString);
        const changedUpdate = updateIfChanged(setKmUpdate, kmString);
        updated = changedCurrent || changedUpdate || updated;
      }
    }

    if (!speech.listening) {
      setLastHeard(transcript);
      if (updated || hadApplicableData) {
        toast.success("Campos preenchidos por voz. Confira antes de salvar.");
      } else {
        toast.warning(
          "Não encontrei dados para preencher. Fale sobre o valor total, preço por litro, litros ou KM.",
        );
      }
    }
  }, [speech.transcript, speech.listening, mode]);

  useEffect(() => {
    if (!speech.error) {
      return;
    }
    toast.error("Não foi possível usar o microfone. Verifique as permissões do navegador.");
  }, [speech.error]);

  const parseNumber = (raw: string) => {
    if (!raw) return 0;
    const normalized = raw
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const formatPricePerLiterValue = (value: string) => {
    if (!value || value.trim().length === 0) {
      return "";
    }
    const numeric = parseNumber(value);
    if (!Number.isFinite(numeric)) {
      return "";
    }
    return formatPricePerLiterNumber(numeric);
  };

  const sanitizeDecimalInput = (value: string, fractionDigits: number) => {
    if (!value) return "";
    const cleaned = value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
    const endsWithSeparator = cleaned.endsWith(",");
    const [integerPart = "", ...fractionParts] = cleaned.split(",");
    const fractionPart = fractionParts.join("").slice(0, fractionDigits);
    const safeInteger =
      integerPart.length === 0 ? "0" : integerPart.replace(/^0+(?=\d)/, "") || "0";
    if (fractionDigits === 0) {
      return safeInteger;
    }
    if (fractionPart.length > 0) {
      return `${safeInteger},${fractionPart}`;
    }
    if (endsWithSeparator) {
      return `${safeInteger},`;
    }
    return safeInteger;
  };

  const formatDecimalValue = (value: string, fractionDigits: number) => {
    if (!value || value.trim().length === 0) {
      return "";
    }
    const numeric = parseNumber(value);
    if (!Number.isFinite(numeric)) {
      return "";
    }
    return numeric.toLocaleString("pt-BR", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  };

  const handlePricePerLiterChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPricePerLiter(sanitizeDecimalInput(event.target.value, 3));
  };

  const handlePricePerLiterBlur = () => {
    setPricePerLiter((current) => formatPricePerLiterValue(current));
  };

  const handleTotalCostChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTotalCost(sanitizeDecimalInput(event.target.value, 2));
  };

  const handleTotalCostBlur = () => {
    setTotalCost((current) => formatDecimalValue(current, 2));
  };

  const handleManualLitersChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (mode === "manual") {
      setManualLiters(sanitizeDecimalInput(event.target.value, 3));
    }
  };

  const derived = useMemo(() => {
    const price = parseNumber(pricePerLiter);
    const total = parseNumber(totalCost);
    const km = parseNumber(kmCurrent);
    const litersFromAuto = price > 0 ? total / price : 0;
    const litersValue =
      mode === "automatic" ? litersFromAuto : parseNumber(manualLiters);
    const kmSinceLast =
      lastEntry && km > lastEntry.kmCurrent ? km - lastEntry.kmCurrent : 0;
    const consumption =
      kmSinceLast > 0 && litersValue > 0 ? kmSinceLast / litersValue : 0;
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

  const handleSaveFuel = async () => {
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

    try {
      const saved = await addFuelEntryMutation.mutateAsync({
        mode,
        pricePerLiter: derived.price,
        totalCost: derived.total,
        liters: mode === "manual" ? derived.litersValue : undefined,
        kmCurrent: derived.km,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["fuelEntries"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicleState"] }),
      ]);

      toast.success("Abastecimento registrado!");
      setKmCurrent(saved.kmCurrent.toString());
      setKmUpdate(saved.kmCurrent.toString());
      setPricePerLiter("");
      setTotalCost("");
      setManualLiters("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o abastecimento.";
      toast.error(message);
    }
  };

  const handleUpdateKm = async () => {
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

    try {
      await setVehicleKmMutation.mutateAsync(kmValue);
      await queryClient.invalidateQueries({ queryKey: ["vehicleState"] });
      setKmCurrent(kmValue.toString());
      toast.success("KM atualizado!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o KM.";
      toast.error(message);
    }
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

  if (fuelEntriesQuery.isLoading || vehicleQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Combustível
          </h1>
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

          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as "automatic" | "manual")}
          >
            <TabsList className="grid w-full grid-cols-2 h-10 bg-secondary/50 backdrop-blur-sm">
              <TabsTrigger
                value="automatic"
                className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300"
              >
                Automático
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all duration-300"
              >
                Manual
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="pricePerLiter">Preço por litro (R$)</Label>
              <Input
                id="pricePerLiter"
                type="text"
                inputMode="decimal"
                pattern="^\\d+(?:[\\.,]\\d{0,3})?$"
                placeholder="0,00"
                autoComplete="off"
                value={pricePerLiter}
                onChange={handlePricePerLiterChange}
                onBlur={handlePricePerLiterBlur}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="totalCost">Valor total (R$)</Label>
              <Input
                id="totalCost"
                type="text"
                inputMode="decimal"
                pattern="^\\d+(?:[\\.,]\\d{0,2})?$"
                placeholder="0,00"
                autoComplete="off"
                value={totalCost}
                onChange={handleTotalCostChange}
                onBlur={handleTotalCostBlur}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="liters">
                {mode === "automatic"
                  ? "Litros calculados"
                  : "Litros abastecidos (L)"}
              </Label>
              <Input
                id="liters"
                type="text"
                placeholder="0,000"
                value={
                  mode === "automatic"
                    ? derived.litersFromAuto > 0
                      ? formatNumber(derived.litersFromAuto)
                      : ""
                    : manualLiters
                }
                onChange={handleManualLitersChange}
                readOnly={mode === "automatic"}
                inputMode="decimal"
                pattern="^\\d+(?:[\\.,]\\d{0,3})?$"
                className={mode === "automatic" ? "bg-muted/40" : ""}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="kmCurrent">
                KM atual do veículo{" "}
                <span className="text-xs text-muted-foreground">
                  • Último registro:{" "}
                  {lastEntry ? formatNumber(lastEntry.kmCurrent, 0) : "--"} km
                </span>
              </Label>
              <Input
                id="kmCurrent"
                type="number"
                step="1"
                placeholder="0"
                value={kmCurrent}
                onChange={(event) => setKmCurrent(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">KM rodados</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.kmSinceLast > 0
                  ? formatNumber(derived.kmSinceLast, 0)
                  : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Último:{" "}
                {lastEntry ? formatNumber(lastEntry.kmSinceLast, 0) : "--"} km
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">Consumo (km/L)</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.consumption > 0
                  ? formatNumber(derived.consumption)
                  : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Média histórica:{" "}
                {stats.averageConsumption > 0
                  ? formatNumber(stats.averageConsumption)
                  : "--"}{" "}
                km/L
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-secondary/30 to-secondary/10 p-3 space-y-1 hover:border-primary/30 transition-all duration-300">
              <p className="text-xs text-muted-foreground">Custo por km</p>
              <p className="text-lg font-semibold text-foreground">
                {derived.costPerKm > 0
                  ? formatCurrency(derived.costPerKm)
                  : "--"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Média histórica:{" "}
                {stats.averageCostPerKm > 0
                  ? formatCurrency(stats.averageCostPerKm)
                  : "--"}
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveFuel}
            size="lg"
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow flex items-center justify-center gap-3"
            disabled={addFuelEntryMutation.isPending}
          >
            {addFuelEntryMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                {micSupported && (
                  <Button
                    type="button"
                    variant={speech.listening ? "destructive" : "secondary"}
                    size="sm"
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (speech.listening) {
                        speech.stop();
                      } else {
                        speech.start();
                      }
                    }}
                  >
                    {speech.listening ? <MicOff size={16} /> : <Mic size={16} />}
                    {speech.listening ? "Parar" : "Falar"}
                  </Button>
                )}
                <span>Salvar abastecimento</span>
              </>
            )}
          </Button>
          {micSupported && lastHeard && (
            <p className="text-[11px] text-muted-foreground text-right">
              Último comando: "{lastHeard}"
            </p>
          )}
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
                • Último registro:{" "}
                {lastEntry ? formatNumber(lastEntry.kmCurrent, 0) : "--"} km
              </span>
            </Label>
            <Input
              id="kmUpdate"
              type="number"
              step="1"
              placeholder="0"
              value={kmUpdate}
              onChange={(event) => setKmUpdate(event.target.value)}
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
                  {lastEntry && lastEntry.consumption > 0
                    ? formatNumber(lastEntry.consumption)
                    : "--"}{" "}
                  km/L
                </p>
                <p>
                  <span className="text-muted-foreground">Custo por km:</span>{" "}
                  {lastEntry && lastEntry.costPerKm > 0
                    ? formatCurrency(lastEntry.costPerKm)
                    : "--"}
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
                  <span className="text-muted-foreground">
                    KM desde último abastecimento:
                  </span>{" "}
                  {kmFromUpdate.distance > 0
                    ? formatNumber(kmFromUpdate.distance, 0)
                    : "--"}{" "}
                  km
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Consumo médio da frota:
                  </span>{" "}
                  {stats.averageConsumption > 0
                    ? formatNumber(stats.averageConsumption)
                    : "--"}{" "}
                  km/L
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
                <li>• Litros: {formatNumber(entries[0].liters)}</li>
                <li>
                  • KM: {formatNumber(entries[0].kmCurrent, 0)} km
                </li>
                <li>• Gasto: {formatCurrency(entries[0].totalCost)}</li>
              </ul>
            )}
          </div>

          <Button
            onClick={handleUpdateKm}
            variant="secondary"
            className="w-full h-12 text-base font-semibold"
            disabled={setVehicleKmMutation.isPending}
          >
            {setVehicleKmMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Atualizando...
              </>
            ) : (
              "Atualizar KM"
            )}
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Registrar;
