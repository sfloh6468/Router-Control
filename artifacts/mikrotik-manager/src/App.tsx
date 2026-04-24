import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider, useRouterContext } from "@/lib/router-context";
import { ChatProvider } from "@/lib/chat-context";
import { Layout } from "@/components/layout";
import { useMe } from "@/hooks/use-admin";

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
import AdminPage from "@/pages/admin";
import OltDashboardPage from "@/pages/olt-dashboard";
import OltOntsPage from "@/pages/olt-onts";
import OltServicePortsPage from "@/pages/olt-service-ports";
import OltAlarmsPage from "@/pages/olt-alarms";
import OltUsersPage from "@/pages/olt-users";
import OltSnapshotsPage from "@/pages/olt-snapshots";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(199, 89%, 42%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(222, 47%, 11%)",
    colorTextSecondary: "hsl(215, 16%, 42%)",
    colorInputText: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(222, 47%, 11%)",
    borderRadius: "0.75rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontFamilyButtons: "system-ui, -apple-system, sans-serif",
    fontSize: "0.95rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "rounded-2xl w-full overflow-hidden border border-border bg-card shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-accent transition-colors",
    formFieldInput: "bg-background border-input focus:border-primary",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors",
    dividerLine: "bg-border",
    alert: "border border-destructive/40 bg-destructive/10",
    logoBox: "h-12 mb-2",
    logoImage: "h-12 w-12",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background px-4">
      <div className="w-full max-w-md">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background px-4">
      <div className="w-full max-w-md">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isConnected } = useRouterContext();
  if (!isConnected) return <Redirect to="/" />;
  return <Component />;
}

function WriterRoute({ component: Component }: { component: React.ComponentType }) {
  const { isConnected } = useRouterContext();
  const me = useMe();
  if (!isConnected) return <Redirect to="/" />;
  if (me.isLoading) return null;
  if (me.data?.canWrite !== true) return <Redirect to="/dashboard" />;
  return <Component />;
}

function AppRoutes() {
  const { isConnected, vendor } = useRouterContext();
  const isOlt = vendor === "huawei-olt";
  return (
    <Layout>
      <Switch>
        <Route path="/">
          {isConnected ? <Redirect to="/dashboard" /> : <ConnectionPage />}
        </Route>

        {isOlt ? (
          <>
            <Route path="/dashboard"><ProtectedRoute component={OltDashboardPage} /></Route>
            <Route path="/onts"><ProtectedRoute component={OltOntsPage} /></Route>
            <Route path="/service-ports"><ProtectedRoute component={OltServicePortsPage} /></Route>
            <Route path="/alarms"><ProtectedRoute component={OltAlarmsPage} /></Route>
            <Route path="/olt-users"><ProtectedRoute component={OltUsersPage} /></Route>
            <Route path="/snapshots"><WriterRoute component={OltSnapshotsPage} /></Route>
            {/* Block MikroTik-only paths for OLT sessions by sending them home. */}
            <Route path="/interfaces"><Redirect to="/dashboard" /></Route>
            <Route path="/ip-addresses"><Redirect to="/dashboard" /></Route>
            <Route path="/firewall"><Redirect to="/dashboard" /></Route>
            <Route path="/dhcp"><Redirect to="/dashboard" /></Route>
            <Route path="/wireless"><Redirect to="/dashboard" /></Route>
          </>
        ) : (
          <>
            <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
            <Route path="/interfaces"><ProtectedRoute component={InterfacesPage} /></Route>
            <Route path="/ip-addresses"><ProtectedRoute component={IpAddressesPage} /></Route>
            <Route path="/firewall"><ProtectedRoute component={FirewallPage} /></Route>
            <Route path="/dhcp"><ProtectedRoute component={DhcpLeasesPage} /></Route>
            <Route path="/wireless"><ProtectedRoute component={WirelessClientsPage} /></Route>
            {/* Block OLT-only paths for MikroTik sessions. */}
            <Route path="/onts"><Redirect to="/dashboard" /></Route>
            <Route path="/service-ports"><Redirect to="/dashboard" /></Route>
            <Route path="/alarms"><Redirect to="/dashboard" /></Route>
            <Route path="/olt-users"><Redirect to="/dashboard" /></Route>
            <Route path="/snapshots"><Redirect to="/dashboard" /></Route>
          </>
        )}

        {/* Shared */}
        <Route path="/terminal"><ProtectedRoute component={TerminalPage} /></Route>
        <Route path="/admin"><AdminPage /></Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: { title: "Welcome to Network Device Manager", subtitle: "Sign in to manage your MikroTik routers and Huawei OLTs" },
        },
        signUp: {
          start: { title: "Create your account", subtitle: "Manage MikroTik routers and Huawei OLTs from anywhere" },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route>
            <Show when="signed-in">
              <RouterProvider>
                <ChatProvider>
                  <AppRoutes />
                </ChatProvider>
              </RouterProvider>
            </Show>
            <Show when="signed-out">
              <Redirect to="/sign-in" />
            </Show>
          </Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
