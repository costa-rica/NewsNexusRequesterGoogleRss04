import { QueryRow } from "../types/query";

export interface QueryBuildResult {
  query: string;
  andString: string | null;
  orString: string | null;
  timeRange: string;
  timeRangeInvalid: boolean;
}

const DEFAULT_TIME_RANGE = "180d";

function normalizeTimeRange(value?: string): {
  timeRange: string;
  timeRangeInvalid: boolean;
} {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return { timeRange: DEFAULT_TIME_RANGE, timeRangeInvalid: false };
  }
  if (!/^\d+d$/.test(trimmed)) {
    return { timeRange: DEFAULT_TIME_RANGE, timeRangeInvalid: true };
  }
  const days = Number.parseInt(trimmed.slice(0, -1), 10);
  if (!Number.isFinite(days) || days <= 0) {
    return { timeRange: DEFAULT_TIME_RANGE, timeRangeInvalid: true };
  }
  return { timeRange: trimmed, timeRangeInvalid: false };
}

function splitCsv(value?: string): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function normalizeTerm(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) {
    return "";
  }
  const hasQuotes =
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));
  if (hasQuotes) {
    return trimmed;
  }
  if (trimmed.includes(" ")) {
    return `"${trimmed}"`;
  }
  return trimmed;
}

function combineForDb(keywords?: string, exactPhrases?: string): string | null {
  const parts = [...splitCsv(keywords), ...splitCsv(exactPhrases)];
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
}

export function buildQuery(row: QueryRow): QueryBuildResult {
  const andKeywords = splitCsv(row.and_keywords);
  const andExact = splitCsv(row.and_exact_phrases);
  const orKeywords = splitCsv(row.or_keywords);
  const orExact = splitCsv(row.or_exact_phrases);

  const andTerms = [...andKeywords, ...andExact]
    .map(normalizeTerm)
    .filter(Boolean);
  const orTerms = [...orKeywords, ...orExact]
    .map(normalizeTerm)
    .filter(Boolean);

  const queryParts: string[] = [];
  if (andTerms.length > 0) {
    queryParts.push(andTerms.join(" "));
  }
  if (orTerms.length > 0) {
    const orExpression = orTerms.join(" OR ");
    queryParts.push(andTerms.length > 0 && orTerms.length > 1 ? `(${orExpression})` : orExpression);
  }

  const { timeRange, timeRangeInvalid } = normalizeTimeRange(row.time_range);
  queryParts.push(`when:${timeRange}`);

  return {
    query: queryParts.join(" ").trim(),
    andString: combineForDb(row.and_keywords, row.and_exact_phrases),
    orString: combineForDb(row.or_keywords, row.or_exact_phrases),
    timeRange,
    timeRangeInvalid,
  };
}

export function buildRssUrl(query: string): string {
  const baseUrl = "https://news.google.com/rss/search";
  const params = new URLSearchParams({ q: query });

  const hl = process.env.GOOGLE_RSS_HL || "en-US";
  const gl = process.env.GOOGLE_RSS_GL || "US";
  const ceid = process.env.GOOGLE_RSS_CEID || "US:en";

  params.set("hl", hl);
  params.set("gl", gl);
  params.set("ceid", ceid);

  return `${baseUrl}?${params.toString()}`;
}
