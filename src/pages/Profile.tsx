import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, Coins, Save, Loader2 } from "lucide-react";

const Profile = () => {
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Sync from profile when it loads
  if (profile && !initialized) {
    setName(profile.name ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
    setInitialized(true);
  }

  const displayName = name || profile?.name || "";
  const displayEmail = profile?.email || user?.email || "";
  const initials = displayName
    ? displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : displayEmail.slice(0, 2).toUpperCase();

  const currentAvatar = avatarUrl || profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("generated-creatives")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("generated-creatives")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      // Save to profiles table
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi alterada." });
    } catch (err: any) {
      toast({ title: "Erro ao enviar foto", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name || displayName })
        .eq("user_id", user.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: "Perfil salvo!", description: "Suas informações foram atualizadas." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-display text-foreground mb-2">Meu Perfil</h1>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e créditos.</p>
      </div>

      <div className="space-y-6">
        {/* Avatar */}
        <div className="gradient-card rounded-2xl border border-border shadow-card p-6 animate-fade-in">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="w-20 h-20 border-2 border-border">
                {currentAvatar ? (
                  <AvatarImage src={currentAvatar} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-display">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                ) : (
                  <Camera className="w-5 h-5 text-foreground" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <h2 className="font-display text-lg text-foreground">{displayName || "Sem nome"}</h2>
              <p className="text-sm text-muted-foreground">{displayEmail}</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="gradient-card rounded-2xl border border-border shadow-card p-6 animate-fade-in">
          <h3 className="font-display text-foreground mb-4">Informações</h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-muted-foreground">Nome</Label>
              <Input
                id="name"
                value={name || displayName}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">E-mail</Label>
              <Input value={displayEmail} disabled className="mt-1 opacity-60" />
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </Button>
          </div>
        </div>

        {/* Credits */}
        <div className="gradient-card rounded-2xl border border-border shadow-card p-6 animate-fade-in">
          <h3 className="font-display text-foreground mb-4">Créditos</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-display text-foreground">
                  {credits?.credits_balance ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">créditos disponíveis</p>
              </div>
            </div>
            <Button variant="hero" onClick={() => {
              toast({ title: "Em breve!", description: "A recarga de créditos estará disponível em breve." });
            }}>
              <Coins className="w-4 h-4" />
              Recarregar
            </Button>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Créditos utilizados: <span className="text-foreground font-medium">{credits?.credits_used ?? 0}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
