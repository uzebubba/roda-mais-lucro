import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogIn, ArrowRight, Mail, Lock, ShieldCheck, TrendingUp, Target } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;

    // TODO: Substituir pela integração real com Supabase/Auth provider
    setTimeout(() => {
      setLoading(false);
      toast.success("Bem-vindo de volta!", {
        description: `Login simulado para ${email}`,
      });
      navigate("/");
    }, 900);
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
                  <LogIn size={22} />
                </div>
                <CardTitle className="text-2xl font-semibold text-foreground">Acesse sua conta</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Entre para sincronizar seus dados, acompanhar metas e receber alertas inteligentes.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Button type="button" variant="outline" className="w-full gap-2 text-sm font-medium">
                  <span className="text-lg" role="img" aria-hidden>🌐</span>
                  Continuar com Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="flex-1" />
                  <span>ou use seu e-mail</span>
                  <Separator className="flex-1" />
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
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
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                      <Link to="#" className="text-xs font-medium text-primary hover:underline">
                        Esqueci minha senha
                      </Link>
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
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      <Checkbox id="remember" name="remember" />
                      <span>Lembrar de mim</span>
                    </label>
                    <span className="text-xs text-muted-foreground">Suporte 24/7 via WhatsApp</span>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full gap-2 text-base font-semibold">
                    Entrar agora
                    <ArrowRight size={18} className={loading ? "animate-pulse" : ""} />
                  </Button>
                </form>
                <p className="text-center text-sm text-muted-foreground">
                  Ainda não tem acesso? {" "}
                  <Link to="#" className="font-semibold text-primary hover:underline">
                    Fale com nossa equipe
                  </Link>
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
