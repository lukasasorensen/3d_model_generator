import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../infrastructure/logger/logger";

export class FileStorageService {
  constructor(
    private scadDir: string,
    private stlDir: string,
    private mfDir: string
  ) {
    logger.debug("FileStorageService initialized", {
      scadDir,
      stlDir,
      mfDir,
    });
  }

  async initialize(): Promise<void> {
    logger.info("Initializing file storage directories");
    try {
      await fs.mkdir(this.scadDir, { recursive: true });
      logger.debug("SCAD directory created/verified", { dir: this.scadDir });

      await fs.mkdir(this.stlDir, { recursive: true });
      logger.debug("STL directory created/verified", { dir: this.stlDir });

      await fs.mkdir(this.mfDir, { recursive: true });
      logger.debug("3MF directory created/verified", { dir: this.mfDir });

      logger.info("File storage directories initialized successfully");
    } catch (error: any) {
      logger.error("Failed to initialize file storage directories", {
        error: error.message,
        scadDir: this.scadDir,
        stlDir: this.stlDir,
        mfDir: this.mfDir,
      });
      throw error;
    }
  }

  async saveScadFile(
    content: string
  ): Promise<{ id: string; filePath: string }> {
    const id = uuidv4();
    const fileName = `${id}.scad`;
    const filePath = path.join(this.scadDir, fileName);

    logger.debug("Saving SCAD file", {
      id,
      fileName,
      contentLength: content.length,
    });

    try {
      await fs.writeFile(filePath, content, "utf-8");
      logger.info("SCAD file saved successfully", {
        id,
        filePath,
        contentLength: content.length,
      });
      return { id, filePath };
    } catch (error: any) {
      logger.error("Failed to save SCAD file", {
        id,
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  getOutputPath(id: string, format: "stl" | "3mf"): string {
    const dir = format === "stl" ? this.stlDir : this.mfDir;
    const outputPath = path.join(dir, `${id}.${format}`);
    logger.debug("Generated output path", { id, format, outputPath });
    return outputPath;
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      logger.debug("File exists", { filePath });
      return true;
    } catch {
      logger.debug("File does not exist", { filePath });
      return false;
    }
  }

  async cleanupOldFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const dirs = [this.scadDir, this.stlDir, this.mfDir];
    const maxAgeHours = Math.round(maxAgeMs / (1000 * 60 * 60));

    logger.info("Starting cleanup of old files", {
      maxAgeHours: `${maxAgeHours}h`,
      directories: dirs,
    });

    let totalDeleted = 0;
    let totalErrors = 0;

    for (const dir of dirs) {
      try {
        const files = await fs.readdir(dir);
        let dirDeleted = 0;

        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const stats = await fs.stat(filePath);
            const age = now - stats.mtimeMs;

            if (age > maxAgeMs) {
              await fs.unlink(filePath);
              dirDeleted++;
              logger.debug("Deleted old file", {
                filePath,
                ageHours: Math.round(age / (1000 * 60 * 60)),
              });
            }
          } catch (fileError: any) {
            totalErrors++;
            logger.warn("Error processing file during cleanup", {
              filePath,
              error: fileError.message,
            });
          }
        }

        totalDeleted += dirDeleted;
        if (dirDeleted > 0) {
          logger.debug("Cleaned up directory", {
            dir,
            filesDeleted: dirDeleted,
          });
        }
      } catch (error: any) {
        totalErrors++;
        logger.error("Error cleaning up directory", {
          dir,
          error: error.message,
        });
      }
    }

    logger.info("File cleanup completed", {
      filesDeleted: totalDeleted,
      errors: totalErrors,
    });
  }
}
