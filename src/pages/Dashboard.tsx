import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, ArrowRight, Lightbulb, ImageIcon } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: credits } = useCredits();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split("@")[0] || "usuário";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const avatarUrl = user
    ? supabase.storage.from("creative-uploads").getPublicUrl(`${user.id}/avatar.png`).data.publicUrl
    : null;

  const { data: recentCreatives = [] } = useQuery({
    queryKey: ["recent-creatives", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_creatives")
        .select("*, creative_requests(product_name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: totalCreatives = 0 } = useQuery({
    queryKey: ["total-creatives", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_creatives")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });

  const CreativeCard = ({ item, index }: { item: any; index: number }) => {
    const productName = item.creative_requests?.product_name || "Criativo";
    return (
      <div
        className="group rounded-xl overflow-hidden border border-border shadow-card animate-fade-in cursor-pointer bg-secondary/30"
        style={{ animationDelay: `${index * 80}ms` }}
        onClick={() => navigate(`/results/${item.request_id}`)}
      >
        {/* Image container — object-contain so full creative is always visible */}
        <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden">
          <img
            src={item.image_url}
            alt={productName}
            className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {/* Info bar — always visible, never overlaps the image */}
        <div className="p-3 flex flex-col gap-1 border-t border-border">
          <span className="text-foreground font-display text-sm font-medium truncate">
            {productName}
          </span>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {format(new Date(item.created_at), "dd/MM/yyyy")}
            </span>
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {item.credits_used}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10 animate-fade-in flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/profile")} className="cursor-pointer">
              <Avatar className="w-14 h-14 border-2 border-border hover:border-primary transition-colors">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-lg font-display">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
            <div>
              <h1 className="text-3xl md:text-4xl font-display text-foreground mb-1">
                Olá, {displayName} 👋
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground">
                Pronto para criar anúncios que convertem?
              </p>
            </div>
          </div>
          <Button variant="hero" size="lg" onClick={() => navigate("/create")}>
            <Plus className="w-5 h-5" />
            Novo Criativo
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats + Dica Pro */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Sparkles, label: "Créditos disponíveis", value: String(credits?.credits_balance ?? 0), color: "text-primary" },
            { icon: ImageIcon, label: "Criativos gerados", value: String(totalCreatives), color: "text-foreground" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="gradient-card rounded-xl p-5 border border-border shadow-card animate-fade-in">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className={`text-2xl font-display ${color}`}>{value}</span>
            </div>
          ))}
          <div className="rounded-xl p-5 border border-primary/40 bg-primary/5 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-primary" />
              <span className="font-display text-primary">Dica Pro</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Seja específico nas dores do seu cliente. A IA gera melhores ângulos quando entende o problema real.
            </p>
          </div>
        </div>

        {/* Portfólio - Histórico */}
        <div className="gradient-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-display text-foreground">Histórico recente</h2>
            <p className="text-sm text-muted-foreground">Seus últimos criativos gerados</p>
          </div>

          {recentCreatives.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              Nenhum criativo gerado ainda. Comece criando seu primeiro!
            </div>
          ) : (
            <>
              {/* Desktop: grid 3×2 */}
              <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 gap-4 p-6">
                {recentCreatives.map((item: any, i: number) => (
                  <CreativeCard key={item.id} item={item} index={i} />
                ))}
              </div>

              {/* Mobile: carrossel */}
              <div className="sm:hidden p-4">
                <Carousel opts={{ align: "start", loop: true }} className="w-full">
                  <CarouselContent className="-ml-3">
                    {recentCreatives.map((item: any, i: number) => (
                      <CarouselItem key={item.id} className="pl-3 basis-[85%]">
                        <CreativeCard item={item} index={i} />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="-left-3 bg-background/80 border-border" />
                  <CarouselNext className="-right-3 bg-background/80 border-border" />
                </Carousel>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
