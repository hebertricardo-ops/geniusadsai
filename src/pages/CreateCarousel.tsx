import { useState } from "react";
import { sanitizeFileName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import CreditsBadge from "@/components/CreditsBadge";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Check, RefreshCw, ImageIcon, Upload } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import InsufficientCreditsDialog from "@/components/InsufficientCreditsDialog";
import GenerationProgress from "@/components/GenerationProgress";

const STEPS = ["Produto", "Persuasão", "Estratégia"];

const OBJECTIVES = [
  { value: "vender diretamente", label: "Vender diretamente" },
  { value: "gerar curiosidade", label: "Gerar curiosidade" },
  { value: "educar / entregar valor", label: "Educar / Entregar valor" },
  { value: "quebrar objeções", label: "Quebrar objeções" },
  { value: "engajar", label: "Engajar (salvar, compartilhar)" },
];

interface CarouselSlide {
  slide_number: number;
  slide_role: string;
  strategy: string;
  headline: string;
  subtext: string;
  cta: string;
}

interface CarouselCopy {
  carousel_title: string;
  slides_count: number;
  credits_cost: number;
  objective: string;
  slides: CarouselSlide[];
}

interface SlideState {
  loading: boolean;
  imageUrl: string | null;
  extraImages: File[];
  useAiImage: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  gancho: "bg-red-500/10 text-red-400 border-red-500/20",
  dor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  agravamento: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  insight: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  solução: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  benefícios: "bg-green-500/10 text-green-400 border-green-500/20",
  "quebra de objeção": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  cta: "bg-primary/10 text-primary border-primary/20",
};

const CreateCarousel = () => {
  const location = useLocation();
  const prefill = (location.state as any)?.prefill;

  const [step, setStep] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [slidesCount, setSlidesCount] = useState(prefill?.slides_count ?? 6);
  const [productName, setProductName] = useState(prefill?.product_name ?? "");
  const [mainPromise, setMainPromise] = useState(prefill?.main_promise ?? "");
  const [painPoints, setPainPoints] = useState(prefill?.pain_points ?? "");
  const [benefits, setBenefits] = useState(prefill?.benefits ?? "");
  const [objections, setObjections] = useState(prefill?.objections ?? "");
  const [carouselObjective, setCarouselObjective] = useState(prefill?.carousel_objective ?? "vender diretamente");
  const [creativeStyle, setCreativeStyle] = useState(prefill?.creative_style ?? "");
  const [extraContext, setExtraContext] = useState(prefill?.extra_context ?? "");
  const [carouselCta, setCarouselCta] = useState(prefill?.cta ?? "");

  // Phase states
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState<CarouselCopy | null>(null);
  const [slideStates, setSlideStates] = useState<SlideState[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [isCreditsDialogOpen, setIsCreditsDialogOpen] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();

  const canProceed = () => {
    switch (step) {
      case 0: return productName.trim() && mainPromise.trim();
      case 1: return painPoints.trim() && benefits.trim();
      case 2: return !!carouselObjective;
      default: return false;
    }
  };

  // Phase 1: Generate copy only
  const handleGenerateCopy = async () => {
    if (!user) return;

    const creditsNeeded = slidesCount;
    const creditsAvailable = credits?.credits_balance ?? 0;
    if (creditsAvailable < creditsNeeded) {
      setIsCreditsDialogOpen(true);
      return;
    }

    setLoadingCopy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-carousel", {
        body: {
          phase: "copy",
          product_name: productName,
          main_promise: mainPromise,
          pain_points: painPoints,
          benefits,
          objections: objections || null,
          carousel_objective: carouselObjective,
          creative_style: creativeStyle || null,
          extra_context: extraContext || null,
          cta: carouselCta || null,
          slides_count: slidesCount,
        },
      });
      if (error) throw error;

      const copy: CarouselCopy = data.copy;
      setGeneratedCopy(copy);
      setSlideStates(copy.slides.map(() => ({ loading: false, imageUrl: null, extraImages: [], useAiImage: false })));

      // Upload reference images once
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 3600);
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        imageUrls.push(signedUrlData.signedUrl);
      }
      setUploadedImageUrls(imageUrls);

      // Build visual context for future consistency
      const visualContext = {
        creative_style: creativeStyle || null,
        image_urls: imageUrls,
        product_name: productName,
        carousel_style_reference: creativeStyle || "clean premium tecnológico",
        typography_style: "sans-serif geométrica (Montserrat ou similar)",
      };

      // Save to history immediately as copy_ready
      const { data: request, error: reqError } = await supabase
        .from("carousel_requests")
        .insert({
          user_id: user.id,
          product_name: productName,
          main_promise: mainPromise,
          pain_points: painPoints,
          benefits,
          objections: objections || null,
          carousel_objective: carouselObjective,
          creative_style: creativeStyle || null,
          extra_context: extraContext || null,
          slides_count: copy.slides.length,
          status: "copy_ready",
          result_data: copy as any,
          visual_context: visualContext as any,
        })
        .select()
        .single();
      if (reqError) throw reqError;
      setRequestId(request.id);

      toast({ title: "Copy gerada!", description: "Agora gere as imagens de cada slide individualmente." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar copy", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoadingCopy(false);
    }
  };

  // Generate single slide image
  const handleGenerateSlideImage = async (slideIndex: number) => {
    if (!user || !generatedCopy || !requestId) return;

    if ((credits?.credits_balance ?? 0) < 1) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de 1 crédito para gerar este slide.", variant: "destructive" });
      return;
    }

    // Set loading for this slide
    setSlideStates(prev => prev.map((s, i) => i === slideIndex ? { ...s, loading: true } : s));

    try {
      const slide = generatedCopy.slides[slideIndex];
      const slideState = slideStates[slideIndex];

      // Upload extra images for this slide
      const extraImageUrls: string[] = [];
      for (const file of slideState.extraImages) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 3600);
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        extraImageUrls.push(signedUrlData.signedUrl);
      }

      // Combine reference + extra images
      const allImageUrls = [...uploadedImageUrls, ...extraImageUrls];

      const { data, error } = await supabase.functions.invoke("generate-carousel", {
        body: {
          phase: "single-image",
          slide,
          image_urls: allImageUrls,
          product_name: productName,
          creative_style: creativeStyle || null,
          total_slides: generatedCopy.slides.length,
          carousel_style_reference: creativeStyle || "clean premium tecnológico",
          use_ai_image: slideState.useAiImage || false,
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

      // Deduct 1 credit (fetch fresh balance to avoid stale state)
      const { data: freshCredits } = await supabase
        .from("user_credits")
        .select("credits_balance, credits_used")
        .eq("user_id", user.id)
        .single();

      if (!freshCredits || freshCredits.credits_balance < 1) {
        throw new Error("Créditos insuficientes");
      }

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
        description: `Slide ${slide.slide_number} do carrossel: ${productName}`,
      });

      queryClient.invalidateQueries({ queryKey: ["credits"] });

      // Update slide state
      setSlideStates(prev => prev.map((s, i) => i === slideIndex ? { ...s, loading: false, imageUrl } : s));

      // Check if all slides are done → update request status
      const updatedStates = slideStates.map((s, i) => i === slideIndex ? { ...s, imageUrl } : s);
      const allDone = updatedStates.every(s => s.imageUrl !== null);
      if (allDone) {
        await supabase.from("carousel_requests").update({ status: "completed" }).eq("id", requestId);
      }

      toast({ title: `Slide ${slide.slide_number} gerado!`, description: "Imagem criada com sucesso." });
    } catch (err: any) {
      console.error(err);
      setSlideStates(prev => prev.map((s, i) => i === slideIndex ? { ...s, loading: false } : s));
      toast({ title: `Erro no slide ${slideIndex + 1}`, description: err.message || "Tente novamente.", variant: "destructive" });
    }
  };

  const handleSlideExtraImages = (slideIndex: number, files: File[]) => {
    setSlideStates(prev => prev.map((s, i) => i === slideIndex ? { ...s, extraImages: files } : s));
  };

  const generatedCount = slideStates.filter(s => s.imageUrl).length;
  const allSlidesGenerated = generatedCopy && generatedCount === generatedCopy.slides.length;

  // Copy review + individual image generation UI
  if (generatedCopy) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display text-foreground mb-2">Slides do Carrossel</h2>
            <p className="text-muted-foreground">
              {generatedCopy.slides.length} slides para "{productName}" — gere as imagens individualmente
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {generatedCount}/{generatedCopy.slides.length} imagens geradas • 1 crédito por slide
            </p>
          </div>

          <div className="space-y-6">
            {generatedCopy.slides.map((slide, idx) => {
              const roleKey = slide.slide_role.toLowerCase();
              const colorClass = ROLE_COLORS[roleKey] || "bg-muted text-muted-foreground border-border";
              const state = slideStates[idx];

              return (
                <div
                  key={idx}
                  className="gradient-card rounded-2xl p-6 border border-border shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display text-sm shrink-0">
                      {slide.slide_number}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={colorClass}>
                          {slide.slide_role}
                        </Badge>
                        {state?.imageUrl && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                            <Check className="w-3 h-3 mr-1" /> Gerado
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-display text-foreground">{slide.headline}</h3>
                      <p className="text-sm text-muted-foreground">{slide.subtext}</p>
                      {slide.cta && (
                        <span className="inline-block px-3 py-1 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold">
                          {slide.cta}
                        </span>
                      )}
                      <p className="text-xs text-foreground/50 italic">
                        Estratégia: {slide.strategy}
                      </p>

                      {/* Generated image preview */}
                      {state?.imageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-border max-w-xs">
                          <img
                            src={state.imageUrl}
                            alt={`Slide ${slide.slide_number}`}
                            className="w-full aspect-square object-cover"
                          />
                        </div>
                      )}

                      {/* Image source options */}
                      {!state?.imageUrl && (
                        <div className="mt-4 space-y-4 pt-3 border-t border-border">
                          {/* Toggle: Upload vs AI */}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setSlideStates(prev => prev.map((s, i) => i === idx ? { ...s, useAiImage: false } : s))}
                              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                                !state?.useAiImage
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              <Upload className="w-3 h-3 inline mr-1" />
                              Enviar imagens
                            </button>
                            <button
                              type="button"
                              onClick={() => setSlideStates(prev => prev.map((s, i) => i === idx ? { ...s, useAiImage: true } : s))}
                              className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                                state?.useAiImage
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background/50 text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              <Sparkles className="w-3 h-3 inline mr-1" />
                              Gerar com IA
                            </button>
                          </div>

                          {!state?.useAiImage ? (
                            <div>
                              <Label className="text-sm text-muted-foreground mb-2 block">
                                Imagens extras para este slide (opcional)
                              </Label>
                              <ImageUpload
                                images={state?.extraImages || []}
                                onImagesChange={(files) => handleSlideExtraImages(idx, files)}
                                maxImages={4}
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              <Sparkles className="w-3 h-3 inline mr-1" />
                              A IA gerará automaticamente uma imagem baseada no contexto deste slide
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        {state?.loading ? (
                          <div className="w-full">
                            <GenerationProgress isActive={true} type="carousel-slide" />
                          </div>
                        ) : state?.imageUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSlideStates(prev => prev.map((s, i) => i === idx ? { ...s, imageUrl: null } : s));
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                            Regenerar (1 crédito)
                          </Button>
                        ) : (
                          <Button
                            variant="hero"
                            size="sm"
                            onClick={() => handleGenerateSlideImage(idx)}
                          >
                            <ImageIcon className="w-4 h-4" />
                            Gerar Imagem (1 crédito)
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setGeneratedCopy(null);
                setSlideStates([]);
                setRequestId(null);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Regenerar Copy
            </Button>
            {allSlidesGenerated && (
              <Button variant="hero" onClick={() => navigate(`/carousel-results/${requestId}`)}>
                <Check className="w-4 h-4" />
                Ver Carrossel Completo
              </Button>
            )}
            {generatedCount > 0 && !allSlidesGenerated && (
              <Button variant="outline" onClick={() => navigate(`/carousel-results/${requestId}`)}>
                Ver Progresso
              </Button>
            )}
          </div>
        </div>
        <InsufficientCreditsDialog
          open={isCreditsDialogOpen}
          onClose={() => setIsCreditsDialogOpen(false)}
          creditsNeeded={slidesCount}
          creditsAvailable={credits?.credits_balance ?? 0}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-display text-foreground mb-1">Novo Carrossel</h1>
              <p className="text-muted-foreground">Gere a copy e os slides do seu carrossel com IA</p>
            </div>
            <CreditsBadge credits={credits?.credits_balance ?? 0} />
          </div>
          <Stepper steps={STEPS} currentStep={step} />
        </div>

          <GenerationProgress isActive={loadingCopy} type="copy" />
        {!loadingCopy && (
          <div className="gradient-card rounded-2xl p-8 border border-border shadow-card animate-fade-in">
            {/* Step 0: Produto */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <ImageIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Imagens de referência</p>
                    <p className="text-sm text-muted-foreground">
                      Após a geração da copy, você poderá enviar imagens do seu produto para cada slide do carrossel.
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-foreground font-display mb-2 block">Nome do produto *</Label>
                  <Input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ex: Curso de Marketing Digital"
                    className="bg-background/50"
                  />
                </div>
                <div>
                  <Label className="text-foreground font-display mb-2 block">Promessa principal *</Label>
                  <Textarea
                    value={mainPromise}
                    onChange={(e) => setMainPromise(e.target.value)}
                    placeholder="Ex: Aprenda a criar anúncios que vendem em 30 dias"
                    className="bg-background/50"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-foreground font-display mb-2 block">
                    Quantidade de slides: <span className="text-primary">{slidesCount}</span>
                    <span className="text-sm text-muted-foreground ml-2">({slidesCount} créditos)</span>
                  </Label>
                  <Slider
                    value={[slidesCount]}
                    onValueChange={(v) => setSlidesCount(v[0])}
                    min={4}
                    max={8}
                    step={1}
                    className="mt-3"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>4 slides</span>
                    <span>8 slides</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Persuasão */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-foreground font-display mb-2 block">Principais dores do público *</Label>
                  <Textarea
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    placeholder="Ex: Não consegue vender online, gasta com anúncios sem retorno..."
                    className="bg-background/50"
                    rows={4}
                  />
                </div>
                <div>
                  <Label className="text-foreground font-display mb-2 block">Principais benefícios *</Label>
                  <Textarea
                    value={benefits}
                    onChange={(e) => setBenefits(e.target.value)}
                    placeholder="Ex: Resultados em 7 dias, suporte personalizado, método comprovado..."
                    className="bg-background/50"
                    rows={4}
                  />
                </div>
                <div>
                  <Label className="text-foreground font-display mb-2 block">Principais objeções (opcional)</Label>
                  <Textarea
                    value={objections}
                    onChange={(e) => setObjections(e.target.value)}
                    placeholder="Ex: É muito caro, não tenho tempo, será que funciona..."
                    className="bg-background/50"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Estratégia */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-foreground font-display mb-2 block">Objetivo do carrossel *</Label>
                  <Select value={carouselObjective} onValueChange={setCarouselObjective}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((obj) => (
                        <SelectItem key={obj.value} value={obj.value}>
                          {obj.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Estilo do Carrossel */}
                <div className="space-y-3">
                  <h2 className="text-xl font-display text-foreground">Estilo do Carrossel</h2>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "dark", label: "Dark / Escuro" },
                      { value: "light", label: "Claro / Light" },
                      { value: "clean", label: "Clean / Minimalista" },
                      { value: "premium", label: "Premium / Luxuoso" },
                      { value: "playful", label: "Infantil / Lúdico" },
                      { value: "tech", label: "Tecnológico / Futurista" },
                      { value: "vibrant", label: "Vibrante / Chamativo" },
                      { value: "corporate", label: "Corporativo / Profissional" },
                    ].map((style) => (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => setCreativeStyle(creativeStyle === style.value ? "" : style.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                          creativeStyle === style.value
                            ? "border-primary bg-primary/10 text-primary shadow-md scale-105"
                            : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        {style.label}
                      </button>
                    ))}
                  </div>
                  {!creativeStyle && (
                    <p className="text-xs text-muted-foreground">Nenhum estilo selecionado — a IA escolherá automaticamente.</p>
                  )}
                </div>

                {/* CTA */}
                <div className="space-y-3">
                  <Label className="text-foreground font-display mb-2 block">CTA do slide final (opcional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Compre agora",
                      "Saiba mais",
                      "Garanta o seu",
                      "Quero aproveitar",
                      "Comece hoje",
                      "Fale conosco",
                      "Teste grátis",
                      "Aproveite a oferta",
                    ].map((ctaOption) => (
                      <button
                        key={ctaOption}
                        type="button"
                        onClick={() => setCarouselCta(carouselCta === ctaOption ? "" : ctaOption)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                          carouselCta === ctaOption
                            ? "border-primary bg-primary/10 text-primary shadow-md scale-105"
                            : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        {ctaOption}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={carouselCta}
                    onChange={(e) => setCarouselCta(e.target.value)}
                    placeholder="Ou digite um CTA personalizado..."
                    className="bg-background/50"
                  />
                </div>

                <div>
                  <Label className="text-foreground font-display mb-2 block">Contexto adicional (opcional)</Label>
                  <Textarea
                    value={extraContext}
                    onChange={(e) => setExtraContext(e.target.value)}
                    placeholder="Ex: público entre 25-40 anos, foco em Instagram..."
                    className="bg-background/50"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={() => step > 0 ? setStep(step - 1) : navigate("/dashboard")}
              >
                <ArrowLeft className="w-4 h-4" />
                {step > 0 ? "Voltar" : "Dashboard"}
              </Button>

              {step < STEPS.length - 1 ? (
                <Button
                  variant="hero"
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                >
                  Próximo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  onClick={handleGenerateCopy}
                  disabled={!canProceed() || loadingCopy}
                >
                  <Sparkles className="w-4 h-4" />
                  Gerar Copy ({slidesCount} slides)
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <InsufficientCreditsDialog
        open={isCreditsDialogOpen}
        onClose={() => setIsCreditsDialogOpen(false)}
        creditsNeeded={slidesCount}
        creditsAvailable={credits?.credits_balance ?? 0}
      />
    </div>
  );
};

export default CreateCarousel;
