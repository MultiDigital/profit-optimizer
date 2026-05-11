/**
 * Renders a signed delta value in muted grey. Used in comparison tables
 * (cost-centers, workforce-analytics) to show how a metric changed between
 * two date snapshots. Near-zero deltas render as an em-dash.
 */
export function DeltaCell({
  value,
  format,
}: {
  value: number;
  format: (v: number) => string;
}) {
  if (Math.abs(value) < 0.005) {
    return <span className="text-muted-foreground">—</span>;
  }
  const sign = value > 0 ? '+' : '';
  return (
    <span className="text-muted-foreground">
      {sign}
      {format(value)}
    </span>
  );
}
