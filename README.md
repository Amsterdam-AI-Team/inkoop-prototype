# Schrijfhulp Prototype Frontend

Next.js frontend application for a llm writing assistance tool, built with the [Amsterdam Design System](https://designsystem.amsterdam).

This version is make specifically for Inkoop (the procurement team at the municipality).

## Prerequisites

- Node.js 24+ and npm 11+
- Backend API running (default: `http://localhost:8000`)
- Python 3.10+ (for backend)
- Docker (for PostgreSQL database)

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Initial Configuration

**Important:** On first load, the application will be empty with generic placeholders. You need to configure it via the admin panel.

### Quick Setup:

1. Start both the backend and frontend (see Backend Setup below)
2. Log in with one of the pre-configured admin accounts (see [backend/README.md](backend/README.md#initial-admin-accounts)):
   - `j.baas@example.com` / `secret123!` (J. Baas)
   - `k.bouwens@example.com` / `secret123!` (K. Bouwens)
3. Navigate to the admin panel at [http://localhost:3000/admin](http://localhost:3000/admin)
4. Click **"Reset naar standaardwaarden inkoop"** to load:
   - App title and branding
   - System prompt for AI-generated content
   - Collection templates (e.g., "Inkoopstrategie")
   - Flow templates with prompts for chapters (e.g., "Hoofdstuk 5 Marktanalyse", "Hoofdstuk 9 Aanbestedingsprocedure")

After loading defaults, you can customize settings, templates, and add users through the admin interface.

## Backend Setup

The backend API is located in the `/backend` directory. You must set up and run the backend before the frontend will work.

**Quick start:**

```bash
# 1. Setup PostgreSQL with Docker
cd backend/database
docker build -t inkoop-db:latest .
docker run -d \
  --name inkoop-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=inkoopsstrategie \
  -v inkoop_db_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  inkoop-db:latest

# 2. Setup and start the API
cd ../api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configure backend/api/.env with database and Azure OpenAI credentials (see backend/README.md)
uvicorn main:app --reload
```

For detailed backend setup instructions, see [backend/README.md](backend/README.md).

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```bash
# Base path for the application (empty for root, or e.g., '/inkoop')
NEXT_PUBLIC_BASE_PATH=''

# Backend API URL (used by Next.js API routes on the server)
API_BASE_URL=http://localhost:8000
```

**Note:** You can optionally add `NEXT_PUBLIC_API_BASE_URL` if the public-facing API URL differs from `API_BASE_URL`.

## Tech Stack

- **Framework:** Next.js 15 with App Router and React Server Components
- **UI Components:** Amsterdam Design System React components
- **Data Fetching:** SWR for client-side caching and optimistic updates
- **Form Validation:** React Hook Form + Zod schemas
- **Styling:** Amsterdam Design System CSS + Tokens
- **Authentication:** Cookie-based sessions with httpOnly tokens

## Architecture

### Authentication Flow

The app uses cookie-based authentication with httpOnly cookies for security:

1. User logs in via `/login` page → calls `/api/login` route
2. `/api/login` proxies to backend `/auth/login` endpoint
3. Backend returns access token, which is stored in httpOnly cookie
4. All authenticated requests include the cookie automatically
5. Session validation via `/api/me` endpoint on app load

### Data Fetching Pattern

The app uses SWR hooks for efficient data fetching with automatic caching:

- `useCollections()` - Fetch all collections for current user
- `useCollection(id)` - Fetch single collection with metadata
- `useFlows(collectionId)` - Fetch flows for a collection
- `useFlow(flowId)` - Fetch single flow with template content

All hooks are located in `src/hooks/useInkoopData.ts` and provide:
- Automatic deduplication of requests
- Optimistic UI updates
- Built-in error handling
- Cache revalidation strategies

### API Routes (Next.js Proxy Layer)

All API routes in `src/app/api/` act as proxies to the backend API, adding authentication from cookies:

#### Authentication
- `POST /api/login` → Backend: `POST /auth/login`
- `POST /api/logout` → Backend: `POST /auth/logout`
- `GET /api/me` → Backend: `GET /users/me`

#### Collections
- `GET /api/collections` → Backend: `GET /collections`
- `GET /api/collections/:id` → Backend: `GET /collections/:id`
- `PATCH /api/collections/:id` → Backend: `PATCH /collections/:id`

#### Flows
- `GET /api/flows/:id` → Backend: `GET /flows/:id`
- `PATCH /api/flows/:id` → Backend: `PATCH /flows/:id`
- `GET /api/collections/:id/flows` → Backend: `GET /collections/:id/flows`

#### Web Search
- `POST /api/flows/:id/websearch` → Backend: `POST /flows/:id/websearch`

### Shared Utilities

- **API Utilities** (`src/lib/api/utils.ts`): Shared helpers for API routes
  - `ensureBaseUrl()` - Validates and returns API base URL
  - `getAuthToken()` - Retrieves access token from cookies
  - `createAuthHeaders()` - Creates standard auth headers

- **Validation** (`src/lib/validation/schemas.ts`): Zod schemas and constants
  - `urlSchema`, `fileSchema`, `collectionSchema`
  - `MAX_FILE_SIZE`, `MAX_FILE_COUNT`, `MAX_URL_COUNT`
  - Validation utilities for files and URLs

## Project Structure

```
src/
├── app/
│   ├── (inkoop)/           # Main app routes (with auth layout)
│   │   ├── page.tsx        # Home/dashboard page (collections list)
│   │   ├── project/        # Project-related pages
│   │   │   ├── page.tsx    # Project detail (flows list)
│   │   │   ├── instructie/ # Flow instruction/context page
│   │   │   ├── bronnen/    # Sources upload page
│   │   │   └── concepttekst/ # Generated text preview
│   │   └── veelgestelde-vragen/
│   ├── api/                # Next.js API routes (proxy to backend)
│   ├── login/              # Login page (public)
│   └── layout.tsx          # Root layout
├── components/             # Reusable React components
├── contexts/               # React contexts (AuthContext)
├── hooks/                  # Custom React hooks (SWR data fetching)
├── lib/                    # Shared utilities
│   ├── api/                # API helper functions
│   └── validation/         # Zod schemas and validation
└── utils/                  # General utility functions
```

## Design System

This project uses the [Amsterdam Design System](https://designsystem.amsterdam) for all UI components and styling.

**Resources:**
- [Component Storybook](https://designsystem.amsterdam)
- [Design System Documentation](https://designsystem.amsterdam/docs)