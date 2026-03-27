import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import CreditsBadge from "@/components/CreditsBadge";
import { useCredits } from "@/hooks/useCredits";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { data: credits } = useCredits();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full gradient-hero">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <CreditsBadge credits={credits?.credits_balance ?? 0} />
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
