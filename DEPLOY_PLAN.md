# Piano di Deployment - Invoice Mauro Mario App

## Problema Attuale

Dopo aver eseguito `shopify app build && shopify app deploy`, l'app non funziona perché:

1. Durante lo sviluppo con `shopify app dev`, Shopify CLI crea automaticamente un **tunnel Cloudflare temporaneo** (es. `xxxxx.trycloudflare.com`)
2. Il comando `shopify app deploy` deploya solo la **configurazione** dell'app su Shopify, NON il backend
3. **Shopify NON ospita il backend** della tua app - devi farlo tu su un servizio di hosting
4. L'app continua a cercare di raggiungere il tunnel Cloudflare che non esiste più
5. Non c'è un server in esecuzione che risponda alle richieste dell'app

## Architettura App

- **Tipo**: Shopify Embedded App con POS UI Extension
- **Framework**: Remix (React full-stack)
- **Runtime**: Node.js 18+
- **Database attuale**: SQLite (solo per sviluppo)
- **Database necessario**: PostgreSQL o MySQL per produzione
- **Porta**: 3000
- **Docker**: Già configurato e pronto

## Soluzione: Deploy su Railway

Railway è la soluzione consigliata perché:
- Gratuito per iniziare
- Setup molto semplice
- Include database PostgreSQL gratuito
- Auto-deploy da GitHub
- Ottima integrazione con Shopify app

### Alternative
- **Fly.io**: Migliori performance globali, richiede più configurazione
- **Render**: Buon free tier, simile a Railway
- **Heroku**: Affidabile ma a pagamento ($5/mese minimo)

## Piano di Deployment Dettagliato

### FASE 1: Preparazione Database (SQLite → PostgreSQL)

**File da modificare**: `prisma/schema.prisma`

**Cambiamento necessario**:
```prisma
// PRIMA (SQLite - solo sviluppo):
datasource db {
  provider = "sqlite"
  url      = "file:dev.sqlite"
}

// DOPO (PostgreSQL - produzione):
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Perché**: SQLite è un database basato su file, funziona solo per sviluppo locale. In produzione serve un database server come PostgreSQL.

---

### FASE 2: Setup Railway

#### Step 1: Creare Account Railway
1. Vai su https://railway.app
2. Registrati con GitHub
3. Autorizza Railway ad accedere ai tuoi repository

#### Step 2: Creare Nuovo Progetto
1. Click su "New Project"
2. Seleziona "Deploy from GitHub repo"
3. Seleziona il repository `shopify-fundamentals/dev/invoice-mauro-mario`
4. Railway rileva automaticamente il Dockerfile

#### Step 3: Aggiungere Database PostgreSQL
1. Nel progetto Railway, click su "New Service"
2. Seleziona "Database" → "PostgreSQL"
3. Railway crea automaticamente il database e la variabile `DATABASE_URL`

#### Step 4: Configurare Variabili d'Ambiente

Nel dashboard Railway, vai su "Variables" e aggiungi:

```env
# Shopify Configuration
SHOPIFY_API_KEY=5074dfa7e5c453d5e39def9332898b8b
SHOPIFY_API_SECRET=<ottieni-da-shopify-partners-dashboard>
SCOPES=read_customers,write_customers,write_products,read_orders,write_orders

# App URL (Railway te lo fornisce dopo il primo deploy)
SHOPIFY_APP_URL=https://your-app-name.up.railway.app

# Database (Railway lo configura automaticamente)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Environment
NODE_ENV=production
PORT=3000
```

**Come ottenere SHOPIFY_API_SECRET**:
1. Vai su https://partners.shopify.com
2. Apps → Seleziona la tua app "invoice-mauro-mario"
3. "App credentials" → Copia "API secret key"

#### Step 5: Primo Deploy
1. Railway deploya automaticamente quando rileva le variabili d'ambiente
2. Vai su "Settings" → "Networking" → Copia il dominio pubblico
3. Il dominio sarà tipo: `https://invoice-mauro-mario-production.up.railway.app`

---

### FASE 3: Aggiornare Configurazione Shopify

#### Step 1: Aggiornare shopify.app.toml

**File da modificare**: `shopify.app.toml`

```toml
# Cambia questa riga:
application_url = "https://example.com"

# Con il tuo URL Railway:
application_url = "https://invoice-mauro-mario-production.up.railway.app"

# Aggiungi anche (se non presente):
[auth]
redirect_urls = [
  "https://invoice-mauro-mario-production.up.railway.app/api/auth",
  "https://invoice-mauro-mario-production.up.railway.app/api/auth/callback"
]
```

#### Step 2: Aggiornare Variabile d'Ambiente su Railway

Torna su Railway e aggiorna `SHOPIFY_APP_URL` con l'URL corretto:
```env
SHOPIFY_APP_URL=https://invoice-mauro-mario-production.up.railway.app
```

Railway ri-deploya automaticamente.

---

### FASE 4: Deploy Configurazione e Extension su Shopify

Dal tuo computer, nella directory del progetto:

```bash
# 1. Assicurati di essere loggato
shopify auth logout
shopify auth login

# 2. Deploya la configurazione aggiornata e l'extension
npm run deploy
```

Questo comando:
- Carica la configurazione aggiornata da `shopify.app.toml`
- Deploya l'extension POS `invoice-tail`
- Aggiorna automaticamente gli URL dei webhook

**Output atteso**:
```
✓ Deployed extension invoice-tail
✓ Updated app configuration
✓ Updated webhook URLs
```

---

### FASE 5: Test e Verifica

#### Test 1: Backend Accessibile
```bash
curl https://invoice-mauro-mario-production.up.railway.app/healthcheck
```
Dovresti ricevere una risposta (anche 404 va bene, significa che il server risponde).

#### Test 2: Installare l'App
1. Vai su Shopify Partners → Apps → Seleziona la tua app
2. Click su "Test your app"
3. Seleziona un development store
4. Installa l'app
5. Verifica che l'installazione completi senza errori

#### Test 3: Verifica Backoffice
1. Dalla Shopify admin del tuo store, vai su Apps
2. Apri "invoice-mauro-mario"
3. Dovresti vedere la lista degli ordini con fattura richiesta
4. Verifica che non ci siano errori nella console del browser

#### Test 4: Verifica POS Extension
1. Apri Shopify POS (app mobile o web)
2. Crea un nuovo carrello
3. Aggiungi un cliente
4. Dovresti vedere la tile "Invoice" nella schermata del carrello
5. Click sulla tile, verifica che la modale si apra correttamente

#### Test 5: Verifica Webhook
1. Nel POS, completa un ordine con richiesta fattura
2. Vai nel backoffice → Orders
3. Verifica che l'ordine mostri "Invoice status: Requested"
4. Controlla i log su Railway per vedere se il webhook è stato ricevuto

---

## Variabili d'Ambiente - Riferimento Completo

```env
# === SHOPIFY CONFIGURATION ===
SHOPIFY_API_KEY=5074dfa7e5c453d5e39def9332898b8b
SHOPIFY_API_SECRET=<from-partners-dashboard>
SCOPES=read_customers,write_customers,write_products,read_orders,write_orders

# === APP URL ===
SHOPIFY_APP_URL=https://your-app-name.up.railway.app

# === DATABASE ===
DATABASE_URL=postgresql://user:password@host:port/database
# Railway popola automaticamente questa variabile con: ${{Postgres.DATABASE_URL}}

# === ENVIRONMENT ===
NODE_ENV=production
PORT=3000

# === OPTIONAL ===
SHOP_CUSTOM_DOMAIN=<if-using-custom-domain>
```

---

## Troubleshooting

### Problema: "App not found" o 404
**Causa**: L'URL in `shopify.app.toml` non corrisponde all'URL su Railway.

**Soluzione**:
1. Verifica l'URL su Railway (Settings → Networking)
2. Aggiorna `shopify.app.toml`
3. Esegui `npm run deploy`

### Problema: "Database connection failed"
**Causa**: `DATABASE_URL` non configurato correttamente.

**Soluzione**:
1. Su Railway, verifica che il servizio PostgreSQL sia attivo
2. Nelle variabili d'ambiente, verifica che `DATABASE_URL` sia `${{Postgres.DATABASE_URL}}`
3. Ri-deploya l'app

### Problema: Extension non appare nel POS
**Causa**: Extension non deployata o app_url non salvato.

**Soluzione**:
1. Verifica che `npm run deploy` sia completato con successo
2. Reinstalla l'app sul development store
3. L'`afterAuth` hook salverà automaticamente l'app_url nel shop metafield

### Problema: Webhook non funziona
**Causa**: Gli URL dei webhook non sono stati aggiornati.

**Soluzione**:
1. Vai su Shopify Partners → Apps → Settings → Webhooks
2. Verifica che gli URL puntino al tuo dominio Railway
3. Esegui `npm run deploy` per auto-aggiornare

### Problema: "Unauthorized" o errori di autenticazione
**Causa**: `SHOPIFY_API_SECRET` errato o mancante.

**Soluzione**:
1. Vai su Shopify Partners → Apps → App credentials
2. Copia "API secret key"
3. Aggiorna su Railway la variabile `SHOPIFY_API_SECRET`

---

## Comandi Utili

### Vedere i log su Railway
```bash
# Installa Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link al progetto
railway link

# Vedere i log in tempo reale
railway logs
```

### Testare il database localmente con PostgreSQL
```bash
# Aggiorna DATABASE_URL nel tuo .env locale
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_db"

# Genera Prisma client
npx prisma generate

# Esegui migrazioni
npx prisma migrate dev

# Visualizza database
npx prisma studio
```

### Re-deploy manuale su Railway
```bash
# Dopo modifiche al codice
git add .
git commit -m "Update"
git push origin main

# Railway ri-deploya automaticamente
```

---

## Costi Stimati

### Railway Free Tier
- **Compute**: 500 ore/mese gratuite (≈ 21 giorni)
- **Database**: 5GB storage PostgreSQL gratuito
- **Bandwidth**: 100GB/mese

**Per un'app in sviluppo/test**: Completamente gratuito

**Per produzione con traffico**:
- Hobby Plan: $5/mese (unlimited hours)
- Database aggiuntivo: Incluso nel piano

---

## Prossimi Passi dopo Deploy

1. **Monitoraggio**
   - Configura alert su Railway per errori
   - Monitora utilizzo database
   - Controlla delivery dei webhook su Shopify Partners

2. **Backup Database**
   - Railway fa backup automatici
   - Considera export periodici per sicurezza

3. **Performance**
   - Monitora tempi di risposta API
   - Ottimizza query Prisma se necessario
   - Considera caching per dati statici

4. **Scalabilità**
   - Railway scala automaticamente con il traffico
   - Considera passaggio a piano Hobby se superi free tier
   - Valuta CDN per asset statici se necessario

5. **Security**
   - Abilita HTTPS (Railway lo fa automaticamente)
   - Monitora accessi non autorizzati
   - Mantieni aggiornate le dipendenze

---

## File di Configurazione Railway (Opzionale)

Puoi creare `railway.json` per customizzare il build:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "./Dockerfile"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Questo file è **opzionale** - Railway rileva automaticamente il Dockerfile.

---

## Riferimenti

- **Railway Docs**: https://docs.railway.app
- **Shopify App Deployment**: https://shopify.dev/docs/apps/deployment
- **Prisma PostgreSQL**: https://www.prisma.io/docs/concepts/database-connectors/postgresql
- **Remix Deployment**: https://remix.run/docs/en/main/guides/deployment

---

## Note Finali

Questa app è già ben strutturata per il deployment:
- ✅ Dockerfile presente e configurato
- ✅ Gestione dinamica URL tramite metafield
- ✅ Webhook auto-configuration
- ✅ CORS già configurato per extension POS
- ✅ Build scripts pronti per produzione

Il deployment su Railway dovrebbe richiedere **circa 30-45 minuti** dalla creazione account al test completo.
