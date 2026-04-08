import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Download, Plus, ArrowLeft, CheckCircle2, Image, Loader2, RefreshCw, Copy, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CreativeResults = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: creatives = [], isLoading } = useQuery({
    queryKey: ["creative-results", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*")
        .eq("request_id", requestId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!user,
  });

  const { data: requestData } = useQuery({
    queryKey: ["creative-request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .eq("id", requestId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId && !!user,
  });

  const copyData = creatives[0]?.copy_data as Record<string, any> | null;

  const handleRegenerate = () => {
    if (!requestData) return;
    navigate("/regenerate", {
      state: {
        prefill: {
          product_name: requestData.product_name,
          promise: requestData.promise,
          pains: requestData.pains,
          benefits: requestData.benefits,
          objections: requestData.objections ?? "",
          cta: requestData.cta ?? "",
          quantity: requestData.quantity,
        },
      },
    });
  };

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `criativo-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, "_blank");
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < creatives.length; i++) {
      await handleDownload(creatives[i].image_url, i);
      if (i < creatives.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
  };

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Carregando resultados...</p>
          </div>
        ) : creatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Image className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-display text-foreground mb-2">Nenhum criativo encontrado</h2>
            <p className="text-muted-foreground mb-6">Não encontramos criativos para esta solicitação.</p>
            <Button variant="hero" onClick={() => navigate("/create")}>
              <Plus className="w-4 h-4" /> Criar Novo
            </Button>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Status badge */}
            <div className="text-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Geração concluída — {creatives.length} criativo{creatives.length > 1 ? "s" : ""} gerado{creatives.length > 1 ? "s" : ""}
              </span>
            </div>

            {/* Summary card */}
            {copyData && (
              <div className="gradient-card rounded-2xl p-6 border border-border shadow-card">
                <h3 className="font-display text-foreground text-lg mb-4">Resumo da Geração</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {copyData.angle_name && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Ângulo</span>
                      <span className="text-foreground font-medium">{copyData.angle_name}</span>
                    </div>
                  )}
                  {copyData.headline && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Headline</span>
                      <span className="text-foreground font-medium">{copyData.headline}</span>
                    </div>
                  )}
                  {copyData.format && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Formato</span>
                      <span className="text-foreground font-medium">{copyData.format}</span>
                    </div>
                  )}
                  {copyData.cta && (
                    <div>
                      <span className="text-muted-foreground block mb-1">CTA</span>
                      <span className="inline-block px-3 py-1 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold">
                        {copyData.cta}
                      </span>
                    </div>
                  )}
                  {copyData.visual_option && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Opção Visual</span>
                      <span className="text-foreground font-medium">{copyData.visual_option}</span>
                    </div>
                  )}
                  {copyData.body && (
                    <div className="md:col-span-2 lg:col-span-3">
                      <span className="text-muted-foreground block mb-1">Body</span>
                      <span className="text-foreground/80 text-xs">{copyData.body}</span>
                    </div>
                  )}
                </div>
                <div className="mt-5 flex justify-center">
                  <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={!requestData} className="w-full sm:w-auto">
                    <RefreshCw className="w-4 h-4" /> Gerar novo com mesmos dados
                  </Button>
                </div>
              </div>
            )}

            {/* Gallery */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display text-foreground">Criativos Gerados</h2>
                {creatives.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                    <Download className="w-4 h-4" /> Baixar Todos
                  </Button>
                )}
              </div>

              <div className={`grid gap-6 ${
                creatives.length === 1 ? "grid-cols-1 max-w-lg mx-auto" :
                creatives.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
              }`}>
                {creatives.map((creative, idx) => (
                  <div
                    key={creative.id}
                    className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden group animate-fade-in"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="relative aspect-square overflow-hidden bg-secondary/30">
                      <img
                        src={creative.image_url}
                        alt={`Criativo ${idx + 1}`}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground font-medium">
                        Criativo {idx + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(creative.image_url, idx)}
                        className="text-primary hover:text-primary"
                      >
                        <Download className="w-4 h-4" /> Baixar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ad Captions */}
            {copyData?.ad_captions && (copyData.ad_captions as any[]).length > 0 && (
              <div className="gradient-card rounded-2xl p-6 border border-border shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <h3 className="font-display text-foreground text-lg">Legendas para o Anúncio</h3>
                </div>
                <div className="space-y-4">
                  {(copyData.ad_captions as any[]).map((item: any, idx: number) => (
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
              <Button variant="hero" onClick={() => navigate("/create")}>
                <Plus className="w-4 h-4" /> Novo Criativo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreativeResults;
