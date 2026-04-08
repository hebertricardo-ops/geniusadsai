import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onClose: () => void;
  creditsNeeded: number;
  creditsAvailable: number;
}

const InsufficientCreditsDialog = ({ open, onClose, creditsNeeded, creditsAvailable }: InsufficientCreditsDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Créditos Insuficientes</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-2 space-y-3">
            <p>
              Você não possui créditos suficientes para realizar esta geração.
            </p>
            <div className="flex justify-between items-center rounded-lg bg-muted/50 p-3">
              <span>Créditos necessários:</span>
              <span className="font-semibold text-foreground">{creditsNeeded}</span>
            </div>
            <div className="flex justify-between items-center rounded-lg bg-muted/50 p-3">
              <span>Seu saldo atual:</span>
              <span className="font-semibold text-destructive">{creditsAvailable}</span>
            </div>
            <p>
              Recarregue seus créditos para continuar gerando seus criativos.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="hero" onClick={() => { onClose(); navigate("/dashboard"); }}>
            Recarregar Créditos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InsufficientCreditsDialog;
