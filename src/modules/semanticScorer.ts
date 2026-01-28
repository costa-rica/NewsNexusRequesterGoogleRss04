import { exec } from "child_process";
import logger from "./logger";

export async function runSemanticScorer(): Promise<void> {
  const scorerPath = process.env.PATH_AND_FILENAME_TO_SEMANTIC_SCORER;
  const childName = process.env.NAME_CHILD_PROCESS_SEMANTIC_SCORER;
  const scorerDir = process.env.PATH_TO_SEMANTIC_SCORER_DIR;
  const scorerKeywordsFile =
    process.env.PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE;

  if (!scorerPath) {
    throw new Error("Missing PATH_AND_FILENAME_TO_SEMANTIC_SCORER env var.");
  }
  if (!childName) {
    throw new Error("Missing NAME_CHILD_PROCESS_SEMANTIC_SCORER env var.");
  }
  if (!scorerDir) {
    throw new Error("Missing PATH_TO_SEMANTIC_SCORER_DIR env var.");
  }
  if (!scorerKeywordsFile) {
    throw new Error(
      "Missing PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE env var.",
    );
  }

  logger.info(`Starting child process: ${scorerPath}`);

  const childEnv = {
    ...process.env,
    NAME_APP: childName,
    PATH_TO_SEMANTIC_SCORER_DIR: scorerDir,
    PATH_TO_SEMANTIC_SCORER_KEYWORDS_EXCEL_FILE: scorerKeywordsFile,
  };

  await new Promise<void>((resolve, reject) => {
    exec(`node "${scorerPath}"`, { env: childEnv }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error executing child process: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        logger.error(`Child process stderr: ${stderr}`);
      }
      if (stdout) {
        logger.info(`Child process output: ${stdout}`);
      }
      logger.info("Child process finished");
      return resolve();
    });
  });
}
