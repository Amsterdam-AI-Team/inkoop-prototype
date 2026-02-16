# Handige commands

## Full reset

Als je de database voor tests volledig wilt leegmaken en opnieuw starten:

```bash
docker stop inkoop-db || true
docker rm inkoop-db || true
docker volume rm inkoop_db_data || true

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

## Inloggen op de database (psql)

Soms wil je even handmatig in de database kijken:

```bash
docker exec -it inkoop-db psql -U postgres -d inkoopsstrategie
```
