# OpenSCAD AI Model Generator

An AI-powered 3D model generator that converts natural language descriptions into 3D models using OpenAI GPT-4 and OpenSCAD.

## Features

- **Natural Language Input**: Describe your 3D model in plain English
- **AI-Powered Code Generation**: GPT-4 generates OpenSCAD code from your description
- **Real-time 3D Visualization**: View your generated models in an interactive 3D viewer
- **Export Options**: Download models as STL or 3MF files
- **Code Display**: View the generated OpenSCAD code

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + react-three-fiber
- **Backend**: Node.js + TypeScript + Express + OpenAI SDK
- **3D Generation**: OpenSCAD CLI
- **Monorepo**: npm workspaces with shared types

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **OpenSCAD** ([Installation instructions below](#installing-openscad))
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))

## Installing OpenSCAD

### macOS
```bash
brew install openscad
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install openscad
```

### Windows
Download the installer from [https://openscad.org/downloads.html](https://openscad.org/downloads.html)

### Verify Installation
```bash
openscad --version
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd open-scad-generate-models
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**

   Create a `.env` file in the `backend` directory:
   ```bash
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env` and add your OpenAI API key:
   ```env
   PORT=3001
   OPENAI_API_KEY=sk-your-api-key-here
   NODE_ENV=development
   ```

   Create a `.env` file in the `frontend` directory:
   ```bash
   cp frontend/.env.example frontend/.env
   ```

   The default frontend `.env` should work for local development:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

## Running the Application

### Development Mode

Run both frontend and backend simultaneously:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend (port 3001)
npm run dev:backend

# Terminal 2 - Frontend (port 5173)
npm run dev:frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001

## Usage

1. Open http://localhost:5173 in your browser
2. Enter a description of the 3D model you want to create (e.g., "a cube with rounded corners")
3. Click "Generate 3D Model"
4. Wait for the AI to generate the OpenSCAD code and compile it
5. View your 3D model in the interactive viewer
6. Download the model as STL or 3MF

## Example Prompts

- "Create a cube with 20mm sides"
- "Make a sphere with radius 15mm"
- "Design a cylinder 30mm tall and 10mm in diameter"
- "Create a pyramid with a square base"
- "Make a torus with major radius 20mm and minor radius 5mm"

## Project Structure

```
open-scad-generate-models/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── api/         # Backend API client
│   │   └── hooks/       # Custom React hooks
│   └── package.json
├── backend/           # Express backend server
│   ├── src/
│   │   ├── services/    # Business logic (OpenAI, OpenSCAD)
│   │   ├── controllers/ # Request handlers
│   │   └── routes/      # API routes
│   ├── generated/       # Generated files (.scad, .stl, .3mf)
│   └── package.json
├── shared/            # Shared TypeScript types
│   └── src/types/
└── package.json       # Root workspace configuration
```

## API Endpoints

### POST /api/models/generate
Generate a 3D model from a text prompt.

**Request:**
```json
{
  "prompt": "Create a cube with 20mm sides",
  "format": "stl"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "prompt": "Create a cube with 20mm sides",
    "scadCode": "cube([20, 20, 20]);",
    "modelUrl": "/api/models/uuid/stl",
    "format": "stl",
    "generatedAt": "2024-01-09T...",
    "status": "completed"
  }
}
```

### GET /api/models/:id/:format
Download the generated model file.

## Troubleshooting

### OpenSCAD not found
**Error:** `OpenSCAD is not installed or not in PATH`

**Solution:** Make sure OpenSCAD is installed and accessible from the command line. Run `openscad --version` to verify.

### OpenAI API Error
**Error:** `401 Unauthorized` or `Invalid API key`

**Solution:** Check that your OpenAI API key is correctly set in `backend/.env`. Make sure there are no extra spaces or quotes.

### Port already in use
**Error:** `EADDRINUSE: address already in use`

**Solution:** Stop any other processes using ports 3001 or 5173, or change the ports in the configuration files.

### Cannot load STL file
**Error:** Three.js fails to load the STL file

**Solution:** Check the browser console for CORS errors. Make sure the backend is running and accessible.

## Development

### Building for Production
```bash
npm run build
```

### Type Checking
```bash
npm run type-check
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- [OpenSCAD](https://openscad.org/) - The Programmers Solid 3D CAD Modeller
- [OpenAI](https://openai.com/) - GPT-4 API
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer for three.js
- [Three.js](https://threejs.org/) - JavaScript 3D library
