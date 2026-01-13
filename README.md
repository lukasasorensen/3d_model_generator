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
   npm run db:up
   ```

   This starts a PostgreSQL container using Docker Compose. The database configuration is read from your `backend/.env` file (see step 4).

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Setup environment variables**

   Create a `.env` file in the `backend` directory:

   ```env
   # Server
   PORT=3001
   NODE_ENV=development

   # OpenAI
   OPENAI_API_KEY=sk-your-api-key-here

   # PostgreSQL Connection (individual variables for Docker Compose)
   POSTGRES_USERNAME=ai_openscad
   POSTGRES_PASSWORD=ai_openscad_dev
   POSTGRES_DB=ai_openscad
   POSTGRES_HOST=localhost
  POSTGRES_PORT=5432

  # Prisma DATABASE_URL (constructed from above variables)
  DATABASE_URL=postgresql://ai_openscad:ai_openscad_dev@localhost:5432/ai_openscad

  # OpenSCAD
  OPENSCAD_MAX_RETRIES=2
  ```

   | Variable            | Required | Description                                     |
   | ------------------- | -------- | ----------------------------------------------- |
   | `OPENAI_API_KEY`    | Yes      | Your OpenAI API key                             |
   | `POSTGRES_USERNAME` | Yes      | PostgreSQL username                             |
   | `POSTGRES_PASSWORD` | Yes      | PostgreSQL password                             |
   | `POSTGRES_DB`       | Yes      | PostgreSQL database name                        |
   | `POSTGRES_HOST`     | Yes      | PostgreSQL host (use `localhost` for local dev) |
  | `POSTGRES_PORT`     | No       | PostgreSQL port (defaults to `5432`)            |
  | `DATABASE_URL`      | Yes      | Full connection URL for Prisma CLI commands     |
  | `PORT`              | No       | Backend server port (defaults to `3001`)        |
  | `OPENSCAD_MAX_RETRIES` | No    | Compile retry attempts (defaults to `2`)        |

   > **Note**: The `DATABASE_URL` must match the individual `POSTGRES_*` variables. It's required for Prisma CLI commands like migrations.

   Create a `.env` file in the `frontend` directory (optional - defaults work for local dev):

   ```env
   VITE_API_BASE_URL=http://localhost:3013/api
   ```

5. **Initialize the database schema**

   Generate the Prisma client and push the schema to the database:

   ```bash
   npm run db:generate
   npm run db:push
   ```

   > **Note**: Use `db:push` for development. For production, use `db:migrate` to create versioned migrations.

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

#### POST /api/models/stream

Generate or update a 3D model. Provide `conversationId` to update an existing conversation.

**Request:**

```json
{
  "prompt": "Create a cube with 20mm sides",
  "format": "stl",
  "conversationId": "optional-conversation-id"
}
```

#### GET /api/models/:id/:format

Download the generated model file.

### Conversations

#### GET /api/conversations

List all conversations.

#### GET /api/conversations/:id

Get a conversation with all messages.

#### DELETE /api/conversations/:id

Delete a conversation.

## Database Management

All database commands can be run from the project root using npm scripts.

### Available Commands

| Command               | Description                                        |
| --------------------- | -------------------------------------------------- |
| `npm run db:up`       | Start PostgreSQL container                         |
| `npm run db:down`     | Stop PostgreSQL container                          |
| `npm run db:reset`    | Stop container, delete all data, and restart fresh |
| `npm run db:logs`     | View PostgreSQL container logs (follow mode)       |
| `npm run db:generate` | Generate Prisma client from schema                 |
| `npm run db:migrate`  | Create and run database migrations (development)   |
| `npm run db:push`     | Push schema changes directly (no migration file)   |
| `npm run db:studio`   | Open Prisma Studio GUI to browse/edit data         |

### Starting the Database

```bash
npm run db:up
```

This starts the PostgreSQL container in the background. The container will automatically restart when Docker starts.

### Viewing Database Logs

```bash
npm run db:logs
```

Press `Ctrl+C` to stop following logs.

### Browsing Data with Prisma Studio

```bash
npm run db:studio
```

This opens a web-based GUI at http://localhost:5555 where you can view and edit your data.

### Schema Changes

When you modify `backend/prisma/schema.prisma`:

**For Development (quick iteration):**

```bash
npm run db:push
```

This syncs the database schema directly without creating migration files. Use this when prototyping.

**For Production (versioned migrations):**

```bash
npm run db:migrate
```

This creates a migration file in `backend/prisma/migrations/` and applies it. Use this for changes you want to track and deploy.

### Resetting the Database

To completely reset the database (delete all data and recreate):

```bash
npm run db:reset
```

This stops the container, removes the Docker volume (all data), restarts the container, and you'll need to run `npm run db:push` again to recreate the schema.

Alternatively, to reset while keeping the container running:

```bash
cd backend
npx prisma migrate reset
```

This drops and recreates all tables, re-runs migrations, and re-seeds data (if you have a seed script).

### Stopping the Database

```bash
# Stop container (data is preserved)
npm run db:down

# Stop container AND delete all data
npm run db:reset
```

### Connecting to PostgreSQL Directly

If you need to run SQL queries directly:

```bash
docker exec -it openscad-postgres psql -U ai_openscad -d ai_openscad
```

Replace the username and database name with your configured values from `.env`.

## Troubleshooting

### OpenSCAD not found

**Error:** `OpenSCAD is not installed or not in PATH`

**Solution:** Make sure OpenSCAD is installed and accessible from the command line. Run `openscad --version` to verify.

### Database connection failed

**Error:** `Can't reach database server`

**Solution:** Make sure Docker is running and the PostgreSQL container is up:

```bash
npm run db:up
docker compose ps
```

### Table does not exist

**Error:** `The table 'public.conversations' does not exist`

**Solution:** The database schema hasn't been applied. Run:

```bash
npm run db:push
```

### Authentication failed

**Error:** `Authentication failed against database server`

**Solution:** The database was created with different credentials than what's in your `.env` file. Reset the database:

```bash
npm run db:reset
npm run db:push
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
