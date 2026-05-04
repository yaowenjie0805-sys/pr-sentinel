export const severityRank = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
};

export function normalizeSeverity(value, fallback = "medium") {
  const normalized = String(value ?? "").toLowerCase();
  return Object.hasOwn(severityRank, normalized) ? normalized : fallback;
}

export function meetsSeverityThreshold(severity, threshold) {
  if (String(threshold).toLowerCase() === "none") return false;
  return severityRank[normalizeSeverity(severity)] >= severityRank[normalizeSeverity(threshold)];
}
