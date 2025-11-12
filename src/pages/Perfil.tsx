import {
  ArrowLeft,
  MessageCircle,
  Save,
  Megaphone,
  Loader2,
  CarFront,
  Gift,
  CalendarClock,
  BadgeCheck,
  ChevronDown,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getUserProfile, updateUserProfile } from "@/lib/supabase-storage";
import { useAuth } from "@/contexts/AuthContext";
import { SUBSCRIPTION_TIERS, useSubscription } from "@/contexts/SubscriptionContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

const Perfil = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const {
    subscribed,
    price_id: activePriceId,
    subscription_end,
    loading: subscriptionStatusLoading,
    checkSubscription,
  } = useSubscription();
  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
    enabled: Boolean(user?.id),
    retry: false,
  });

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isProductNewsOpen, setIsProductNewsOpen] = useState(false);
  const [subscriptionAction, setSubscriptionAction] = useState<"portal" | "cancel-trial" | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<"monthly" | "annual" | null>(null);

  const profile = profileQuery.data;

  const nextBillingDate = useMemo(() => {
    if (!subscription_end) {
      return null;
    }
    const parsed = new Date(subscription_end);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(parsed);
  }, [subscription_end]);

  const trialDaysLeft = useMemo(() => {
    if (!subscription_end) {
      return null;
    }
    const diff = new Date(subscription_end).getTime() - Date.now();
    if (!Number.isFinite(diff)) {
      return null;
    }
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [subscription_end]);

  const isTrialWindow =
    subscribed && typeof trialDaysLeft === "number" && trialDaysLeft > 0 && trialDaysLeft <= 7;

  const trialCountdown = trialDaysLeft ?? 0;

  const isMonthlyActive = subscribed && activePriceId === SUBSCRIPTION_TIERS.MENSAL.price_id;
  const isAnnualActive = subscribed && activePriceId === SUBSCRIPTION_TIERS.ANUAL.price_id;

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || metadataName || "");
      setEmail(profile.email ?? user?.email ?? "");
      setIsEditing(profile.fullName === "João Motorista");
    }
  }, [profile, metadataName, user?.email]);

  useEffect(() => {
    if (profileQuery.error) {
      const error = profileQuery.error;
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados do perfil.";
      toast.error(message);
    }
  }, [profileQuery.error]);

  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
  });

  useEffect(() => {
    if (!profile || updateProfileMutation.isPending) {
      return;
    }
    const shouldSyncName =
      Boolean(metadataName) && profile.fullName === "João Motorista";
    const shouldSyncEmail =
      Boolean(user?.email) && profile.email === "joao@email.com";

    if (!shouldSyncName && !shouldSyncEmail) {
      return;
    }

    const run = async () => {
      try {
        const updated = await updateProfileMutation.mutateAsync({
          fullName: shouldSyncName ? metadataName : profile.fullName,
          email: shouldSyncEmail ? user?.email ?? profile.email : profile.email,
        });
        queryClient.setQueryData(["userProfile"], updated);
        setFullName(updated.fullName);
        setEmail(updated.email);
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to sync user profile", error);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadataName, profile, user?.email]);

  const displayedEmail = useMemo(() => {
    return email || user?.email || profile?.email || "";
  }, [email, user?.email, profile?.email]);

  const avatarInitials = useMemo(() => {
    if (profile?.avatarInitials && profile.avatarInitials.length > 0) {
      return profile.avatarInitials;
    }
    if (fullName.trim().length > 0) {
      return fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
    }
    return "JM";
  }, [profile?.avatarInitials, fullName]);

  const openSubscriptionPortal = async (action: "portal" | "cancel-trial") => {
    setSubscriptionAction(action);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Você precisa estar logado para gerenciar a assinatura.");
        return;
      }

      const { data, error } = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        toast.success("Abrimos o portal da assinatura em uma nova aba.");
      } else {
        toast.error("Não foi possível abrir o portal da assinatura.");
      }
    } catch (error) {
      console.error("Failed to open customer portal", error);
      toast.error("Não foi possível acessar o portal de assinatura.");
    } finally {
      setSubscriptionAction(null);
    }
  };

  const handleSubscriptionPortal = () => {
    void openSubscriptionPortal("portal");
  };

  const handleCancelTrial = () => {
    void openSubscriptionPortal("cancel-trial");
  };

  const handleGoToPlans = () => {
    navigate("/assinatura");
  };

  const handleWhatsApp = () => {
    const supportUrl = "https://wa.me/message/QURUXGZK3FPPE1";
    window.open(supportUrl, "_blank", "noopener,noreferrer");
  };

  const handleProductNews = () => {
    setIsProductNewsOpen(true);
  };

  const handleShareNews = async () => {
    const shareText =
      "A Bubba está lançando a sincronização automática de ganhos e várias novidades feitas para motoristas. Bora testar?";
    const shareUrl =
      typeof window !== "undefined" ? window.location.origin : "https://bubbapp.com";

    if (typeof navigator === "undefined") {
      toast.info(`Copie e compartilhe: ${shareUrl}`);
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Novidades da Bubba",
          text: shareText,
          url: shareUrl,
        });
        toast.success("Valeu por compartilhar a Bubba!");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        toast.success("Texto copiado! É só colar e enviar.");
        return;
      }

      toast.info(`Copie e compartilhe: ${shareUrl}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Não conseguimos compartilhar agora. Tente novamente.");
    }
  };

  const handleSaveProfile = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error("Informe seu nome para personalizar a experiência.");
      return;
    }

    try {
      const updated = await updateProfileMutation.mutateAsync({
        fullName: trimmedName,
        email: email.trim(),
      });
      queryClient.setQueryData(["userProfile"], updated);
      setFullName(updated.fullName);
      setEmail(updated.email);
      toast.success("Perfil atualizado com sucesso!");
      setIsEditing(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o perfil.";
      toast.error(message);
    }
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Você saiu da sua conta.");
      navigate("/login", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar a sessão.";
      toast.error(message);
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="glass-card border-b border-border/50 px-4 py-4 flex items-center justify-between gap-3 animate-fade-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="rounded-full"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="flex-1 text-center text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
          Perfil
        </h1>
        <Button variant="outline" size="sm" onClick={handleSignOut}>
          Sair
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4 animate-fade-in">
        {/* User Info */}
        <Card className="relative overflow-hidden rounded-3xl border border-emerald-400/25 bg-gradient-to-b from-background/92 via-background/80 to-background/95 p-4 sm:p-5 shadow-[0_24px_68px_-38px_rgba(16,185,129,0.55)] glass-card animate-fade-in">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(34,197,94,0.22),transparent_60%),radial-gradient(circle_at_88%_90%,rgba(16,185,129,0.16),transparent_65%)]"
            aria-hidden
          />
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 sm:flex-1">
                <Avatar className="h-16 w-16 border border-primary/40 shadow-[0_0_30px_-18px_rgba(34,197,94,0.75)]">
                  <AvatarFallback className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary/80 to-primary-glow text-xl text-primary-foreground">
                    <span className="absolute inset-0 rounded-full opacity-20 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.7),transparent_65%)]" />
                    <span className="relative font-semibold tracking-wide uppercase">
                      {avatarInitials}
                    </span>
                    <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/95 shadow-lg">
                      <CarFront size={16} className="text-primary" />
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground/80">
                    Perfil
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-foreground">
                    {fullName || "Motorista Bubba"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{displayedEmail}</p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleStartEditing}
                  className="gap-2 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                >
                  Editar dados
                </Button>
              )}
            </div>

            {!isEditing && isTrialWindow && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-amber-200">
                  Em teste ({trialCountdown} dia{trialCountdown === 1 ? "" : "s"})
                </span>
              </div>
            )}

            {isEditing && (
              <div className="space-y-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="fullName"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Seu nome
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Digite como quer ser chamado"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="email"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>
                <Button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-glow py-3 text-base font-semibold hover:shadow-glow"
                  onClick={handleSaveProfile}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar dados
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Ações rápidas */}
        <div className="animate-fade-in overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 via-background/95 to-background/85 shadow-[0_26px_60px_-36px_rgba(16,185,129,0.65)] backdrop-blur-sm">
          <div className="divide-y divide-emerald-400/15">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex w-full items-center justify-between gap-4 p-5 text-left transition-all hover:bg-emerald-500/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:p-6"
            >
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">Suporte via WhatsApp</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Fale com nosso time em horário comercial.
                  </span>
                </span>
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">Abrir</span>
            </button>
            <button
              type="button"
              onClick={handleProductNews}
              className="group flex w-full items-center justify-between gap-4 p-5 text-left transition-all hover:bg-emerald-500/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:p-6"
            >
              <span className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200 transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                  <Megaphone className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">Novidades do produto</span>
                  <span className="mt-1 block text-xs text-muted-foreground transition-colors group-hover:text-primary">
                    Clique aqui e saiba o que vem aí
                  </span>
                </span>
              </span>
              <span className="text-xs font-medium text-emerald-200/80 transition-colors group-hover:text-primary">
                ✨
              </span>
            </button>
          </div>
        </div>

        {/* Assinatura e planos */}
        <div className="space-y-4 animate-fade-in">
          <div className="overflow-hidden rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 via-background/95 to-background/85 shadow-[0_26px_60px_-36px_rgba(16,185,129,0.65)] backdrop-blur-sm">
            <div className="divide-y divide-emerald-400/15">
              {!isAnnualActive && (
                <Collapsible
                  open={expandedPlan === "monthly"}
                  onOpenChange={(open) =>
                    setExpandedPlan((current) => (open ? "monthly" : current === "monthly" ? null : current))
                  }
                >
                  <div
                    className={`relative p-5 transition-all sm:p-6 ${
                      expandedPlan === "monthly" || isMonthlyActive
                        ? "bg-emerald-500/12 shadow-[inset_0_1px_0_rgba(16,185,129,0.4)]"
                        : "hover:bg-emerald-500/8"
                    }`}
                  >
                    {isMonthlyActive && (
                      <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary/80" aria-hidden />
                    )}
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                              Plano Mensal
                            </span>
                            {isMonthlyActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                <BadgeCheck className="h-3 w-3" />
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-lg font-semibold text-foreground">R$ 29,90/mês</p>
                          <p className="text-xs text-muted-foreground">
                            Controle seu negócio mês a mês com suporte prioritário.
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform ${
                            expandedPlan === "monthly" ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-5 border-t border-emerald-400/20 pt-4 text-sm text-muted-foreground">
                      <ul className="space-y-2">
                        {[
                          "Registro ilimitado de corridas e despesas",
                          "Metas diárias e mensais em tempo real",
                          "Sincronização na nuvem e suporte prioritário",
                        ].map((feature) => (
                          <li key={feature} className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          onClick={isMonthlyActive ? handleSubscriptionPortal : handleGoToPlans}
                          className="sm:flex-1"
                          variant={isMonthlyActive ? "outline" : "default"}
                        >
                          {isMonthlyActive ? "Gerenciar plano mensal" : "Assinar plano mensal"}
                        </Button>
                        {!isMonthlyActive && (
                          <Button
                            onClick={handleGoToPlans}
                            variant="ghost"
                            className="sm:w-auto"
                            size="sm"
                          >
                            Ver benefícios completos
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              <Collapsible
                open={expandedPlan === "annual"}
                onOpenChange={(open) =>
                  setExpandedPlan((current) => (open ? "annual" : current === "annual" ? null : current))
                }
              >
                <div
                  className={`relative p-5 transition-all sm:p-6 ${
                    expandedPlan === "annual" || isAnnualActive
                      ? "bg-emerald-500/12 shadow-[inset_0_1px_0_rgba(16,185,129,0.4)]"
                      : "hover:bg-emerald-500/8"
                  }`}
                >
                  {isAnnualActive && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary/80" aria-hidden />
                  )}
                  {!isAnnualActive && (
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-emerald-400/60" aria-hidden />
                  )}
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Plano Anual
                          </span>
                          {isAnnualActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              <BadgeCheck className="h-3 w-3" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                              Economia 44%
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-lg font-semibold text-foreground">R$ 199,90/ano</p>
                        <p className="text-xs text-muted-foreground">
                          Equivalente a R$ 16,50 por mês com economia de 44%.
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          expandedPlan === "annual" ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-5 border-t border-emerald-400/20 pt-4 text-sm text-muted-foreground">
                    <ul className="space-y-2">
                      {[
                        "Todos os recursos do plano mensal inclusos",
                        "12 meses pelo valor de 6,7 meses",
                        "Prioridade máxima em novidades e suporte",
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={isAnnualActive ? handleSubscriptionPortal : handleGoToPlans}
                        className="sm:flex-1"
                        variant={isAnnualActive ? "outline" : "default"}
                      >
                        {isAnnualActive ? "Gerenciar plano anual" : "Assinar plano anual"}
                      </Button>
                      {!isAnnualActive && (
                        <Button
                          onClick={handleGoToPlans}
                          variant="ghost"
                          className="sm:w-auto"
                          size="sm"
                        >
                          Comparar com outros planos
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
          </div>

          <Card className="relative overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-emerald-500/12 via-emerald-600/10 to-emerald-700/5 p-5 shadow-[0_18px_50px_-28px_rgba(16,185,129,0.65)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(34,197,94,0.3),transparent_60%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,0.24),transparent_55%)]" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 backdrop-blur">
                  <Gift className="h-7 w-7 text-emerald-100" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200/80">
                    Período de teste
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-emerald-50 sm:text-xl">
                    {subscribed
                      ? isTrialWindow
                        ? "Teste premium ativo"
                        : "Assinatura Bubba ativa"
                      : "Ative seu teste premium de 7 dias"}
                  </h3>
                  <p className="mt-2 text-sm text-emerald-100/90 sm:max-w-md">
                    {!subscribed
                      ? "Explore todos os recursos da Bubba sem compromisso. Você pode cancelar online antes dos 7 dias e não será cobrado."
                      : isTrialWindow
                      ? `Faltam ${trialDaysLeft ?? 0} dia${trialDaysLeft === 1 ? "" : "s"} para o fim do teste gratuito. Se não quiser continuar, cancele com um clique.`
                      : nextBillingDate
                      ? `Sua assinatura está ativa. A próxima cobrança está prevista para ${nextBillingDate}. Você pode gerenciar ou cancelar quando quiser.`
                      : "Sua assinatura está ativa e pode ser gerenciada online quando desejar."}
                  </p>
                  {nextBillingDate && subscribed && (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200/90">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {isTrialWindow ? "Teste termina em" : "Próxima cobrança"}:{" "}
                      <span className="font-semibold">{nextBillingDate}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                {subscribed ? (
                  <>
                    <Button
                      onClick={handleSubscriptionPortal}
                      disabled={subscriptionAction !== null}
                      variant="outline"
                      className="w-full sm:w-48"
                    >
                      {subscriptionAction !== null
                        ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Abrindo portal...
                          </>
                        )
                        : "Gerenciar assinatura"}
                    </Button>
                    {isTrialWindow ? (
                      <Button
                        onClick={handleCancelTrial}
                        variant="destructive"
                        size="sm"
                        className="w-full sm:w-48"
                        disabled={subscriptionAction !== null}
                      >
                        {subscriptionAction === "cancel-trial"
                          ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cancelando...
                            </>
                          )
                          : subscriptionAction === "portal"
                          ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Abrindo portal...
                            </>
                          )
                          : (
                            <>
                              <X className="mr-2 h-4 w-4" />
                              Cancelar teste agora
                            </>
                          )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => void checkSubscription()}
                        variant="ghost"
                        size="sm"
                        className="text-emerald-200 hover:text-emerald-100"
                        disabled={subscriptionStatusLoading}
                      >
                        {subscriptionStatusLoading ? "Atualizando..." : "Atualizar status"}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button onClick={handleGoToPlans} className="w-full sm:w-48">
                      Iniciar teste gratuito
                    </Button>
                    <Button
                      onClick={handleGoToPlans}
                      variant="ghost"
                      size="sm"
                      className="text-emerald-200 hover:text-emerald-100"
                    >
                      Ver planos completos
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2 text-xs text-emerald-200/80">
              <BadgeCheck className="h-4 w-4" />
              Cancelamento online imediato durante o período de teste.
            </div>
          </Card>
        </div>
      </main>

      <Dialog open={isProductNewsOpen} onOpenChange={setIsProductNewsOpen}>
        <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto border border-emerald-500/30 bg-[#021022] text-emerald-50 shadow-[0_45px_120px_-65px_rgba(16,185,129,0.9)]">
          <div className="space-y-6 px-1 sm:px-0">
            <DialogHeader className="space-y-3 text-left">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <span role="img" aria-hidden>
                  🚀
                </span>
                Novidades da Bubba
              </p>
              <div className="space-y-2">
                <DialogTitle className="text-2xl font-semibold leading-tight text-emerald-50">
                  A Bubba é o seu copiloto financeiro.
                </DialogTitle>
                <DialogDescription className="text-base leading-relaxed text-emerald-100/80">
                  A gente entende cada corrida, cada minuto no trânsito e valoriza o seu tempo e o seu lucro.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-3 text-sm leading-relaxed text-emerald-50/90">
              <p className="font-semibold text-emerald-100 uppercase tracking-wider text-xs">
                Feita pra quem dirige de verdade
              </p>
              <p>
                Estamos criando a ferramenta mais prática e inteligente de controle financeiro. Feita para o dia a dia real
                dos motoristas, nada de planilhas frias ou complicadas.
              </p>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 px-4 py-5 text-white shadow-xl">
              <div className="space-y-1 text-left sm:text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">
                  Em breve
                </p>
                <p className="text-base font-semibold uppercase tracking-wide leading-tight text-white sm:px-2">
                  Sincronização automática de ganhos
                </p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/90 text-left sm:text-center sm:max-w-sm sm:mx-auto">
                Chega de anotar tudo à mão. Nova sincronização para você focar em rodar com mais lucro e tranquilidade.
              </p>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-emerald-50/90">
              <p className="flex items-center gap-2 font-semibold text-emerald-300">
                <span role="img" aria-hidden>
                  💚
                </span>
                O seu apoio é o combustível da Bubba
              </p>
              <p>
                Ao testar, dar feedback e compartilhar o app, você ajuda a construir uma ferramenta de motorista pra motorista.
              </p>
              <p className="font-medium text-emerald-50">
                Obrigado por rodar com a Bubba. Conte com a gente na pista!
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Button
              className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={handleShareNews}
            >
              Compartilhar
            </Button>
            <Button
              variant="ghost"
              className="w-full border border-emerald-500/30 bg-transparent text-emerald-200 hover:bg-emerald-500/10"
              onClick={() => setIsProductNewsOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
