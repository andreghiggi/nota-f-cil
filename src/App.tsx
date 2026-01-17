import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Empresas from "./pages/Empresas";
import NFCe from "./pages/NFCe";
import Certificados from "./pages/Certificados";
import Tokens from "./pages/Tokens";
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
          <Route path="/" element={<Index />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/nfce" element={<NFCe />} />
          <Route path="/certificados" element={<Certificados />} />
          <Route path="/tokens" element={<Tokens />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/docs" element={<DocumentacaoAPI />} />
          <Route path="/auth" element={<Auth />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
