import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";

const ChangePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error("Erro ao alterar senha: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="gradient-card rounded-2xl p-10 border border-border shadow-card max-w-md w-full">
        <div className="text-center mb-8">
          <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-display text-foreground mb-2">Alterar senha</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, altere sua senha temporária antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password" className="text-foreground">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-foreground">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
            />
          </div>

          <Button variant="hero" type="submit" className="w-full" disabled={loading}>
            {loading ? "Alterando..." : "Alterar senha e continuar"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
