import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlgorithmSimulation } from "@/components/dev/AlgorithmSimulation";
import { useAuth } from "@/lib/stores/auth";

export const Route = createFileRoute("/_faculty/dev/simulation")({
  component: DevSimulation,
});

function DevSimulation() {
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

  return <AlgorithmSimulation />;
}
