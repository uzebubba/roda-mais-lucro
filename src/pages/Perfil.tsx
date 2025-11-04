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
  Clock,
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
import { Progress } from "@/components/ui/progress";

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
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10 animate-fade-in">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="h-9 w-9 rounded-full"
          >
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-lg font-bold text-foreground">
            Perfil
          </h1>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSignOut}
            className="h-9 px-3 text-xs"
          >
            Sair
          </Button>
        </div>
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
        <div className="space-y-3 animate-fade-in">
          <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.15),transparent_70%)]" />
            <div className="relative space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Período de teste
                  </p>
                  <h3 className="mt-0.5 text-base font-bold text-foreground">
                    {subscribed
                      ? isTrialWindow
                        ? "Teste ativo"
                        : "Assinatura ativa"
                      : "7 dias grátis"}
                  </h3>
                </div>
                <Button
                  onClick={() => void checkSubscription()}
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={subscriptionStatusLoading}
                >
                  {subscriptionStatusLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Atualizar"
                  )}
                </Button>
              </div>

              {isTrialWindow && trialDaysLeft !== null && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dias restantes</span>
                    <span className="font-semibold text-foreground">{trialDaysLeft} de 7 dias</span>
                  </div>
                  <Progress value={(trialDaysLeft / 7) * 100} className="h-2" />
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                {!subscribed
                  ? "Explore todos os recursos sem compromisso. Cancele online a qualquer momento."
                  : isTrialWindow
                  ? "Aproveite o período de teste. Cancele antes do fim para não ser cobrado."
                  : nextBillingDate
                  ? `Próxima cobrança: ${nextBillingDate}`
                  : "Gerencie sua assinatura quando desejar."}
              </p>

              <div className="flex flex-col gap-2">
                {subscribed ? (
                  <Button
                    onClick={handleSubscriptionPortal}
                    disabled={subscriptionAction === "portal"}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {subscriptionAction === "portal" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Abrindo...
                      </>
                    ) : (
                      "Gerenciar assinatura"
                    )}
                  </Button>
                ) : (
                  <Button onClick={handleGoToPlans} className="w-full" size="sm">
                    Iniciar teste gratuito
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {!isAnnualActive && (
              <Card className={`relative overflow-hidden border transition-all ${
                isMonthlyActive 
                  ? "border-primary/40 bg-primary/5" 
                  : "border-border/40 hover:border-primary/30"
              }`}>
                {isMonthlyActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-glow" />
                )}
                <Collapsible
                  open={expandedPlan === "monthly"}
                  onOpenChange={(open) =>
                    setExpandedPlan((current) => (open ? "monthly" : current === "monthly" ? null : current))
                  }
                >
                  <div className="p-4">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-start justify-between gap-3 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Plano Mensal
                            </span>
                            {isMonthlyActive && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                <BadgeCheck className="h-3 w-3" />
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-xl font-bold text-foreground mb-1">R$ 29,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                          <p className="text-xs text-muted-foreground">
                            Controle mês a mês com suporte prioritário
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                            expandedPlan === "monthly" ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 pt-4 border-t border-border/40">
                      <ul className="space-y-2 mb-4">
                        {[
                          "Registro ilimitado de corridas e despesas",
                          "Metas em tempo real",
                          "Sincronização na nuvem",
                        ].map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={isMonthlyActive ? handleSubscriptionPortal : handleGoToPlans}
                        className="w-full"
                        variant={isMonthlyActive ? "outline" : "default"}
                        size="sm"
                      >
                        {isMonthlyActive ? "Gerenciar plano" : "Assinar mensal"}
                      </Button>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </Card>
            )}

            <Card className={`relative overflow-hidden border transition-all ${
              isAnnualActive 
                ? "border-primary/40 bg-primary/5" 
                : "border-primary/30 hover:border-primary/40"
            }`}>
              {isAnnualActive ? (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-glow" />
              ) : (
                <div className="absolute top-2 right-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  -44%
                </div>
              )}
              <Collapsible
                open={expandedPlan === "annual"}
                onOpenChange={(open) =>
                  setExpandedPlan((current) => (open ? "annual" : current === "annual" ? null : current))
                }
              >
                <div className="p-4">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Plano Anual
                          </span>
                          {isAnnualActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <BadgeCheck className="h-3 w-3" />
                              Ativo
                            </span>
                          )}
                        </div>
                        <p className="text-xl font-bold text-foreground mb-1">
                          R$ 199,90<span className="text-sm font-normal text-muted-foreground">/ano</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          R$ 16,50/mês · Economia de 44%
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${
                          expandedPlan === "annual" ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 pt-4 border-t border-border/40">
                    <ul className="space-y-2 mb-4">
                      {[
                        "Todos os recursos do mensal",
                        "12 meses pelo preço de 6,7 meses",
                        "Prioridade máxima em suporte",
                      ].map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={isAnnualActive ? handleSubscriptionPortal : handleGoToPlans}
                      className="w-full"
                      variant={isAnnualActive ? "outline" : "default"}
                      size="sm"
                    >
                      {isAnnualActive ? "Gerenciar plano" : "Assinar anual"}
                    </Button>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </Card>
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
