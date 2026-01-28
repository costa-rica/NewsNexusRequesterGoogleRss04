# Article Storage (Google RSS)

This document explains how the Google News RSS requester stores request metadata, articles, and optional article content in the NewsNexus10 database. It is based on the current implementation in `modules/requestsNewsGoogleRss.js`, especially the `storeNewsApiArticles` function and the request creation logic in `makeGoogleRssRequest`.

## High-level flow

1. Build the Google News RSS query URL and fetch RSS XML.
2. Parse RSS `<item>` entries into a normalized `requestResponseData.results` array.
3. Create a `NewsApiRequest` record for the fetch.
4. For each RSS item:
   - Skip if an `Article` already exists with the same `url`.
   - Insert a new `Article` row.
   - Optionally insert an `ArticleContent` row if `article.content` is present.
5. Update `NewsApiRequest.countOfArticlesSavedToDbFromRequest` with the number of inserted articles.

## Tables written or updated

### 1) NewsApiRequests (insert, then update)

Created in `makeGoogleRssRequest` and updated in `storeNewsApiArticles`.

Insert fields (from `NewsApiRequest.create`):

- `newsArticleAggregatorSourceId`: `NewsArticleAggregatorSource.id` for `NAME_OF_ORG_REQUESTING_FROM`.
- `dateEndOfRequest`: current UTC date (`new Date().toISOString().split("T")[0]`).
- `countOfArticlesReceivedFromRequest`: `requestResponseData.results.length`.
- `status`: `requestResponseData.status` (`"success"` or `"error"`).
- `url`: the constructed RSS request URL.
- `andString`: original AND query string.
- `orString`: original OR query string.
- `notString`: original NOT query string.
- `isFromAutomation`: `true`.

Update fields (from `newsApiRequest.update`):

- `countOfArticlesSavedToDbFromRequest`: number of newly created `Article` rows for this request.

Notes:

- `dateStartOfRequest` and `countOfArticlesAvailableFromRequest` are not set in this flow.
- The request is created even when the RSS response contains zero items.

### 2) Articles (insert, deduplicated)

Created in `storeNewsApiArticles` for each RSS item, unless a row already exists with the same `url`.

Insert fields:

- `publicationName`: RSS `source` text.
- `title`: RSS `title`.
- `description`: RSS `description` (prefers the anchor text in the HTML description).
- `url`: RSS `link`.
- `publishedDate`: RSS `pubDate`.
- `entityWhoFoundArticleId`: derived from the `NewsArticleAggregatorSource` for the current org (`EntityWhoFoundArticle.id`).
- `newsApiRequestId`: the `NewsApiRequest.id` created for this fetch.

Deduplication rule:

- Before insert, the code checks `Article.findOne({ where: { url: article.link } })`. If a row exists, the article is skipped and does not count toward `countOfArticlesSavedToDbFromRequest`.

### 3) ArticleContents (optional insert)

Created only when `article.content` exists in the parsed response object.

- `articleId`: `Article.id` from the newly created article.
- `content`: `article.content`.

Note:

- `article.content` is not populated by the RSS parser in this service. It is only written if upstream code injects content into `requestResponseData.results` before storage.

## RSS element to database mapping

The RSS parser maps each `<item>` into `requestResponseData.results` with the following fields:

- `title`: `item.title[0]`
- `description`: anchor text inside `item.description[0]` when present, otherwise full `description` text
- `pubDate`: `item.pubDate[0]`
- `source`: `item.source[0]._`
- `link`: `item.link[0]`

These fields then map into `Article` columns as follows:

| RSS element | Parsed field | Article column       | Notes |
| ----------- | ------------ | -------------------- | ----- |
| `<title>`   | `title`      | `title`              | Stored as-is |
| `<description>` | `description` | `description`   | Uses anchor text if present |
| `<link>`    | `link`       | `url`                | Used for dedupe check |
| `<source>`  | `source`     | `publicationName`    | Source display name |
| `<pubDate>` | `pubDate`    | `publishedDate`      | Stored as raw RSS date string |

## Time and date handling

### Article publication time

- Source: RSS `<pubDate>` string.
- Destination: `Article.publishedDate`.
- The code passes the raw RSS string (e.g., RFC 822 format) into the `publishedDate` column. There is no conversion to `DATEONLY` in this service.

### Request time

- Source: local system clock (`new Date().toISOString()`), not RSS.
- Destination: `NewsApiRequest.dateEndOfRequest`.
- Stored as UTC date-only string (YYYY-MM-DD).

## References in code

- Request creation: `modules/requestsNewsGoogleRss.js` (function `makeGoogleRssRequest`)
- Article storage: `modules/requestsNewsGoogleRss.js` (function `storeNewsApiArticles`)
- Table definitions: `docs/DATABASE_OVERVIEW.md`
