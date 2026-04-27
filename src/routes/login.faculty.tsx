import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/login/faculty")({
  head: () => ({
    meta: [
      { title: "Faculty sign in — Feeana" },
      {
        name: "description",
        content: "Sign in or create your Feeana faculty account.",
      },
    ],
  }),
  component: () => <AuthPage role="faculty" />,
});
