import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  Fuel,
  Gauge,
  Droplet,
  HelpCircle,
  Loader2,
  Mic,
  MicOff,
  Save,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addFuelEntry,
  addTransaction,
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
import { triggerEducationalTip } from "@/lib/educational-tips";
import {
  FuelTutorialProvider,
  useFuelTutorialAnchor,
  useFuelTutorialControls,
} from "@/components/tutorial/FuelTutorial";

const EMPTY_FUEL_ENTRIES: FuelEntry[] = [];
const VOICE_CAPTURE_ENABLED = false; // Toggle when the voice feature is ready

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
  const fuelCardAnchorRef = useFuelTutorialAnchor<HTMLDivElement>("fuel-card");
  const fuelModeAnchorRef = useFuelTutorialAnchor<HTMLDivElement>("fuel-mode");
  const fuelInputsAnchorRef = useFuelTutorialAnchor<HTMLDivElement>("fuel-inputs");
  const kmCardAnchorRef = useFuelTutorialAnchor<HTMLDivElement>("fuel-km-card");
  const kmSummaryAnchorRef = useFuelTutorialAnchor<HTMLDivElement>("fuel-km-summary");
  const kmUpdateAnchorRef = useFuelTutorialAnchor<HTMLButtonElement>("fuel-km-update");
  const { restartTutorial } = useFuelTutorialControls();
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [manualLiters, setManualLiters] = useState("");
  const [kmCurrent, setKmCurrent] = useState("");
  const [kmUpdate, setKmUpdate] = useState("");
  const speech = useSpeechRecognition();
  const {
    supported: micSupported,
    listening,
    transcript,
    isFinalTranscript,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
  } = speech;
  const [lastHeard, setLastHeard] = useState("");
  const showVoiceControls = VOICE_CAPTURE_ENABLED && micSupported;

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

  const addTransactionMutation = useMutation({
    mutationFn: addTransaction,
  });

  const setVehicleKmMutation = useMutation({
    mutationFn: setVehicleKm,
  });

  useEffect(() => {
    triggerEducationalTip("fuel-page", () => {
      toast.info("💡 Dica: Use o modo automático! Ele calcula os litros pra você.");
    });
  }, []);

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
  const VOICE_TOAST_ID = "fuel-voice-feedback";
  const lastProcessedFuelTranscriptRef = useRef("");

  useEffect(() => {
    if (listening) {
      lastProcessedFuelTranscriptRef.current = "";
      toast.dismiss(VOICE_TOAST_ID);
    }
  }, [listening]);

  useEffect(() => {
    const cleanedTranscript = transcript ? transcript.trim() : "";

    if (cleanedTranscript.length === 0) {
      return;
    }

    if (cleanedTranscript === lastProcessedFuelTranscriptRef.current) {
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

    if (!/\d/.test(cleanedTranscript)) {
      if (!listening) {
        setLastHeard(cleanedTranscript);
        lastProcessedFuelTranscriptRef.current = cleanedTranscript;
      }
      return;
    }

    const parsed = parseFuelSpeech(cleanedTranscript);

    if (!parsed) {
      if (!listening) {
        setLastHeard(cleanedTranscript);
        toast.warning(
          "Não consegui entender. Tente dizer algo como: 'Abasteci 120 reais a 5,99 o litro e rodei até 85 mil KM'.",
          { id: VOICE_TOAST_ID },
        );
        lastProcessedFuelTranscriptRef.current = cleanedTranscript;
      }
      return;
    }

    setLastHeard(cleanedTranscript);

    let updated = false;
    let hadApplicableData = false;

    let nextPriceCandidate = parseNumber(pricePerLiter);
    let nextTotalCandidate = parseNumber(totalCost);

    if (parsed.totalCost !== undefined && parsed.totalCost > 0) {
      hadApplicableData = true;
      const formatted = formatDecimalNumber(parsed.totalCost, 2);
      const changed = updateIfChanged(setTotalCost, formatted);
      if (changed) {
        updated = true;
      }
      nextTotalCandidate = parsed.totalCost;
    }

    if (parsed.pricePerLiter !== undefined && parsed.pricePerLiter > 0) {
      hadApplicableData = true;
      const formatted = formatPricePerLiterNumber(parsed.pricePerLiter);
      const changed = updateIfChanged(setPricePerLiter, formatted);
      if (changed) {
        updated = true;
      }
      nextPriceCandidate = parsed.pricePerLiter;
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
        if (changedCurrent || changedUpdate) {
          updated = true;
        }
      }
    }

    lastProcessedFuelTranscriptRef.current = cleanedTranscript;

    if (!isFinalTranscript) {
      return;
    }

    if (updated || hadApplicableData) {
      toast.success("Campos preenchidos por voz. Confira antes de salvar.", {
        id: VOICE_TOAST_ID,
      });

      const hasPrice = parsed.pricePerLiter !== undefined
        ? parsed.pricePerLiter > 0
        : nextPriceCandidate > 0;
      const hasTotal = parsed.totalCost !== undefined
        ? parsed.totalCost > 0
        : nextTotalCandidate > 0;

      if (listening && hasPrice && hasTotal) {
        stopSpeech();
      }
    } else {
      toast.warning(
        "Não encontrei dados para preencher. Fale sobre o valor total, preço por litro, litros ou KM.",
        { id: VOICE_TOAST_ID },
      );
    }
  }, [transcript, listening, mode, stopSpeech, isFinalTranscript, pricePerLiter, totalCost]);

  useEffect(() => {
    if (!speechError) {
      return;
    }
    toast.error("Não foi possível usar o microfone. Verifique as permissões do navegador.");
  }, [speechError]);

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

      let transactionRegistered = false;
      try {
        await addTransactionMutation.mutateAsync({
          type: "expense",
          amount: saved.totalCost,
          date: saved.createdAt,
          description: "Abastecimento",
          category: "Combustível",
        });
        transactionRegistered = true;
      } catch (transactionError) {
        const message =
          transactionError instanceof Error
            ? transactionError.message
            : "Não foi possível registrar o gasto automaticamente.";
        toast.error(
          `${message} O abastecimento foi salvo, mas registre o gasto manualmente em 'Registrar gasto'.`,
        );
      }

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["fuelEntries"] }),
        queryClient.invalidateQueries({ queryKey: ["vehicleState"] }),
      ];
      if (transactionRegistered) {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        );
      }
      await Promise.all(invalidations);

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

  const isSavingFuel =
    addFuelEntryMutation.isPending || addTransactionMutation.isPending;

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
        <div className="flex flex-1 items-center gap-3">
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
        </div>
        <button
          type="button"
          onClick={() => restartTutorial()}
          aria-label="Rever tutorial de combustível"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-muted-foreground shadow-lg backdrop-blur transition hover:scale-105 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-6">
        <Card
          ref={fuelCardAnchorRef}
          className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-background/90 via-background/75 to-background/90 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(16,185,129,0.55)] glass-card animate-fade-in"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(34,197,94,0.18),transparent_60%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.14),transparent_65%)]"
            aria-hidden
          />
          <span className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-emerald-400/60 via-emerald-300/80 to-emerald-400/60" />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_12px_32px_-28px_rgba(16,185,129,0.75)]">
                  <Droplet size={20} />
                </span>
                <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                  Combustível
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                  Registro de Abastecimento
                </h2>
              </div>
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {mode === "automatic" ? "Modo automático" : "Modo manual"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => restartTutorial()}
                >
                  Ver tutorial
                </Button>
              </div>
            </div>

            <div ref={fuelModeAnchorRef}>
              <Tabs
                value={mode}
                onValueChange={(value) => setMode(value as "automatic" | "manual")}
              >
                <TabsList className="grid w-full grid-cols-2 rounded-full border border-primary/20 bg-background/60 p-1 text-sm backdrop-blur">
                  <TabsTrigger
                    value="automatic"
                    className="rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-primary/15 data-[state=active]:text-primary transition-all"
                  >
                    Automático
                  </TabsTrigger>
                  <TabsTrigger
                    value="manual"
                    className="rounded-full px-3 py-2 text-sm font-medium data-[state=active]:bg-primary/15 data-[state=active]:text-primary transition-all"
                  >
                    Manual
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div ref={fuelInputsAnchorRef} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-400/20 bg-background/70 p-3 shadow-[0_10px_30px_-28px_rgba(16,185,129,0.6)] backdrop-blur">
                <Label
                  htmlFor="pricePerLiter"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Preço por litro (R$)
                </Label>
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

              <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-400/20 bg-background/70 p-3 shadow-[0_10px_30px_-28px_rgba(16,185,129,0.6)] backdrop-blur">
                <Label
                  htmlFor="totalCost"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Valor total (R$)
                </Label>
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

              <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-400/20 bg-background/70 p-3 shadow-[0_10px_30px_-28px_rgba(16,185,129,0.6)] backdrop-blur">
                <Label
                  htmlFor="liters"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
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

              <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-400/20 bg-background/70 p-3 shadow-[0_10px_30px_-28px_rgba(16,185,129,0.6)] backdrop-blur">
                <Label
                  htmlFor="kmCurrent"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  KM atual do veículo
                  <span className="mt-0.5 block text-[11px] font-normal normal-case tracking-normal text-muted-foreground/80">
                    Último registro:{" "}
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

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                  Resumo do abastecimento
                </p>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Atualizado em tempo real
                </span>
              </div>
              <div className="mt-4 flex flex-col divide-y divide-emerald-400/15 sm:grid sm:grid-cols-3 sm:gap-4 sm:divide-y-0 sm:divide-x">
                <div className="flex flex-col gap-2 pt-3 sm:pt-0 sm:px-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    KM rodados
                  </p>
                  <p className="text-xl font-semibold text-foreground leading-tight sm:text-2xl">
                    {derived.kmSinceLast > 0
                      ? formatNumber(derived.kmSinceLast, 0)
                      : "--"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Último abastecimento:{" "}
                    {lastEntry ? formatNumber(lastEntry.kmSinceLast, 0) : "--"} km
                  </p>
                </div>
                <div className="flex flex-col gap-2 py-3 sm:py-0 sm:px-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    Consumo (km/L)
                  </p>
                  <p className="text-xl font-semibold text-foreground leading-tight sm:text-2xl">
                    {derived.consumption > 0
                      ? formatNumber(derived.consumption)
                      : "--"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Média histórica:{" "}
                    {stats.averageConsumption > 0
                      ? formatNumber(stats.averageConsumption)
                      : "--"}{" "}
                    km/L
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-3 sm:pt-0 sm:px-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    Custo por km
                  </p>
                  <p className="text-xl font-semibold text-foreground leading-tight sm:text-2xl">
                    {derived.costPerKm > 0
                      ? formatCurrency(derived.costPerKm)
                      : "--"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Média histórica:{" "}
                    {stats.averageCostPerKm > 0
                      ? formatCurrency(stats.averageCostPerKm)
                      : "--"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              {showVoiceControls ? (
                <Button
                  type="button"
                  variant={listening ? "destructive" : "secondary"}
                  size="sm"
                  className={`flex w-full items-center justify-center gap-2 border border-white/20 sm:w-auto ${
                    listening
                      ? "bg-destructive hover:bg-destructive/90 text-white"
                      : "bg-white/15 hover:bg-white/25 text-white"
                  }`}
                  onClick={() => {
                    if (listening) {
                      stopSpeech();
                    } else {
                      startSpeech();
                    }
                  }}
                >
                  {listening ? <MicOff size={16} /> : <Mic size={16} />}
                  {listening ? "Parar captura" : "Falar"}
                </Button>
              ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground sm:w-auto whitespace-nowrap">
                  <Mic size={16} className="text-muted-foreground" />
                  <span>Em breve</span>
                </div>
              )}
              <Button
                onClick={handleSaveFuel}
                size="lg"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 text-base font-semibold hover:shadow-glow sm:flex-1"
                disabled={isSavingFuel}
              >
                {isSavingFuel ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span>Salvar abastecimento</span>
                  </>
                )}
              </Button>
            </div>
            {showVoiceControls && lastHeard && (
              <p className="text-[11px] text-muted-foreground text-right">
                Último comando: "{lastHeard}"
              </p>
            )}
          </div>
        </Card>

        <Card
          ref={kmCardAnchorRef}
          className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-background/92 via-background/75 to-background/90 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(16,185,129,0.55)] glass-card animate-fade-in"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(34,197,94,0.22),transparent_58%),radial-gradient(circle_at_88%_92%,rgba(16,185,129,0.16),transparent_65%)]"
            aria-hidden
          />
          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                  Quilometragem
                </p>
                <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                  Controle de KM Rodado
                </h2>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_10px_30px_-20px_rgba(16,185,129,0.8)]">
                <Fuel size={20} />
              </span>
            </div>

            <div className="grid gap-1.5">
              <Label
                htmlFor="kmUpdate"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                KM atual
                <span className="ml-2 text-[11px] font-normal text-muted-foreground/80">
                  Último registro:{" "}
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

            <div ref={kmSummaryAnchorRef} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-emerald-200/80">
                    <Gauge size={16} />
                    <span>Resumo do último abastecimento</span>
                  </div>
                <div className="mt-3 space-y-1.5 text-sm">
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

              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-emerald-200/80">
                  <CircleDollarSign size={16} />
                  <span>Projeção atual</span>
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
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

              <div className="rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-500/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumo do dia
                </p>
                {entries.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground/80">
                    Nenhum abastecimento registrado ainda.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground/90">
                    <li>• Litros: {formatNumber(entries[0].liters)}</li>
                    <li>• KM: {formatNumber(entries[0].kmCurrent, 0)} km</li>
                    <li>• Gasto: {formatCurrency(entries[0].totalCost)}</li>
                  </ul>
                )}
              </div>
            </div>

            <Button
              ref={kmUpdateAnchorRef}
              onClick={handleUpdateKm}
              variant="secondary"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 py-3 text-base font-semibold text-primary hover:bg-primary/15"
              disabled={setVehicleKmMutation.isPending}
            >
              {setVehicleKmMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  <span>Atualizar KM</span>
                </>
              )}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

const RegistrarPage = () => {
  return (
    <FuelTutorialProvider>
      <Registrar />
    </FuelTutorialProvider>
  );
};

export default RegistrarPage;
