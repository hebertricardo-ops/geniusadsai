import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Image, Clock, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: credits } = useCredits();

  const { data: history = [] } = useQuery({
    queryKey: ["creative-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: totalCreatives = 0 } = useQuery({
    queryKey: ["total-creatives", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_creatives")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  return (
    <div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-display text-foreground mb-3">
            Gere criativos que <span className="text-gradient">convertem</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Crie anúncios estáticos profissionais com IA em segundos.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate("/create")}>
            <Plus className="w-5 h-5" />
            Novo Criativo
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Sparkles, label: "Créditos disponíveis", value: String(credits?.credits_balance ?? 0), color: "text-primary" },
            { icon: Image, label: "Criativos gerados", value: String(totalCreatives), color: "text-foreground" },
            { icon: Clock, label: "Expira em", value: "7 dias", color: "text-muted-foreground" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="gradient-card rounded-xl p-5 border border-border shadow-card animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className={`text-2xl font-display ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-display text-foreground">Histórico recente</h2>
            <p className="text-sm text-muted-foreground">Seus criativos ficam disponíveis por 7 dias</p>
          </div>
          <div className="divide-y divide-border">
            {history.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">
                Nenhum criativo gerado ainda. Comece criando seu primeiro!
              </div>
            ) : (
              history.map((item: any) => (
                <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(item.created_at), "dd/MM/yyyy")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{item.quantity} créditos</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${item.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {item.status === "completed" ? "Concluído" : item.status === "processing" ? "Processando" : "Pendente"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
