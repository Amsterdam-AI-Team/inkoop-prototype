# Schrijfhulp Prototype (Inkoop)

A full-stack LLM writing assistance tool for the procurement team at the Municipality of Amsterdam. Built with Next.js, FastAPI, PostgreSQL, and Azure OpenAI, using the [Amsterdam Design System](https://designsystem.amsterdam).

This version is made specifically for Inkoop (procurement), but can be extended to other teams and use cases.

## Prerequisites

- Node.js 24+ and npm 11+
- Python 3.10+
- Docker (for PostgreSQL database)

## Quick Start

### 1. Database

```bash
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
```

This creates a PostgreSQL image with pgvector, the base schema, admin infrastructure, and two pre-seeded admin accounts.

### 2. Backend API

```bash
cd backend/api
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configure environment (see Environment Variables below)
cp .env.example .env
# Edit .env with your database and Azure OpenAI credentials

uvicorn main:app --reload
```

API available at http://localhost:8000 — Swagger docs at http://localhost:8000/docs

**Note:** Remember to activate the virtual environment each time:
```bash
cd backend/api && source .venv/bin/activate
```

### 3. Frontend

```bash
# From project root
npm install
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### 4. Initial Configuration

The application starts empty with generic placeholders. To configure it:

1. Log in with a pre-configured admin account:

   | Email | Password | Display Name |
   |-------|----------|--------------|
   | j.baas@example.com | `secret123!` | J. Baas |
   | k.bouwens@example.com | `secret123!` | K. Bouwens |

2. Navigate to the admin panel at [http://localhost:3000/admin](http://localhost:3000/admin)
3. Click **"Reset naar standaardwaarden inkoop"** to load:
   - App title and branding
   - System prompt for AI-generated content
   - Collection templates (e.g., "Inkoopstrategie")
   - Flow templates with prompts for chapters (e.g., "Hoofdstuk 5 Marktanalyse", "Hoofdstuk 9 Aanbestedingsprocedure")

After loading defaults, you can customize settings, templates, and add users through the admin interface.

**Important:** Change the default admin passwords after first login. The seed button overwrites existing settings and templates — use it for initial setup or to reset to defaults.

## Environment Variables

### Frontend (`.env` in project root)

See `.env.example`:

```env
NEXT_PUBLIC_BASE_PATH=''
API_BASE_URL=http://localhost:8000
```

You can optionally add `NEXT_PUBLIC_API_BASE_URL` if the public-facing API URL differs from `API_BASE_URL`.

### Backend (`backend/api/.env`)

See `backend/api/.env.example`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/inkoopsstrategie
JWT_SECRET=change_me_in_production
JWT_EXPIRES_MIN=60
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
```

## Architecture

### Tech Stack

**Frontend:**
- Next.js 15 with App Router and React Server Components
- Amsterdam Design System React components
- SWR for client-side caching and optimistic updates
- React Hook Form + Zod schemas
- MDX Editor for rich text editing

**Backend:**
- FastAPI (Python 3.10+)
- PostgreSQL 16 + pgvector
- JWT authentication (bcrypt for passwords)
- Azure OpenAI for text generation
- Selenium WebDriver for web search

### Authentication Flow

The app uses cookie-based authentication with httpOnly cookies:

1. User logs in via `/login` page → calls `/api/login` route
2. `/api/login` proxies to backend `/auth/login` endpoint
3. Backend returns access token, which is stored in httpOnly cookie
4. All authenticated requests include the cookie automatically
5. Session validation via `/api/me` endpoint on app load

### Project Structure

```
├── src/                           # Frontend (Next.js)
│   ├── app/
│   │   ├── (inkoop)/              # Authenticated routes
│   │   │   ├── page.tsx           # Home/dashboard (collections list)
│   │   │   ├── project/           # Project pages
│   │   │   │   ├── page.tsx       # Project detail (flows list)
│   │   │   │   ├── instructie/    # Flow instruction page
│   │   │   │   ├── bronnen/       # Sources upload page
│   │   │   │   └── concepttekst/  # Generated text preview
│   │   │   └── admin/             # Admin panel
│   │   ├── api/                   # Next.js API routes (proxy to backend)
│   │   └── login/                 # Login page (public)
│   ├── components/                # Reusable React components
│   ├── contexts/                  # React contexts (AuthContext)
│   ├── hooks/                     # SWR data fetching hooks
│   ├── lib/                       # API helpers, validation schemas, seed data
│   └── utils/                     # General utilities
│
├── backend/
│   ├── api/
│   │   ├── main.py                # FastAPI entry point
│   │   ├── endpoints/             # Route handlers (auth, collections, flows, admin)
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── services/              # Business logic
│   │   ├── middleware/             # OpenAI and websearch integrations
│   │   ├── prompts/               # LLM prompt templates
│   │   └── utils/                 # Helper functions
│   └── database/
│       ├── Dockerfile             # PostgreSQL + pgvector image
│       ├── init.sql               # Base schema
│       ├── 001_add_admin_and_settings.sql  # Admin tables + seed data
│       └── testdata.sql           # Optional test data
│
├── package.json                   # Frontend dependencies
├── next.config.mjs                # Next.js configuration
└── tsconfig.json                  # TypeScript configuration
```

## Frontend

### Data Fetching Pattern

The app uses SWR hooks for efficient data fetching with automatic caching:

- `useCollections()` — Fetch all collections for current user
- `useCollection(id)` — Fetch single collection with metadata
- `useFlows(collectionId)` — Fetch flows for a collection
- `useFlow(flowId)` — Fetch single flow with template content

All hooks are in `src/hooks/useInkoopData.ts` and provide automatic deduplication, optimistic UI updates, error handling, and cache revalidation.

### API Routes (Next.js Proxy Layer)

All API routes in `src/app/api/` proxy to the backend API, adding authentication from cookies:

| Frontend Route | Backend Endpoint |
|---|---|
| `POST /api/login` | `POST /auth/login` |
| `POST /api/logout` | `POST /auth/logout` |
| `GET /api/me` | `GET /users/me` |
| `GET /api/collections` | `GET /collections` |
| `GET /api/collections/:id` | `GET /collections/:id` |
| `PATCH /api/collections/:id` | `PATCH /collections/:id` |
| `GET /api/flows/:id` | `GET /flows/:id` |
| `PATCH /api/flows/:id` | `PATCH /flows/:id` |
| `GET /api/collections/:id/flows` | `GET /collections/:id/flows` |
| `POST /api/flows/:id/websearch` | `POST /flows/:id/websearch` |

### Shared Utilities

- **API Utilities** (`src/lib/api/utils.ts`): `ensureBaseUrl()`, `getAuthToken()`, `createAuthHeaders()`
- **Validation** (`src/lib/validation/schemas.ts`): Zod schemas for URLs, files, collections + constants (`MAX_FILE_SIZE`, `MAX_FILE_COUNT`, `MAX_URL_COUNT`)

## Backend

### API Endpoints

Base URL: `http://localhost:8000`

**Authentication:**
- `POST /auth/register` — Set password for pre-created users
- `POST /auth/login` — Login (returns JWT)
- `POST /auth/change-password` — Change own password

**Collections & Flows:**
- `POST /collections` — Create collection
- `DELETE /collections/{id}` — Delete collection
- `POST /flows/{collection_id}` — Create flow
- `DELETE /flows/{flow_id}` — Delete flow
- `POST /flows/{flow_id}/documents` — Upload document

**Web Search:**
- `POST /flows/{flow_id}/websearch` — Trigger search
- `POST /flows/{flow_id}/websearch/get_sources` — Get results

**Admin** (requires admin token):
- `GET/PATCH /admin/settings` — App settings
- `GET/POST /admin/collection-templates` — Collection templates
- `GET/POST /admin/users` — User management
- `PATCH /admin/users/{id}` — Update user (including password reset)

### Database Schema

**Core Tables:**
- `users` — Accounts (email, password hash, admin flag)
- `collections` — User's document collections
- `flows` — Workflows within collections
- `documents` — Uploaded files linked to flows
- `web_sources` — Search results from internet search

**Admin Tables:**
- `app_settings` — Key-value configuration (system prompt, branding)
- `collection_templates` — Collection type definitions
- `flow_templates` — Flow configurations linked to collection templates

### Database Management

**Load test data** (optional, for development):

```bash
docker exec -i inkoop-db psql -U postgres -d inkoopsstrategie < backend/database/testdata.sql
```

**Access the database** via psql:

```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie
```

**Full database reset** (deletes ALL data):

```bash
docker stop inkoop-db || true
docker rm inkoop-db || true
docker volume rm inkoop_db_data || true

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
```

## User Management

### Adding Users

Admins can create users via the admin panel at [http://localhost:3000/admin](http://localhost:3000/admin):

1. Expand "Gebruikers" section
2. Click "Nieuwe gebruiker"
3. Fill in email, display name, password
4. Check "Admin" if needed

**Alternative (API):**
```bash
curl -X POST http://localhost:8000/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "display_name": "New User",
    "password": "temp_password",
    "is_admin": false
  }'
```

### User Registration Flow

New users (created by admin without password) can set their password at [http://localhost:3000/account](http://localhost:3000/account) → "Registreren".

**Note:** This flow will be replaced by IntraID/SSO in production.

### Password Management

**Change own password (API):**
```bash
curl -X POST http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password": "old_password", "new_password": "new_password"}'
```

**Reset user password (admin):** Via admin panel → "Gebruikers" → "Wachtwoord resetten", or:
```bash
curl -X PATCH http://localhost:8000/admin/users/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "new_password"}'
```

## Troubleshooting

### Database Connection Failed

```bash
docker ps | rg inkoop-db     # Check if container is running
docker logs inkoop-db         # Check logs
```

### Can't Login with Admin Account

```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie \
  -c "SELECT email, is_admin, hashed_password IS NOT NULL AS has_password FROM users WHERE is_admin = TRUE;"
```

### Migration Not Applied

```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

If `app_settings` table is missing, the migration didn't run. Delete the volume and rebuild the database image.

## Design System

This project uses the [Amsterdam Design System](https://designsystem.amsterdam) for all UI components and styling.

- [Component Storybook](https://designsystem.amsterdam)
- [Design System Documentation](https://designsystem.amsterdam/docs)

## Future Enhancements

- [ ] IntraID/SSO integration (replace password login for internal users)
- [ ] Row-level security (RLS) for multi-tenant data isolation
- [ ] Audit logging for admin actions
- [ ] Email notifications for user creation
- [ ] API rate limiting
