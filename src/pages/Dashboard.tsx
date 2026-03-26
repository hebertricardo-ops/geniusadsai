import { Button } from "@/components/ui/button";
import CreditsBadge from "@/components/CreditsBadge";
import { useNavigate } from "react-router-dom";
import { Zap, Plus, Image, Clock, Sparkles, ArrowRight } from "lucide-react";

const mockHistory = [
  { id: 1, productName: "Sérum Vitamina C", createdAt: "2024-03-15", creditsUsed: 3, status: "completed" },
  { id: 2, productName: "Whey Protein Gold", createdAt: "2024-03-14", creditsUsed: 2, status: "completed" },
  { id: 3, productName: "Tênis Runner Pro", createdAt: "2024-03-12", creditsUsed: 5, status: "completed" },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">CreativeAI</span>
        </div>
        <div className="flex items-center gap-4">
          <CreditsBadge credits={10} />
          <Button variant="ghost" size="sm">
            Sair
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
            Gere criativos que <span className="text-gradient">convertem</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Crie anúncios estáticos profissionais com IA em segundos. 
            Copy persuasiva + composição visual automática.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate("/create")}>
            <Plus className="w-5 h-5" />
            Novo Criativo
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Sparkles, label: "Créditos disponíveis", value: "10", color: "text-primary" },
            { icon: Image, label: "Criativos gerados", value: "24", color: "text-foreground" },
            { icon: Clock, label: "Expira em", value: "7 dias", color: "text-muted-foreground" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="gradient-card rounded-xl p-5 border border-border shadow-card animate-fade-in"
            >
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className={`text-2xl font-display font-bold ${color}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* History */}
        <div className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-display font-bold text-foreground">Histórico recente</h2>
            <p className="text-sm text-muted-foreground">
              Seus criativos ficam disponíveis por 7 dias
            </p>
          </div>
          <div className="divide-y divide-border">
            {mockHistory.map((item) => (
              <div
                key={item.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Image className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">{item.createdAt}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {item.creditsUsed} créditos
                  </span>
                  <Button variant="outline" size="sm">
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
