import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Registrar from "./pages/Registrar";
import Historico from "./pages/Historico";
import Fixas from "./pages/Fixas";
import Perfil from "./pages/Perfil";
import { BottomNav } from "./components/BottomNav";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import MigrateData from "./pages/MigrateData";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <>
                      <Home />
                      <BottomNav />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registrar"
                element={
                  <ProtectedRoute>
                    <>
                      <Registrar />
                      <BottomNav />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/historico"
                element={
                  <ProtectedRoute>
                    <>
                      <Historico />
                      <BottomNav />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fixas"
                element={
                  <ProtectedRoute>
                    <>
                      <Fixas />
                      <BottomNav />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <>
                      <Perfil />
                      <BottomNav />
                    </>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/migrate"
                element={
                  <ProtectedRoute>
                    <MigrateData />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<Login />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <NotFound />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
