import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import CreditsBadge from "@/components/CreditsBadge";
import { ArrowLeft, ArrowRight, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const STEPS = ["Imagens", "Produto", "Persuasão", "CTA"];

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
  const [generatedCopies, setGeneratedCopies] = useState<any[] | null>(null);
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
      toast({ title: "Créditos insuficientes", description: "Você não tem créditos suficientes.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Upload images
      const imageUrls: string[] = [];
      for (const file of images) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
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
        body: { product_name: productName, promise, pains, benefits, objections, cta },
      });
      if (copyError) throw copyError;

      setGeneratedCopies(copyData.copies);

      // 4. Deduct credits
      await supabase
        .from("user_credits")
        .update({
          credits_balance: (credits?.credits_balance ?? 0) - quantity,
          credits_used: (credits?.credits_used ?? 0) + quantity,
        })
        .eq("user_id", user.id);

      // 5. Log transaction
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        type: "usage",
        amount: -quantity,
        description: `Geração de criativos: ${productName}`,
      });

      // 6. Update request status
      await supabase
        .from("creative_requests")
        .update({ status: "completed" })
        .eq("id", request.id);

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });

      toast({ title: "Copies geradas!", description: "Suas variações de copy estão prontas." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao gerar", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">CreativeAI</span>
        </div>
        <div className="flex items-center gap-4">
          <CreditsBadge credits={credits?.credits_balance ?? 0} />
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {generatedCopies ? (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">Copies Geradas 🎉</h2>
              <p className="text-muted-foreground">3 ângulos de copy para "{productName}"</p>
            </div>
            {generatedCopies.map((copy: any, i: number) => (
              <div key={i} className="gradient-card rounded-2xl p-6 border border-border shadow-card space-y-3">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">{copy.angle_name}</span>
                <h3 className="text-xl font-display font-bold text-foreground">{copy.headline}</h3>
                <p className="text-sm text-muted-foreground font-medium">{copy.subheadline}</p>
                <p className="text-sm text-foreground/80">{copy.body}</p>
                <div className="pt-2">
                  <span className="inline-block px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-semibold">{copy.cta}</span>
                </div>
              </div>
            ))}
            <div className="flex gap-4 justify-center pt-4">
              <Button variant="outline" onClick={() => { setGeneratedCopies(null); setStep(0); setImages([]); }}>
                Novo Criativo
              </Button>
              <Button variant="hero" onClick={() => navigate("/dashboard")}>
                Ir para Dashboard
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
                    <h2 className="text-xl font-display font-bold text-foreground mb-2">Envie suas imagens</h2>
                    <p className="text-muted-foreground text-sm">Faça upload das imagens do produto (máx. 4)</p>
                  </div>
                  <ImageUpload images={images} onImagesChange={setImages} />
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Quantidade de criativos (1-5)</Label>
                    <Input type="number" min={1} max={5} value={quantity} onChange={(e) => setQuantity(Math.min(5, Math.max(1, parseInt(e.target.value) || 1)))} className="bg-background/50 border-border w-24" />
                    <p className="text-xs text-muted-foreground">Cada criativo consome 1 crédito</p>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-display font-bold text-foreground mb-2">Sobre o produto</h2>
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
                    <h2 className="text-xl font-display font-bold text-foreground mb-2">Elementos de persuasão</h2>
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
                    <h2 className="text-xl font-display font-bold text-foreground mb-2">Call to Action</h2>
                    <p className="text-muted-foreground text-sm">Defina o CTA do seu anúncio (opcional)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">CTA personalizado</Label>
                    <Input value={cta} onChange={(e) => setCta(e.target.value)} placeholder='Ex: "Compre agora com 30% OFF"' className="bg-background/50 border-border" />
                  </div>
                  <div className="bg-background/30 rounded-xl p-5 border border-border space-y-3">
                    <h3 className="font-display font-semibold text-sm text-foreground">Resumo</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Imagens:</span> <span className="text-foreground">{images.length}</span></div>
                      <div><span className="text-muted-foreground">Criativos:</span> <span className="text-foreground">{quantity}</span></div>
                      <div><span className="text-muted-foreground">Produto:</span> <span className="text-foreground">{productName}</span></div>
                      <div><span className="text-muted-foreground">Créditos:</span> <span className="text-primary font-semibold">{quantity}</span></div>
                    </div>
                  </div>
                </div>
              )}

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
                    {loading ? "Gerando..." : <><Sparkles className="w-4 h-4" /> Gerar Criativos</>}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateCreative;
