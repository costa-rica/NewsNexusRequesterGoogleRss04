# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewsNexusRequesterGoogleRss02 is a Google News RSS requester service that systematically fetches news articles based on search parameters defined in an Excel spreadsheet. It prioritizes requests intelligently (never-requested first, then oldest requests) and maintains request history in a database.

**Base URL**: `https://news.google.com/rss/`

## Common Commands

### Run the Application

```bash
npm start
# Or with guardrail bypass:
node index.js --run-anyway
```

### Install Dependencies

```bash
npm install
```

## Required Environment Variables

The application requires these environment variables in `.env`:

```bash
# Application Identity
NAME_APP=NewsNexusRequesterGoogleRss02

# Database Configuration
NAME_DB=newsnexus10.db
PATH_DATABASE=/Users/nick/Documents/_databases/NewsNexus10/

# File Paths
PATH_TO_API_RESPONSE_JSON_FILES=/path/to/api_response_json_files
PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED=/path/to/AutomatedRequestsGoogleNewsRss.xlsx
PATH_AND_FILENAME_TO_SEMANTIC_SCORER=/path/to/NewsNexusSemanticScorer02/index.js
PATH_TO_SEMANTIC_SCORER_DIR=/path/to/semantic_scorer
PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE=/path/to/NewsNexusSemanticScorerKeywords.xlsx

# Request Configuration
NAME_OF_ORG_REQUESTING_FROM="Google News RSS"
ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES=true
LIMIT_DAYS_BACK_TO_REQUEST=29
LIMIT_MAXIMUM_MASTER_INDEX=210
MILISECONDS_IN_BETWEEN_REQUESTS=1000

# Time Guardrail Configuration
GUARDRAIL_TARGET_TIME=00:40
GUARDRAIL_TARGET_WINDOW_IN_MINS=5

# Logging Configuration
NODE_ENV=testing
PATH_TO_LOGS=/path/to/logs/
LOG_MAX_FILES=1
NAME_CHILD_PROCESS_SEMANTIC_SCORER=NewsNexusSemanticScorer02
```

## High-Level Architecture

### Core Workflow

The application follows this sequence:

1. **Initialization** (index.js:1-76)
   - Load environment variables
   - Initialize Winston logger first
   - Apply time guardrail check (exits if outside configured window unless `--run-anyway` flag is used)
   - **CRITICAL**: Initialize database models via `initModels()` BEFORE importing any other modules

2. **Parameter Preparation** (index.js:104-146)
   - Read query objects from Excel spreadsheet (columns: id, andString, orString, notString, startDate, includeDomains, excludeDomains)
   - Split into never-requested vs previously-requested arrays
   - Sort previously-requested by dateEndOfRequest (ascending)
   - Prioritize: never-requested first, then oldest requests
   - Calculate dateEndOfRequest for each query

3. **Request Processing** (index.js:148-215)
   - Process requests in priority order
   - For each request:
     - Verify dateEndOfRequest is today or prior
     - Make RSS request via `requester()` function
     - Respect pacing with MILISECONDS_IN_BETWEEN_REQUESTS
     - Update NewsApiRequests table with results
   - Exit conditions:
     - Reached LIMIT_MAXIMUM_MASTER_INDEX
     - All queries updated (dateEndOfRequest is today)
     - Processed all queries in array

4. **Post-Processing**
   - Optionally run semantic scorer child process

### Module Organization

- **modules/logger.js**: Winston logger configuration (see LOGGING_NODE_JS_V06.md)
- **modules/requestsNewsGoogleRss.js**: Core RSS request logic, XML parsing (xml2js), database writes
- **modules/utilitiesMisc.js**: Date adjustment logic, request prioritization, child process spawning
- **modules/utilitiesReadAndMakeFiles.js**: Excel file reading (ExcelJS), JSON file writing

### Database Integration

**CRITICAL INITIALIZATION ORDER:**

```javascript
require("dotenv").config();
const logger = require("./modules/logger");

// MUST initialize models BEFORE importing other modules that use them
const { initModels, sequelize } = require("newsnexus10db");
initModels();

// NOW safe to import modules that use database models
const {
  getRequestsParameterArrayFromExcelFile,
} = require("./modules/utilitiesReadAndMakeFiles");
const {
  createArraysOfParametersNeverRequestedAndRequested,
} = require("./modules/utilitiesMisc");
```

**Why this matters**: The `newsnexus10db` package is a local TypeScript-based Sequelize ORM package (at `../NewsNexus10Db`). Models are unusable until `initModels()` completes initialization and applies associations. Attempting to use models before this will cause TypeError exceptions.

**Database Location**: Configured via `PATH_DATABASE` + `NAME_DB` environment variables

**Primary Tables Used**:

- **NewsApiRequest**: Tracks all RSS requests with search parameters (andString, orString, notString), date ranges, and article counts
- **Article**: Stores fetched articles
- **NewsArticleAggregatorSource**: Identifies the source (Google News RSS)
- **ArticleContent**: Full article text from web scraping

See docs/DATABASE_OVERVIEW.md for complete schema details.

### Time Guardrail System

The application enforces a configurable time window for execution:

- **Configuration**: `GUARDRAIL_TARGET_TIME` (HH:MM format, UTC) ± `GUARDRAIL_TARGET_WINDOW_IN_MINS` minutes
- **Default**: 00:40 ± 5 minutes = 00:35-00:45 UTC
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

**Child Processes**: Each child process (e.g., semantic scorer) gets its own logger via `NAME_CHILD_PROCESS_*` environment variable passed as child's `NAME_APP`

**V06 Early Exit Pattern**: All early exit scenarios (validation errors, guardrail checks) follow this pattern to ensure logs flush to disk in production mode:

```javascript
const message = "Exit reason here";
logger.error(message); // Winston log for file persistence
console.error(message); // Immediate stderr visibility
await new Promise((resolve) => setTimeout(resolve, 100)); // Flush buffer
process.exit(1); // Exit
```

**Why both logger and console.error?**

- `logger.*()` writes to Winston (buffered, file-only in production mode)
- `console.error()` writes directly to stderr (unbuffered, immediate visibility for systemd/cron)
- 100ms delay gives Winston time to flush buffer to disk before process termination

See docs/LOGGING_NODE_JS_V06.md for complete specifications.

### XML Parsing and Error Handling

Google News RSS returns XML responses. The application uses `xml2js` library with `parseStringPromise()` for async XML-to-JSON conversion.

**Timeout and Retry**:
- Each fetch request has a 20-second timeout using `AbortController`
- Single retry on failure with delay of `MILISECONDS_IN_BETWEEN_REQUESTS * 2`
- After both attempts fail, logs error and skips to next request

**Empty Results**: RSS feeds with no `<item>` elements (zero search results) are handled gracefully with an empty array fallback

**Error Resilience**: Individual request failures don't crash the service; errors are logged and processing continues with remaining requests

## Excel Spreadsheet Format

**Required Columns**:

- id
- andString (AND search terms)
- orString (OR search terms)
- notString (NOT search terms)
- startDate (YYYY-MM-DD format)
- includeDomains (comma-separated domain list)
- excludeDomains (comma-separated domain list)

**Note**: endDate is calculated by the application, not read from spreadsheet

## Key Behavioral Details

### Request Window

- **Default**: 10 days per request (hardcoded in requestsNewsGoogleRss.js:23)
- Each request covers startDate to startDate + 10 days (capped at today)

### Request Prioritization Logic

1. Queries never requested before (no matching entry in NewsApiRequests table)
2. Previously requested queries, sorted by dateEndOfRequest ascending (oldest first)
3. Filters out requests where dateEndOfRequest equals today

### Request Lifecycle

- **Date Adjustment**: If a request was made previously, the new startDate becomes the previous dateEndOfRequest
- **Database Tracking**: Each request creates/updates a NewsApiRequest record with:
  - Search parameters (andString, orString, notString)
  - Date ranges (dateStartOfRequest, dateEndOfRequest)
  - Article counts (received, saved, available)
  - Request status and URL

## Important Implementation Notes

1. **Always initialize logger before any other code** (after dotenv)
2. **Always call initModels() before importing modules that use database models**
3. **Respect the time guardrail system** - it's designed to prevent off-hours execution
4. **Handle Excel date parsing carefully** - ExcelJS returns Date objects or Excel serial numbers
5. **All times use UTC** - no timezone conversions
6. **Child process management** - Semantic scorer is spawned as separate process with its own logging

## Related Documentation

- docs/DATABASE_OVERVIEW.md - Complete database schema and model relationships
- docs/REQUIREMENTS_GUARDRAIL_TARGET_TIME.md - Time guardrail specifications
- docs/LOGGING_NODE_JS_V06.md - Winston logging requirements
- docs/MIGRATING_FROM_XLSX_TO_EXCELJS.md - Excel library migration notes
