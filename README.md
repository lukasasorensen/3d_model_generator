# OpenSCAD AI Model Generator

An AI-powered 3D model generator that converts natural language descriptions into 3D models using OpenAI GPT-4 and OpenSCAD.

## Features

- **Natural Language Input**: Describe your 3D model in plain English
- **AI-Powered Code Generation**: GPT-4 generates OpenSCAD code from your description
- **Conversation History**: Save and continue conversations with follow-up prompts to refine your models
- **Real-time 3D Visualization**: View your generated models in an interactive 3D viewer
- **Export Options**: Download models as STL or 3MF files
- **Code Display**: View the generated OpenSCAD code

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + react-three-fiber
- **Backend**: Node.js + TypeScript + Express + OpenAI SDK + Prisma
- **Database**: PostgreSQL (via Docker)
- **3D Generation**: OpenSCAD CLI
- **Monorepo**: npm workspaces with shared types

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/))
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

2. **Start PostgreSQL database**

   ```bash
   docker-compose up -d
   ```

   You can customize the PostgreSQL configuration using environment variables:

   | Variable            | Default           | Description         |
   | ------------------- | ----------------- | ------------------- |
   | `POSTGRES_USER`     | `openscad`        | Database username   |
   | `POSTGRES_PASSWORD` | `openscad_dev`    | Database password   |
   | `POSTGRES_DB`       | `openscad_models` | Database name       |
   | `POSTGRES_PORT`     | `5432`            | Host port to expose |

   Example with custom values:

   ```bash
   POSTGRES_PASSWORD=mysecurepassword docker-compose up -d
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Setup environment variables**

   Create a `.env` file in the `backend` directory:

   ```env
   PORT=3001
   OPENAI_API_KEY=sk-your-api-key-here
   NODE_ENV=development
   POSTGRES_USERNAME=username
   POSTGRES_PASSWORD=password
   POSTGRES_DB=db_name
   POSTGRES_PORT=5432
   ```

   Create a `.env` file in the `frontend` directory (optional - defaults work for local dev):

   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   ```

5. **Generate Prisma client and run migrations**
   ```bash
   cd backend
   npm run db:generate
   npm run db:push
   cd ..
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
6. **Add follow-up prompts** to refine your model (e.g., "make it twice as large" or "add a hole in the center")
7. Download the model as STL or 3MF
8. Your conversations are saved and can be accessed from the sidebar

## Example Prompts

### Initial prompts:

- "Create a cube with 20mm sides"
- "Make a sphere with radius 15mm"
- "Design a cylinder 30mm tall and 10mm in diameter"
- "Create a pyramid with a square base"
- "Make a torus with major radius 20mm and minor radius 5mm"

### Follow-up prompts:

- "Make it twice as large"
- "Add a hole through the center"
- "Round the edges"
- "Add a base underneath"

## Project Structure

```
open-scad-generate-models/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── api/           # Backend API client
│   │   └── hooks/         # Custom React hooks
│   └── package.json
├── backend/               # Express backend server
│   ├── prisma/            # Prisma schema and migrations
│   ├── src/
│   │   ├── services/      # Business logic (OpenAI, OpenSCAD, Conversations)
│   │   ├── controllers/   # Request handlers
│   │   └── routes/        # API routes
│   ├── generated/         # Generated files (.scad, .stl, .3mf)
│   └── package.json
├── shared/                # Shared TypeScript types
│   └── src/types/
├── docker-compose.yml     # PostgreSQL database
└── package.json           # Root workspace configuration
```

## API Endpoints

### Models

#### POST /api/models/generate

Generate a 3D model from a text prompt (without conversation history).

**Request:**

```json
{
  "prompt": "Create a cube with 20mm sides",
  "format": "stl"
}
```

#### GET /api/models/:id/:format

Download the generated model file.

### Conversations

#### GET /api/conversations

List all conversations.

#### POST /api/conversations

Create a new conversation with an initial prompt (streaming SSE).

**Request:**

```json
{
  "prompt": "Create a cube with 20mm sides",
  "format": "stl"
}
```

#### GET /api/conversations/:id

Get a conversation with all messages.

#### POST /api/conversations/:id/messages/stream

Add a follow-up message to a conversation (streaming SSE).

**Request:**

```json
{
  "prompt": "Make it twice as large",
  "format": "stl"
}
```

#### DELETE /api/conversations/:id

Delete a conversation.

## Database Management

### View database with Prisma Studio

```bash
cd backend
npm run db:studio
```

### Reset database

```bash
cd backend
npx prisma migrate reset
```

### Stop PostgreSQL

```bash
docker-compose down
```

### Stop PostgreSQL and delete data

```bash
docker-compose down -v
```

## Troubleshooting

### OpenSCAD not found

**Error:** `OpenSCAD is not installed or not in PATH`

**Solution:** Make sure OpenSCAD is installed and accessible from the command line. Run `openscad --version` to verify.

### Database connection failed

**Error:** `Can't reach database server`

**Solution:** Make sure Docker is running and the PostgreSQL container is up:

```bash
docker-compose up -d
docker-compose ps
```

### OpenAI API Error

**Error:** `401 Unauthorized` or `Invalid API key`

**Solution:** Check that your OpenAI API key is correctly set in `backend/.env`. Make sure there are no extra spaces or quotes.

### Port already in use

**Error:** `EADDRINUSE: address already in use`

**Solution:** Stop any other processes using ports 3001, 5173, or 5432, or change the ports in the configuration files.

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
- [Prisma](https://www.prisma.io/) - Next-generation ORM for Node.js
- [react-three-fiber](https://docs.pmnd.rs/react-three-fiber/) - React renderer for three.js
- [Three.js](https://threejs.org/) - JavaScript 3D library
