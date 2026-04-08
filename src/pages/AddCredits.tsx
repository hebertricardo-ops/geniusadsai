import { Button } from "@/components/ui/button";

const packages = [
  {
    name: "Básico",
    emoji: "💡",
    credits: 20,
    price: "R$ 49,90",
    perUnit: "R$ 2,49 por criativo",
    highlight: false,
    tagline: "Para quem quer sair do zero e começar a testar de verdade",
    features: ["Criação em escala inicial", "Mais testes = mais chances de vender", "Baixo custo por criativo", "Acesso imediato"],
    cta: "COMEÇAR COM O BÁSICO",
    checkoutUrl: "https://pay.hotmart.com/E105290250P?off=1lncai6a&checkoutMode=10",
  },
  {
    name: "Pro",
    emoji: "🚀",
    credits: 50,
    price: "R$ 99,90",
    perUnit: "R$ 1,99 por criativo",
    highlight: true,
    tagline: "Para quem quer performance e consistência",
    features: ["Melhor custo-benefício", "Volume + velocidade de execução", "Acelera validação de campanhas", "Custo ainda mais baixo por criativo", "Acesso imediato"],
    cta: "QUERO O MELHOR CUSTO-BENEFÍCIO",
    checkoutUrl: "https://pay.hotmart.com/E105290250P?off=0eczkuvh&checkoutMode=10",
  },
  {
    name: "Plus",
    emoji: "🔥",
    credits: 100,
    price: "R$ 129,90",
    perUnit: "R$ 1,29 por criativo",
    highlight: false,
    tagline: "Para quem quer dominar o jogo dos criativos",
    features: ["Menor custo por criativo", "Máxima produtividade", "Liberdade total para testar", "Valide ofertas 10x mais rápido", "Acesso imediato"],
    cta: "QUERO ESCALAR AO MÁXIMO",
    checkoutUrl: "https://pay.hotmart.com/E105290250P?off=p12z4pm0&checkoutMode=10",
  },
];

const AddCredits = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display text-foreground mb-3">
          Adicionar <span className="text-gradient">Créditos</span>
        </h1>
        <p className="text-muted-foreground">
          Escolha o pacote ideal para continuar criando seus anúncios
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map(({ name, emoji, credits, price, perUnit, highlight, tagline, features, cta, checkoutUrl }) => (
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
                window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
              }}
            >
              {cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddCredits;
