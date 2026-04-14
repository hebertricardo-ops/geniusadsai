import { useParams, useNavigate } from "react-router-dom";
import { sanitizeFileName } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Download, Plus, ArrowLeft, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Copy, Info, ImageIcon, AlertCircle, Sparkles, Upload, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import ImageUpload from "@/components/ImageUpload";

interface SlideGenerationState {
  loading: boolean;
  useAiImage: boolean;
  extraImages: File[];
}

const CarouselResults = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideGenStates, setSlideGenStates] = useState<Record<number, SlideGenerationState>>({});

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
  const visualContext = request?.visual_context as any;
  const slides = [...(resultData?.slides || [])].sort((a: any, b: any) => (a.slide_number || 0) - (b.slide_number || 0));
  const isCopyReady = request?.status === "copy_ready";
  const isPartial = creatives.length > 0 && creatives.length < slides.length;

  const mergedSlides = slides.map((slide: any) => {
    const creative = creatives.find((c) => {
      const cd = c.copy_data as any;
      return cd?.slide_number === slide.slide_number;
    });
    return { ...slide, creative };
  });

  const getSlideGenState = (idx: number): SlideGenerationState =>
    slideGenStates[idx] || { loading: false, useAiImage: true, extraImages: [] };

  const updateSlideGenState = (idx: number, updates: Partial<SlideGenerationState>) => {
    setSlideGenStates(prev => ({
      ...prev,
      [idx]: { ...getSlideGenState(idx), ...updates },
    }));
  };

  const handleGenerateSlideImage = async (slideIndex: number) => {
    if (!user || !request || !resultData) return;

    if ((credits?.credits_balance ?? 0) < 1) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de 1 crédito para gerar este slide.", variant: "destructive" });
      return;
    }

    updateSlideGenState(slideIndex, { loading: true });

    try {
      const slide = slides[slideIndex];
      const state = getSlideGenState(slideIndex);

      // Upload extra images if any
      const extraImageUrls: string[] = [];
      for (const file of state.extraImages) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 3600);
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        extraImageUrls.push(signedUrlData.signedUrl);
      }

      // Collect existing generated slide URLs for style consistency
      const existingSlideUrls = creatives
        .map(c => c.image_url)
        .filter(Boolean);

      // Reference images from visual context + extra uploads
      const refImageUrls = [...(visualContext?.image_urls || []), ...extraImageUrls];

      const { data, error } = await supabase.functions.invoke("generate-carousel", {
        body: {
          phase: "single-image",
          slide,
          image_urls: refImageUrls,
          product_name: visualContext?.product_name || request.product_name,
          creative_style: visualContext?.creative_style || request.creative_style,
          total_slides: slides.length,
          carousel_style_reference: visualContext?.carousel_style_reference || request.creative_style || "clean premium tecnológico",
          use_ai_image: state.useAiImage,
          existing_slide_urls: existingSlideUrls,
          typography_style: visualContext?.typography_style || "sans-serif geométrica (Montserrat ou similar)",
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const imageUrl = data.image_url;

      // Save to generated_creatives
      await supabase.from("generated_creatives").insert({
        user_id: user.id,
        image_url: imageUrl,
        carousel_request_id: requestId,
        copy_data: {
          type: "carousel",
          slide_number: slide.slide_number,
          ...slide,
        },
        credits_used: 1,
      });

      // Deduct credit
      const { data: freshCredits } = await supabase
        .from("user_credits")
        .select("credits_balance, credits_used")
        .eq("user_id", user.id)
        .single();

      if (!freshCredits || freshCredits.credits_balance < 1) throw new Error("Créditos insuficientes");

      await supabase
        .from("user_credits")
        .update({
          credits_balance: freshCredits.credits_balance - 1,
          credits_used: freshCredits.credits_used + 1,
        })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -1,
        description: `Slide ${slide.slide_number} do carrossel: ${request.product_name}`,
      });

      // Check if all slides now have images
      const newCreativesCount = creatives.length + 1;
      if (newCreativesCount >= slides.length) {
        await supabase.from("carousel_requests").update({ status: "completed" }).eq("id", requestId);
      }

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-creatives", requestId] });
      queryClient.invalidateQueries({ queryKey: ["carousel-request", requestId] });

      updateSlideGenState(slideIndex, { loading: false });
      toast({ title: `Slide ${slide.slide_number} gerado!`, description: "Imagem criada com sucesso." });
    } catch (err: any) {
      console.error(err);
      updateSlideGenState(slideIndex, { loading: false });
      toast({ title: `Erro no slide ${slideIndex + 1}`, description: err.message || "Tente novamente.", variant: "destructive" });
    }
  };

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

  const slidesWithImages = mergedSlides.filter((s: any) => s.creative);
  const currentMerged = mergedSlides[currentSlide];
  const currentCreative = currentMerged?.creative;
  const currentGenState = getSlideGenState(currentSlide);

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

            {/* Copy info + generate controls */}
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

                  {/* Generate controls for missing image */}
                  {!currentCreative && (
                    <div className="pt-4 border-t border-border space-y-4">
                      {/* Toggle: Upload vs AI */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateSlideGenState(currentSlide, { useAiImage: false })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                            !currentGenState.useAiImage
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Upload className="w-3 h-3 inline mr-1" />
                          Enviar imagens
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSlideGenState(currentSlide, { useAiImage: true })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                            currentGenState.useAiImage
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          Gerar com IA
                        </button>
                      </div>

                      {!currentGenState.useAiImage ? (
                        <ImageUpload
                          images={currentGenState.extraImages}
                          onImagesChange={(files) => updateSlideGenState(currentSlide, { extraImages: files })}
                          maxImages={4}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          A IA gerará automaticamente uma imagem baseada no contexto deste slide
                        </p>
                      )}

                      {currentGenState.loading ? (
                        <Button variant="outline" disabled className="w-full">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando...
                        </Button>
                      ) : (
                        <Button
                          variant="hero"
                          className="w-full"
                          onClick={() => handleGenerateSlideImage(currentSlide)}
                        >
                          <ImageIcon className="w-4 h-4" />
                          Gerar Imagem (1 crédito)
                        </Button>
                      )}
                    </div>
                  )}
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
                className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all relative ${
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
                    <Plus className="w-5 h-5 text-primary/60" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Ad Captions */}
          {resultData?.ad_captions && (resultData.ad_captions as any[]).length > 0 && (
            <div className="gradient-card rounded-2xl p-6 border border-border shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-display text-foreground text-lg">Legendas para a Postagem</h3>
              </div>
              <div className="space-y-4">
                {(resultData.ad_captions as any[]).map((item: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-background/50 border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">Opção {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(item.caption);
                          toast({ title: "Legenda copiada!", description: `Opção ${idx + 1} copiada para a área de transferência.` });
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copiar
                      </Button>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-line">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

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
