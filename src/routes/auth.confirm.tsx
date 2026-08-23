import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLandingCard } from "@/components/auth";
import { useAuth } from "@/lib/stores/auth";

type ConfirmSearch = { role?: "faculty" | "student" };

export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    role: search.role === "faculty" || search.role === "student" ? search.role : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Confirm email — Feeana" },
      { name: "description", content: "Confirm your Feeana account email address." },
    ],
  }),
  component: ConfirmEmailPage,
});

type Status = "resolving" | "success" | "expired";

function ConfirmEmailPage() {
  const { role } = Route.useSearch();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [status, setStatus] = useState<Status>("resolving");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.get("error")) {
      setStatus("expired");
    } else if (hashParams.get("access_token")) {
      setStatus("success");
    }
  }, []);

  useEffect(() => {
    if (status !== "resolving" || isLoading) return;
    setStatus(isAuthenticated ? "success" : "expired");
  }, [isAuthenticated, isLoading, status]);

  const signInLink = role === "faculty" ? "/auth/faculty" : "/auth/student";

  if (status === "success") {
    return (
      <AuthLandingCard
        icon={CheckCircle2}
        iconClassName="bg-primary/15 text-primary ring-primary/30"
        title="Account Verified"
        description="Your email address has been confirmed."
      >
        <div className="space-y-4 text-center">
          <Button asChild className="w-full">
            <Link to={signInLink}>
              <LogIn className="h-4 w-4" /> Go to Sign In
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            You can proceed using the button above, or safely close this tab and return to your
            previous window.
          </p>
        </div>
      </AuthLandingCard>
    );
  }

  if (status === "expired") {
    return (
      <AuthLandingCard
        icon={AlertCircle}
        iconClassName="bg-destructive/15 text-destructive ring-destructive/30"
        title="Link expired or already used"
        description="This confirmation link is invalid or has expired."
      >
        <div className="text-center">
          <Button asChild className="w-full">
            <Link to={signInLink}>
              <LogIn className="h-4 w-4" /> Back to Sign In
            </Link>
          </Button>
        </div>
      </AuthLandingCard>
    );
  }

  return (
    <AuthLandingCard icon={Mail} title="Confirming your email">
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying your account…
      </div>
    </AuthLandingCard>
  );
}
