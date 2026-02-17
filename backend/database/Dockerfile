FROM postgres:16

RUN apt-get update && apt-get install -y postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Full schema + seed data
COPY init.sql /docker-entrypoint-initdb.d/01_init.sql
