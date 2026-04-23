import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/AuthPage";

export const Route = createFileRoute("/login/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor sign in — Feeana" },
      {
        name: "description",
        content: "Sign in or create your Feeana instructor account.",
      },
    ],
  }),
  component: () => <AuthPage role="instructor" />,
});
