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
import { shortToken } from "./walkthrough";

const MEAN_COLOR = "rgb(99, 102, 241)";
const TOKEN_COLOR = "rgb(16, 185, 129)";

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

  const tokenNorms = useMemo(
    () => tokenLayerL2Norms(internals, tokenIndex),
    [internals, tokenIndex],
  );

  const magnitudeData = useMemo(
    () =>
      internals.layerRms.map((rms, layer) => ({
        layer,
        rms,
        token: tokenNorms[layer] ?? 0,
      })),
    [internals.layerRms, tokenNorms],
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
          final layer RMS {internals.layerRms[NUM_LAYERS]?.toFixed(3) ?? "—"}
        </Badge>
        <Badge variant="outline" className="font-mono">
          lowest mean per-token cosine · into L{minCosine.layer} · {minCosine.cosine.toFixed(3)}
        </Badge>
      </div>

      {/* Each panel keeps its own Y axis: element RMS and a token's ‖h‖₂ differ by a
          factor of √384, so a shared scale would invite a false comparison. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Element RMS per layer (all tokens)</Label>
          </div>
          <HiddenStateLine
            data={magnitudeData}
            dataKey="rms"
            name="element RMS (all tokens)"
            color={MEAN_COLOR}
            dot={{ r: 2 }}
            labelFormatter={(v) => `Layer ${v}`}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>‖h‖₂ per layer · token #{tokenIndex}</Label>
            <Select value={String(tokenIndex)} onValueChange={setToken}>
              <SelectTrigger className="h-7 w-[11rem] text-xs" aria-label="Token to trace">
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
          <HiddenStateLine
            data={magnitudeData}
            dataKey="token"
            name={`‖h‖₂ token #${tokenIndex}`}
            color={TOKEN_COLOR}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            labelFormatter={(v) => `Layer ${v}`}
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Layer-to-layer similarity (cosine)</Label>
            <span className="text-[10px] text-muted-foreground">
              1.0 = representation unchanged
            </span>
          </div>
          <HiddenStateLine
            data={cosineData}
            dataKey="cosine"
            name="cosine"
            color={MEAN_COLOR}
            dot={{ r: 2 }}
            domain={[0, 1]}
            referenceLine={1}
            labelFormatter={(v) => `Layer ${v} vs ${Number(v) - 1}`}
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Cosine is averaged over tokens, so the lowest point marks the boundary with the largest
        average per-token change — not necessarily the layer that moves a given token most. The two
        magnitude panels use independent scales: element RMS averages over all 384 dimensions, while
        ‖h‖₂ is one token's full-vector norm.
      </p>
    </div>
  );
}

function HiddenStateLine({
  data,
  dataKey,
  name,
  color,
  domain,
  referenceLine,
  labelFormatter,
  strokeWidth = 2,
  strokeDasharray,
  dot = false,
}: {
  data: Array<Record<string, number>>;
  dataKey: string;
  name: string;
  color: string;
  domain?: [number, number];
  referenceLine?: number;
  labelFormatter: (value: number) => string;
  strokeWidth?: number;
  strokeDasharray?: string;
  dot?: { r: number } | false;
}) {
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis
          dataKey="layer"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "layer", position: "insideBottom", offset: -2, fontSize: 10 }}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={46}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={labelFormatter}
          formatter={(value: number, seriesName: string) => [value.toFixed(4), seriesName]}
        />
        {referenceLine !== undefined && (
          <ReferenceLine y={referenceLine} stroke={MEAN_COLOR} strokeDasharray="3 3" />
        )}
        <Line
          type="monotone"
          dataKey={dataKey}
          name={name}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          dot={dot}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
