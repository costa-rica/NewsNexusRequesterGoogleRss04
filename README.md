# NewsNexusRequesterGoogleRss04

## Project Overview

This is a Node.js/TypeScript microservice that reads a query spreadsheet, builds Google News RSS searches, and stores requests/articles in the NewsNexus database. It also runs a semantic scorer child process after ingest completes.

## Setup

1. Ensure the local dependency exists at `../NewsNexus10Db`.
   - To install directly (locally): `npm install file:../NewsNexus10Db`
2. Install dependencies: `npm install`.
3. Build the project: `npm run build`.

## Usage

Run the compiled service:

```bash
npm start
```

Run directly with TypeScript in development:

```bash
npm run dev
```

Bypass the guardrail window:

```bash
node dist/index.js --run-anyway
```

The service reads the query spreadsheet from `PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED`, performs Google News RSS requests, stores results in the database, and then launches the semantic scorer child process.

## Project Structure

```
NewsNexusRequesterGoogleRss04/
├── src/
│   ├── modules/
│   │   ├── guardrail.ts        # Time window enforcement
│   │   ├── queryBuilder.ts     # RSS query + URL building
│   │   ├── rssFetcher.ts       # Google News RSS fetch
│   │   ├── spreadsheet.ts      # Excel query reader
│   │   ├── semanticScorer.ts   # Child process runner
│   │   ├── storage.ts          # DB writes
│   │   └── logger.ts           # Winston logging
│   ├── types/
│   │   └── query.ts            # Spreadsheet row shape
│   └── index.ts                # Main entrypoint
├── docs/
│   ├── LOGGING_NODE_JS_V06.md
│   ├── PRODUCT_REQUIREMENTS_DOCUMENT.md
│   └── README-format.md
├── package.json
├── tsconfig.json
└── README.md
```

## .env

```
NODE_ENV=development
NEXT_PUBLIC_MODE=
NAME_APP=NewsNexusRequesterGoogleRss04
PATH_TO_LOGS=/path/to/logs
LOG_MAX_SIZE=5
LOG_MAX_FILES=5
GUARDRAIL_TARGET_TIME=23:00
GUARDRAIL_TARGET_WINDOW_IN_MINS=5
PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED=/path/to/query_spreadsheet.xlsx
NAME_OF_ORG_REQUESTING_FROM=
GOOGLE_RSS_HL=en-US
GOOGLE_RSS_GL=US
GOOGLE_RSS_CEID=US:en
PATH_AND_FILENAME_TO_SEMANTIC_SCORER=/path/to/semantic_scorer/index.js
NAME_CHILD_PROCESS_SEMANTIC_SCORER=
PATH_TO_SEMANTIC_SCORER_DIR=/path/to/semantic_scorer
PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE=/path/to/semantic_scorer_keywords.xlsx
PATH_DATABASE=/path/to/database
NAME_DB=newsnexus10.db
```

## External Files

### Query Spreadsheet (Excel)

- Naming: Any `.xlsx` file path configured by `PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED`.
- Worksheet: Uses the first worksheet only.
- Required columns:
  - `id`: integer identifier for the row (optional, used for logging)
  - `and_keywords`: comma-separated keywords for AND searches
  - `and_exact_phrases`: quoted exact phrases for AND searches
  - `or_keywords`: comma-separated keywords for OR searches
  - `or_exact_phrases`: quoted exact phrases for OR searches
  - `time_range`: string such as `1d`, `1w`, `1m`, or `1y` for Google News time filters

### Semantic Scorer Keywords Spreadsheet (Excel)

- Naming: Any `.xlsx` file path configured by `PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE`.
- Expected contents: This file is passed to the semantic scorer child process; the expected columns/structure should match that scorer's requirements.

## Child Processes

### Semantic Scorer

- Command: `node "${PATH_AND_FILENAME_TO_SEMANTIC_SCORER}"`.
- Required env:
  - `PATH_AND_FILENAME_TO_SEMANTIC_SCORER`
  - `NAME_CHILD_PROCESS_SEMANTIC_SCORER`
  - `PATH_TO_SEMANTIC_SCORER_DIR`
  - `PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE`
- Logging: stdout/stderr are captured and logged by the parent. The child receives `NAME_APP` set to `NAME_CHILD_PROCESS_SEMANTIC_SCORER` so it can write its own log file when using the shared logging conventions.

## References

- [docs/DATABASE_OVERVIEW.md](docs/DATABASE_OVERVIEW.md)
- [docs/DOCUMENTATION_ARTICLE_STORAGE.md](docs/DOCUMENTATION_ARTICLE_STORAGE.md)
- [docs/LOGGING_NODE_JS_V06.md](docs/LOGGING_NODE_JS_V06.md)
- [docs/PRODUCT_REQUIREMENTS_DOCUMENT.md](docs/PRODUCT_REQUIREMENTS_DOCUMENT.md)
- [docs/README-format.md](docs/README-format.md)
- [docs/REQUIREMENTS_GUARDRAIL_TARGET_TIME.md](docs/REQUIREMENTS_GUARDRAIL_TARGET_TIME.md)
- [docs/reference/CLAUDE-NewsNexusRequesterGoogleRss02.md](docs/reference/CLAUDE-NewsNexusRequesterGoogleRss02.md)
