import { Coins } from "lucide-react";

interface CreditsBadgeProps {
  credits: number;
}

const CreditsBadge = ({ credits }: CreditsBadgeProps) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border">
      <Coins className="w-4 h-4 text-primary" />
      <span className="text-sm font-display text-foreground">
        {credits}
      </span>
      <span className="text-xs text-muted-foreground">créditos</span>
    </div>
  );
};

export default CreditsBadge;
