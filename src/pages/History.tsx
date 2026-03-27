import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Image, Download, Eye, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: requests = [], isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display text-foreground mb-2">
          Histórico de Criativos
        </h1>
        <p className="text-muted-foreground">
          Todos os criativos gerados. Disponíveis para download por 7 dias.
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="gradient-card rounded-2xl border border-border p-12 text-center animate-fade-in">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-display font-semibold text-foreground mb-2">
            Nenhum criativo gerado ainda
          </h2>
          <p className="text-muted-foreground mb-6">
            Comece criando seu primeiro criativo com IA.
          </p>
          <Button variant="hero" onClick={() => navigate("/create")}>
            Criar Primeiro Criativo
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {requests.map((req) => {
            const creatives = creativesMap[req.id] ?? [];
            return (
              <div
                key={req.id}
                className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden animate-fade-in"
              >
                <div className="p-5 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-foreground text-lg">
                      {req.product_name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(req.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {req.quantity} crédito{req.quantity > 1 ? "s" : ""}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          req.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : req.status === "processing"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {req.status === "completed"
                          ? "Concluído"
                          : req.status === "processing"
                          ? "Processando"
                          : "Pendente"}
                      </span>
                    </div>
                  </div>
                  {creatives.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/results/${req.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver detalhes
                    </Button>
                  )}
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
                                handleDownload(
                                  creative.image_url,
                                  `criativo-${creative.id.slice(0, 8)}.png`
                                )
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
          })}
        </div>
      )}
    </div>
  );
};

export default History;
