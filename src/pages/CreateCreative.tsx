import { useState } from "react";
import { sanitizeFileName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import CreditsBadge from "@/components/CreditsBadge";
import { ArrowLeft, ArrowRight, Sparkles, Zap, Check, Eye, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import InsufficientCreditsDialog from "@/components/InsufficientCreditsDialog";
import GenerationProgress from "@/components/GenerationProgress";

const STEPS = ["Imagens", "Produto", "Persuasão", "CTA"];

interface VisualOption {
  option_label: string;
  visual_description: string;
  element_distribution: string;
  composition: string;
  visual_hierarchy: string;
  layout_style: string;
  cta_highlight: string;
}

interface CopyAngle {
  angle_name: string;
  headline: string;
  subheadline?: string;
  body: string;
  cta: string;
  visual_options: VisualOption[];
}

const CreateCreative = () => {
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<File[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [productName, setProductName] = useState("");
  const [promise, setPromise] = useState("");
  const [pains, setPains] = useState("");
  const [benefits, setBenefits] = useState("");
  const [objections, setObjections] = useState("");
  const [cta, setCta] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedAngles, setGeneratedAngles] = useState<CopyAngle[] | null>(null);
  const [adCaptions, setAdCaptions] = useState<{ caption: string }[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<number | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<number | null>(null);
  const [expandedAngle, setExpandedAngle] = useState<number | null>(null);
  const [format, setFormat] = useState("1:1");
  const [creativeStyle, setCreativeStyle] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [generatingCreative, setGeneratingCreative] = useState(false);
  const [isCreditsDialogOpen, setIsCreditsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();

  const canProceed = () => {
    switch (step) {
      case 0: return images.length > 0;
      case 1: return productName.trim() && promise.trim();
      case 2: return pains.trim() && benefits.trim();
      case 3: return true;
      default: return false;
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    if ((credits?.credits_balance ?? 0) < quantity) {
      setIsCreditsDialogOpen(true);
      return;
    }

    setLoading(true);
    try {
      // 1. Upload images
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (error) throw error;
        imageUrls.push(path);
      }

      // 2. Create request record
      const { data: request, error: reqError } = await supabase
        .from("creative_requests")
        .insert({
          user_id: user.id,
          product_name: productName,
          promise,
          pains,
          benefits,
          objections: objections || null,
          cta: cta || null,
          quantity,
          status: "processing",
        })
        .select()
        .single();
      if (reqError) throw reqError;

      // 3. Generate copy via edge function
      const { data: copyData, error: copyError } = await supabase.functions.invoke("generate-copy", {
        body: { product_name: productName, promise, pains, benefits, objections, cta, creative_style: creativeStyle || undefined },
      });
      if (copyError) throw copyError;

      setGeneratedAngles(copyData.angles);
      setAdCaptions(copyData.ad_captions || []);
      setSelectedAngle(null);
      setSelectedVisual(null);

      // Update request status (copy generated, no credits debited yet - credits only on image generation)
      await supabase
        .from("creative_requests")
        .update({ status: "completed" })
        .eq("id", request.id);

      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });

      toast({ title: "Copies geradas!", description: "Escolha seu ângulo e opção visual." });
    } catch (err: any) {
      console.error(err);
      // Update request status to error if we have a request
      try {
        const { data: lastReq } = await supabase
          .from("creative_requests")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "processing")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastReq?.id) {
          await supabase.from("creative_requests").update({ status: "error" }).eq("id", lastReq.id);
        }
      } catch { /* ignore */ }
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCreative = async () => {
    if (selectedAngle === null || selectedVisual === null || !generatedAngles || !user) return;
    const angle = generatedAngles[selectedAngle];
    const visual = angle.visual_options[selectedVisual];

    if ((credits?.credits_balance ?? 0) < quantity) {
      toast({ title: "Créditos insuficientes", description: "Você não tem créditos suficientes para gerar.", variant: "destructive" });
      return;
    }

    setGeneratingCreative(true);
    try {
      // 1. Get public URLs for uploaded images
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 600); // 10 min expiry
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        imageUrls.push(signedUrlData.signedUrl);
      }

      // 2. Call generate-creative edge function
      const { data: creativeData, error: creativeError } = await supabase.functions.invoke("generate-creative", {
        body: {
          image_urls: imageUrls,
          product_name: productName,
          promise,
          pains,
          benefits,
          objections: objections || null,
          headline: angle.headline,
          body: angle.body,
          cta: angle.cta,
          visual_option: {
            visual_description: visual.visual_description,
            element_distribution: visual.element_distribution,
            composition: visual.composition,
            visual_hierarchy: visual.visual_hierarchy,
            layout_style: visual.layout_style,
            cta_highlight: visual.cta_highlight,
          },
          format,
          quantity,
          creative_style: creativeStyle || undefined,
          additional_instructions: additionalInstructions.trim() || undefined,
        },
      });
      if (creativeError) throw creativeError;

      const generatedImages = creativeData?.images || [];

      // 2b. Get or create a request_id for linking results
      const { data: reqData } = await supabase
        .from("creative_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_name", productName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const requestId = reqData?.id;

      // 3. Save each generated image
      for (const img of generatedImages) {
        const imgUrl = img.url || img;
        await supabase.from("generated_creatives").insert({
          user_id: user.id,
          image_url: imgUrl,
          request_id: requestId || null,
          copy_data: {
            angle_name: angle.angle_name,
            headline: angle.headline,
            subheadline: angle.subheadline,
            body: angle.body,
            cta: angle.cta,
            visual_option: visual.option_label,
            format,
            ad_captions: adCaptions,
          },
          credits_used: 1,
        });
      }

      // 4. Deduct credits (fetch fresh balance to avoid stale state)
      const usedCredits = generatedImages.length || quantity;
      const { data: freshCredits } = await supabase
        .from("user_credits")
        .select("credits_balance, credits_used")
        .eq("user_id", user.id)
        .single();

      if (!freshCredits || freshCredits.credits_balance < usedCredits) {
        throw new Error("Créditos insuficientes");
      }

      await supabase
        .from("user_credits")
        .update({
          credits_balance: freshCredits.credits_balance - usedCredits,
          credits_used: freshCredits.credits_used + usedCredits,
        })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -usedCredits,
        description: `Criativos gerados: ${productName} (${angle.angle_name})`,
      });

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });

      toast({ title: "Criativos gerados!", description: `${generatedImages.length} criativo(s) gerado(s) com sucesso.` });
      if (requestId) {
        navigate(`/results/${requestId}`);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar criativo", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setGeneratingCreative(false);
    }
  };

  const angleLabels = ["🔴 Dor Principal", "🟢 Transformação", "🟡 Quebra de Objeção"];

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {generatedAngles ? (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display text-foreground mb-2">Escolha seu Ângulo e Conceito Visual</h2>
              <p className="text-muted-foreground">3 ângulos × 2 opções visuais = 6 conceitos para "{productName}"</p>
            </div>

            {/* Angle selection */}
            <div className="space-y-6">
              {generatedAngles.map((angle, angleIdx) => (
                <div key={angleIdx} className="space-y-4">
                  {/* Angle header card */}
                  <div
                    className={`gradient-card rounded-2xl p-6 border-2 shadow-card cursor-pointer transition-all duration-200 ${
                      selectedAngle === angleIdx
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    }`}
                    onClick={() => {
                      setSelectedAngle(angleIdx);
                      setSelectedVisual(null);
                      setExpandedAngle(expandedAngle === angleIdx ? null : angleIdx);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                            {angleLabels[angleIdx] || angle.angle_name}
                          </span>
                          {selectedAngle === angleIdx && (
                            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Selecionado
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-display text-foreground">{angle.headline}</h3>
                        {angle.subheadline && (
                          <p className="text-sm text-muted-foreground font-medium">{angle.subheadline}</p>
                        )}
                        <p className="text-sm text-foreground/80">{angle.body}</p>
                        <div className="pt-2">
                          <span className="inline-block px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold">
                            {angle.cta}
                          </span>
                        </div>
                      </div>
                      <Eye className="w-5 h-5 text-muted-foreground mt-1 shrink-0 ml-4" />
                    </div>
                  </div>

                  {/* Visual options - show when angle is expanded */}
                  {(expandedAngle === angleIdx || selectedAngle === angleIdx) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 animate-fade-in">
                      {angle.visual_options.map((visual, visIdx) => (
                        <div
                          key={visIdx}
                          className={`rounded-xl p-5 border-2 cursor-pointer transition-all duration-200 ${
                            selectedAngle === angleIdx && selectedVisual === visIdx
                              ? "bg-primary/5 border-primary ring-2 ring-primary/20"
                              : "bg-background/50 border-border hover:border-primary/40"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAngle(angleIdx);
                            setSelectedVisual(visIdx);
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-display text-sm text-foreground">
                                {visual.option_label}
                              </span>
                              {selectedAngle === angleIdx && selectedVisual === visIdx && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{visual.visual_description}</p>
                            <div className="space-y-2 text-xs">
                              <div>
                                <span className="font-semibold text-foreground/70">Elementos:</span>{" "}
                                <span className="text-muted-foreground">{visual.element_distribution}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-foreground/70">Composição:</span>{" "}
                                <span className="text-muted-foreground">{visual.composition}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-foreground/70">Hierarquia:</span>{" "}
                                <span className="text-muted-foreground">{visual.visual_hierarchy}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-foreground/70">Layout:</span>{" "}
                                <span className="text-muted-foreground">{visual.layout_style}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-foreground/70">CTA:</span>{" "}
                                <span className="text-muted-foreground">{visual.cta_highlight}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Format selector */}
            {selectedAngle !== null && selectedVisual !== null && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-lg font-display text-foreground text-center">Formato do Criativo</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
                  {[
                    { value: "1:1", label: "1:1", desc: "Feed" },
                    { value: "4:5", label: "4:5", desc: "Feed vertical" },
                    { value: "9:16", label: "9:16", desc: "Stories/Reels" },
                    { value: "16:9", label: "16:9", desc: "Landscape" },
                  ].map((f) => (
                    <div
                      key={f.value}
                      className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-center ${
                        format === f.value
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 bg-background/50"
                      }`}
                      onClick={() => setFormat(f.value)}
                    >
                      <span className="font-display text-foreground">{f.label}</span>
                      <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generation progress overlay */}
            <GenerationProgress
              isActive={generatingCreative}
              type="creative"
              onTimeout={() => {
                toast({ title: "Geração demorada", description: "O processo está demorando mais que o esperado. Se persistir, tente novamente.", variant: "destructive" });
              }}
            />

            {/* Actions */}
            <div className="flex gap-4 justify-center pt-4">
              <Button variant="outline" onClick={() => { setGeneratedAngles(null); setStep(0); setImages([]); }}>
                Novo Criativo
              </Button>
              <Button
                variant="hero"
                onClick={handleGenerateCreative}
                disabled={selectedAngle === null || selectedVisual === null || generatingCreative}
              >
                {generatingCreative ? "Gerando criativo..." : <><Sparkles className="w-4 h-4" /> Gerar Criativo</>}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-10"><Stepper steps={STEPS} currentStep={step} /></div>
            <div className="gradient-card rounded-2xl p-8 shadow-card border border-border animate-fade-in">
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-display text-foreground mb-2">Envie suas imagens</h2>
                    <p className="text-muted-foreground text-sm">Faça upload das imagens do produto (máx. 4)</p>
                  </div>
                  <ImageUpload images={images} onImagesChange={setImages} />
                  <div className="space-y-3">
                    <h2 className="text-xl font-display text-foreground">Quantidade de criativos</h2>
                    <div className="flex gap-3">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setQuantity(num)}
                          className={`flex items-center justify-center w-14 h-14 rounded-xl border-2 text-lg font-bold transition-all duration-200 ${
                            quantity === num
                              ? "border-primary bg-primary/10 text-primary shadow-md scale-105"
                              : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                   <p className="text-xs text-muted-foreground">Cada criativo consome 1 crédito</p>
                  </div>

                  {/* Estilo Principal do Criativo */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-display text-foreground">Estilo do Criativo</h2>
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
                </div>
              )}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-display text-foreground mb-2">Sobre o produto</h2>
                    <p className="text-muted-foreground text-sm">Informações para gerar a copy do anúncio</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Nome do produto *</Label>
                      <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Sérum Vitamina C Premium" className="bg-background/50 border-border" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Promessa principal *</Label>
                      <Textarea value={promise} onChange={(e) => setPromise(e.target.value)} placeholder="Ex: Pele mais jovem e radiante em 30 dias" className="bg-background/50 border-border resize-none" rows={3} />
                    </div>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-display text-foreground mb-2">Elementos de persuasão</h2>
                    <p className="text-muted-foreground text-sm">Dores, benefícios e objeções do público-alvo</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Dores do público *</Label>
                      <Textarea value={pains} onChange={(e) => setPains(e.target.value)} placeholder="Ex: Manchas, rugas precoces, pele sem vida" className="bg-background/50 border-border resize-none" rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Benefícios *</Label>
                      <Textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="Ex: Reduz manchas, ilumina a pele, antioxidante" className="bg-background/50 border-border resize-none" rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Objeções comuns (opcional)</Label>
                      <Textarea value={objections} onChange={(e) => setObjections(e.target.value)} placeholder='Ex: "É caro", "Será que funciona?"' className="bg-background/50 border-border resize-none" rows={2} />
                    </div>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-display text-foreground mb-2">Call to Action</h2>
                    <p className="text-muted-foreground text-sm">Defina o CTA do seu anúncio (opcional)</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm text-muted-foreground">Sugestões de CTA</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Clique em Saiba Mais", "Fale Conosco", "Assistir Mais", "Cadastre-se Agora", "Obter Oferta"].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setCta(suggestion)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            cta === suggestion
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background/50 text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                    <Label className="text-sm text-muted-foreground">CTA personalizado</Label>
                    <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder='Ex: "Compre agora com 30% OFF"' className="bg-background/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Orientações adicionais (opcional)</Label>
                    <Textarea
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      placeholder="Ex: Usar a imagem do produto como elemento central, incluir selo de garantia, adicionar efeito de brilho no fundo..."
                      className="bg-background/50 border-border resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="bg-background/30 rounded-xl p-5 border border-border space-y-3">
                    <h3 className="font-display text-sm text-foreground">Resumo</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Imagens:</span> <span className="text-foreground">{images.length}</span></div>
                      <div><span className="text-muted-foreground">Criativos:</span> <span className="text-foreground">{quantity}</span></div>
                      <div><span className="text-muted-foreground">Produto:</span> <span className="text-foreground">{productName}</span></div>
                      <div><span className="text-muted-foreground">Créditos:</span> <span className="text-primary font-semibold">{quantity}</span></div>
                    </div>
                  </div>
                </div>
              )}

              <GenerationProgress
                isActive={loading}
                type="copy"
                onTimeout={() => {
                  toast({ title: "Geração demorada", description: "A geração de copy está demorando mais que o esperado. Aguarde ou tente novamente.", variant: "destructive" });
                }}
              />

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button variant="hero" onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                    Próximo <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button variant="hero" onClick={handleGenerate} disabled={loading}>
                    {loading ? "Gerando copy..." : <><Sparkles className="w-4 h-4" /> Gerar variações de copy</>}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <InsufficientCreditsDialog
        open={isCreditsDialogOpen}
        onClose={() => setIsCreditsDialogOpen(false)}
        creditsNeeded={quantity}
        creditsAvailable={credits?.credits_balance ?? 0}
      />
    </div>
  );
};

export default CreateCreative;
