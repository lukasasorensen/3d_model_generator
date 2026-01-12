import { OpenSCADService } from "../../services/openscadService";
import { FileStorageService } from "../../services/fileStorageService";

export class CompilationAgent {
  constructor(
    private openscadService: OpenSCADService,
    private fileStorage: FileStorageService
  ) {}

  async compileModel(
    scadCode: string,
    format: "stl" | "3mf"
  ): Promise<{ fileId: string; outputPath: string; modelUrl: string }> {
    const { id: fileId, filePath: scadPath } =
      await this.fileStorage.saveScadFile(scadCode);
    const outputPath = this.fileStorage.getOutputPath(fileId, format);

    if (format === "stl") {
      await this.openscadService.generateSTL(scadPath, outputPath);
    } else {
      await this.openscadService.generate3MF(scadPath, outputPath);
    }

    return {
      fileId,
      outputPath,
      modelUrl: `/api/models/${fileId}/${format}`,
    };
  }
}
