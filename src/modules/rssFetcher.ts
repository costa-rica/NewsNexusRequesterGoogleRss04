import { parseStringPromise } from "xml2js";
import logger from "./logger";

export interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  source?: string;
  content?: string;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

function extractAnchorText(input: string): string | null {
  const match = input.match(/<a[^>]*>(.*?)<\/a>/i);
  return match?.[1]?.trim() || null;
}

function mapItems(items: any[]): RssItem[] {
  return items.map((item) => {
    const descriptionRaw = item.description?.[0] || "";
    const anchorText = extractAnchorText(descriptionRaw);
    const description = anchorText || stripHtml(descriptionRaw) || descriptionRaw;

    return {
      title: item.title?.[0],
      description,
      link: item.link?.[0],
      pubDate: item.pubDate?.[0],
      source: item.source?.[0]?._ || item.source?.[0],
    };
  });
}

export async function fetchRssItems(url: string): Promise<{
  status: "success" | "error";
  items: RssItem[];
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NewsNexusRequesterGoogleRss04/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorMessage = `RSS request failed with status ${response.status}`;
      logger.error(errorMessage);
      return { status: "error", items: [], error: errorMessage };
    }

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: true });
    const items = parsed?.rss?.channel?.[0]?.item || [];

    if (!items || items.length === 0) {
      return { status: "success", items: [] };
    }

    return { status: "success", items: mapItems(items) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown RSS fetch error";
    logger.error(`RSS request error: ${message}`);
    return { status: "error", items: [], error: message };
  }
}
