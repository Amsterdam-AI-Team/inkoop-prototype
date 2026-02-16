FROM postgres:16

RUN apt-get update && apt-get install -y postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Basis schema
COPY init.sql /docker-entrypoint-initdb.d/10_init.sql

# Admin infrastructure + seeded admin users
COPY 001_add_admin_and_settings.sql /docker-entrypoint-initdb.d/20_add_admin_and_settings.sql
