import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../infrastructure/logger/logger";

const execAsync = promisify(exec);

export class OpenSCADService {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    logger.debug("OpenSCADService initialized", { outputDir });
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
