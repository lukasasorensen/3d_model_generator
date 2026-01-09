import 'dotenv/config';
import { createApp } from './app';
import { OpenSCADService } from './services/openscadService';
import * as path from 'path';

const PORT = process.env.PORT || 3001;

async function startServer() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is not set');
    console.error('Please set your OpenAI API key in backend/.env');
    process.exit(1);
  }

  const openscadService = new OpenSCADService(path.join(__dirname, '../generated'));
  const isInstalled = await openscadService.checkInstallation();

  if (!isInstalled) {
    console.error('ERROR: OpenSCAD is not installed or not in PATH');
    console.error('Please install OpenSCAD from: https://openscad.org/downloads.html');
    console.error('');
    console.error('Installation instructions:');
    console.error('  macOS:   brew install openscad');
    console.error('  Linux:   sudo apt-get install openscad');
    console.error('  Windows: Download from https://openscad.org/downloads.html');
    process.exit(1);
  }

  const { app, fileStorage } = createApp();

  await fileStorage.initialize();

  app.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  OpenSCAD AI Model Generator Backend');
    console.log('========================================');
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log('OpenSCAD installation: ✓');
    console.log('OpenAI API key: ✓');
    console.log('');
    console.log('Ready to generate 3D models!');
    console.log('========================================');
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
