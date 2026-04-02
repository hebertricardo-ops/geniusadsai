import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const credits = parseInt(searchParams.get("credits") || "0", 10);

  useEffect(() => {
    const addCredits = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !credits) {
          setProcessing(false);
          return;
        }

        // Add credits to user balance
        const { data: currentCredits } = await supabase
          .from("user_credits")
          .select("credits_balance")
          .eq("user_id", user.id)
          .single();

        if (currentCredits) {
          await supabase
            .from("user_credits")
            .update({ credits_balance: currentCredits.credits_balance + credits })
            .eq("user_id", user.id);
        }

        // Log the transaction
        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: credits,
          type: "purchase",
          description: `Compra de ${credits} créditos via Stripe`,
        });

        toast.success(`${credits} créditos adicionados com sucesso!`);
      } catch (error) {
        console.error("Error adding credits:", error);
        toast.error("Erro ao processar créditos. Entre em contato com o suporte.");
      } finally {
        setProcessing(false);
      }
    };

    addCredits();
  }, [credits]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="gradient-card rounded-2xl p-10 border border-border shadow-card max-w-md w-full text-center">
        {processing ? (
          <>
            <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-display text-foreground mb-2">Processando pagamento...</h1>
            <p className="text-sm text-muted-foreground">Aguarde enquanto adicionamos seus créditos.</p>
          </>
        ) : (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-display text-foreground mb-2">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              {credits > 0
                ? `${credits} créditos foram adicionados à sua conta.`
                : "Seu pagamento foi processado com sucesso."}
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
