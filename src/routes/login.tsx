import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, BookOpenCheck, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Feeana" },
      {
        name: "description",
        content: "Access the instructor or student portal for Feeana.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("instructor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await login(email, password, role);
      toast.success(`Welcome, ${user.name}`);
      navigate({
        to: user.role === "instructor" ? "/home" : "/student/home",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (r: UserRole) => {
    setRole(r);
    if (r === "instructor") {
      setEmail("admin@feeana.edu");
      setPassword("admin123");
    } else {
      setEmail("student@feeana.edu");
      setPassword("student123");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to Feeana</CardTitle>
            <CardDescription>Choose your portal to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="instructor" className="gap-2">
                  <GraduationCap className="h-4 w-4" /> Instructor
                </TabsTrigger>
                <TabsTrigger value="student" className="gap-2">
                  <BookOpenCheck className="h-4 w-4" /> Student
                </TabsTrigger>
              </TabsList>
              <TabsContent value="instructor" className="mt-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => fillDemo("instructor")}
                >
                  Use demo instructor credentials
                </button>
              </TabsContent>
              <TabsContent value="student" className="mt-2">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => fillDemo("student")}
                >
                  Use demo student credentials
                </button>
              </TabsContent>
            </Tabs>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@feeana.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <LogIn className="h-4 w-4" />
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Submitting feedback means you accept the{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
