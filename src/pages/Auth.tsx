import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import logoFull from "@/assets/logo-full.png";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const formatWhatsApp = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signIn, signUp } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatWhatsApp(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
        } else {
          navigate("/dashboard");
        }
      } else {
        const rawWhatsapp = whatsapp.replace(/\D/g, "");
        if (rawWhatsapp.length < 10) {
          toast({ title: "WhatsApp inválido", description: "Informe DDD + número com pelo menos 10 dígitos.", variant: "destructive" });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, name, rawWhatsapp);
        if (error) {
          toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
        } else {
          // Fire-and-forget webhook to Make.com
          fetch("https://hook.us2.make.com/1ifgxwj2g4o47qa1lbo3ab51vumvoydy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, whatsapp: rawWhatsapp }),
          }).catch(() => {});

          toast({
            title: "Conta criada!",
            description: "Verifique seu email para confirmar o cadastro.",
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <img src={logoFull} alt="Genius ADS" className="h-32" />
          </div>
          <p className="text-muted-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </p>
        </div>

        <div className="gradient-card rounded-2xl p-8 shadow-card border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm text-muted-foreground">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="bg-background/50 border-border" />
              </div>
            )}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="whatsapp" className="text-sm text-muted-foreground">WhatsApp (DDD + Número)</Label>
                <Input id="whatsapp" type="tel" value={whatsapp} onChange={handleWhatsAppChange} placeholder="(11) 99999-9999" className="bg-background/50 border-border" required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-background/50 border-border" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Senha</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-background/50 border-border pr-10" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
          <div className="mt-6 text-center">
            <span className="text-muted-foreground text-sm">
              {isLogin ? "Não tem conta?" : "Já tem conta?"}{" "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
                {isLogin ? "Cadastre-se" : "Faça login"}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
