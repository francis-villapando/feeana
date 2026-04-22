import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { ClassStoreProvider } from "@/lib/classStore";
import { CourseStoreProvider } from "@/lib/courseStore";
import { FeedbackStoreProvider } from "@/lib/feedbackStore";
import bgImage from "../assets/bg-abstract.jpg";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="bg-gradient-to-br from-primary to-primary/40 bg-clip-text text-7xl font-bold text-transparent">
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4" /> Go home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<Record<string, never>>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Feeana — Outcome-aligned feedback intelligence" },
      {
        name: "description",
        content:
          "Feeana diagnoses learning gaps by comparing student feedback against Intended Learning Outcomes for CS instructors.",
      },
      { property: "og:title", content: "Feeana — Feedback intelligence" },
      {
        property: "og:description",
        content:
          "AI-powered, outcome-aligned feedback intelligence for Computer Science instructors.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Inject the background image as a CSS variable consumed by body::before.
  const bgStyle = `:root { --feeana-bg-image: url(${bgImage}); }`;
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: bgStyle }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <ClassStoreProvider>
        <CourseStoreProvider>
          <FeedbackStoreProvider>
            <Outlet />
            <Toaster richColors position="top-right" />
          </FeedbackStoreProvider>
        </CourseStoreProvider>
      </ClassStoreProvider>
    </AuthProvider>
  );
}
