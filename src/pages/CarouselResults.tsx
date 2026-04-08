import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Download, Plus, ArrowLeft, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Copy, Info, ImageIcon, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const CarouselResults = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: request, isLoading: loadingRequest } = useQuery({
    queryKey: ["carousel-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_requests")
        .select("*")
        .eq("id", requestId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!user,
  });

  const { data: creatives = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ["carousel-creatives", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*")
        .eq("carousel_request_id", requestId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!user,
  });

  const isLoading = loadingRequest || loadingCreatives;
  const resultData = request?.result_data as any;
  const slides = [...(resultData?.slides || [])].sort((a: any, b: any) => (a.slide_number || 0) - (b.slide_number || 0));
  const isCopyReady = request?.status === "copy_ready";
  const isPartial = creatives.length > 0 && creatives.length < slides.length;

  // Build merged slides: copy + image (if available)
  const mergedSlides = slides.map((slide: any) => {
    const creative = creatives.find((c) => {
      const cd = c.copy_data as any;
      return cd?.slide_number === slide.slide_number;
    });
    return { ...slide, creative };
  });

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carrossel-slide-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  const handleDownloadAll = async () => {
    const withImages = mergedSlides.filter((s: any) => s.creative);
    for (let i = 0; i < withImages.length; i++) {
      await handleDownload(withImages[i].creative.image_url, i);
      if (i < withImages.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
  };

  const handleCopyAll = () => {
    if (!slides.length) return;
    const text = slides.map((s: any) =>
      `--- Slide ${s.slide_number} (${s.slide_role}) ---\nHeadline: ${s.headline}\n${s.subtext ? `Subtexto: ${s.subtext}\n` : ""}${s.cta ? `CTA: ${s.cta}\n` : ""}`
    ).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copy copiada!", description: "Texto de todos os slides copiado." });
  };

  const roleLabels: Record<string, string> = {
    gancho: "🎯 Gancho",
    dor: "💔 Dor",
    agravamento: "⚡ Agravamento",
    insight: "💡 Insight",
    solução: "✅ Solução",
    benefícios: "🎁 Benefícios",
    "quebra de objeção": "🛡️ Quebra de Objeção",
    cta: "🚀 CTA",
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando carrossel...</p>
      </div>
    );
  }

  if (!slides.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <h2 className="text-xl font-display text-foreground mb-2">Nenhum slide encontrado</h2>
        <p className="text-muted-foreground mb-6">Não encontramos slides para este carrossel.</p>
        <Button variant="hero" onClick={() => navigate("/create-carousel")}>
          <Plus className="w-4 h-4" /> Novo Carrossel
        </Button>
      </div>
    );
  }

  // Find first slide with an image for the viewer
  const slidesWithImages = mergedSlides.filter((s: any) => s.creative);
  const currentMerged = mergedSlides[currentSlide];
  const currentCreative = currentMerged?.creative;

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-8 animate-fade-in">
          {/* Status */}
          <div className="text-center">
            {isCopyReady || isPartial ? (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                {creatives.length}/{slides.length} slides com imagem gerada
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Carrossel completo — {creatives.length} slide{creatives.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Title & actions */}
          {resultData && (
            <div className="gradient-card rounded-2xl p-6 border border-border shadow-card">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-display text-foreground">{resultData.carousel_title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Objetivo: {resultData.objective} • {resultData.slides_count} slides
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyAll}>
                    <Copy className="w-4 h-4" /> Copiar Copy
                  </Button>
                  {slidesWithImages.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                      <Download className="w-4 h-4" /> Baixar Todos
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main slide viewer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Image */}
            <div className="relative gradient-card rounded-2xl border border-border shadow-card overflow-hidden">
              <div className="aspect-square bg-black/20 flex items-center justify-center">
                {currentCreative ? (
                  <img
                    src={currentCreative.image_url}
                    alt={`Slide ${currentSlide + 1}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 opacity-30" />
                    <p className="text-sm">Imagem não gerada</p>
                  </div>
                )}
              </div>

              {/* Navigation arrows */}
              <button
                onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                disabled={currentSlide === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentSlide(Math.min(mergedSlides.length - 1, currentSlide + 1))}
                disabled={currentSlide === mergedSlides.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground hover:bg-background disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Download single */}
              {currentCreative && (
                <div className="absolute bottom-3 right-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDownload(currentCreative.image_url, currentSlide)}
                  >
                    <Download className="w-4 h-4" /> Baixar
                  </Button>
                </div>
              )}
            </div>

            {/* Copy info */}
            <div className="space-y-4">
              {currentMerged && (
                <div className="gradient-card rounded-2xl p-6 border border-border shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary uppercase tracking-wider">
                      Slide {currentMerged.slide_number} de {slides.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {roleLabels[currentMerged.slide_role?.toLowerCase()] || currentMerged.slide_role}
                      </span>
                      {!currentCreative && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                          Sem imagem
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-display text-foreground leading-tight">
                      {currentMerged.headline}
                    </h3>
                    {currentMerged.subtext && (
                      <p className="text-muted-foreground mt-2">{currentMerged.subtext}</p>
                    )}
                  </div>

                  {currentMerged.cta && (
                    <div className="pt-2">
                      <span className="inline-block px-5 py-2.5 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold">
                        {currentMerged.cta}
                      </span>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground cursor-help">
                          <Info className="w-4 h-4 mt-0.5 shrink-0" />
                          <p>{currentMerged.strategy}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Orientação estratégica deste slide</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Slide thumbnails */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {mergedSlides.map((slide: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                  currentSlide === idx
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 opacity-60 hover:opacity-100"
                }`}
              >
                {slide.creative ? (
                  <img
                    src={slide.creative.image_url}
                    alt={`Slide ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
            </Button>
            <Button variant="hero" onClick={() => navigate("/create-carousel")}>
              <Plus className="w-4 h-4" /> Novo Carrossel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarouselResults;
