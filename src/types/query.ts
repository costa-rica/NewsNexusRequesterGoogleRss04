export interface QueryRow {
  id?: number;
  and_keywords?: string;
  and_exact_phrases?: string;
  or_keywords?: string;
  or_exact_phrases?: string;
  time_range?: string;
}
