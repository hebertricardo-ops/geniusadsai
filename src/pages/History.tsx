import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Image, Download, Eye, Clock, Loader2, RefreshCw, Layers, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ type: "creative" | "carousel"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Creative requests
  const { data: requests = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ["all-creative-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Carousel requests
  const { data: carouselRequests = [], isLoading: loadingCarousels } = useQuery({
    queryKey: ["all-carousel-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Creatives by request_id (for regular creatives)
  const { data: creativesMap = {} } = useQuery({
    queryKey: ["all-creatives-by-request", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data) {
        const rid = c.request_id ?? "unknown";
        if (!map[rid]) map[rid] = [];
        map[rid].push(c);
      }
      return map;
    },
    enabled: !!user,
  });

  // Creatives by carousel_request_id
  const { data: carouselCreativesMap = {} } = useQuery({
    queryKey: ["all-creatives-by-carousel", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*")
        .not("carousel_request_id", "is", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data) {
        const rid = (c as any).carousel_request_id ?? "unknown";
        if (!map[rid]) map[rid] = [];
        map[rid].push(c);
      }
      return map;
    },
    enabled: !!user,
  });

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "creative") {
        // Delete associated generated_creatives first, then the request
        await supabase.from("generated_creatives").delete().eq("request_id", deleteTarget.id);
        const { error } = await supabase.from("creative_requests").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      } else {
        // Delete associated generated_creatives first, then the carousel request
        await supabase.from("generated_creatives").delete().eq("carousel_request_id", deleteTarget.id);
        const { error } = await supabase.from("carousel_requests").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      }
      toast({ title: "Excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["all-creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-carousel-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-creatives-by-request"] });
      queryClient.invalidateQueries({ queryKey: ["all-creatives-by-carousel"] });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const isLoading = loadingCreatives || loadingCarousels;

  type HistoryItem =
    | { type: "creative"; data: (typeof requests)[0]; createdAt: string }
    | { type: "carousel"; data: (typeof carouselRequests)[0]; createdAt: string };

  const allItems: HistoryItem[] = [
    ...requests.map((r) => ({ type: "creative" as const, data: r, createdAt: r.created_at })),
    ...carouselRequests.map((r) => ({ type: "carousel" as const, data: r, createdAt: r.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusBadge = (status: string) => {
    if (status === "completed")
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Concluído</span>;
    if (status === "processing")
      return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Processando</span>;
    if (status === "copy_ready")
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Copy pronta</span>;
    return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Pendente</span>;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display text-foreground mb-2">Histórico</h1>
        <p className="text-muted-foreground">
          Todos os criativos e carrosseis gerados. Disponíveis para download por 7 dias.
        </p>
      </div>

      {allItems.length === 0 ? (
        <div className="gradient-card rounded-2xl border border-border p-12 text-center animate-fade-in">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display text-foreground mb-2">Nenhum criativo gerado ainda</h2>
          <p className="text-muted-foreground mb-6">Comece criando seu primeiro criativo com IA.</p>
          <Button variant="hero" onClick={() => navigate("/create")}>
            Criar Primeiro Criativo
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {allItems.map((item) => {
            if (item.type === "creative") {
              const req = item.data;
              const creatives = creativesMap[req.id] ?? [];
              return (
                <div
                  key={`cr-${req.id}`}
                  className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden animate-fade-in"
                >
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-foreground text-lg">{req.product_name}</h3>
                        <Badge variant="outline" className="text-xs">Criativo</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(req.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {req.quantity} crédito{req.quantity > 1 ? "s" : ""}
                        </span>
                        {statusBadge(req.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {creatives.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/results/${req.id}`)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver detalhes
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate("/regenerate", {
                            state: {
                              prefill: {
                                product_name: req.product_name,
                                promise: req.promise,
                                pains: req.pains,
                                benefits: req.benefits,
                                objections: req.objections || "",
                                cta: req.cta || "",
                                quantity: req.quantity,
                              },
                            },
                          })
                        }
                      >
                        <RefreshCw className="w-4 h-4 mr-1" /> Gerar novos
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget({ type: "creative", id: req.id, name: req.product_name })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {creatives.length > 0 ? (
                    <div className="p-5">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {creatives.map((creative) => (
                          <div
                            key={creative.id}
                            className="group relative rounded-xl overflow-hidden border border-border bg-secondary/30"
                          >
                            <img
                              src={creative.image_url}
                              alt="Criativo gerado"
                              className="w-full aspect-square object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  handleDownload(creative.image_url, `criativo-${creative.id.slice(0, 8)}.png`)
                                }
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-background/80 backdrop-blur-sm">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {format(new Date(creative.created_at), "dd/MM")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 text-center text-sm text-muted-foreground">
                      Nenhuma imagem gerada para esta requisição.
                    </div>
                  )}
                </div>
              );
            }

            // Carousel item
            const req = item.data;
            const resultData = req.result_data as any;
            const slides = resultData?.slides || [];
            const carouselCreatives = carouselCreativesMap[req.id] ?? [];

            return (
              <div
                key={`car-${req.id}`}
                className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden animate-fade-in"
              >
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-foreground text-lg">{req.product_name}</h3>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        <Layers className="w-3 h-3 mr-1" /> Carrossel
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(req.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {slides.length} slides • {carouselCreatives.length}/{slides.length} imagens
                      </span>
                      {statusBadge(req.status)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/carousel-results/${req.id}`)}>
                      <Eye className="w-4 h-4 mr-1" /> Ver detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate("/create-carousel", {
                          state: {
                            prefill: {
                              product_name: req.product_name,
                              main_promise: req.main_promise,
                              pain_points: req.pain_points,
                              benefits: req.benefits,
                              objections: req.objections || "",
                              carousel_objective: req.carousel_objective,
                              creative_style: req.creative_style || "",
                              extra_context: req.extra_context || "",
                              slides_count: req.slides_count,
                            },
                          },
                        })
                      }
                    >
                      <Copy className="w-4 h-4 mr-1" /> Gerar Novamente
                    </Button>
                  </div>
                </div>

                {carouselCreatives.length > 0 ? (
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {carouselCreatives.map((creative, idx) => (
                        <div
                          key={creative.id}
                          className="group relative rounded-xl overflow-hidden border border-border bg-secondary/30"
                        >
                          <img
                            src={creative.image_url}
                            alt={`Slide ${idx + 1}`}
                            className="w-full aspect-square object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                handleDownload(creative.image_url, `carrossel-slide-${idx + 1}.png`)
                              }
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              Slide {idx + 1}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    {req.status === "copy_ready"
                      ? "Copy gerada — imagens ainda não foram geradas."
                      : "Nenhuma imagem gerada para este carrossel."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default History;
