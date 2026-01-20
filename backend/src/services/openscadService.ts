import * as fs from "fs/promises";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../infrastructure/logger/logger";
import { FileStorageService } from "./fileStorageService";

const execAsync = promisify(exec);

export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

export class OpenSCADService {
  private outputDir: string;
  private fileStorage: FileStorageService | null = null;

  constructor(outputDir: string, fileStorage?: FileStorageService) {
    this.outputDir = outputDir;
    this.fileStorage = fileStorage || null;
    logger.debug("OpenSCADService initialized", { outputDir });
  }

  /**
   * Sets the FileStorageService dependency (for deferred initialization).
   */
  setFileStorage(fileStorage: FileStorageService): void {
    this.fileStorage = fileStorage;
  }

  async checkInstallation(): Promise<boolean> {
    logger.debug("Checking OpenSCAD installation");
    try {
      const { stdout } = await execAsync("openscad --version");
      logger.info("OpenSCAD installation verified", {
        version: stdout.trim(),
      });
      return true;
    } catch (error: any) {
      logger.error("OpenSCAD not found or not accessible", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Saves SCAD code and generates a preview image.
   */
  async previewModel({
    scadCode,
  }: {
    scadCode: string;
  }): Promise<{
    fileId: string;
    previewPath: string;
    previewUrl: string;
    scadPath: string;
  }> {
    if (!this.fileStorage) {
      throw new Error("FileStorageService not configured");
    }

    const { id: fileId, filePath: scadPath } =
      await this.fileStorage.saveScadFile(scadCode);

    try {
      await this.generatePreview(scadPath, fileId);
    } catch (error: any) {
      throw new CompileError(`Failed to compile model: ${error.message}`);
    }

    const previewPath = path.join(
      path.dirname(path.dirname(scadPath)),
      "previews",
      `${fileId}.png`
    );

    const previewUrl = `/api/previews/${fileId}.png`;

    return {
      fileId,
      previewPath,
      previewUrl,
      scadPath,
    };
  }

  /**
   * Generates the final output file (STL or 3MF).
   */
  async generateOutput(
    scadPath: string,
    fileId: string,
    format: "stl" | "3mf"
  ): Promise<{ outputPath: string; modelUrl: string }> {
    if (!this.fileStorage) {
      throw new Error("FileStorageService not configured");
    }

    const outputPath = this.fileStorage.getOutputPath(fileId, format);

    if (format === "stl") {
      await this.generateSTL(scadPath, outputPath);
    } else {
      await this.generate3MF(scadPath, outputPath);
    }

    return {
      outputPath,
      modelUrl: `/api/models/${fileId}/${format}`,
    };
  }

  /**
   * Generates a preview PNG image from SCAD file.
   */
  async generatePreview(scadPath: string, fileId: string): Promise<string> {
    const previewsDir = path.join(
      path.dirname(path.dirname(scadPath)),
      "previews"
    );
    await fs.mkdir(previewsDir, { recursive: true });
    const previewPath = path.join(previewsDir, `${fileId}.png`);

    const command = `openscad -o "${previewPath}" --imgsize=800,600 --viewall --autocenter "${scadPath}"`;
    logger.debug("Generating OpenSCAD preview", { command, previewPath });

    try {
      await execAsync(command, { timeout: 60000 });
      return previewPath;
    } catch (error: any) {
      logger.error("Failed to generate preview image", {
        error: error.message,
        previewPath,
      });
      throw new CompileError(
        `Failed to generate preview image: ${error.message}`
      );
    }
  }

  async generateSTL(
    scadFilePath: string,
    outputFilePath: string
  ): Promise<void> {
    const command = `openscad -o "${outputFilePath}" "${scadFilePath}"`;
    logger.info("Generating STL file", {
      scadFilePath,
      outputFilePath,
    });
    logger.debug("Executing OpenSCAD command", { command });

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000,
      });

      const duration = Date.now() - startTime;

      if (stdout) {
        logger.debug("OpenSCAD stdout", { stdout: stdout.trim() });
      }

      if (stderr) {
        // OpenSCAD often outputs warnings to stderr that aren't errors
        if (stderr.includes("ERROR")) {
          logger.error("OpenSCAD compilation error", {
            stderr: stderr.trim(),
            scadFilePath,
          });
          throw new Error(`OpenSCAD compilation error: ${stderr}`);
        }
        logger.debug("OpenSCAD stderr (non-error)", { stderr: stderr.trim() });
      }

      logger.info("STL file generated successfully", {
        scadFilePath,
        outputFilePath,
        duration: `${duration}ms`,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error.killed || error.signal) {
        logger.error("OpenSCAD compilation timed out", {
          scadFilePath,
          outputFilePath,
          duration: `${duration}ms`,
          timeout: "60s",
        });
        throw new Error("OpenSCAD compilation timed out after 60 seconds");
      }

      logger.error("Failed to generate STL", {
        scadFilePath,
        outputFilePath,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw new Error(`Failed to generate STL: ${error.message}`);
    }
  }

  async generate3MF(
    scadFilePath: string,
    outputFilePath: string
  ): Promise<void> {
    const command = `openscad -o "${outputFilePath}" "${scadFilePath}"`;
    logger.info("Generating 3MF file", {
      scadFilePath,
      outputFilePath,
    });
    logger.debug("Executing OpenSCAD command", { command });

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000,
      });

      const duration = Date.now() - startTime;

      if (stdout) {
        logger.debug("OpenSCAD stdout", { stdout: stdout.trim() });
      }

      if (stderr) {
        if (stderr.includes("ERROR")) {
          logger.error("OpenSCAD compilation error", {
            stderr: stderr.trim(),
            scadFilePath,
          });
          throw new Error(`OpenSCAD compilation error: ${stderr}`);
        }
        logger.debug("OpenSCAD stderr (non-error)", { stderr: stderr.trim() });
      }

      logger.info("3MF file generated successfully", {
        scadFilePath,
        outputFilePath,
        duration: `${duration}ms`,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error.killed || error.signal) {
        logger.error("OpenSCAD compilation timed out", {
          scadFilePath,
          outputFilePath,
          duration: `${duration}ms`,
          timeout: "60s",
        });
        throw new Error("OpenSCAD compilation timed out after 60 seconds");
      }

      logger.error("Failed to generate 3MF", {
        scadFilePath,
        outputFilePath,
        error: error.message,
        duration: `${duration}ms`,
      });
      throw new Error(`Failed to generate 3MF: ${error.message}`);
    }
  }

  parseError(stderr: string): {
    message: string;
    line?: number;
    column?: number;
  } {
    const lineMatch = stderr.match(/line (\d+)/);
    const colMatch = stderr.match(/column (\d+)/);

    const parsed = {
      message: stderr,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: colMatch ? parseInt(colMatch[1], 10) : undefined,
    };

    logger.debug("Parsed OpenSCAD error", parsed);
    return parsed;
  }
}
