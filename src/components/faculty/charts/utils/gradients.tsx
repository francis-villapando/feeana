import type { GradientSpec } from "./gradientSpecs";

/**
 * Renders SVG gradient definitions. Must be called as a function, not used as
 * a component: recharts drops unknown wrapper components, so `url(#...)`
 * fills would reference nothing.
 */
export function renderGradients(specs: GradientSpec[]) {
  return (
    <defs>
      {specs.map((spec) => (
        <linearGradient
          key={spec.id}
          id={spec.id}
          x1="0"
          y1={spec.y1 ?? "0"}
          x2="0"
          y2={spec.y2 ?? "1"}
          gradientUnits={spec.gradientUnits}
        >
          {spec.stops.map((stop) => (
            <stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.stopOpacity}
            />
          ))}
        </linearGradient>
      ))}
    </defs>
  );
}
