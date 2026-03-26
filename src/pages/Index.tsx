import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Zap, ArrowRight, Sparkles, Image, Shield, Clock } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-display font-bold text-foreground">CreativeAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
            Entrar
          </Button>
          <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
            Começar grátis
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary border border-border mb-6 animate-fade-in">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Powered by AI</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6 animate-fade-in">
          Criativos que{" "}
          <span className="text-gradient">vendem</span>
          <br />
          gerados em segundos
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
          Transforme imagens de produtos em anúncios estáticos profissionais com 
          copywriting avançado e composição visual automática. Feito para Meta Ads.
        </p>
        <div className="flex items-center justify-center gap-4 animate-fade-in">
          <Button variant="hero" size="lg" onClick={() => navigate("/auth")}>
            Começar agora
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/auth")}>
            Ver demo
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Image,
              title: "Composição Visual IA",
              description: "Upload suas imagens e receba criativos prontos com layout profissional e hierarquia visual."
            },
            {
              icon: Sparkles,
              title: "Copywriting Avançado",
              description: "3 ângulos de copy diferentes para cada criativo, com técnicas de alta conversão."
            },
            {
              icon: Shield,
              title: "Meta Ads Ready",
              description: "Criativos otimizados para feed e stories, prontos para subir nas suas campanhas."
            },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="gradient-card rounded-2xl p-7 border border-border shadow-card hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mb-5 group-hover:gradient-primary transition-all duration-300">
                <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-12">
          Como funciona
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { step: "1", title: "Upload", desc: "Envie até 4 imagens do produto" },
            { step: "2", title: "Descreva", desc: "Produto, promessa e benefícios" },
            { step: "3", title: "IA gera", desc: "Copy + composição visual automática" },
            { step: "4", title: "Baixe", desc: "Criativos prontos para usar" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-3">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-glow font-display font-bold text-primary-foreground">
                {step}
              </div>
              <h3 className="font-display font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="gradient-card rounded-2xl p-10 border border-border shadow-card">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">
            Pronto para criar criativos que <span className="text-gradient">convertem</span>?
          </h2>
          <p className="text-muted-foreground mb-8">
            Comece grátis e veja a diferença que IA faz nos seus anúncios.
          </p>
          <Button variant="hero" size="lg" onClick={() => navigate("/auth")}>
            Criar minha conta grátis
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          © 2024 CreativeAI. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default Index;
