import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthStatusProvider, useAuthStatus } from "@/context/auth-status";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import InviteAccept from "./pages/InviteAccept";
import Pricing from "./pages/Pricing";
import PublicNote from "./pages/PublicNote";
import Admin from "./pages/Admin";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import TrashPage from "./pages/TrashPage";

const queryClient = new QueryClient();

const RequireAuth = ({
  redirectTo = "/auth?view=login",
  children,
}: {
  redirectTo?: string;
  children: React.ReactElement;
}) => {
  const { status } = useAuthStatus();
  const cachedStatus =
    typeof window !== "undefined" ? window.localStorage.getItem("teampad_auth_status") : null;
  if (status === "loading") {
    if (cachedStatus === "authed") {
      return children;
    }
    return (
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-primary/70 animate-pulse" />
    );
  }
  if (status === "guest") {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthStatusProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              <Route path="/" element={<Index />} />
              <Route
                path="/app"
                element={
                  <RequireAuth redirectTo="/auth?view=login">
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/workspaces/:workspaceId/trash"
                element={
                  <RequireAuth redirectTo="/auth?view=login">
                    <TrashPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/app/admin"
                element={
                  <RequireAuth redirectTo="/auth?view=login&redirect=/app/admin">
                    <Admin />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth redirectTo="/auth?view=login">
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route path="/auth" element={<Auth />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route
                path="/pricing"
                element={
                  <RequireAuth redirectTo="/auth?view=login&redirect=/pricing">
                    <Pricing />
                  </RequireAuth>
                }
              />
              <Route path="/public/notes/:slug" element={<PublicNote />} />
              <Route path="/invite/:token" element={<InviteAccept />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthStatusProvider>
    </QueryClientProvider>
  );
};

export default App;
