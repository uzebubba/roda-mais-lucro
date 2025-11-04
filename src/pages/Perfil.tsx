import {
  ArrowLeft,
  Download,
  MessageCircle,
  Save,
  Megaphone,
  Loader2,
  Sparkles,
  CarFront,
  Gift,
  CalendarClock,
  BadgeCheck,
  ChevronDown,
  Check,
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
  const [subscriptionAction, setSubscriptionAction] = useState<"portal" | null>(null);
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

  const handleSubscriptionPortal = async () => {
    setSubscriptionAction("portal");
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

  const handleGoToPlans = () => {
    navigate("/assinatura");
  };

  const handleWhatsApp = () => {
    const supportUrl = "https://wa.me/message/QURUXGZK3FPPE1";
    window.open(supportUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = () => {
    alert("Funcionalidade de exportar dados será implementada em breve!");
  };

  const handleProductNews = () => {
    setIsProductNewsOpen(true);
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
        <Card className="p-6 glass-card animate-fade-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4 sm:flex-1">
              <Avatar className="h-16 w-16 border border-primary/30 shadow-[0_0_25px_-12px_rgba(34,197,94,0.7)]">
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
                <h2 className="text-xl font-bold text-foreground">
                  {fullName || "Motorista Bubba"}
                </h2>
                <p className="text-sm text-muted-foreground">{displayedEmail}</p>
              </div>
            </div>
            {!isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartEditing}
                className="h-8 self-start text-sm font-medium text-primary hover:text-primary/80 sm:self-auto"
              >
                Editar dados
              </Button>
            )}
          </div>
          {isEditing && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Seu nome</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Digite como quer ser chamado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar dados
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>

        {/* Subscription overview */}
        <div className="space-y-4 animate-fade-in">
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
                      disabled={subscriptionAction === "portal"}
                      variant={isTrialWindow ? "destructive" : "outline"}
                      className="w-full sm:w-48"
                    >
                      {subscriptionAction === "portal"
                        ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Abrindo portal...
                          </>
                        )
                        : isTrialWindow
                        ? "Cancelar teste agora"
                        : "Gerenciar assinatura"}
                    </Button>
                    <Button
                      onClick={() => void checkSubscription()}
                      variant="ghost"
                      size="sm"
                      className="text-emerald-200 hover:text-emerald-100"
                      disabled={subscriptionStatusLoading}
                    >
                      {subscriptionStatusLoading ? "Atualizando..." : "Atualizar status"}
                    </Button>
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

          <div className="space-y-3">
            <Collapsible
              open={expandedPlan === "monthly"}
              onOpenChange={(open) =>
                setExpandedPlan((current) => (open ? "monthly" : current === "monthly" ? null : current))
              }
            >
              <Card
                className={`border border-border/60 p-4 transition-all ${
                  isMonthlyActive ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10" : "bg-card"
                }`}
              >
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
                <CollapsibleContent className="pt-4 space-y-4 text-sm text-muted-foreground">
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
                  <div className="flex flex-col gap-2 sm:flex-row">
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
              </Card>
            </Collapsible>

            <Collapsible
              open={expandedPlan === "annual"}
              onOpenChange={(open) =>
                setExpandedPlan((current) => (open ? "annual" : current === "annual" ? null : current))
              }
            >
              <Card
                className={`border border-border/60 p-4 transition-all ${
                  isAnnualActive ? "border-primary/60 bg-primary/5 shadow-lg shadow-primary/10" : "bg-card"
                }`}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Plano Anual
                        </span>
                        {isAnnualActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <BadgeCheck className="h-3 w-3" />
                            Ativo
                          </span>
                        )}
                        {!isAnnualActive && (
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
                <CollapsibleContent className="pt-4 space-y-4 text-sm text-muted-foreground">
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
                  <div className="flex flex-col gap-2 sm:flex-row">
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
              </Card>
            </Collapsible>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 animate-fade-in">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleWhatsApp}
          >
            <span className="flex items-center gap-3">
              <MessageCircle size={18} />
              Suporte via WhatsApp
            </span>
            <span className="text-xs text-muted-foreground">Em horário comercial</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleExport}
          >
            <span className="flex items-center gap-3">
              <Download size={18} />
              Exportar dados
            </span>
            <span className="text-xs text-muted-foreground">CSV / Excel</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-between group"
            onClick={handleProductNews}
          >
            <span className="flex items-center gap-3">
              <Megaphone size={18} />
              <span className="flex flex-col items-start">
                <span>Novidades do produto</span>
                <span className="text-xs text-muted-foreground transition-colors group-hover:text-primary">
                  Clique aqui e saiba o que vem aí
                </span>
              </span>
            </span>
            <span className="text-xs text-muted-foreground">✨</span>
          </Button>
        </div>
      </main>

      <Dialog open={isProductNewsOpen} onOpenChange={setIsProductNewsOpen}>
        <DialogContent className="sm:max-w-[420px] border border-border/60 bg-gradient-to-b from-background via-background/95 to-background/90">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles size={22} />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold leading-tight">
                  Novidades da Bubba
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Construído com quem vive o asfalto todos os dias.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p className="flex items-center gap-2 text-foreground font-medium">
              <span role="img" aria-hidden>🚀</span>
              Novidades da Bubba
            </p>
            <p>
              A Bubba nasceu para ser o copiloto financeiro de quem move as cidades. A gente entende cada corrida,
              cada hora no trânsito e valoriza seu tempo e lucro.
            </p>
            <p>
              Por isso estamos construindo a ferramenta mais prática e inteligente de controle financeiro, feita para a
              rotina real dos motoristas — não para planilhas frias.
            </p>
            <p>
              Estamos finalizando a sincronização automática de ganhos para você abandonar anotações manuais e focar em
              rodar com mais lucro e tranquilidade.
            </p>
            <p className="font-medium text-primary">
              💚 O seu apoio é o combustível que move a Bubba: ao testar, dar feedback e compartilhar a Bubba,
              você ajuda a construir um app de motorista pra motorista.
            </p>
            <p className="font-medium text-foreground">
              Obrigado por rodar com a Bubba. Conte com a gente!
            </p>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={() => setIsProductNewsOpen(false)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
