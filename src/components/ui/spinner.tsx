import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeMap = {
  sm: 18,
  md: 30,
  lg: 42,
};

// Solid-color wheel segments (like macOS beach ball)
const SEGMENTS = [
  { color: "hsl(0, 85%, 55%)" },     // Red
  { color: "hsl(30, 90%, 55%)" },     // Orange
  { color: "hsl(50, 95%, 52%)" },     // Yellow
  { color: "hsl(120, 55%, 45%)" },    // Green
  { color: "hsl(195, 80%, 48%)" },    // Cyan
  { color: "hsl(215, 85%, 55%)" },    // Blue
  { color: "hsl(270, 65%, 55%)" },    // Purple
  { color: "hsl(325, 75%, 55%)" },    // Pink
];

function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

export function Spinner({ className, size = "md", label }: SpinnerProps) {
  const s = sizeMap[size];
  const sliceAngle = 360 / SEGMENTS.length;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="relative" style={{ width: s, height: s }}>
        <svg
          width={s}
          height={s}
          viewBox="0 0 40 40"
          className="animate-spin"
          style={{ animationDuration: "1s" }}
        >
          {SEGMENTS.map((seg, i) => (
            <path
              key={i}
              d={pieSlicePath(20, 20, 18, i * sliceAngle, (i + 1) * sliceAngle)}
              fill={seg.color}
            />
          ))}
        </svg>
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

export function PageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" label={label} />
    </div>
  );
}
