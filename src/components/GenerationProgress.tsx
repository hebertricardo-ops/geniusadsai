import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

type GenerationType = "copy" | "creative" | "carousel-slide";

interface GenerationProgressProps {
  isActive: boolean;
  type: GenerationType;
}

const MESSAGES: Record<GenerationType, string[]> = {
  copy: [
    "Analisando seu produto...",
    "Identificando dores e benefícios...",
    "Criando ângulos persuasivos...",
    "Refinando headlines e CTAs...",
    "Otimizando a copy para conversão...",
    "Finalizando variações...",
  ],
  creative: [
    "Preparando composição visual...",
    "Processando imagens de referência...",
    "Gerando layout do criativo...",
    "Aplicando elementos de design...",
    "Ajustando hierarquia visual...",
    "Renderizando criativo final...",
  ],
  "carousel-slide": [
    "Analisando contexto do slide...",
    "Criando composição visual...",
    "Aplicando estilo do carrossel...",
    "Integrando textos ao layout...",
    "Renderizando imagem do slide...",
    "Finalizando...",
  ],
};

const GenerationProgress = ({ isActive, type }: GenerationProgressProps) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = MESSAGES[type];

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 60) return prev + 2;
        if (prev < 85) return prev + 0.5;
        if (prev < 95) return prev + 0.1;
        return prev;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isActive, messages.length]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6 animate-fade-in">
      <div className="relative">
        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center shadow-glow animate-pulse">
          <Sparkles className="w-8 h-8 text-primary-foreground" />
        </div>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>Aguarde...</span>
        </div>
      </div>

      <p className="text-sm text-foreground font-medium text-center transition-all duration-300">
        {messages[messageIndex]}
      </p>

      <p className="text-xs text-muted-foreground text-center">
        Não feche esta página enquanto o processo estiver em andamento
      </p>
    </div>
  );
};

export default GenerationProgress;
