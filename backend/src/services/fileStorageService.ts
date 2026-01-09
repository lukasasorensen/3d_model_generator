import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileStorageService {
  constructor(
    private scadDir: string,
    private stlDir: string,
    private mfDir: string
  ) {}

  async initialize(): Promise<void> {
    await fs.mkdir(this.scadDir, { recursive: true });
    await fs.mkdir(this.stlDir, { recursive: true });
    await fs.mkdir(this.mfDir, { recursive: true });
  }

  async saveScadFile(content: string): Promise<{ id: string; filePath: string }> {
    const id = uuidv4();
    const fileName = `${id}.scad`;
    const filePath = path.join(this.scadDir, fileName);

    await fs.writeFile(filePath, content, 'utf-8');

    return { id, filePath };
  }

  getOutputPath(id: string, format: 'stl' | '3mf'): string {
    const dir = format === 'stl' ? this.stlDir : this.mfDir;
    return path.join(dir, `${id}.${format}`);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupOldFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const dirs = [this.scadDir, this.stlDir, this.mfDir];

    for (const dir of dirs) {
      try {
        const files = await fs.readdir(dir);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.unlink(filePath);
          }
        }
      } catch (error) {
        console.error(`Error cleaning up directory ${dir}:`, error);
      }
    }
  }
}
