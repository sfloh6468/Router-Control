import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider, useRouterContext } from "@/lib/router-context";
import { ChatProvider } from "@/lib/chat-context";
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
    colorPrimary: "hsl(189, 94%, 50%)",
    colorBackground: "hsl(220, 27%, 8%)",
    colorInputBackground: "hsl(220, 27%, 12%)",
    colorText: "hsl(210, 40%, 98%)",
    colorTextSecondary: "hsl(215, 20%, 65%)",
    colorInputText: "hsl(210, 40%, 98%)",
    colorNeutral: "hsl(210, 40%, 98%)",
    borderRadius: "0.75rem",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontFamilyButtons: "system-ui, -apple-system, sans-serif",
    fontSize: "0.95rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "rounded-2xl w-full overflow-hidden border border-white/10 bg-card/60 backdrop-blur-xl shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "",
    headerSubtitle: "",
    socialButtonsBlockButton:
      "border border-white/10 bg-black/20 hover:bg-white/5 transition-colors",
    socialButtonsBlockButtonText: "",
    formFieldLabel: "",
    formFieldInput: "bg-black/30 border-white/10 focus:border-primary/50",
    formButtonPrimary:
      "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors",
    footerAction: "",
    footerActionLink: "",
    footerActionText: "",
    dividerLine: "bg-white/10",
    dividerText: "",
    identityPreviewEditButton: "",
    formFieldSuccessText: "",
    alert: "border border-destructive/40 bg-destructive/10",
    alertText: "",
    otpCodeFieldInput: "bg-black/30 border-white/10",
    formFieldRow: "",
    main: "",
    logoBox: "h-12 mb-2",
    logoImage: "h-12 w-12",
  },
};

const elementStyles: Record<string, React.CSSProperties> = {
  headerTitle: { color: "hsl(210, 40%, 98%)" },
  headerSubtitle: { color: "hsl(215, 20%, 65%)" },
  socialButtonsBlockButtonText: { color: "hsl(210, 40%, 98%)" },
  formFieldLabel: { color: "hsl(210, 40%, 98%)" },
  footerActionLink: { color: "hsl(189, 94%, 50%)" },
  footerActionText: { color: "hsl(215, 20%, 65%)" },
  dividerText: { color: "hsl(215, 20%, 65%)" },
  identityPreviewEditButton: { color: "hsl(189, 94%, 50%)" },
  formFieldSuccessText: { color: "hsl(142, 70%, 50%)" },
  alertText: { color: "hsl(0, 84%, 70%)" },
};

(clerkAppearance.elements as any).headerTitle = { ...elementStyles.headerTitle };
(clerkAppearance.elements as any).headerSubtitle = { ...elementStyles.headerSubtitle };
(clerkAppearance.elements as any).socialButtonsBlockButtonText = { ...elementStyles.socialButtonsBlockButtonText };
(clerkAppearance.elements as any).formFieldLabel = { ...elementStyles.formFieldLabel };
(clerkAppearance.elements as any).footerActionLink = { ...elementStyles.footerActionLink };
(clerkAppearance.elements as any).footerActionText = { ...elementStyles.footerActionText };
(clerkAppearance.elements as any).dividerText = { ...elementStyles.dividerText };
(clerkAppearance.elements as any).identityPreviewEditButton = { ...elementStyles.identityPreviewEditButton };
(clerkAppearance.elements as any).formFieldSuccessText = { ...elementStyles.formFieldSuccessText };
(clerkAppearance.elements as any).alertText = { ...elementStyles.alertText };

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background px-4">
      <div className="w-full max-w-md">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background px-4">
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
          start: { title: "Welcome to MikroTik Access", subtitle: "Sign in to manage your routers" },
        },
        signUp: {
          start: { title: "Create your account", subtitle: "Manage MikroTik routers from anywhere" },
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
