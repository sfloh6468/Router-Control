import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { RouterProvider, useRouterContext } from "@/lib/router-context";
import { ChatProvider } from "@/lib/chat-context";
import { Layout } from "@/components/layout";

// Pages
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import ConnectionPage from "@/pages/connection";
import DashboardPage from "@/pages/dashboard";
import InterfacesPage from "@/pages/interfaces";
import IpAddressesPage from "@/pages/ip-addresses";
import FirewallPage from "@/pages/firewall";
import DhcpLeasesPage from "@/pages/dhcp";
import WirelessClientsPage from "@/pages/wireless";
import TerminalPage from "@/pages/terminal";
import AdminPage from "@/pages/admin";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isConnected } = useRouterContext();
  if (!isConnected) return <Redirect to="/" />;
  return <Component />;
}

function AppRoutes() {
  const { isConnected } = useRouterContext();
  return (
    <Layout>
      <Switch>
        <Route path="/">
          {isConnected ? <Redirect to="/dashboard" /> : <ConnectionPage />}
        </Route>
        <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
        <Route path="/interfaces"><ProtectedRoute component={InterfacesPage} /></Route>
        <Route path="/ip-addresses"><ProtectedRoute component={IpAddressesPage} /></Route>
        <Route path="/firewall"><ProtectedRoute component={FirewallPage} /></Route>
        <Route path="/dhcp"><ProtectedRoute component={DhcpLeasesPage} /></Route>
        <Route path="/wireless"><ProtectedRoute component={WirelessClientsPage} /></Route>
        <Route path="/terminal"><ProtectedRoute component={TerminalPage} /></Route>
        <Route path="/admin"><AdminPage /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return (
    <RouterProvider>
      <ChatProvider>
        <AppRoutes />
      </ChatProvider>
    </RouterProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WouterRouter base={basePath}>
            <AuthGate />
          </WouterRouter>
        </AuthProvider>
      </QueryClientProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
