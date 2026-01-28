# Product Requirements Document: NewsNexus Requester (Google RSS) 04

The goal of this project is to create a Type Script microservice that can be used to fetch news articles from the Google RSS feed.

## Code Structure

The code base will be in an src/ directory. The entry point should be an index.ts file. The code should be modular so that if the workflow changes we can modify the code without affecting the rest of the codebase. Make use of a src/modules/ directory to store the modules. You can use an src/types/ directory to store the types. But place the logging and other utilities in the src/modules/ directory.

The indext.ts file should have a guardrail to check the time and exit if it is outside of the guardrail window. We will make use of two environment variables to define the guardrail window. The environment variables are GUARDRAIL_TARGET_TIME and GUARDRAIL_TARGET_WINDOW_IN_MINS. The guardrail will be checked before the application starts.

This microservice will replace an existing microservice called NewsNexusRequesterGoogleRss02. The main difference is that the new microservice will have a spreadsheet with parameters better suited for the Google RSS feed. Also, we want this codebase to be modular and easy to maintain. I have added the NewsNexusRequesterGoogleRss02's CLAUDE.md file in docs/reference/CLAUDE-NewsNexusRequesterGoogleRss02.md for reference. You can use this as a reference but in cases where we can do things better we should do them better.

## Workflow

The service will make use of a spreadsheet to provide the parameters for the requests. The spreadsheet filename and path will be in the .env variable PATH_AND_FILENAME_FOR_QUERY_SPREADSHEET_AUTOMATED.

The service should have a function that will make the request to the Google RSS feed based a single set of parameters. Then the results will be parsed and stored in the database. To do this we have documentation on the existing approach in the file DOCUMENTATION_ARTICLE_STORAGE.md. This microservice will replace an existing microservice called NewsNexusRequesterGoogleRss02. The documetnation in DOCUMENTATION_ARTICLE_STORAGE.md lays out how the existing microservice works and how the database is structured. This part should not change.

When adding data to the NewsApiRequests table, combine the and_keywords and and_exact_phrases into a single string separated by commas and add them to the `andString` column. Ideally, we would like to keep the qoutes from the and_exact_phrases in the string. Do the same for the or_keywords and or_exact_phrases into a single string separated by commas and add them to the `orString` column.

Since the Google RSS feed does not have official documentation may need to modify the query request structure so this should be this adds to why we want to have a funciton or a small set of functions to handle the query request. Then we will build a looping mechinaism around this function to handle the spreadsheet.

When the microservice runs it should loop through the spreadsheet and for each row it should call the function to make the request to the Google RSS feed.

## Database

There is a docs/DATABASE_OVERVIEW.md file that lays out the database structure and how this microservice will interact with it.

## Logging

There is a docs/LOGGING_NODE_JS_V06.md file that lays out the logging structure we want to use for this microservice.

## Run Semantic Scorer

After the microservice has run and stored the articles in the database it should run the semantic scorer on the articles.

Here is sample code from the NewsNexusRequesterGoogleRss02 which is a JS microservice that runs the semantic scorer on the articles.

```js
async function runSemanticScorer() {
  logger.info(
    `Starting child process: ${process.env.PATH_AND_FILENAME_TO_SEMANTIC_SCORER}`,
  );

  // Prepare environment variables for child process
  const childEnv = {
    ...process.env, // Inherit all parent environment variables
    NAME_APP: process.env.NAME_CHILD_PROCESS_SEMANTIC_SCORER, // Pass child process name
  };

  return new Promise((resolve, reject) => {
    exec(
      `node "${process.env.PATH_AND_FILENAME_TO_SEMANTIC_SCORER}"`,
      { env: childEnv }, // Pass environment variables to child
      (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error executing child process: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          logger.error(`Child process stderr: ${stderr}`);
        }
        logger.info(`Child process finished`);
        resolve(stdout);
      },
    );
  })
    .then(() => {
      logger.info(
        " [NewsNexusRequesterGoogleRss02] ✅ NewsNexusSemanticScorer02 has finished.",
      );
      process.exit();
    })
    .catch(() => {
      logger.info(
        " [NewsNexusRequesterGoogleRss02] ❌ NewsNexusSemanticScorer02 has finished with error.",
      );
      process.exit(1);
    });
}
```

## User Spreadsheet

The spreadsheet will contain a column for search query terms
The columns will be:
id: integer
and_keywords: string, use commas to separate keywords
and_exact_phrases: string, use quotes to create exact phrases
or_keywords: string, use commas to separate keywords
or_exact_phrases: string, use quotes to create exact phrases
time_range: string, "1d", "1w", "1m", "1y"
