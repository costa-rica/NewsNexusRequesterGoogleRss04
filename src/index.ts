import "dotenv/config";
import logger from "./modules/logger";
import { evaluateGuardrail } from "./modules/guardrail";
import { readQuerySpreadsheet } from "./modules/spreadsheet";
import { buildQuery, buildRssUrl } from "./modules/queryBuilder";
import { fetchRssItems } from "./modules/rssFetcher";
import { runSemanticScorer } from "./modules/semanticScorer";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const bypassGuardrail = process.argv.includes("--run-anyway");

  let guardrailStatus;
  try {
    guardrailStatus = evaluateGuardrail();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guardrail validation failed.";
    logger.error(message);
    console.error(message);
    await delay(100);
    process.exit(1);
  }

  logger.info(
    `Guardrail window ${guardrailStatus.windowStart}-${guardrailStatus.windowEnd} UTC (target ${guardrailStatus.targetTime}, now ${guardrailStatus.currentTime}).`,
  );

  if (!bypassGuardrail && !guardrailStatus.withinWindow) {
    const message =
      "Guardrail window not active. Exiting before processing requests.";
    logger.warn(message);
    console.error(message);
    await delay(100);
    process.exit(0);
  }

  const spreadsheetPath =
    process.env.PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED;
  if (!spreadsheetPath) {
    const message =
      "Missing PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED env var.";
    logger.error(message);
    console.error(message);
    await delay(100);
    process.exit(1);
  }

  const nameOfOrg = process.env.NAME_OF_ORG_REQUESTING_FROM;
  if (!nameOfOrg) {
    const message = "Missing NAME_OF_ORG_REQUESTING_FROM env var.";
    logger.error(message);
    console.error(message);
    await delay(100);
    process.exit(1);
  }

  const { initModels } = require("newsnexus10db");
  initModels();

  const { ensureAggregatorSourceAndEntity, storeRequestAndArticles } =
    await import("./modules/storage");

  const { newsArticleAggregatorSourceId, entityWhoFoundArticleId } =
    await ensureAggregatorSourceAndEntity(nameOfOrg);

  const rows = await readQuerySpreadsheet(spreadsheetPath);
  logger.info(`Loaded ${rows.length} query rows from spreadsheet.`);

  for (const row of rows) {
    const queryResult = buildQuery(row);

    if (!queryResult.query) {
      logger.warn(`Skipping row ${row.id ?? "unknown"}: empty query.`);
      continue;
    }

    const requestUrl = buildRssUrl(queryResult.query);
    const timeRangeNote = queryResult.timeRangeInvalid
      ? " - invalid time_range"
      : "";
    logger.info(
      `Requesting RSS (${queryResult.timeRange}${timeRangeNote}): ${requestUrl}`,
    );

    const response = await fetchRssItems(requestUrl);

    await storeRequestAndArticles({
      requestUrl,
      andString: queryResult.andString,
      orString: queryResult.orString,
      notString: null,
      status: response.status,
      items: response.items,
      newsArticleAggregatorSourceId,
      entityWhoFoundArticleId,
    });
  }

  await runSemanticScorer();
  logger.info("NewsNexusRequesterGoogleRss04 finished.");
})().catch(async (error) => {
  const message =
    error instanceof Error ? error.message : "Unhandled application error.";
  logger.error(message);
  console.error(message);
  await delay(100);
  process.exit(1);
});
