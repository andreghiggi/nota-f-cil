import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Empresas from "./pages/Empresas";
import NFCe from "./pages/NFCe";
import Certificados from "./pages/Certificados";
import Tokens from "./pages/Tokens";
import Webhooks from "./pages/Webhooks";
import Logs from "./pages/Logs";
import Configuracoes from "./pages/Configuracoes";
import DocumentacaoAPI from "./pages/DocumentacaoAPI";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/docs" element={<DocumentacaoAPI />} />
          <Route path="*" element={
            <AuthProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/empresas" element={<ProtectedRoute><Empresas /></ProtectedRoute>} />
                <Route path="/nfce" element={<ProtectedRoute><NFCe /></ProtectedRoute>} />
                <Route path="/certificados" element={<ProtectedRoute><Certificados /></ProtectedRoute>} />
                <Route path="/tokens" element={<ProtectedRoute><Tokens /></ProtectedRoute>} />
                <Route path="/webhooks" element={<ProtectedRoute><Webhooks /></ProtectedRoute>} />
                <Route path="/logs" element={<ProtectedRoute><Logs /></ProtectedRoute>} />
                <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AuthProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
