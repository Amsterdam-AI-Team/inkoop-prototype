# Backend API - Inkoopstrategie

> **Note:** This is the backend API. For frontend setup, see the [root README](../README.md).

Een backend-API die inkopers ondersteunt bij het opstellen van **inkoopstrategieën**.

---

## Quick Start (Clean Repository)

### 1. Build Database Image

```bash
cd backend/database
docker build -t inkoop-db:latest .
```

This creates a PostgreSQL image with:
- pgvector extension
- Base schema (users, collections, flows, documents)
- Admin infrastructure (settings, templates)
- Two pre-seeded admin accounts

### 2. Start Database

```bash
docker run -d \
  --name inkoop-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=inkoopsstrategie \
  -v inkoop_db_data:/var/lib/postgresql/data \
  -p 5432:5432 \
  inkoop-db:latest
```

### 3. Start API

```bash
cd backend/api

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the API
uvicorn main:app --reload
```

API available at: http://localhost:8000

**Note:** Remember to activate the virtual environment each time you work on the API:
```bash
cd backend/api
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

---

## Initial Admin Accounts

Two admin accounts are pre-configured:

| Email | Password | Display Name |
|-------|----------|--------------|
| j.baas@amsterdam.nl | `secret123!` | J. Baas |
| k.bouwens@amsterdam.nl | `secret123!` | K. Bouwens |

**Important:** Change these passwords immediately after first login via the admin panel or `/auth/change-password` endpoint.

---

## Initial Application Setup

**The application starts empty** with generic placeholders. To configure it for use:

1. Log in with an admin account (see above)
2. Navigate to the admin panel at http://localhost:3000/admin
3. Click the **"Reset naar standaardwaarden inkoop"** button

This loads the default configuration from `src/lib/seeds/inkoop-settings.json`, including:
- **App settings:** title, branding, and system prompt for AI content generation
- **Collection templates:** document type definitions (e.g., "Inkoopstrategie")
- **Flow templates:** chapter templates with detailed prompts for each section
  - Hoofdstuk 5 Marktanalyse (Market Analysis)
  - Hoofdstuk 9 Aanbestedingsprocedure (Tender Procedure)

After loading defaults, you can customize everything through the admin interface:
- Edit app title and branding
- Modify the system prompt that guides AI content generation
- Create/edit collection and flow templates
- Manage users and permissions

**Note:** The seed button overwrites existing settings and templates. Use it for initial setup or to reset to defaults.

---

## User Management

### Adding New Users

Admins can create users via the admin panel:

1. Log in as admin at http://localhost:3000/account
2. Navigate to http://localhost:3000/admin
3. Expand "Gebruikers" section
4. Click "Nieuwe gebruiker"
5. Fill in email, display name, password
6. Check "Admin" if needed
7. Click "Aanmaken"

**Alternative (API):**
```bash
curl -X POST http://localhost:8000/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@amsterdam.nl",
    "display_name": "New User",
    "password": "temp_password",
    "is_admin": false
  }'
```

### User Registration Flow

New users (created by admin without password) can set their password:

1. Navigate to http://localhost:3000/account
2. Click "Registreren"
3. Enter email (must match admin-created account)
4. Set password
5. Submit

**Note:** This flow will be replaced by IntraID/SSO in production.

---

## Password Management

### Change Own Password

Logged-in users can change their password:

**Via API:**
```bash
curl -X POST http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "old_password",
    "new_password": "new_password"
  }'
```

### Reset User Password (Admin Only)

Admins can reset any user's password:

1. Log in as admin at http://localhost:3000/admin
2. Find user in "Gebruikers" section
3. Click "Wachtwoord resetten"
4. Enter new password
5. Click "Opslaan"

**Alternative (API):**
```bash
curl -X PATCH http://localhost:8000/admin/users/USER_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "new_password"}'
```

---

## Development & Testing

### Loading Test Data

For local development, you can load demo users, collections, and flows:

```bash
cd backend/database
docker exec -i inkoop-db psql -U postgres -d inkoopsstrategie < testdata.sql
```

This creates:
- 6 demo users (including k.bouwens@amsterdam.nl with password)
- Sample collections and flows
- Embedded prompt templates

**Note:** testdata.sql is NOT loaded automatically - it's opt-in for development.

### Accessing the Database

Direct database access via psql:

```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie
```

Useful queries:
```sql
-- List all users
SELECT id, email, display_name, is_admin,
       hashed_password IS NOT NULL AS has_password
FROM users;

-- List all collections
SELECT c.id, c.name, u.email AS owner
FROM collections c
JOIN users u ON c.user_id = u.id;

-- List all templates
SELECT type, display_name, enabled FROM collection_templates;
```

---

## Full Database Reset

To completely reset the database (deletes ALL data):

```bash
docker stop inkoop-db || true
docker rm inkoop-db || true
docker volume rm inkoop_db_data || true

# Rebuild and restart
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

---

## Architecture

### Core Features

1. **Document Management** - Upload and analyze documents
2. **Internet Search** - Automated web research via Selenium
3. **Text Generation** - AI-powered content creation via Azure OpenAI
4. **Flows** - Multi-step workflows combining documents, search, and generation
5. **Admin System** - Template management, user management, app settings

### Tech Stack

- **API:** FastAPI (Python 3.10+)
- **Database:** PostgreSQL 16 + pgvector
- **Auth:** JWT tokens (bcrypt for passwords)
- **AI:** Azure OpenAI
- **Search:** Selenium WebDriver

### Project Structure

```
backend/
├── api/
│   ├── endpoints/          # API routes (auth, collections, flows, admin)
│   ├── middleware/         # OpenAI and websearch integrations
│   ├── models/             # SQLAlchemy ORM models
│   ├── services/           # Business logic
│   ├── schemas/            # Pydantic request/response models
│   ├── .venv/              # Virtual environment (created during setup)
│   ├── main.py             # FastAPI application entry point
│   └── requirements.txt    # Python dependencies
└── database/
    ├── Dockerfile          # PostgreSQL + pgvector image
    ├── init.sql            # Base schema
    ├── 001_add_admin_and_settings.sql  # Admin infrastructure + seed admins
    └── testdata.sql        # Optional test data
```

### Database Schema

**Core Tables:**
- `users` - User accounts (email, password hash, admin flag)
- `collections` - User's document collections
- `flows` - Workflows within collections
- `documents` - Uploaded files linked to flows
- `web_sources` - Search results from internet search

**Admin Tables:**
- `app_settings` - Key-value configuration (system prompt, branding)
- `collection_templates` - Collection type definitions
- `flow_templates` - Flow configurations (linked to collection templates)

---

## API Overview

Base URL (dev): `http://localhost:8000`

### Authentication
- `POST /auth/register` - Set password for pre-created users
- `POST /auth/login` - Login (returns JWT)
- `POST /auth/change-password` - Change own password

### Collections & Flows
- `POST /collections` - Create collection
- `DELETE /collections/{id}` - Delete collection
- `POST /flows/{collection_id}` - Create flow
- `DELETE /flows/{flow_id}` - Delete flow
- `POST /flows/{flow_id}/documents` - Upload document

### Web Search
- `POST /flows/{flow_id}/websearch` - Trigger search
- `POST /flows/{flow_id}/websearch/get_sources` - Get results

### Admin (requires admin token)
- `GET /admin/settings` - Get all settings
- `PATCH /admin/settings/{key}` - Update setting
- `GET /admin/collection-templates` - List templates
- `POST /admin/collection-templates` - Create template
- `GET /admin/users` - List users
- `POST /admin/users` - Create user
- `PATCH /admin/users/{id}` - Update user (including password reset)

**Swagger Docs:** http://localhost:8000/docs

---

## Environment Variables

Create `.env` file in `backend/api/` (see `.env.example`):

```bash
# Copy the example file
cd backend/api
cp .env.example .env
# Then edit .env with your actual credentials
```

Required variables:
```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/inkoopsstrategie
JWT_SECRET=change_me_in_production
JWT_EXPIRES_MIN=60
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
```

---

## Troubleshooting

### Database Connection Failed

Check if container is running:
```bash
docker ps | rg inkoop-db
```

Check logs:
```bash
docker logs inkoop-db
```

### Can't Login with Admin Account

Verify admin users exist:
```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie \
  -c "SELECT email, is_admin, hashed_password IS NOT NULL AS has_password FROM users WHERE is_admin = TRUE;"
```

### Migration Not Applied

Check applied scripts:
```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

If `app_settings` table missing, migration didn't run. Check:
1. Is 001_add_admin_and_settings.sql copied to container?
2. Is database volume fresh (delete volume and rebuild)

---

## Future Enhancements

- [ ] IntraID/SSO integration (replace password login for internal users)
- [ ] Row-level security (RLS) for multi-tenant data isolation
- [ ] Audit logging for admin actions
- [ ] Email notifications for user creation
- [ ] API rate limiting
