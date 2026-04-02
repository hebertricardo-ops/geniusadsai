import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{
    isNewUser: boolean;
    tempPassword: string | null;
    email: string;
    credits: number;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");
  const packageId = searchParams.get("package");

  useEffect(() => {
    const processPayment = async () => {
      if (!sessionId || !packageId) {
        setError("Dados de pagamento incompletos.");
        setProcessing(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("handle-payment-success", {
          body: { sessionId, packageId },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setResult(data);
        toast.success(`${data.credits} créditos adicionados com sucesso!`);
      } catch (err: any) {
        console.error("Error processing payment:", err);
        setError("Erro ao processar pagamento. Entre em contato com o suporte.");
      } finally {
        setProcessing(false);
      }
    };

    processPayment();
  }, [sessionId, packageId]);

  const copyPassword = () => {
    if (result?.tempPassword) {
      navigator.clipboard.writeText(result.tempPassword);
      toast.success("Senha copiada!");
    }
  };

  const handleLogin = async () => {
    if (!result?.email || !result?.tempPassword) return;
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: result.tempPassword,
      });
      if (error) throw error;
      navigate("/change-password");
    } catch (err: any) {
      toast.error("Erro ao fazer login automático. Use suas credenciais na tela de login.");
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="gradient-card rounded-2xl p-10 border border-border shadow-card max-w-md w-full text-center">
        {processing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-display text-foreground mb-2">Processando pagamento...</h1>
            <p className="text-sm text-muted-foreground">Aguarde enquanto configuramos sua conta.</p>
          </>
        ) : error ? (
          <>
            <h1 className="text-xl font-display text-foreground mb-2">Ops!</h1>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </>
        ) : result?.isNewUser ? (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-display text-foreground mb-2">Conta criada com sucesso!</h1>
            <p className="text-muted-foreground mb-6">
              {result.credits} créditos foram adicionados à sua conta.
            </p>

            <div className="bg-secondary/50 rounded-xl p-5 mb-6 text-left border border-border">
              <p className="text-sm font-semibold text-foreground mb-3">📧 Suas credenciais de acesso:</p>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Email:</span> {result.email}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1">
                    <span className="font-medium text-foreground">Senha:</span>{" "}
                    {showPassword ? result.tempPassword : "••••••••••••"}
                  </p>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={copyPassword}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                ⚠️ Anote sua senha! Você precisará alterá-la no primeiro acesso.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="hero" onClick={handleLogin}>
                Entrar e alterar senha
              </Button>
              <Button variant="outline" onClick={() => navigate("/auth")}>
                Ir para o login
              </Button>
            </div>
          </>
        ) : (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-display text-foreground mb-2">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              {result?.credits} créditos foram adicionados à sua conta.
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="hero" onClick={() => navigate("/create")}>
                Criar criativos agora
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Ir para o Dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
