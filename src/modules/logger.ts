import fs from "fs";
import path from "path";
import winston from "winston";

const resolvedEnv = process.env.NODE_ENV || process.env.NEXT_PUBLIC_MODE;
if (!resolvedEnv) {
  console.error("Missing required environment variable: NODE_ENV");
  process.exit(1);
}

if (!['development', 'testing', 'production'].includes(resolvedEnv)) {
  console.error(
    `Invalid NODE_ENV value: ${resolvedEnv}. Expected development, testing, or production.`,
  );
  process.exit(1);
}

const nameApp = process.env.NAME_APP;
if (!nameApp) {
  console.error("Missing required environment variable: NAME_APP");
  process.exit(1);
}

const pathToLogs = process.env.PATH_TO_LOGS;
if (!pathToLogs) {
  console.error("Missing required environment variable: PATH_TO_LOGS");
  process.exit(1);
}

if (resolvedEnv !== "development") {
  fs.mkdirSync(pathToLogs, { recursive: true });
}

const maxSizeMb = Number.parseInt(process.env.LOG_MAX_SIZE || "5", 10);
const maxFiles = Number.parseInt(process.env.LOG_MAX_FILES || "5", 10);
const maxSizeBytes = Number.isFinite(maxSizeMb)
  ? maxSizeMb * 1024 * 1024
  : 5 * 1024 * 1024;
const maxFilesCount = Number.isFinite(maxFiles) ? maxFiles : 5;

const transports: winston.transport[] = [];

if (resolvedEnv === "development" || resolvedEnv === "testing") {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(
          ({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`,
        ),
      ),
    }),
  );
}

if (resolvedEnv === "testing" || resolvedEnv === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.join(pathToLogs, `${nameApp}.log`),
      maxsize: maxSizeBytes,
      maxFiles: maxFilesCount,
      tailable: true,
    }),
  );
}

const logger = winston.createLogger({
  level: resolvedEnv === "development" ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`,
    ),
  ),
  transports,
});

export default logger;
