import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateCreative from "./pages/CreateCreative";
import CreateCarousel from "./pages/CreateCarousel";
import CreativeResults from "./pages/CreativeResults";
import CarouselResults from "./pages/CarouselResults";
import History from "./pages/History";
import Profile from "./pages/Profile";
import RegenerateCreative from "./pages/RegenerateCreative";
import PaymentSuccess from "./pages/PaymentSuccess";
import ChangePassword from "./pages/ChangePassword";
import AddCredits from "./pages/AddCredits";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedWithLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />
            <Route path="/create" element={<ProtectedWithLayout><CreateCreative /></ProtectedWithLayout>} />
            <Route path="/create-carousel" element={<ProtectedWithLayout><CreateCarousel /></ProtectedWithLayout>} />
            <Route path="/results/:requestId" element={<ProtectedWithLayout><CreativeResults /></ProtectedWithLayout>} />
            <Route path="/carousel-results/:requestId" element={<ProtectedWithLayout><CarouselResults /></ProtectedWithLayout>} />
            <Route path="/history" element={<ProtectedWithLayout><History /></ProtectedWithLayout>} />
            <Route path="/regenerate" element={<ProtectedWithLayout><RegenerateCreative /></ProtectedWithLayout>} />
            <Route path="/add-credits" element={<ProtectedWithLayout><AddCredits /></ProtectedWithLayout>} />
            <Route path="/profile" element={<ProtectedWithLayout><Profile /></ProtectedWithLayout>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
