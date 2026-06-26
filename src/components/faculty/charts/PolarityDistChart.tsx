import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chartTooltipProps } from "@/components/analysis";
import type { DistEntry } from "@/lib/types/types";
import { POLARITY_COLOR_ORDER } from "@/lib/constants/chartColors";

const polarityColorMap = Object.fromEntries(POLARITY_COLOR_ORDER);

interface PolarityDistChartProps {
  data: DistEntry[];
}

export function PolarityDistChart({ data }: PolarityDistChartProps) {
  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base">Polarity distribution</CardTitle>
        <CardDescription>Feedback tone distribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={3}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={polarityColorMap[entry.label] ?? "var(--color-chart-1)"}
                />
              ))}
            </Pie>
            <Tooltip
              wrapperStyle={{ pointerEvents: "none" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const entry = payload[0].payload as DistEntry;
                const color = polarityColorMap[entry.label] ?? "var(--color-foreground)";
                const texts = entry.feedbackTexts ?? [];
                const preview = texts.slice(0, 3);
                const remaining = texts.length - preview.length;
                return (
                  <div style={{ ...chartTooltipProps.contentStyle, pointerEvents: "none", maxWidth: 400 }}>
                    <p style={{ fontWeight: 500, color, margin: 0 }}>
                      {entry.label}
                    </p>
                    <p style={{ color: "var(--color-muted-foreground)", margin: 0, marginTop: 2 }}>
                      Count: {entry.value}
                    </p>
                    {preview.length > 0 && (
                      <div
                        style={{
                          marginTop: 6,
                          borderTop: "1px solid var(--color-border)",
                          paddingTop: 6,
                        }}
                      >
                        {preview.map((text, i) => (
                          <p
                            key={i}
                            style={{
                              margin: 0,
                              padding: "4px 0",
                              fontSize: 11,
                              lineHeight: 1.4,
                              color: "var(--color-foreground)",
                              borderBottom:
                                i < preview.length - 1
                                  ? "1px solid var(--color-border)"
                                  : "none",
                            }}
                          >
                            &ldquo;{text}&rdquo;
                          </p>
                        ))}
                        {remaining > 0 && (
                          <p style={{ margin: 0, marginTop: 4, fontSize: 11, color: "var(--color-muted-foreground)" }}>
                            +{remaining} more
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
