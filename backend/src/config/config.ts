import 'dotenv/config';

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
    models: {
      tiny: string;
      small: string;
      medium: string;
      large: string;
      xlarge: string;
    };
  };
  openscad: {
    maxCompileRetries: number;
  };
  otel: {
    enabled: boolean;
    serviceName: string;
    otlpEndpoint: string;
    debug: boolean;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || 'localhost'
  },
  db: {
    url: process.env.DATABASE_URL || '',
    username: process.env.POSTGRES_USERNAME || '',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DB || '',
    host: process.env.POSTGRES_HOST || '',
    port: parseInt(process.env.POSTGRES_PORT || '5432')
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logToFile: process.env.LOG_TO_FILE === 'true',
    logFilePath: process.env.LOG_FILE_PATH || 'logs/app.log',
    maxLogFileSize: parseInt(process.env.MAX_LOG_FILE_SIZE || '5242880'), // 5MB
    maxLogFileCount: parseInt(process.env.MAX_LOG_FILE_COUNT || '5')
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    models: {
      tiny: process.env.OPENAI_MODEL_TINY || 'gpt-4.1-nano',
      small: process.env.OPENAI_MODEL_SMALL || 'gpt-5-nano',
      medium: process.env.OPENAI_MODEL_MEDIUM || 'gpt-5-mini',
      large: process.env.OPENAI_MODEL_LARGE || 'gpt-5',
      xlarge: process.env.OPENAI_MODEL_XLARGE || 'gpt-5'
    }
  },
  openscad: {
    maxCompileRetries: parseInt(process.env.OPENSCAD_MAX_RETRIES || '2')
  },
  otel: {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME || 'openscad-ai-backend',
    otlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || `http://localhost:${process.env.OTLP_GRPC_PORT || '4317'}`,
    debug: process.env.OTEL_DEBUG === 'true'
  }
};
