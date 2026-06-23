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
import { AnalysisStoreProvider } from "@/lib/stores/analysisStore";
import { AuthProvider } from "@/lib/stores/auth";
import { ClassStoreProvider } from "@/lib/stores/classStore";
import { CourseStoreProvider } from "@/lib/stores/courseStore";
import { FeedbackStoreProvider } from "@/lib/stores/feedbackStore";
import { ThemeProvider, useTheme } from "@/lib/providers/themeProvider";
import bgImage from "../assets/bg-abstract.jpg";

import "../styles.css";

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

export const Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Feeana — Outcome-aligned feedback intelligence" },
      {
        name: "description",
        content:
          "Feeana diagnoses learning gaps by comparing student feedback against Intended Learning Outcomes for CS faculty.",
      },
      { property: "og:title", content: "Feeana — Feedback intelligence" },
      {
        property: "og:description",
        content: "AI-powered, outcome-aligned feedback intelligence for Computer Science faculty.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const bgStyle = `:root { --feeana-bg-image: url(${bgImage}); }`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: bgStyle }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('feeana-ui-theme') || 'system';
                  var root = document.documentElement;
                  root.classList.remove('light', 'dark');
                  if (theme === 'system') {
                    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    root.classList.add(dark ? 'dark' : 'light');
                  } else {
                    root.classList.add(theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ToasterWithTheme() {
  const { theme } = useTheme()
  return <Toaster richColors position="top-right" theme={theme as 'light' | 'dark' | undefined} />
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClassStoreProvider>
          <CourseStoreProvider>
            <FeedbackStoreProvider>
              <AnalysisStoreProvider>
                <Outlet />
                <ToasterWithTheme />
              </AnalysisStoreProvider>
            </FeedbackStoreProvider>
          </CourseStoreProvider>
        </ClassStoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}