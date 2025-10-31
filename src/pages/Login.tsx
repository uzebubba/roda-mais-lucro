import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, ArrowRight, Mail, Lock, ShieldCheck, TrendingUp, Target, User } from "lucide-react";
import FullPageLoader from "@/components/FullPageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const bullets = [
  {
    icon: <TrendingUp size={18} className="text-primary" />,
    title: "Lucro real em tempo real",
    description: "Conecte corridas e saiba quanto realmente entrou, já descontando custos." ,
  },
  {
    icon: <Target size={18} className="text-primary" />,
    title: "Metas que fazem sentido",
    description: "Receba alertas quando estiver perto de bater sua meta diária ou mensal." ,
  },
  {
    icon: <ShieldCheck size={18} className="text-primary" />,
    title: "Seus dados seguros",
    description: "Sincronização em nuvem com exportações a qualquer momento." ,
  },
];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const redirectPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | undefined;
    return state?.from?.pathname ?? "/";
  }, [location.state]);

  useEffect(() => {
    if (user) {
      navigate(redirectPath, { replace: true });
    }
  }, [user, navigate, redirectPath]);

  if (authLoading) {
    return <FullPageLoader />;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = (formData.get("email") as string | null)?.trim();
    const password = formData.get("password") as string | null;
    const fullName = (formData.get("fullName") as string | null)?.trim();

    if (!email || !password) {
      toast.error("Informe e-mail e senha para continuar.");
      return;
    }

    if (mode === "register" && !fullName) {
      toast.error("Informe seu nome completo para criar a conta.");
      return;
    }

    setLoading(true);
    const run = async () => {
      try {
        if (mode === "login") {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            throw error;
          }

          toast.success("Bem-vindo de volta!", {
            description: `Sessão iniciada para ${email}`,
          });
          navigate(redirectPath, { replace: true });
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: fullName ? { full_name: fullName } : undefined,
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          const { error: loginAfterSignupError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (loginAfterSignupError) {
            toast.success("Conta criada! Confirme seu e-mail para liberar o acesso.");
            return;
          }
        }

        toast.success("Conta criada com sucesso!");
        navigate(redirectPath, { replace: true });
      } catch (authError: unknown) {
        const message =
          authError instanceof Error ? authError.message : "Não foi possível processar sua solicitação.";
        toast.error("Algo deu errado!", {
          description: message,
        });
      } finally {
        setLoading(false);
      }
    };

    void run();
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-background/90 to-background text-foreground">
      <div className="relative flex min-h-screen flex-col lg:grid lg:grid-cols-[1.1fr,1fr]">
        <aside className="relative hidden overflow-hidden border-r border-border/30 bg-gradient-to-br from-primary/20 via-primary/10 to-background lg:flex">
          <div className="absolute inset-0 opacity-60" style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, hsla(142,76%,40%,0.35) 0, transparent 45%), radial-gradient(circle at 80% 0%, hsla(160,76%,40%,0.25) 0, transparent 55%)",
          }} />
          <div className="relative z-10 flex flex-col justify-between px-12 py-14">
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.35em] text-primary/80 font-semibold">Roda+ Controle</p>
              <h1 className="text-4xl font-bold leading-tight text-foreground">
                Controle total das suas corridas em um só lugar.
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
                Tenha visão clara de lucro, custos e manutenção. Pensado por quem vive o asfalto para motoristas que querem sobrar mais no fim do mês.
              </p>
            </div>
            <div className="space-y-5">
              {bullets.map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/40 px-4 py-3 backdrop-blur">
                  <div className="mt-1">{item.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground/80">
              © {new Date().getFullYear()} Roda+ Controle. O copiloto financeiro dos motoristas de aplicativo brasileiros.
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md">
            <Card className="glass-card">
              <CardHeader className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {mode === "login" ? <LogIn size={22} /> : <User size={22} />}
                </div>
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {mode === "login"
                    ? "Entre para sincronizar seus dados, acompanhar metas e receber alertas inteligentes."
                    : "Crie seu acesso em poucos segundos para manter suas corridas sempre sincronizadas."}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 text-sm font-medium"
                  onClick={() => toast.info("Integração com Google em breve.")}
                  disabled={loading}
                >
                  <span className="text-lg" role="img" aria-hidden>🌐</span>
                  Continuar com Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1" />
                  <span>ou use seu e-mail</span>
                  <Separator className="flex-1" />
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {mode === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">Nome completo</Label>
                      <div className="relative">
                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="fullName"
                          name="fullName"
                          type="text"
                          placeholder="Como devemos te chamar?"
                          autoComplete="name"
                          required={mode === "register"}
                          className="pl-9"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="voce@email.com"
                        autoComplete="email"
                        required
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                      {mode === "login" && (
                        <Link to="#" className="text-xs font-medium text-primary hover:underline">
                          Esqueci minha senha
                        </Link>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className="pl-9"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  {mode === "login" && (
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <Checkbox id="remember" name="remember" disabled />
                        <span>Lembrar de mim</span>
                      </label>
                      <span className="text-xs text-muted-foreground">Suporte 24/7 via WhatsApp</span>
                    </div>
                  )}
                  <Button type="submit" disabled={loading} className="w-full gap-2 text-base font-semibold">
                    {mode === "login" ? "Entrar agora" : "Criar conta"}
                    <ArrowRight size={18} className={loading ? "animate-pulse" : ""} />
                  </Button>
                </form>
                <p className="text-center text-sm text-muted-foreground">
                  {mode === "login" ? (
                    <>
                      Primeira vez aqui?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("register")}
                        className="font-semibold text-primary hover:underline"
                      >
                        Criar conta agora
                      </button>
                    </>
                  ) : (
                    <>
                      Já possui uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className="font-semibold text-primary hover:underline"
                      >
                        Fazer login
                      </button>
                    </>
                  )}
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  Ao continuar, você concorda com os nossos {" "}
                  <Link to="#" className="text-primary hover:underline">Termos de Uso</Link> e {" "}
                  <Link to="#" className="text-primary hover:underline">Política de Privacidade</Link>.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;
