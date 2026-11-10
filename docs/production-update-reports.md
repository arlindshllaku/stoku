# Ndërrimet, raportet dhe SMTP

## Sjellja

- IMEI i shitur ose i dalë në ndërrim mund të hyjë përsëri në të njëjtin dyqan. Përdoret i njëjti artikull; shitja origjinale, kostoja në faturë dhe lëvizjet ruhen.
- Telefoni hyrës me IMEI që është tashmë në stok/rezervim refuzohet.
- Një ndërrim pranon 1 deri 100 telefona hyrës. Cash mund të hyjë, të dalë ose të jetë zero.
- Transaksionet e vjetra që i përkasin një qarkullimi të mëparshëm nuk editohen/fshihen pasi telefoni kthehet përsëri.
- Telefonat ekzistues të pranuar në ndërrim nuk fshihen gjatë editimit.
- Raportet ndahen në shitje, ndërrime, blerje, lëvizje inventari dhe stok aktual.
- Datat e raporteve përfshijnë gjithë ditën sipas zonës kohore të dyqanit.
- Inventari sipas datave tregon lëvizjet gjatë periudhës; stoku aktual tregon gjendjen tani, jo një rindërtim historik të stokut.
- Pamja ka 50 rreshta për faqe; eksporti përmban gjithë periudhën, deri në 20 000 regjistrime. Për më shumë zgjidhet periudhë më e shkurtër.
- XLSX është skedar real Excel; PDF përdor DejaVu Sans për ë/ç. Teksti i përdoruesve në Excel ruhet si tekst, jo si formulë.

## SMTP dhe automatizimet

Super admin/pronari me users.manage dhe reports.export hap Cilësimet për dyqanin e zgjedhur.

1. Ruaj serverin SMTP, portin, STARTTLS/SSL, përdoruesin, fjalëkalimin dhe adresën dërguese.
2. Dërgo email testues.
3. Krijo një automatizim me marrësit, raportet, PDF/XLSX, intervalin në minuta (minimumi 15), numrin e ditëve dhe dërgimin e parë.
4. Për stokun aktual zgjidh Stoku aktual; datat nuk kufizojnë këtë gjendje.

Ora e dërgimit vendoset në orën lokale të browser-it dhe ruhet në UTC.
Scheduler kontrollon çdo minutë dhe queue gjeneron/dërgon bashkëngjitjet.
Fjalëkalimi ruhet i enkriptuar me APP_KEY dhe nuk kthehet në API.
Fusha bosh e fjalëkalimit ruan vlerën ekzistuese.
Automatizimi mund të editohet, pauzohet ose fshihet. Shfaqen dërgimi i fundit, radha dhe gabimi i fundit.
Queue provon deri tri herë. SMTP duhet të lejojë lidhje dalëse nga serveri dhe madhësinë e bashkëngjitjeve.
Pas tri dështimeve, radha kalon te intervali i ardhshëm. Nëse backend/.env cakton REDIS_QUEUE_RETRY_AFTER, vlera duhet të jetë së paku 180 sekonda.
Rregullat ndalojnë kur krijuesi humb qasjen ose dyqani çaktivizohet.

## Përditësimi i production-it

Këto komanda ekzekutohen VETËM në LXC stoku, në /opt/stoku, pas rishikimit dhe bashkimit të PR-së në main.
Mos ekzekuto migrate:fresh, db:wipe, migrate:refresh ose docker compose down -v.
Mos rigjenero APP_KEY dhe mos zëvendëso .env me .env.example.

Kontrollo gjendjen përpara ndryshimit:

```bash
cd /opt/stoku
git status --short
git branch --show-current
docker compose ps
```

Nëse ka ndryshime lokale në docker-compose.yml ose bllokim nga Git, ndalo dhe pajto konfigurimet; mos përdor reset/checkout për t'i hequr.

Backup me aplikacionin përkohësisht në maintenance:

```bash
set -euo pipefail
umask 077
backup_dir="/opt/stoku/backups/pre-reports-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"
docker compose exec -T backend php artisan down --retry=60
docker compose stop queue scheduler
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/stoku.dump"
test -s "$backup_dir/stoku.dump"
docker compose exec -T postgres pg_restore --list < "$backup_dir/stoku.dump" > "$backup_dir/restore-list.txt"
docker compose exec -T backend tar -C /app -czf - storage > "$backup_dir/storage.tar.gz"
cp backend/.env "$backup_dir/backend.env"
cp docker-compose.yml "$backup_dir/docker-compose.yml"
if [ -f .env ]; then cp .env "$backup_dir/root.env"; fi
git rev-parse HEAD > "$backup_dir/previous-commit.txt"
```

Mbaj edhe një kopje të backup-it jashtë LXC-së / serverit Proxmox. Lista e pg_restore verifikon lexueshmërinë; një provë restore në databazë të veçuar është kontrolli përfundimtar.

Pastaj, pasi main përmban këtë ndryshim:

```bash
git pull --ff-only origin main
docker compose build backend queue scheduler frontend
docker compose up -d backend
docker compose exec -T backend php artisan migrate --force
docker compose exec -T backend php artisan migrate:status
docker compose up -d queue scheduler frontend
docker compose exec -T backend php artisan up
docker compose ps
docker compose exec -T backend php artisan route:list --path=report
docker compose exec -T backend php artisan schedule:list
curl -i -H 'Accept: application/json' http://127.0.0.1:8000/api/v1/auth/me
```

Për curl pa token pritet 401. Entrypoint gjeneron cache-et e production-it dhe backend-i kryen migrations automatikisht; migrate i dytë është kontroll idempotent.
Nëse build/migration dështon, aplikacioni mbetet në maintenance. Mos vazhdo me ndryshime në databazë; kontrollo logs dhe commit-in e regjistruar në backup.
Mos përdor rollback të verbër pas aktivizimit të automatizimeve, sepse down() i migration-it heq tabelat e reja.

Ky përditësim krijon vetëm dy tabela të reja për SMTP/automatizime. Migration i mëparshëm i permissions përditëson rolin employee, pa fshirë të dhëna biznesi.
Shitjet/blerjet/inventari ekzistues nuk pastrohen dhe historiku financiar nuk rillogaritet nga ky migration.

## Verifikimi lokal

```bash
cd frontend
npm ci
npm run build
npm run lint
cd ../backend
composer install
php vendor/bin/phpunit
```

PHPUnit përdor SQLite në memorie dhe APP_ENV=testing; nuk përdor kredenciale production.
Testet mbulojnë kthimin pas shitjes, pesë telefona hyrës, refuzimin e IMEI në stok, rollback të cash-it, eksportet, izolimin mes dyqaneve, enkriptimin SMTP, permissions dhe ruajtjen e të dhënave gjatë migration-it të ri.
