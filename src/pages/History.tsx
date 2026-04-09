import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Image, Download, Eye, Clock, Loader2, RefreshCw, Layers, Copy, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreativeItem = {
  id: string;
  image_url: string;
  created_at: string;
  request_id: string | null;
  carousel_request_id: string | null;
  copy_data: any;
  credits_used: number;
};

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCreative, setSelectedCreative] = useState<CreativeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "creative" | "carousel"; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // All generated creatives
  const { data: allCreatives = [], isLoading: loadingCreatives } = useQuery({
    queryKey: ["gallery-creatives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CreativeItem[];
    },
    enabled: !!user,
  });

  // Creative requests (for detail info)
  const { data: creativeRequests = [] } = useQuery({
    queryKey: ["all-creative-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("creative_requests").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Carousel requests (for detail info)
  const { data: carouselRequests = [] } = useQuery({
    queryKey: ["all-carousel-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("carousel_requests").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const creativeRequestsMap = useMemo(() => {
    const map: Record<string, (typeof creativeRequests)[0]> = {};
    for (const r of creativeRequests) map[r.id] = r;
    return map;
  }, [creativeRequests]);

  const carouselRequestsMap = useMemo(() => {
    const map: Record<string, (typeof carouselRequests)[0]> = {};
    for (const r of carouselRequests) map[r.id] = r;
    return map;
  }, [carouselRequests]);

  const getRequestInfo = useCallback((creative: CreativeItem) => {
    if (creative.request_id && creativeRequestsMap[creative.request_id]) {
      const req = creativeRequestsMap[creative.request_id];
      return { type: "creative" as const, name: req.product_name, request: req };
    }
    if (creative.carousel_request_id && carouselRequestsMap[creative.carousel_request_id]) {
      const req = carouselRequestsMap[creative.carousel_request_id];
      return { type: "carousel" as const, name: req.product_name, request: req };
    }
    return null;
  }, [creativeRequestsMap, carouselRequestsMap]);

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

  const handleRegenerate = (creative: CreativeItem) => {
    const info = getRequestInfo(creative);
    if (!info) return;

    if (info.type === "creative") {
      const req = info.request;
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
      });
    } else {
      const req = info.request;
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
      });
    }
    setSelectedCreative(null);
  };

  const confirmDelete = (creative: CreativeItem) => {
    const info = getRequestInfo(creative);
    if (!info) return;
    setDeleteTarget({
      id: info.type === "creative" ? creative.request_id! : creative.carousel_request_id!,
      type: info.type,
      name: info.name,
    });
    setSelectedCreative(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "creative") {
        await supabase.from("generated_creatives").delete().eq("request_id", deleteTarget.id);
        const { error } = await supabase.from("creative_requests").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      } else {
        await supabase.from("generated_creatives").delete().eq("carousel_request_id", deleteTarget.id);
        const { error } = await supabase.from("carousel_requests").delete().eq("id", deleteTarget.id);
        if (error) throw error;
      }
      toast({ title: "Excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["gallery-creatives"] });
      queryClient.invalidateQueries({ queryKey: ["all-creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-carousel-requests"] });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Navigation between creatives
  const selectedIndex = selectedCreative ? allCreatives.findIndex(c => c.id === selectedCreative.id) : -1;
  const goToPrev = () => {
    if (selectedIndex > 0) setSelectedCreative(allCreatives[selectedIndex - 1]);
  };
  const goToNext = () => {
    if (selectedIndex < allCreatives.length - 1) setSelectedCreative(allCreatives[selectedIndex + 1]);
  };

  if (loadingCreatives) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display text-foreground mb-2">Minha Galeria</h1>
        <p className="text-muted-foreground">
          Todos os seus criativos gerados. Clique em qualquer imagem para ver detalhes.
        </p>
      </div>

      {allCreatives.length === 0 ? (
        <div className="gradient-card rounded-2xl border border-border p-12 text-center animate-fade-in">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display text-foreground mb-2">Nenhum criativo gerado ainda</h2>
          <p className="text-muted-foreground mb-6">Comece criando seu primeiro criativo com IA.</p>
          <Button variant="hero" onClick={() => navigate("/create")}>
            Criar Primeiro Criativo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
          {allCreatives.map((creative) => {
            const info = getRequestInfo(creative);
            return (
              <div
                key={creative.id}
                className="group relative rounded-xl overflow-hidden border border-border bg-secondary/30 cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:scale-[1.02]"
                onClick={() => setSelectedCreative(creative)}
              >
                <img
                  src={creative.image_url}
                  alt="Criativo"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium truncate">
                      {info?.name || "Criativo"}
                    </span>
                    {info?.type === "carousel" && (
                      <Layers className="w-3 h-3 text-primary shrink-0 ml-1" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {format(new Date(creative.created_at), "dd/MM/yy")}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedCreative} onOpenChange={(open) => !open && setSelectedCreative(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {selectedCreative && (() => {
            const info = getRequestInfo(selectedCreative);
            return (
              <div className="flex flex-col md:flex-row">
                {/* Image side */}
                <div className="relative md:w-1/2 bg-secondary/30 flex items-center justify-center min-h-[300px]">
                  <img
                    src={selectedCreative.image_url}
                    alt="Criativo"
                    className="w-full h-full object-contain max-h-[70vh]"
                  />
                  {/* Nav arrows */}
                  {selectedIndex > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-background transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-foreground" />
                    </button>
                  )}
                  {selectedIndex < allCreatives.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); goToNext(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 hover:bg-background transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>
                  )}
                </div>

                {/* Info side */}
                <div className="md:w-1/2 p-6 flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                      {info?.name || "Criativo"}
                      {info?.type === "carousel" && (
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                          <Layers className="w-3 h-3 mr-1" /> Carrossel
                        </Badge>
                      )}
                      {info?.type === "creative" && (
                        <Badge variant="outline" className="text-xs">Criativo</Badge>
                      )}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mt-4 space-y-3 flex-1 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {format(new Date(selectedCreative.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    </div>

                    {info?.type === "creative" && info.request && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <p><span className="font-medium text-foreground">Promessa:</span> {info.request.promise}</p>
                        <p><span className="font-medium text-foreground">Dores:</span> {info.request.pains}</p>
                        <p><span className="font-medium text-foreground">Benefícios:</span> {info.request.benefits}</p>
                        {info.request.cta && <p><span className="font-medium text-foreground">CTA:</span> {info.request.cta}</p>}
                      </div>
                    )}

                    {info?.type === "carousel" && info.request && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <p><span className="font-medium text-foreground">Promessa:</span> {info.request.main_promise}</p>
                        <p><span className="font-medium text-foreground">Dores:</span> {info.request.pain_points}</p>
                        <p><span className="font-medium text-foreground">Benefícios:</span> {info.request.benefits}</p>
                        <p><span className="font-medium text-foreground">Objetivo:</span> {info.request.carousel_objective}</p>
                      </div>
                    )}

                    {selectedCreative.copy_data && (
                      <div className="space-y-1 pt-2 border-t border-border">
                        <p className="font-medium text-foreground text-xs uppercase tracking-wide">Copy</p>
                        {(selectedCreative.copy_data as any)?.headline && (
                          <p className="text-foreground font-semibold">{(selectedCreative.copy_data as any).headline}</p>
                        )}
                        {(selectedCreative.copy_data as any)?.body_text && (
                          <p className="text-muted-foreground text-xs">{(selectedCreative.copy_data as any).body_text}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(selectedCreative.image_url, `criativo-${selectedCreative.id.slice(0, 8)}.png`)}
                    >
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                    {info && (
                      <Button size="sm" variant="outline" onClick={() => handleRegenerate(selectedCreative)}>
                        <RefreshCw className="w-4 h-4 mr-1" /> Gerar novos
                      </Button>
                    )}
                    {info?.type === "creative" && selectedCreative.request_id && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/results/${selectedCreative.request_id}`)}>
                        <Eye className="w-4 h-4 mr-1" /> Ver todos
                      </Button>
                    )}
                    {info?.type === "carousel" && selectedCreative.carousel_request_id && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/carousel-results/${selectedCreative.carousel_request_id}`)}>
                        <Eye className="w-4 h-4 mr-1" /> Ver todos
                      </Button>
                    )}
                    {info && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => confirmDelete(selectedCreative)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir do histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.name}"? Esta ação não pode ser desfeita e todas as imagens associadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default History;
