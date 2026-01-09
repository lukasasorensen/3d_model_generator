import "dotenv/config";

export interface Config {
  server: {
    port: number;
    host: string;
  };
  db: {
    url: string;
    username: string;
    password: string;
    database: string;
    host: string;
    port: number;
  };
  logging: {
    level: string;
    logToFile: boolean;
    logFilePath: string;
    maxLogFileSize: number;
    maxLogFileCount: number;
  };
  openai: {
    apiKey: string;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || "3001"),
    host: process.env.HOST || "localhost",
  },
  db: {
    url: process.env.DATABASE_URL || "",
    username: process.env.POSTGRES_USERNAME || "",
    password: process.env.POSTGRES_PASSWORD || "",
    database: process.env.POSTGRES_DB || "",
    host: process.env.POSTGRES_HOST || "",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
    logToFile: process.env.LOG_TO_FILE === "true",
    logFilePath: process.env.LOG_FILE_PATH || "logs/app.log",
    maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || "5242880"), // 5MB
    maxLogFileCount: parseInt(process.env.MAX_LOG_FILE_COUNT || "5"),
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
};
