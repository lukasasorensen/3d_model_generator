import "dotenv/config";
import { createApp } from "./app";
import { OpenSCADService } from "./services/openscadService";
import * as path from "path";

const PORT = process.env.PORT || 3001;

function buildDatabaseUrl(): string {
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || "5432";
  const user = process.env.POSTGRES_USERNAME;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  const missingVars: string[] = [];
  if (!host) missingVars.push("POSTGRES_HOST");
  if (!user) missingVars.push("POSTGRES_USERNAME");
  if (!password) missingVars.push("POSTGRES_PASSWORD");
  if (!database) missingVars.push("POSTGRES_DB");

  if (missingVars.length > 0) {
    console.error("ERROR: Missing required database environment variables:");
    missingVars.forEach((v) => console.error(`  - ${v}`));
    console.error("");
    console.error("Please set the following in backend/.env:");
    console.error("  POSTGRES_HOST=localhost");
    console.error("  POSTGRES_PORT=5432 (optional, defaults to 5432)");
    console.error("  POSTGRES_USERNAME=ai_openscad");
    console.error("  POSTGRES_PASSWORD=ai_openscad_dev");
    console.error("  POSTGRES_DB=ai_openscad");
    process.exit(1);
  }

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

async function startServer() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY environment variable is not set");
    console.error("Please set your OpenAI API key in backend/.env");
    process.exit(1);
  }

  // Build DATABASE_URL from individual components for Prisma
  process.env.DATABASE_URL = buildDatabaseUrl();

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
