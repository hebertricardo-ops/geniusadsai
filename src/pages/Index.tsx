import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Zap, ArrowRight, Sparkles, Image, Shield, Clock,
  Brain, Target, Upload, PenTool, Layers, Quote,
  Check, X, Package, FileText, BarChart3
} from "lucide-react";
import logoIcon from "@/assets/logo-icon.png";
import logoText from "@/assets/logo-text.png";
import heroShowcase from "@/assets/hero-showcase.jpeg";
import mockupImage from "@/assets/mockup_lp_1.png";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Index = () => {
  const navigate = useNavigate();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  return (
    <div className="min-h-screen gradient-hero">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <img src={logoIcon} alt="Genius ADS" className="w-9 h-9 rounded-xl object-contain" />
          <img src={logoText} alt="Genius ADS" className="h-16 text-xl object-fill" />
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

      {/* DOBRA 1 — Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-display text-foreground leading-tight mb-6 animate-fade-in">
          Criativos que <span className="text-gradient">vendem</span>,
          <br />
          gerados em segundos
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
          Transforme qualquer produto ou serviço em criativos de alta conversão em menos de 60 segundos, sem precisar pensar, escrever ou editar.
        </p>
        <div className="flex items-center justify-center gap-4 mb-14 animate-fade-in">
          <Button variant="hero" size="lg" onClick={() => navigate("/auth")}>
            Começar agora
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/auth")}>
            Ver demo
          </Button>
        </div>

        {/* Video */}
        <div className="max-w-3xl mx-auto mb-14 animate-fade-in">
          <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-border/50" style={{ paddingBottom: '56.25%' }}>
            {!isVideoPlaying ? (
              <div
                className="absolute inset-0 cursor-pointer group"
                onClick={() => setIsVideoPlaying(true)}
              >
                <img
                  src="https://img.youtube.com/vi/XsivhOx4Q0Q/maxresdefault.jpg"
                  alt="Genius ADS - Demo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                  <PlayCircle className="w-20 h-20 text-white drop-shadow-lg group-hover:scale-110 transition-transform" />
                </div>
              </div>
            ) : (
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube.com/embed/XsivhOx4Q0Q?autoplay=1&controls=0&modestbranding=1&rel=0&showinfo=0"
                title="Genius ADS - Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </div>

        {/* Benefícios grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto animate-fade-in">
          {[
            { emoji: "⚡", text: "Gere criativos completos em segundos (imagem + copy)" },
            { emoji: "🧠", text: "Baseado nas dores reais do seu público" },
            { emoji: "🎯", text: "Copy já estruturada para conversão" },
            
            { emoji: "🚀", text: "Teste muito mais criativos em menos tempo" },
            { emoji: "📈", text: "Valide sua oferta até 10x mais rápido" },
            { emoji: "💸", text: "Pare de depender de designer ou inspiração" },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex items-start gap-3 text-left p-3 rounded-xl bg-secondary/50 border border-border/50">
              <span className="text-xl flex-shrink-0">{emoji}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DOBRA 2 — Dor */}
      <section className="max-w-4xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-10 text-center">
          Você já <span className="text-gradient">pensou isso</span>?
        </h2>
        <div className="gradient-card rounded-2xl p-8 md:p-12 border border-border shadow-card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {[
              "Eu não sei o que escrever no anúncio…",
              "Meu criativo nunca parece bom o suficiente",
              "Demoro demais pra criar e no final nem sei se vai vender",
              "Vejo outros anunciando melhor que eu… mas não sei o que eles fazem",
              "Fico travado olhando pra tela sem saber por onde começar",
              "Testo um ou dois criativos e torço pra dar certo",
            ].map((quote) => (
              <div key={quote} className="flex items-start gap-3 p-4 rounded-xl bg-secondary/40 border border-border/30">
                <Quote className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground italic">"{quote}"</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="text-lg text-foreground font-display">
              Se você já pensou isso…
            </p>
            <p className="text-lg text-primary font-display mt-1">
              o problema não é seu produto.
            </p>
            <p className="text-muted-foreground mt-2">
              É a forma como você está criando seus criativos.
            </p>
          </div>
        </div>
      </section>

      {/* DOBRA 3 — Transição Dor → Solução */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-10">
          A culpa <span className="text-gradient">não é sua</span>
        </h2>
        <div className="space-y-4 max-w-lg mx-auto mb-10">
          {[
            "Você está criando tudo do zero, toda vez",
            "Não tem estrutura pronta de copy",
            "Não sabe quais dores usar",
            "Falta padrão, só tentativa e erro",
            "Criar criativo virou um processo lento",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-left">
              <X className="w-5 h-5 text-destructive flex-shrink-0" />
              <span className="text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mb-2">A verdade é simples:</p>
        <p className="text-xl font-display text-foreground mb-1">
          Você não precisa ser criativo.
        </p>
        <p className="text-xl font-display text-foreground mb-4">
          Você precisa de um <span className="text-gradient">sistema que cria por você.</span>
        </p>
        <p className="text-muted-foreground">
          E é exatamente isso que o <span className="text-primary font-semibold">Genius ADS</span> faz.
        </p>
      </section>

      {/* DOBRA 4 — Passo a passo */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-12">
          Como funciona o <span className="text-gradient">Genius ADS</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {[
            { step: "1", title: "Envie suas imagens", desc: "Produto, logo, print ou modelo" },
            { step: "2", title: "Preencha as informações", desc: "Produto, promessa, dores, benefícios (ou deixe a IA sugerir)" },
            { step: "3", title: "Clique em gerar", desc: "O Genius ADS cria o criativo completo + 3 opções de copy" },
            { step: "4", title: "Baixe e use", desc: "Pronto para anunciar ou postar" },
          ].map(({ step, title, desc }) => (
            <div key={step} className="space-y-3">
              <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center mx-auto shadow-glow font-display text-primary-foreground">
                {step}
              </div>
              <h3 className="font-display text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 text-muted-foreground text-sm">
          <span>Sem travar</span>
          <span className="w-1 h-1 rounded-full bg-primary" />
          <span>Sem pensar demais</span>
          <span className="w-1 h-1 rounded-full bg-primary" />
          <span>Sem perder tempo</span>
        </div>
      </section>

      {/* DOBRA 5 — O que você recebe */}
      {/* Hero Showcase Image */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-4 animate-fade-in">
        <img
          src={heroShowcase}
          alt="Genius ADS - Plataforma de geração de criativos com IA"
          className="w-full max-w-2xl lg:max-w-3xl mx-auto rounded-2xl shadow-2xl"
          loading="lazy"
        />
      </div>

      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-12 text-center">
          Tudo que você vai <span className="text-gradient">receber</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Package, title: "Gerador de Criativos Automáticos", description: "Cria anúncios completos prontos para uso" },
            { icon: Brain, title: "Motor de Copy Inteligente", description: "Textos baseados em dor, desejo e objeção" },
            { icon: FileText, title: "Gerador de Legendas (3 variações)", description: "Receba múltiplas opções de copy para testar" },
            { icon: Image, title: "Composição Visual com IA", description: "Cria criativos com aparência profissional" },
            { icon: Target, title: "Estruturas de Alta Conversão", description: "Baseado no que funciona em anúncios reais" },
            { icon: Zap, title: "Geração em Escala", description: "Crie dezenas de criativos em minutos" },
          ].map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="gradient-card rounded-2xl p-7 border border-border shadow-card hover:border-primary/30 transition-all duration-300 group flex flex-col items-center text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mb-5 group-hover:gradient-primary transition-all duration-300">
                <Icon className="w-5 h-5 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="text-lg font-display text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DOBRA 6 — Para quem serve */}
      <section className="max-w-4xl mx-auto px-4 py-16 pb-[50px]">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-12 text-center">
          Para quem <span className="text-gradient">serve</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="gradient-card rounded-2xl p-8 border border-border shadow-card">
            <h3 className="font-display text-foreground text-lg mb-6">
              Isso é pra você se:
            </h3>
            <div className="space-y-4">
              {[
                "Vende produtos físicos ou digitais",
                "Quer rodar anúncios mas trava na criação",
                "Perde tempo criando criativos do zero",
                "Quer testar mais criativos sem esforço",
                "Quer escalar sem depender de designer",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="gradient-card rounded-2xl p-8 border border-border shadow-card">
            <h3 className="font-display text-foreground text-lg mb-6">
              Não é pra você se:
            </h3>
            <div className="space-y-4">
              {[
                "Não pretende vender nada",
                "Não quer testar anúncios",
                "Prefere fazer tudo manualmente",
                "Não vê problema em perder tempo criando",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <X className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mockup Image */}
      <section className="max-w-5xl mx-auto px-4 py-0 flex justify-center">
        <img
          src={mockupImage}
          alt="Genius ADS - Plataforma em dispositivos"
          className="max-w-[280px] md:max-w-sm lg:max-w-md h-auto"
          loading="lazy"
        />
      </section>

      {/* DOBRA 7 — Preços */}
      <section className="max-w-5xl mx-auto px-4 py-20 pt-[60px]">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-12 text-center">
          Escolha seu <span className="text-gradient">pacote de créditos</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              name: "Free", emoji: "🆓", credits: 4, price: "R$ 0,00", perUnit: null, highlight: false, packageId: "free",
              tagline: "Para quem quer testar antes de investir",
              features: ["Acesso imediato", "100% gratuito", "Sem compromisso"],
              cta: "COMEÇAR GRÁTIS",
            },
            {
              name: "Básico", emoji: "💡", credits: 20, price: "R$ 49,90", perUnit: "R$ 2,49 por criativo", highlight: false, packageId: "basico", checkoutUrl: "https://pay.hotmart.com/E105290250P?off=1lncai6a&checkoutMode=10",
              tagline: "Para quem quer sair do zero e começar a testar de verdade",
              features: ["Criação em escala inicial", "Mais testes = mais chances de vender", "Baixo custo por criativo", "Acesso imediato"],
              cta: "COMEÇAR COM O BÁSICO",
            },
            {
              name: "Pro", emoji: "🚀", credits: 50, price: "R$ 99,90", perUnit: "R$ 1,99 por criativo", highlight: true, packageId: "pro", checkoutUrl: "https://pay.hotmart.com/E105290250P?off=0eczkuvh&checkoutMode=10",
              tagline: "Para quem quer performance e consistência",
              features: ["Melhor custo-benefício", "Volume + velocidade de execução", "Acelera validação de campanhas", "Custo ainda mais baixo por criativo", "Acesso imediato"],
              cta: "ESCALAR COM O PRO",
            },
            {
              name: "Plus", emoji: "🔥", credits: 100, price: "R$ 129,90", perUnit: "R$ 1,29 por criativo", highlight: false, packageId: "plus", checkoutUrl: "https://pay.hotmart.com/E105290250P?off=p12z4pm0&checkoutMode=10",
              tagline: "Para quem quer dominar o jogo dos criativos",
              features: ["Menor custo por criativo", "Máxima produtividade", "Liberdade total para testar", "Valide ofertas 10x mais rápido", "Acesso imediato"],
              cta: "QUERO ESCALAR AO MÁXIMO",
            },
          ].map(({ name, emoji, credits, price, perUnit, highlight, tagline, features, cta, packageId, checkoutUrl }) => (
            <div
              key={name}
              className={`gradient-card rounded-2xl p-7 border shadow-card flex flex-col relative ${
                highlight ? "border-primary shadow-glow" : "border-border"
              }`}
            >
              {highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-xs font-semibold text-primary-foreground">
                  Mais popular
                </div>
              )}
              <div className="text-center mb-4">
                <span className="text-3xl mb-2 block">{emoji}</span>
                <h3 className="font-display text-foreground text-lg mb-1">Pacote {name}</h3>
                <p className="text-sm text-muted-foreground">{credits} créditos</p>
              </div>
              <div className="text-center mb-4">
                <p className="text-2xl font-display text-foreground">{price}</p>
                {perUnit && (
                  <p className="text-xs text-muted-foreground mt-1">({perUnit})</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center italic mb-5">💬 {tagline}</p>
              <div className="space-y-2 mb-6 flex-1">
                {features.map((f) => (
                  <p key={f} className="text-sm text-muted-foreground text-center">{f}</p>
                ))}
              </div>
              <Button
                variant="hero"
                size="sm"
                className="w-full text-xs whitespace-normal text-center leading-tight py-2"
                onClick={() => {
                  if (packageId === "free") {
                    navigate("/auth");
                    return;
                  }
                  if (checkoutUrl) {
                    window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                {cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* DOBRA 8 — Custo de não comprar */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-display text-foreground mb-10 text-center">
          Vamos ser <span className="text-gradient">diretos</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="gradient-card rounded-2xl p-8 border border-border shadow-card">
            <h3 className="font-display text-foreground mb-6">Hoje você:</h3>
            <div className="space-y-3">
              {[
                "Gasta 1 a 2 horas pra criar um criativo",
                "No final do dia faz 4 ou 5 no máximo",
                "Fica na dúvida se está bom",
                "Paga caro pra designer",
                "Espera dias pra receber",
                "Sem garantia de resultado",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <X className="w-4 h-4 text-destructive flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="gradient-card rounded-2xl p-8 border border-primary/50 shadow-card shadow-glow">
            <h3 className="font-display text-foreground mb-6">Com o Genius ADS:</h3>
            <div className="space-y-3">
              {[
                "Cria 20+ criativos em minutos",
                "Sem pensar em copy",
                "Sem depender de design",
                "Sem travar",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-muted-foreground mt-8">
          O problema não é custo.{" "}
          <span className="text-foreground font-semibold">É o tempo e as oportunidades que você está perdendo.</span>
        </p>
      </section>

      {/* DOBRA 9 — CTA Final + FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-20">
        <div className="gradient-card rounded-2xl p-10 border border-border shadow-card text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-display text-foreground mb-4">
            Comece agora com o <span className="text-gradient">Genius ADS</span>
          </h2>
          <p className="text-muted-foreground mb-2">🆓 Teste grátis com 4 créditos</p>
          <p className="text-muted-foreground mb-8">ou 💡 Comece com o pacote básico</p>
          <Button variant="hero" size="lg" onClick={() => navigate("/auth")}>
            COMEÇAR AGORA
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        <h2 className="text-2xl font-display text-foreground mb-8 text-center">
          Perguntas Frequentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: "Preciso saber design?", a: "Não. O Genius ADS faz tudo automaticamente." },
            { q: "Preciso escrever copy?", a: "Não. Você recebe o criativo pronto + legendas." },
            { q: "Funciona para qualquer produto?", a: "Sim. Basta inserir as informações." },
            { q: "Quantos criativos posso gerar?", a: "Depende do seu pacote de créditos." },
            { q: "Posso testar antes de pagar?", a: "Sim. Você tem 4 créditos gratuitos." },
            { q: "Quando começo a usar?", a: "Imediatamente." },
          ].map(({ q, a }, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-border">
              <AccordionTrigger className="text-foreground hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025 Genius ADS. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default Index;
