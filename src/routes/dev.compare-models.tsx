import { createFileRoute, notFound } from "@tanstack/react-router";
import { CompareModelsPage } from "@/components/dev/CompareModelsPage";

export const Route = createFileRoute("/dev/compare-models")({
  beforeLoad: () => {
    const isEnabled = import.meta.env.VITE_MODEL_COMPARISON === "true";
    if (!isEnabled) {
      throw notFound();
    }
  },
  component: CompareModelsPage,
});
