import * as React from "react";

const STUB_USER = {
  id: "user_e2e_test",
  emailAddresses: [{ id: "email_e2e", emailAddress: "olt_e2e_user@example.com" }],
  primaryEmailAddress: { emailAddress: "olt_e2e_user@example.com" },
  fullName: "OLT E2E User",
  firstName: "OLT",
  lastName: "User",
  imageUrl: "",
};

const STUB_SESSION = {
  id: "sess_e2e_test",
  user: STUB_USER,
  getToken: async () => "e2e-test-token",
};

export const ClerkProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

type ShowProps = {
  children?: React.ReactNode;
  when: "signed-in" | "signed-out" | string;
};
export const Show = ({ children, when }: ShowProps) => (when === "signed-in" ? <>{children}</> : null);

export const SignedIn = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SignedOut = (_: { children?: React.ReactNode }) => null;
export const ClerkLoaded = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const ClerkLoading = (_: { children?: React.ReactNode }) => null;

export const SignIn = (_props: any) => <div data-testid="stub-sign-in" />;
export const SignUp = (_props: any) => <div data-testid="stub-sign-up" />;
export const UserButton = (_props: any) => <div data-testid="stub-user-button" />;

export const useClerk = () => ({
  signOut: async () => {},
  addListener: (_cb: (...args: any[]) => void) => () => {},
  session: STUB_SESSION,
  user: STUB_USER,
  loaded: true,
});

export const useUser = () => ({
  user: STUB_USER,
  isLoaded: true,
  isSignedIn: true,
});

export const useAuth = () => ({
  isSignedIn: true,
  isLoaded: true,
  userId: STUB_USER.id,
  sessionId: STUB_SESSION.id,
  getToken: async () => "e2e-test-token",
  signOut: async () => {},
});

export const useSession = () => ({
  session: STUB_SESSION,
  isLoaded: true,
  isSignedIn: true,
});
