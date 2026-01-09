import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class OpenSCADService {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async checkInstallation(): Promise<boolean> {
    try {
      await execAsync('openscad --version');
      return true;
    } catch {
      return false;
    }
  }

  async generateSTL(scadFilePath: string, outputFilePath: string): Promise<void> {
    const command = `openscad -o "${outputFilePath}" "${scadFilePath}"`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000,
      });

      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`OpenSCAD compilation error: ${stderr}`);
      }
    } catch (error: any) {
      if (error.killed || error.signal) {
        throw new Error('OpenSCAD compilation timed out after 60 seconds');
      }
      throw new Error(`Failed to generate STL: ${error.message}`);
    }
  }

  async generate3MF(scadFilePath: string, outputFilePath: string): Promise<void> {
    const command = `openscad -o "${outputFilePath}" "${scadFilePath}"`;

    try {
      const { stderr } = await execAsync(command, {
        timeout: 60000,
      });

      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`OpenSCAD compilation error: ${stderr}`);
      }
    } catch (error: any) {
      if (error.killed || error.signal) {
        throw new Error('OpenSCAD compilation timed out after 60 seconds');
      }
      throw new Error(`Failed to generate 3MF: ${error.message}`);
    }
  }

  parseError(stderr: string): { message: string; line?: number; column?: number } {
    const lineMatch = stderr.match(/line (\d+)/);
    const colMatch = stderr.match(/column (\d+)/);

    return {
      message: stderr,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: colMatch ? parseInt(colMatch[1], 10) : undefined,
    };
  }
}
