import { useState, useCallback } from "react";
import { sanitizeFileName } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ImageUpload from "@/components/ImageUpload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import CreditsBadge from "@/components/CreditsBadge";
import { Sparkles, Loader2, Check, Eye, Package, Target, ShieldAlert, MessageSquare, Zap } from "lucide-react";
import GenerationProgress from "@/components/GenerationProgress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

interface PrefillData {
  product_name: string;
  promise: string;
  pains: string;
  benefits: string;
  objections: string;
  cta: string;
  quantity: number;
}

const RegenerateCreative = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as any)?.prefill as PrefillData | undefined;
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const queryClient = useQueryClient();

  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedAngles, setGeneratedAngles] = useState<CopyAngle[] | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<number | null>(null);
  const [selectedVisual, setSelectedVisual] = useState<number | null>(null);
  const [expandedAngle, setExpandedAngle] = useState<number | null>(null);
  const [format, setFormat] = useState("1:1");
  const [generatingCreative, setGeneratingCreative] = useState(false);
  const [productName, setProductName] = useState(prefill?.product_name ?? "");
  const [promise, setPromise] = useState(prefill?.promise ?? "");
  const [pains, setPains] = useState(prefill?.pains ?? "");
  const [benefits, setBenefits] = useState(prefill?.benefits ?? "");
  const [objections, setObjections] = useState(prefill?.objections ?? "");
  const [cta, setCta] = useState(prefill?.cta ?? "");
  const [quantity, setQuantity] = useState(prefill?.quantity ?? 1);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [creativeStyle, setCreativeStyle] = useState("");

  if (!prefill) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Nenhuma informação de criativo encontrada.</p>
        <Button variant="hero" onClick={() => navigate("/history")}>Voltar ao Histórico</Button>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!user || images.length === 0) {
      toast({ title: "Imagem obrigatória", description: "Faça upload de pelo menos uma imagem.", variant: "destructive" });
      return;
    }
    if ((credits?.credits_balance ?? 0) < quantity) {
      toast({ title: "Créditos insuficientes", description: "Você não tem créditos suficientes.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (error) throw error;
        imageUrls.push(path);
      }

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

      const { data: copyData, error: copyError } = await supabase.functions.invoke("generate-copy", {
        body: { product_name: productName, promise, pains, benefits, objections, cta, creative_style: creativeStyle || undefined },
      });
      if (copyError) throw copyError;

      setGeneratedAngles(copyData.angles);
      setSelectedAngle(null);
      setSelectedVisual(null);

      await supabase
        .from("user_credits")
        .update({
          credits_balance: (credits?.credits_balance ?? 0) - quantity,
          credits_used: (credits?.credits_used ?? 0) + quantity,
        })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -quantity,
        description: `Regeneração de criativos: ${productName}`,
      });

      await supabase
        .from("creative_requests")
        .update({ status: "completed" })
        .eq("id", request.id);

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });

      toast({ title: "Copies geradas!", description: "Escolha seu ângulo e opção visual." });
    } catch (err: any) {
      console.error(err);
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
      toast({ title: "Créditos insuficientes", variant: "destructive" });
      return;
    }

    setGeneratingCreative(true);
    try {
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("creative-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
          .from("creative-uploads")
          .createSignedUrl(path, 600);
        if (signedUrlErr || !signedUrlData?.signedUrl) throw new Error("Failed to create signed URL");
        imageUrls.push(signedUrlData.signedUrl);
      }

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

      const { data: reqData } = await supabase
        .from("creative_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_name", productName)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const requestId = reqData?.id;

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
          },
          credits_used: 1,
        });
      }

      const usedCredits = generatedImages.length || quantity;
      await supabase
        .from("user_credits")
        .update({
          credits_balance: (credits?.credits_balance ?? 0) - usedCredits,
          credits_used: (credits?.credits_used ?? 0) + usedCredits,
        })
        .eq("user_id", user.id);

      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -usedCredits,
        description: `Criativos regenerados: ${productName} (${angle.angle_name})`,
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

  const editableFields = [
    { icon: Package, label: "Produto", value: productName, onChange: setProductName, type: "input" as const },
    { icon: Target, label: "Promessa", value: promise, onChange: setPromise, type: "input" as const },
    { icon: ShieldAlert, label: "Dores", value: pains, onChange: setPains, type: "textarea" as const },
    { icon: Sparkles, label: "Benefícios", value: benefits, onChange: setBenefits, type: "textarea" as const },
    { icon: MessageSquare, label: "Objeções", value: objections, onChange: setObjections, type: "textarea" as const },
    { icon: Zap, label: "CTA", value: cta, onChange: setCta, type: "input" as const },
    { icon: MessageSquare, label: "Orientações adicionais", value: additionalInstructions, onChange: setAdditionalInstructions, type: "textarea" as const },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-display text-foreground mb-1">Gerar Novos Criativos</h1>
        <p className="text-muted-foreground text-sm">
          Dados do criativo anterior pré-carregados. Faça upload de novas imagens e gere.
        </p>
      </div>

      {!generatedAngles ? (
        <div className="space-y-6 animate-fade-in">
          {/* Image upload */}
          <div className="gradient-card rounded-2xl border border-border p-6">
            <h2 className="font-display text-foreground text-lg mb-4">📷 Imagens do Produto</h2>
            <ImageUpload images={images} onImagesChange={setImages} maxImages={4} />
          </div>

          {/* Editable fields */}
          <div className="gradient-card rounded-2xl border border-border p-6">
            <h2 className="font-display text-foreground text-lg mb-5">📋 Dados do Criativo</h2>
            <div className="space-y-5">
              {editableFields.map(({ icon: Icon, label, value, onChange, type }) => (
                <div key={label}>
                  {label === "CTA" && (
                    <div className="mb-3">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Sugestões de CTA</Label>
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
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="mt-2 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</Label>
                      {type === "textarea" ? (
                        <Textarea
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          className="text-sm min-h-[72px] bg-background/50"
                        />
                      ) : (
                        <Input
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          className="text-sm bg-background/50"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3">
                <div className="mt-2 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantidade</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all text-sm font-display ${
                          quantity === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background/50 text-muted-foreground hover:border-primary/40"
                        }`}
                        onClick={() => setQuantity(n)}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Estilo do Criativo */}
              <div className="pt-4 border-t border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Estilo do Criativo</h3>
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
                  <p className="text-xs text-muted-foreground mt-2">Nenhum estilo selecionado — a IA escolherá automaticamente.</p>
                )}
              </div>
            </div>
          </div>

          <GenerationProgress
            isActive={loading}
            type="copy"
            onTimeout={() => {
              toast({ title: "Geração demorada", description: "A geração está demorando mais que o esperado.", variant: "destructive" });
            }}
          />

          {/* Generate button */}
          <div className="flex items-center justify-between pt-2">
            <CreditsBadge credits={credits?.credits_balance ?? 0} />
            <Button
              variant="hero"
              size="lg"
              onClick={handleGenerate}
              disabled={loading || images.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando copies…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Gerar Ângulos de Copy
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Angle selection — same as CreateCreative */
        <div className="space-y-8 animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-display text-foreground mb-2">Escolha seu Ângulo e Conceito Visual</h2>
            <p className="text-muted-foreground">3 ângulos × 2 opções visuais = 6 conceitos para "{productName}"</p>
          </div>

          <div className="space-y-6">
            {generatedAngles.map((angle, angleIdx) => (
              <div key={angleIdx} className="space-y-4">
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

          <GenerationProgress
            isActive={generatingCreative}
            type="creative"
            onTimeout={() => {
              toast({ title: "Geração demorada", description: "A geração do criativo está demorando mais que o esperado.", variant: "destructive" });
            }}
          />

          <div className="flex gap-4 justify-center pt-4">
            <Button variant="outline" onClick={() => setGeneratedAngles(null)}>
              Voltar ao Resumo
            </Button>
            <Button
              variant="hero"
              onClick={handleGenerateCreative}
              disabled={selectedAngle === null || selectedVisual === null || generatingCreative}
            >
              {generatingCreative ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Gerando criativos…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Gerar Criativos Finais
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegenerateCreative;
