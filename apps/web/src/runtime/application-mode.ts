/** Pure mode selection, never authentication or an implicit demo fallback. */
export function parseApplicationMode(value: string | undefined): "DEMO" | "B1" | null {
  return value === "B1" || value === "DEMO" ? value : null;
}
