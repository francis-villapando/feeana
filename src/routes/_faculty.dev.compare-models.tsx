import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CompareModelsPage } from "@/components/dev/CompareModelsPage";
import { useAuth } from "@/lib/stores/auth";

export const Route = createFileRoute("/_faculty/dev/compare-models")({
  component: DevCompareModels,
});

function DevCompareModels() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user?.isDev) {
      navigate({ to: "/home" });
    }
  }, [isLoading, user, navigate]);

  if (isLoading || !user?.isDev) {
    return null;
  }

  return <CompareModelsPage />;
}
