import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth";

export const Route = createFileRoute("/login/student")({
  head: () => ({
    meta: [
      { title: "Student sign in — Feeana" },
      {
        name: "description",
        content: "Sign in or create your Feeana student account.",
      },
    ],
  }),
  component: () => <AuthPage role="student" />,
});
