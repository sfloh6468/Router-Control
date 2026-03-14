import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider, useRouterContext } from "@/lib/router-context";
import { Layout } from "@/components/layout";

// Pages
import NotFound from "@/pages/not-found";
import ConnectionPage from "@/pages/connection";
import DashboardPage from "@/pages/dashboard";
import InterfacesPage from "@/pages/interfaces";
import IpAddressesPage from "@/pages/ip-addresses";
import FirewallPage from "@/pages/firewall";
import DhcpLeasesPage from "@/pages/dhcp";
import WirelessClientsPage from "@/pages/wireless";
import TerminalPage from "@/pages/terminal";

const queryClient = new QueryClient();

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isConnected } = useRouterContext();
  
  if (!isConnected) {
    return <Redirect to="/" />;
  }
  
  return <Component />;
}

function Router() {
  const { isConnected } = useRouterContext();

  return (
    <Layout>
      <Switch>
        {/* Public / Entry Route */}
        <Route path="/">
          {isConnected ? <Redirect to="/dashboard" /> : <ConnectionPage />}
        </Route>

        {/* Protected Routes */}
        <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
        <Route path="/interfaces"><ProtectedRoute component={InterfacesPage} /></Route>
        <Route path="/ip-addresses"><ProtectedRoute component={IpAddressesPage} /></Route>
        <Route path="/firewall"><ProtectedRoute component={FirewallPage} /></Route>
        <Route path="/dhcp"><ProtectedRoute component={DhcpLeasesPage} /></Route>
        <Route path="/wireless"><ProtectedRoute component={WirelessClientsPage} /></Route>
        <Route path="/terminal"><ProtectedRoute component={TerminalPage} /></Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </RouterProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
