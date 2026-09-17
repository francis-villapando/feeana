import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NUM_LAYERS, tokenLayerL2Norms, type ModelInternals } from "@/lib/algorithm/internals";

const MEAN_COLOR = "rgb(99, 102, 241)";
const TOKEN_COLOR = "rgb(16, 185, 129)";

function shortToken(token: string): string {
  return token.replace(/^▁/, "").replace(/^Ġ/, "") || token;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover, #fff)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 6,
  fontSize: 11,
  fontFamily: "monospace",
} as const;

export function HiddenStateEvolutionChart({
  internals,
  subwords,
}: {
  internals: ModelInternals;
  subwords: string[];
}) {
  const [token, setToken] = useState("0");
  const tokenIndex = Math.min(Number(token), Math.max(internals.activeTokens - 1, 0));

  const meanNorms = internals.layerL2;
  const tokenNorms = useMemo(
    () => tokenLayerL2Norms(internals, tokenIndex),
    [internals, tokenIndex],
  );

  const normData = useMemo(
    () =>
      meanNorms.map((mean, layer) => ({
        layer,
        mean,
        token: tokenNorms[layer] ?? 0,
      })),
    [meanNorms, tokenNorms],
  );

  const cosineData = useMemo(
    () =>
      internals.layerCosine.map((cosine, i) => ({
        layer: i + 1,
        cosine,
      })),
    [internals.layerCosine],
  );

  const minCosine = useMemo(
    () =>
      cosineData.reduce(
        (acc, d) => (d.cosine < acc.cosine ? d : acc),
        cosineData[0] ?? { layer: 0, cosine: 1 },
      ),
    [cosineData],
  );

  const tokens = subwords.slice(0, internals.activeTokens);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {NUM_LAYERS + 1} hidden states · layer 0 = embeddings
        </Badge>
        <Badge variant="outline" className="font-mono">
          final ‖h‖₂ {meanNorms[NUM_LAYERS]?.toFixed(3) ?? "—"}
        </Badge>
        <Badge variant="outline" className="font-mono">
          min cosine {minCosine.cosine.toFixed(3)} @ L{minCosine.layer}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Representation magnitude ‖h‖₂ per layer</Label>
            <Select value={String(tokenIndex)} onValueChange={setToken}>
              <SelectTrigger className="h-7 w-[11rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((tok, i) => (
                  <SelectItem key={i} value={String(i)} className="text-xs">
                    #{i} {shortToken(tok)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={normData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="layer"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "layer", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={46} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) => `Layer ${v}`}
                formatter={(value: number, name: string) => [value.toFixed(4), name]}
              />
              <Line
                type="monotone"
                dataKey="mean"
                name="mean (all tokens)"
                stroke={MEAN_COLOR}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="token"
                name={`token #${tokenIndex}`}
                stroke={TOKEN_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Layer-to-layer similarity (cosine drift)</Label>
            <span className="text-[10px] text-muted-foreground">
              1.0 = representation unchanged
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={cosineData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="layer"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                label={{ value: "layer", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={46}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) => `Layer ${v} vs ${Number(v) - 1}`}
                formatter={(value: number) => [value.toFixed(4), "cosine"]}
              />
              <ReferenceLine y={1} stroke={MEAN_COLOR} strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cosine"
                name="cosine"
                stroke={MEAN_COLOR}
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Each transformer layer re-writes the token representations. A dip in the cosine curve marks
        a layer where the encoding changed direction most; the magnitude curve shows how the
        representation grows as contextual information accumulates toward the pooled sentence
        vector.
      </p>
    </div>
  );
}
