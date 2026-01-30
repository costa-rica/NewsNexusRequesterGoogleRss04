# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewsNexusRequesterGoogleRss04 is a TypeScript microservice that reads search queries from an Excel spreadsheet, builds Google News RSS search URLs, fetches articles, and stores them in the NewsNexus database. After ingesting articles, it automatically launches a semantic scorer child process to analyze the content.

## Common Commands

### Build the Project
```bash
npm run build
```

### Run the Application
```bash
npm start
# Or with guardrail bypass:
node dist/index.js --run-anyway
```

### Development Mode
```bash
npm run dev
```

### Install Dependencies
```bash
# First-time setup: Install local database package
npm install file:../NewsNexus10Db
# Then install all dependencies
npm install
```

## Required Environment Variables

```bash
# Application Identity
NODE_ENV=development
NAME_APP=NewsNexusRequesterGoogleRss04

# Database Configuration
PATH_DATABASE=/path/to/database
NAME_DB=newsnexus10.db

# Logging Configuration
PATH_TO_LOGS=/path/to/logs
LOG_MAX_SIZE=5
LOG_MAX_FILES=5

# Time Guardrail Configuration
GUARDRAIL_TARGET_TIME=23:00
GUARDRAIL_TARGET_WINDOW_IN_MINS=5

# Query Spreadsheet
PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED=/path/to/query_spreadsheet.xlsx
NAME_OF_ORG_REQUESTING_FROM=

# Google RSS Configuration
GOOGLE_RSS_HL=en-US
GOOGLE_RSS_GL=US
GOOGLE_RSS_CEID=US:en

# Semantic Scorer Child Process
PATH_AND_FILENAME_TO_SEMANTIC_SCORER=/path/to/semantic_scorer/index.js
NAME_CHILD_PROCESS_SEMANTIC_SCORER=
PATH_TO_SEMANTIC_SCORER_DIR=/path/to/semantic_scorer
PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE=/path/to/semantic_scorer_keywords.xlsx
```

## High-Level Architecture

### Core Workflow (src/index.ts)

1. **Initialization** (index.ts:1-62)
   - Load environment variables via dotenv
   - Initialize Winston logger first (modules/logger.ts)
   - Evaluate time guardrail (modules/guardrail.ts) - exits if outside configured window unless `--run-anyway` flag is used
   - Validate required environment variables (exits on missing vars)
   - **CRITICAL**: Initialize database models via `initModels()` from `newsnexus10db` package BEFORE importing storage module

2. **Source and Entity Setup** (index.ts:64-68)
   - Ensure NewsArticleAggregatorSource exists for the organization
   - Ensure EntityWhoFoundArticle exists for tracking article discovery

3. **Query Processing** (index.ts:70-101)
   - Read query spreadsheet (modules/spreadsheet.ts)
   - For each row:
     - Build query string with AND/OR keywords and time range (modules/queryBuilder.ts)
     - Construct RSS URL with Google parameters (modules/queryBuilder.ts)
     - Fetch RSS items (modules/rssFetcher.ts)
     - Store request and articles to database (modules/storage.ts)
   - Skip rows with empty queries

4. **Post-Processing** (index.ts:103)
   - Run semantic scorer child process (modules/semanticScorer.ts)

### Module Organization

**src/types/query.ts**: TypeScript interface for spreadsheet row structure

**src/modules/logger.ts**: Winston logger configuration (follows LOGGING_NODE_JS_V06.md)

**src/modules/guardrail.ts**: Time window enforcement system
- Parses `GUARDRAIL_TARGET_TIME` and `GUARDRAIL_TARGET_WINDOW_IN_MINS`
- Validates time format (HH:MM, 24-hour)
- Calculates UTC time window (target ± window minutes)
- Handles day boundaries correctly (e.g., midnight crossover)
- Returns status object with window details

**src/modules/spreadsheet.ts**: Excel file reader using ExcelJS
- Reads first worksheet only
- Maps columns: id, and_keywords, and_exact_phrases, or_keywords, or_exact_phrases, time_range

**src/modules/queryBuilder.ts**: Query construction logic
- Combines AND/OR keywords and exact phrases
- Normalizes terms (adds quotes for multi-word phrases)
- Parses time_range (defaults to 180d if blank/invalid)
- Builds Google News RSS URL with localization parameters

**src/modules/rssFetcher.ts**: RSS fetching with xml2js parsing
- Fetches from Google News RSS endpoint
- Parses XML to extract articles (title, link, description, source, pubDate, content)
- Returns items array and status

**src/modules/storage.ts**: Database write operations
- Creates/finds NewsArticleAggregatorSource and EntityWhoFoundArticle
- Creates NewsApiRequest records with query metadata
- Deduplicates articles by URL (skips existing)
- Creates Article and ArticleContent records
- Tracks article counts (received vs saved)

**src/modules/semanticScorer.ts**: Child process launcher
- Spawns semantic scorer as separate Node.js process
- Passes environment variables (NAME_APP becomes NAME_CHILD_PROCESS_SEMANTIC_SCORER)
- Captures and logs stdout/stderr
- Waits for completion before finishing

### Database Integration

**CRITICAL INITIALIZATION ORDER**:

```typescript
import "dotenv/config";
import logger from "./modules/logger";

// MUST initialize models BEFORE importing modules that use them
const { initModels } = require("newsnexus10db");
initModels();

// NOW safe to import storage module that uses database models
const { ensureAggregatorSourceAndEntity, storeRequestAndArticles } =
  await import("./modules/storage");
```

**Why this matters**: The `newsnexus10db` package is a local TypeScript-based Sequelize ORM package (at `../NewsNexus10Db`). Models are unusable until `initModels()` completes initialization and applies associations.

**Database Location**: Configured via `PATH_DATABASE` + `NAME_DB` environment variables

**Primary Tables Used**:
- **NewsArticleAggregatorSource**: Identifies the RSS source organization
- **EntityWhoFoundArticle**: Links to the aggregator source
- **NewsApiRequest**: Tracks each RSS request with query strings (andString, orString), date, counts, status
- **Article**: Stores fetched articles (url is unique key for deduplication)
- **ArticleContent**: Full article content/description

### Time Guardrail System

The application enforces a configurable time window for execution:

- **Configuration**: `GUARDRAIL_TARGET_TIME` (HH:MM format, UTC) ± `GUARDRAIL_TARGET_WINDOW_IN_MINS` minutes
- **Default**: 23:00 ± 5 minutes = 22:55-23:05 UTC
- **Bypass**: Use `--run-anyway` flag to bypass guardrail
- **Implementation**: Validates time format, handles day boundaries correctly, logs window and current time
- **Exit Behavior**: Gracefully exits with status 0 if outside window (allows Winston to flush logs)

See docs/REQUIREMENTS_GUARDRAIL_TARGET_TIME.md for detailed specifications.

### Logging System

Winston-based logging with environment-specific behavior:

- **development**: Console only
- **testing**: Console AND files
- **production**: Files only

**Log Files**: Named `[NAME_APP].log` with rotation based on LOG_MAX_SIZE (default 5MB) and LOG_MAX_FILES (default 5)

**Child Processes**: Each child process gets its own logger via `NAME_CHILD_PROCESS_*` environment variable passed as child's `NAME_APP`

**V06 Early Exit Pattern**: All early exit scenarios (validation errors, guardrail checks) use async IIFE pattern with 100ms delay to ensure logs flush to disk:

```typescript
const message = "Exit reason here";
logger.error(message);    // Winston log for file persistence
console.error(message);   // Immediate stderr visibility
await delay(100);         // Flush buffer
process.exit(1);          // Exit
```

**Why both logger and console.error?**
- `logger.*()` writes to Winston (buffered, file-only in production mode)
- `console.error()` writes directly to stderr (unbuffered, immediate visibility for systemd/cron)
- 100ms delay gives Winston time to flush buffer to disk before process termination

See docs/LOGGING_NODE_JS_V06.md for complete specifications.

## Query Spreadsheet Format

**File**: Excel (.xlsx) at path specified by `PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED`

**Worksheet**: First sheet only

**Columns**:
- `id`: (optional) Integer identifier for logging
- `and_keywords`: Comma-separated keywords for AND searches
- `and_exact_phrases`: Quoted exact phrases for AND searches
- `or_keywords`: Comma-separated keywords for OR searches
- `or_exact_phrases`: Quoted exact phrases for OR searches
- `time_range`: String like "1d", "2d", "3d", etc. (defaults to "180d" if blank/invalid)

**Query Building Logic** (modules/queryBuilder.ts):
1. Split CSV values and normalize terms (add quotes for multi-word phrases)
2. Combine AND terms with space separator
3. Combine OR terms with " OR " separator (wrapped in parentheses if multiple terms and AND terms present)
4. Append `when:[time_range]` to query
5. Build URL: `https://news.google.com/rss/search?q=[query]&hl=[hl]&gl=[gl]&ceid=[ceid]`

## Key Behavioral Details

### Time Range Handling

Default: 180 days (queryBuilder.ts:11)
- Accepts format: `\d+d` (e.g., "1d", "7d", "30d")
- Invalid/blank values default to 180d
- Logs warning when time_range is invalid

### Article Deduplication

Articles are deduplicated by URL (storage.ts:71-74):
- Checks for existing article with same URL before creating
- Skips article if URL already exists in database
- Logs count of new articles saved vs total received

### Error Handling

The application uses try-catch at the top level (index.ts:105-112):
- All errors are caught, logged, and written to stderr
- Process exits with code 1 on unhandled errors
- 100ms delay before exit ensures log flush

## Important Implementation Notes

1. **Always initialize logger before any other code** (after dotenv)
2. **Always call initModels() before importing modules that use database models**
3. **Respect the time guardrail system** - it's designed to prevent off-hours execution
4. **All times use UTC** - no timezone conversions
5. **TypeScript compilation required** - run `npm run build` before `npm start`
6. **Local dependency** - `newsnexus10db` package must exist at `../NewsNexus10Db`
7. **Child process management** - Semantic scorer runs synchronously after all ingestion completes

## Related Documentation

- docs/DATABASE_OVERVIEW.md - Complete database schema
- docs/DOCUMENTATION_ARTICLE_STORAGE.md - Article storage specifications
- docs/REQUIREMENTS_GUARDRAIL_TARGET_TIME.md - Time guardrail specifications
- docs/LOGGING_NODE_JS_V06.md - Winston logging requirements
- docs/PRODUCT_REQUIREMENTS_DOCUMENT.md - Original product requirements
- docs/reference/CLAUDE-NewsNexusRequesterGoogleRss02.md - Reference implementation (previous version)
