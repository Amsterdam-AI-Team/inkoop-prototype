# Deployment Plan: Inkoop Prototype

Plan for deploying the Inkoop (Schrijfhulp) prototype to Azure, using the RND-HQ
shared App Service template from https://github.com/Amsterdam/innovation-rnd-hq.
This document is the agreed plan before any code or infra changes. No application
code is changed by writing this plan.

## Goal

Get the Inkoop prototype (Next.js frontend + FastAPI backend + PostgreSQL/pgvector)
running on Azure App Service behind the Amsterdam Cloud Platform shared services,
reachable at a stable URL for the procurement team pilot.

## Locked decisions

1. **Hosting: Azure App Service** (not AKS). After removing the websearch feature
   the app is a plain web + API workload, which is the App Service sweet spot.
2. **Routing: full mode (DigiCert subdomain), straight to the domain.** Target
   URL `https://inkoop.rnd.amsterdam.nl`. Confirmed with Mani: the shared wildcard
   (preview path-based routing) is not ready and would cause more problems, so we
   go straight to a dedicated domain with its own DigiCert cert. No interim
   `*.azurewebsites.net` phase: the template disables public access and the cert
   is under 24 hours, so a temporary public URL is not worth the template change.
   Bonus: a subdomain serves the app at root, so we do not need
   `NEXT_PUBLIC_BASE_PATH` path rewriting.
3. **Remove websearch from the prototype.** Strip the browser-driven websearch
   flow so the image stays slim (no Chromium) and the backend is request/response
   only. This is a code change handled in a later session, not here.
4. **Database: reuse the existing Postgres Flexible Server with a new database.**
   Server `ailab-o-7qgpypjt4y2lg` in resource group `ailab-o-rg`
   (subscription `f9a64e31-6933-4a1e-b05f-382d251d2463`, ONT). Per Mani: we reuse
   the shared server but create a dedicated `inkoop` database on it, and the infra
   pipeline must create that database (the App Service template does not manage
   databases). See the database creation step below.
   Portal: https://portal.azure.com/#resource/subscriptions/f9a64e31-6933-4a1e-b05f-382d251d2463/resourceGroups/ailab-o-rg/providers/Microsoft.DBforPostgreSQL/flexibleServers/ailab-o-7qgpypjt4y2lg

## Target architecture (ONT)

```
Internet
  -> Shared ADS (Application Gateway + WAF)        [Cloud Platform]
     listener: inkoop.rnd.amsterdam.nl (DigiCert)
       -> App Service: inkoop-web  (Next.js, port 8080)   [rg-rnd-inkoop-ont]
            -> App Service: inkoop-api (FastAPI, port 8000) via private endpoint
                 -> Postgres Flexible Server ailab-o-7qgpypjt4y2lg  [ailab-o-rg]
                 -> Azure OpenAI (AI Foundry endpoint)
```

- Only `inkoop-web` is exposed through the ADS listener. The frontend calls the
  API server-side via its internal `*.azurewebsites.net` hostname.
- Both apps run on one App Service Plan in resource group `rg-rnd-inkoop-ont`.
- Secrets live in the workload Key Vault (`provisionKeyVault: true`).

## Fixed environment values (ONT)

| Item | Value |
|------|-------|
| Subscription | `f9a64e31-6933-4a1e-b05f-382d251d2463` |
| Workload name | `inkoop` |
| Resource group (created by template) | `rg-rnd-inkoop-ont` |
| Workload ACR | `rndhqacront.azurecr.io` (in `shared-o-rg`) |
| VNet | `infr-weu-vnet-rnd-ont-01` |
| Variable group | `RND-HQ-SharedInfra-Ont` |
| Postgres server | `ailab-o-7qgpypjt4y2lg.postgres.database.azure.com` (in `ailab-o-rg`) |
| CCC env file | `infra/cloud-platform/ccc-rnd/Environments/ccc-rnd-ont-01.json` |
| Target URL | `https://inkoop.rnd.amsterdam.nl` |

## Two-track model (important)

Deployment is two parallel tracks. Both are our responsibility.

- **Workload track** (this repo): Dockerfiles, build + infra pipelines, App
  Service. We own this end to end.
- **Cloud Ops track** (PR to the Azure DevOps `CCC-RND` repo): the ADS listener,
  DigiCert cert reference, subnets, and NSG rules. Reviewed and merged by the
  Cloud Platform team. Has lead time, so start it early.

## Prerequisites and blockers

1. **DigiCert certificate** for `inkoop.rnd.amsterdam.nl`. Process Mani uses
   (under 24 hours):
   1. Create a CSR for the domain in the shared Key Vault `shared-o-tupiyhowoglqm`
      in `shared-o-rg`
      (https://portal.azure.com/#@amsterdam.nl/resource/subscriptions/f9a64e31-6933-4a1e-b05f-382d251d2463/resourceGroups/shared-o-rg/providers/Microsoft.KeyVault/vaults/shared-o-tupiyhowoglqm/certificates).
   2. Upload the CSR to DigiCert, wait for approval (under 24 hours).
   3. Download the completed cert from DigiCert and upload it back to the Key
      Vault.
   Its Key Vault URI then goes into the ADS full-mode fragment
   (`keyVaultCertificate`). Start this first; it is the long pole.
2. **One-time App Service platform setup in the ONT VNet** (if not already done
   for an earlier App Service workload):
   - `AzureAppService` subnet delegated to `Microsoft.Web/serverFarms`.
   - `PrivateLinkEndpointIntern` subnet for private endpoints.
   - Shared ACR-pull managed identity `id-rndhq-appservice-acrpull-o` and ACR
     `rndhqacront` in `shared-o-rg` (provisioned by `pipelines/infra.yaml` in
     rnd-hq; idempotent).
3. **Postgres connectivity (verified facts, Cloud Ops change needed).** Checked
   on the live server `ailab-o-7qgpypjt4y2lg`:
   - `publicNetworkAccess: Disabled`. No public path, not reachable from a laptop.
   - The server is **VNet-injected** into VNet `infr-weu-vnet-rnd-ont-05`, subnet
     `DatabaseAI` (RG `infr-weu-networking-rg`), with private DNS zone
     `ailab-o-7qgpypjt4y2lg.private.postgres.database.azure.com`.
   - This is a **different VNet** than the App Service VNet `infr-weu-vnet-rnd-ont-01`.
   - A VNet-injected flex server **cannot take a private endpoint**, so the PE
     idea does not apply. Connectivity options (both are Cloud Ops work, the VNets
     are Cloud-Platform-managed):
     - (a) Peer `infr-weu-vnet-rnd-ont-01` and `infr-weu-vnet-rnd-ont-05`, and link
       the DB private DNS zone to `-01` so the FQDN resolves.
     - (b) Point the App Service VNet integration at `-05` instead of `-01` (the
       template allows overriding `vnetName` / `networkResourceGroupName`), which
       needs a delegated `AzureAppService` subnet in `-05`.
   Raise this with Mani as the primary networking question.
4. **pgvector on the flex server (not enabled yet, verified).** Current
   `azure.extensions` = `pgaudit,postgis,citext,timescaledb,pg_trgm`, so `vector`
   is missing. Add `vector` to the allowlist (control-plane write, needs
   Contributor/admin via `EM4W-RND-o-ailab-developer` or `-admin`), then
   `CREATE EXTENSION vector` in the target database.
5. **Database schema and target DB (verified).** The only non-system database on
   the server is `main` (created by Kasper); there is no `inkoop` database yet.
   Confirm with Kasper whether `main` is the inkoop database or whether we create a
   dedicated one. The local setup bakes schema + pgvector + seed admins into a
   Docker image (`backend/database/Dockerfile` + `init.sql`); for Azure we apply
   `backend/database/init.sql` to the chosen database instead.
6. **Public network access is disabled by the template.** The App Service Bicep
   sets `publicNetworkAccess: 'Disabled'` (`app-service.bicep:146`). The web app
   is reachable only through its private endpoint via Shared ADS. There is no
   working `*.azurewebsites.net` public URL out of the box, so the "use the App
   Service URL for now" idea needs either a template change to enable public
   access for an interim phase, or we go straight to the ADS + WAF + domain route.
   See open question 1.
7. **Access to the flex server (partially verified).** Control-plane reads work
   (we can list the server and databases via inherited Reader). Control-plane
   write (enabling pgvector) needs Contributor/admin via `EM4W-RND-o-ailab-developer`
   or `-admin`, which our account does not visibly have; ask Kasper to add us or to
   make the change. Data-plane access to run `init.sql` needs either the
   `localpgadmin` password (Kasper has it) or an Entra Postgres role created for
   our account (Entra auth is enabled on the server). Both password and Entra auth
   are on.

## Secrets to move to Key Vault

From `backend/api/.env.example`. None of these belong in `.env` files in the repo
for the deployed app.

| Secret | Notes |
|--------|-------|
| `DATABASE_URL` | `postgresql+psycopg2://<user>:<pw>@ailab-o-7qgpypjt4y2lg.postgres.database.azure.com:5432/<db>` |
| `JWT_SECRET` | Generate a strong value, not `change_me_in_production` |
| `JWT_EXPIRES_MIN` | Non-secret config, can be a plain app setting |
| `AZURE_OPENAI_ENDPOINT` | AI Foundry endpoint |
| `AZURE_OPENAI_API_KEY` | Prefer managed identity later, key for now |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name |

Frontend needs `API_BASE_URL` pointing at the internal API hostname
(`https://inkoop-api-o-app.azurewebsites.net`), set as an app setting.

## Phased plan

### Phase 0: Kick off the long-lead items (do first, in parallel)

- Request the DigiCert cert for `inkoop.rnd.amsterdam.nl`.
- Confirm the one-time App Service VNet setup exists in ONT, or run the rnd-hq
  team `pipelines/infra.yaml` to create it.
- Line up the Postgres private endpoint and DNS with Mani (see Phase 3), and
  enable pgvector on the flex server.

### Phase 1: Code cleanup (later session, code change)

- Remove the websearch flow: the `/flows/{id}/websearch*` endpoints, `run_search`,
  and the `browser_use` agent in `backend/api/endpoints/flows_router.py`.
- Drop `browser-use` and `beautifulsoup4` from `backend/api/requirements.txt`.
- Drop or ignore the `web_search_sources` table.
- Add `output: 'standalone'` to `next.config.mjs` for a slim frontend image.

### Phase 2: Containerize (later session, code change)

- `Dockerfile` for the frontend (Next.js standalone, expose 8080).
- `Dockerfile` for the backend (FastAPI/uvicorn, expose 8000).
- Model both on `rnd-hq/examples/app-service-hello-world` and
  `rnd-hq/infra/docker/`.

### Phase 3: Database setup

The server is VNet-injected and the shared App Service template does not manage
databases, so this is partly a Cloud Ops change and partly a step in this repo's
pipeline (not a fork of the template):

- **Network connectivity (Cloud Ops / Mani):** make the DB VNet
  `infr-weu-vnet-rnd-ont-05` reachable from the App Service VNet
  `infr-weu-vnet-rnd-ont-01`, via peering plus linking the
  `ailab-o-7qgpypjt4y2lg.private.postgres.database.azure.com` private DNS zone to
  `-01`, or by integrating the App Service into `-05`. A private endpoint is not
  an option for a VNet-injected flex server.
- **Target database:** confirm with Kasper whether to use the existing `main`
  database or create a dedicated `inkoop` one
  (`az postgres flexible-server db create -g ailab-o-rg -s ailab-o-7qgpypjt4y2lg
  -d inkoop`).
- **Enable pgvector** on the server: add `vector` to the `azure.extensions`
  allowlist (`az postgres flexible-server parameter set -g ailab-o-rg
  -s ailab-o-7qgpypjt4y2lg --name azure.extensions --value
  vector,pgaudit,postgis,citext,timescaledb,pg_trgm`), then `CREATE EXTENSION
  vector` in the target database.
- Apply `backend/database/init.sql` to the target database.
- Seed or create the first admin account (the app also has a
  "Reset naar standaardwaarden inkoop" admin action).

### Phase 4: Pipelines (workload track)

- `pipelines/build-image.yaml`: builds and pushes `rnd/inkoop-web` and
  `rnd/inkoop-api` to `rndhqacront`.
- `pipelines/infra.yaml`: extends
  `infra/templates/app-service/template.yaml@rndHqInfra` with
  `routingMode: full`, `provisionKeyVault: true`, and two apps:
  ```yaml
  apps:
    - name: "web"
      containerRepository: "rnd/inkoop-web"
      containerTag: "$(Build.SourceVersion)"
      containerPort: "8080"
    - name: "api"
      containerRepository: "rnd/inkoop-api"
      containerTag: "$(Build.SourceVersion)"
      containerPort: "8000"
  ```
- Run `rnd doctor` to verify Azure login, subscription, ACR access, and the
  variable group before running pipelines.

### Phase 5: Cloud Ops PR (Cloud Ops track)

- Copy `infra/templates/app-service/cloud-platform.full.fragment.jsonc`, replace
  `myapp` with `inkoop`, and set `keyVaultCertificate` to the real DigiCert URI.
- Open a PR to `CCC-RND` targeting `Environments/ccc-rnd-ont-01.json`.
- Use the `cloud-platform` skill before editing Cloud Platform JSON.
- This adds the dedicated listener for `inkoop.rnd.amsterdam.nl`, the backend
  pool pointing at `inkoop-web-o-app.azurewebsites.net`, NSG rules, and the WAF
  policy.

### Phase 6: Wire secrets and verify

- Populate the workload Key Vault with the secrets above.
- Confirm the App Service identities have `Key Vault Secrets User`.
- After the cert is active and the CCC PR merges, verify
  `https://inkoop.rnd.amsterdam.nl` resolves, the frontend reaches the API, and
  the API reaches Postgres and Azure OpenAI.

## Open questions

1. **DB VNet connectivity** (Mani / Cloud Ops): the server is VNet-injected in
   `infr-weu-vnet-rnd-ont-05`/`DatabaseAI`, the App Service goes into `-01`. Peer
   the two VNets and link the DB private DNS zone to `-01`, or integrate the App
   Service into `-05`? Which approach does Cloud Ops prefer?
2. **Our rights and credentials** (Kasper): can we be added to
   `EM4W-RND-o-ailab-developer` for control-plane writes (pgvector), and how do we
   connect to run `init.sql` (the `localpgadmin` password, or an Entra Postgres
   role for our account)?
3. **Target database** (Kasper): use the existing `main` database, or create a
   dedicated `inkoop` one?
4. **Auth**: the prototype uses its own JWT + bcrypt admin login. Keep that for
   the pilot, or move to Entra ID before exposing publicly?

## Draft messages (not sent yet)

Ready to send when we want to unblock the two tracks. Status: not sent.

### To Kasper (database)

> Hoi Kasper, dank voor het aanmaken van de db op `ailab-o-7qgpypjt4y2lg`. Ik zie
> alleen een database `main` staan, geen `inkoop`. Is `main` bedoeld voor inkoop,
> of zullen we een aparte `inkoop`-db maken? Verder twee dingen die ik nodig heb
> om de boel op te zetten: (1) kun je mij in `EM4W-RND-o-ailab-developer` zetten,
> zodat ik pgvector als server-parameter kan aanzetten (`vector` ontbreekt nu in
> `azure.extensions`)? En (2) hoe verbind ik met de db om ons schema te laden, via
> het `localpgadmin`-wachtwoord of kun je een Entra-Postgres-rol voor mijn account
> aanmaken?

### To Mani (networking)

> Hoi Máni, kleine correctie op mijn eerdere vraag: de flex server
> `ailab-o-7qgpypjt4y2lg` blijkt VNet-injected in `infr-weu-vnet-rnd-ont-05`
> (subnet `DatabaseAI`) met public access uit, dus een private endpoint kan niet.
> De App Service komt in `-01`. Wat heeft jullie voorkeur: `-01` en `-05` peeren +
> de private DNS-zone aan `-01` koppelen, of de App Service VNet-integratie meteen
> in `-05` hangen? Dan stem ik de pipeline daarop af.
