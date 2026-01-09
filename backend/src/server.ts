import { createApp } from "./app";
import { OpenSCADService } from "./services/openscadService";
import * as path from "path";
import { config } from "./config/config";

const PORT = config.server.port;

function buildDatabaseUrl(): string {
  const host = config.db.host;
  const port = config.db.port;
  const user = config.db.username;
  const password = config.db.password;
  const database = config.db.database;

  const missingVars: string[] = [];
  if (!host) missingVars.push("db.host");
  if (!user) missingVars.push("db.username");
  if (!password) missingVars.push("db.password");
  if (!database) missingVars.push("db.database");

  if (missingVars.length > 0) {
    console.error("ERROR: Missing required database environment variables:");
    missingVars.forEach((v) => console.error(`  - ${v}`));
    console.error("");
    console.error("Please set the following in backend/.env:");
    console.error("  db.host=localhost");
    console.error("  POSTGRES_PORT=5432 (optional, defaults to 5432)");
    console.error("  db.username=ai_openscad");
    console.error("  db.password=ai_openscad_dev");
    console.error("  db.database=ai_openscad");
    process.exit(1);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function startServer() {
  if (!config.openai.apiKey) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set");
    console.error("Please set your OpenAI API key in backend/.env");
    process.exit(1);
  }

  // Build DATABASE_URL from individual components for Prisma
  config.db.url = buildDatabaseUrl();

  const openscadService = new OpenSCADService(
    path.join(__dirname, "../generated")
  );
  const isInstalled = await openscadService.checkInstallation();

  if (!isInstalled) {
    console.error("ERROR: OpenSCAD is not installed or not in PATH");
    console.error(
      "Please install OpenSCAD from: https://openscad.org/downloads.html"
    );
    console.error("");
    console.error("Installation instructions:");
    console.error("  macOS:   brew install openscad");
    console.error("  Linux:   sudo apt-get install openscad");
    console.error(
      "  Windows: Download from https://openscad.org/downloads.html"
    );
    process.exit(1);
  }

  const { app, fileStorage, shutdown } = createApp();

  await fileStorage.initialize();

  const server = app.listen(PORT, () => {
    console.log("");
    console.log("========================================");
    console.log("  OpenSCAD AI Model Generator Backend");
    console.log("========================================");
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log("OpenSCAD installation: ✓");
    console.log("OpenAI API key: ✓");
    console.log("Database: ✓");
    console.log("");
    console.log("Ready to generate 3D models!");
    console.log("========================================");
  });

  // Graceful shutdown
  const gracefulShutdown = async () => {
    console.log("\nShutting down gracefully...");
    server.close(async () => {
      await shutdown();
      console.log("Server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
