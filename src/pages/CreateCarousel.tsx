import { useState } from "react";
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
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Check, RefreshCw, ImageIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [slidesCount, setSlidesCount] = useState(6);
  const [productName, setProductName] = useState("");
  const [mainPromise, setMainPromise] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [benefits, setBenefits] = useState("");
  const [objections, setObjections] = useState("");
  const [carouselObjective, setCarouselObjective] = useState("vender diretamente");
  const [creativeStyle, setCreativeStyle] = useState("");
  const [extraContext, setExtraContext] = useState("");

  // Phase states
  const [loadingCopy, setLoadingCopy] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState<CarouselCopy | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();

  const canProceed = () => {
    switch (step) {
      case 0: return images.length > 0 && productName.trim() && mainPromise.trim();
      case 1: return painPoints.trim() && benefits.trim();
      case 2: return !!carouselObjective;
      default: return false;
    }
  };

  // Phase 1: Generate copy only
  const handleGenerateCopy = async () => {
    if (!user) return;
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
          slides_count: slidesCount,
        },
      });
      if (error) throw error;
      setGeneratedCopy(data.copy);
      toast({ title: "Copy gerada!", description: "Revise os slides e confirme para gerar as imagens." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar copy", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoadingCopy(false);
    }
  };

  // Phase 2: Generate images from approved copy
  const handleGenerateImages = async () => {
    if (!user || !generatedCopy) return;
    const cost = generatedCopy.slides.length;
    if ((credits?.credits_balance ?? 0) < cost) {
      toast({ title: "Créditos insuficientes", description: `Você precisa de ${cost} créditos para gerar ${cost} slides.`, variant: "destructive" });
      return;
    }

    setLoadingImages(true);
    try {
      // 1. Upload reference images
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 600);
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        imageUrls.push(signedUrlData.signedUrl);
      }

      // 2. Create carousel request record
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
          slides_count: generatedCopy.slides.length,
          status: "processing",
          result_data: generatedCopy as any,
        })
        .select()
        .single();
      if (reqError) throw reqError;

      // 3. Call generate-carousel phase 2
      const { data: imagesData, error: imagesError } = await supabase.functions.invoke("generate-carousel", {
        body: {
          phase: "images",
          image_urls: imageUrls,
          copy: generatedCopy,
          product_name: productName,
          creative_style: creativeStyle || null,
          slides_count: generatedCopy.slides.length,
        },
      });
      if (imagesError) throw imagesError;

      // 4. Update request status
      await supabase
        .from("carousel_requests")
        .update({ status: "completed" })
        .eq("id", request.id);

      // 5. Save generated images to generated_creatives
      for (const slide of imagesData.slides) {
        await supabase.from("generated_creatives").insert({
          user_id: user.id,
          image_url: slide.image_url,
          request_id: request.id,
          copy_data: {
            type: "carousel",
            slide_number: slide.slide_number,
            ...generatedCopy.slides.find((s) => s.slide_number === slide.slide_number),
          },
          credits_used: 1,
        });
      }

      // 6. Deduct credits
      await supabase
        .from("user_credits")
        .update({
          credits_balance: (credits?.credits_balance ?? 0) - cost,
          credits_used: (credits?.credits_used ?? 0) + cost,
        })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -cost,
        description: `Carrossel gerado: ${productName} (${cost} slides)`,
      });

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });

      toast({ title: "Carrossel gerado!", description: `${cost} slides criados com sucesso.` });
      navigate(`/carousel-results/${request.id}`);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar imagens", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoadingImages(false);
    }
  };

  // Copy review UI
  if (generatedCopy && !loadingImages) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display text-foreground mb-2">Revise a Copy do Carrossel</h2>
            <p className="text-muted-foreground">
              {generatedCopy.slides.length} slides para "{productName}" — confirme para gerar as imagens
            </p>
          </div>

          <div className="space-y-4">
            {generatedCopy.slides.map((slide, idx) => {
              const roleKey = slide.slide_role.toLowerCase();
              const colorClass = ROLE_COLORS[roleKey] || "bg-muted text-muted-foreground border-border";
              return (
                <div
                  key={idx}
                  className="gradient-card rounded-2xl p-6 border border-border shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display text-sm shrink-0">
                      {slide.slide_number}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={colorClass}>
                          {slide.slide_role}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-display text-foreground">{slide.headline}</h3>
                      <p className="text-sm text-muted-foreground">{slide.subtext}</p>
                      {slide.cta && (
                        <span className="inline-block px-3 py-1 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold">
                          {slide.cta}
                        </span>
                      )}
                      <p className="text-xs text-foreground/50 italic mt-2">
                        Estratégia: {slide.strategy}
                      </p>
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
              }}
            >
              <RefreshCw className="w-4 h-4" />
              Regenerar Copy
            </Button>
            <Button variant="hero" onClick={handleGenerateImages}>
              <ImageIcon className="w-4 h-4" />
              Gerar Imagens ({generatedCopy.slides.length} créditos)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading images UI
  if (loadingImages) {
    return (
      <div>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow animate-pulse">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-display text-foreground mb-2">Gerando as imagens do carrossel...</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Estamos criando {generatedCopy?.slides.length || slidesCount} imagens para seus slides. Isso pode levar alguns minutos.
            </p>
            <Loader2 className="w-6 h-6 text-primary animate-spin mt-6" />
          </div>
        </div>
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

        {loadingCopy ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow animate-pulse">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-display text-foreground mb-2">Gerando a copy do carrossel...</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Estamos criando os textos para {slidesCount} slides. Isso leva apenas alguns segundos.
            </p>
            <Loader2 className="w-6 h-6 text-primary animate-spin mt-6" />
          </div>
        ) : (
          <div className="gradient-card rounded-2xl p-8 border border-border shadow-card animate-fade-in">
            {/* Step 0: Produto */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-foreground font-display mb-2 block">Imagens de referência *</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Envie até 4 imagens do seu produto para servir de referência visual
                  </p>
                  <ImageUpload images={images} onImagesChange={setImages} maxImages={4} />
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
                <div>
                  <Label className="text-foreground font-display mb-2 block">Estilo / Tom (opcional)</Label>
                  <Input
                    value={creativeStyle}
                    onChange={(e) => setCreativeStyle(e.target.value)}
                    placeholder="Ex: dark tecnológico, clean, premium, vibrante, emocional"
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
    </div>
  );
};

export default CreateCarousel;
