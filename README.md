# Emily — versione autonoma

Emily è una rubrica personale React + Vite. Questa cartella contiene il progetto completo da caricare nella **radice di un repository GitHub dedicato**. Account, profili, contatti e foto sono gestiti da Supabase; la versione autonoma non richiede un account ChatGPT.

## Stato attuale

- Progetto Supabase già collegato: `mbzxgciojwefynbbxjot`, regione `eu-west-1`.
- Schema e permessi già applicati. **Non rieseguire la migrazione sul progetto esistente.**
- Accesso con e-mail e password. La registrazione richiede un codice di conferma dell’e-mail; gli accessi successivi usano la password.
- SMTP Brevo già configurato. Recupero password tramite link e-mail e attivazione della password per gli account che usavano soltanto i codici.
- Accesso telefonico implementato ma disabilitato, finché non viene configurato e provato un servizio SMS.
- Logo “E connessa” nell’intestazione e nelle schermate di accesso, con icona browser e icona del collegamento sulla schermata Home.
- Indirizzo dell’app: https://fiorella9800.github.io/Emily/ . Gli aggiornamenti sul ramo main vengono pubblicati da GitHub Actions.
- La rubrica originale all’indirizzo principale usa ancora il vecchio backend Sites. Quei dati non sono stati migrati automaticamente a Supabase.

Il repository contiene soltanto codice, schema e configurazione pubblica. Non contiene contatti degli utenti, foto, credenziali SMTP, password o chiavi amministrative.

## Pubblicazione su GitHub Pages

GitHub conserva il codice e le sue versioni. GitHub Pages pubblica il sito statico. Supabase continua a conservare e proteggere i dati: non occorre crearne un nuovo progetto.

1. Nell’account GitHub `Fiorella9800` crea un repository chiamato **Emily**, ramo iniziale **main**, con un README. Se usi GitHub Free, scegli **Public**: il codice sarà visibile, mentre i dati degli utenti rimangono nel backend Supabase e sono protetti dai permessi.
2. Carica nella radice del repository **il contenuto di questa cartella**, inclusi `.github/workflows/pages.yml`, `.gitignore`, `.nvmrc`, `.env.example` e `package-lock.json`. Non caricare soltanto lo ZIP o una cartella esterna contenente il progetto.
3. Nel repository apri **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. Apri **Actions → Pubblica Emily su GitHub Pages → Run workflow**, scegli **main** e avvia la pubblicazione. Dopo l’attivazione, i successivi aggiornamenti su main avviano automaticamente il workflow.
5. Attendi che build e deploy risultino completati. L’indirizzo reale è mostrato in **Settings → Pages → Visit site**. Se il repository è esattamente `Fiorella9800/Emily`, l’indirizzo previsto è `https://fiorella9800.github.io/Emily/`: non considerarlo attivo prima della conferma del deployment.
6. Aggiorna Supabase come indicato sotto e prova l’accesso sul nuovo indirizzo.

Il workflow installa le versioni bloccate dal lockfile, esegue i test di autenticazione e dei permessi e costruisce il sito per il percorso restituito da GitHub Pages. Pubblica soltanto `dist/`, senza migrazioni o dati. Non richiede chiavi amministrative o password di Supabase nei secrets GitHub. Se usi un ramo diverso da main, modifica il filtro `on.push.branches` del workflow.

Il workflow si trova qui in una cartella autonoma esportabile. Per usarlo deve essere `.github/workflows/pages.yml` alla radice del **nuovo repository**, non `independent/.github/workflows/pages.yml` in un repository più grande.

### Impostazioni Supabase al cambio di indirizzo

Apri https://supabase.com/dashboard/project/mbzxgciojwefynbbxjot/auth/url-configuration . Solo dopo aver verificato che il nuovo sito è online:

- Imposta **Site URL** all’indirizzo HTTPS finale, con la barra conclusiva. Per il repository proposto: `https://fiorella9800.github.io/Emily/`.
- Aggiungi lo stesso indirizzo esatto a **Redirect URLs**.
- Durante il passaggio puoi mantenere anche il vecchio indirizzo Emily tra i redirect consentiti.

La sessione del browser appartiene a ogni indirizzo: sul nuovo sito dovrai accedere nuovamente con la **stessa e-mail** per vedere gli stessi dati Supabase. Non occorre registrare un secondo account. I nuovi link e QR di condivisione useranno il nuovo indirizzo; i QR stampati in precedenza continuano a puntare al vecchio sito. Rigenerali per distribuire il nuovo indirizzo. Non disattivare il vecchio sito prima delle verifiche.

### Verifiche prima del passaggio definitivo

- Accedi sul nuovo sito, salva un contatto, esci e riaccedi da telefono; controlla profilo, contatti e foto.
- Con due account diversi verifica che le rubriche restino separate.
- Genera un QR nuovo e riapri anche un QR dalla sezione Condivisioni. Verifica importazione e revoca con un secondo account.
- Verifica che non siano condivisi note personali, utilità del contatto, Tu/Lei, incontri o legami personali.
- Prova fotocamera e scansione QR su iPhone e Android in HTTPS.

La build e i test locali non sostituiscono queste verifiche nel browser dopo la pubblicazione.

## Sviluppo locale

### Foto di profili e contatti

Il caricamento di una foto apre un pop-up con l’immagine intera e un riquadro quadrato. Trascina il riquadro per centrare il volto e usa gli angoli per ridimensionarlo; sono supportati touch e tastiera. **Imposta foto profilo** conferma il ritaglio e torna alla scheda. **Modifica ritaglio** riapre l’immagine originale, prima del salvataggio. Annullare il pop-up mantiene la foto precedente.

La foto viene salvata insieme al profilo o alla persona quando premi **Salva profilo** o **Salva persona**. Il ritaglio viene preparato nel browser come JPEG 600 × 600; viene caricata soltanto la foto confermata, tramite il servizio foto già esistente.

### Comandi

Usa Node.js 24 (oppure una versione compatibile, almeno 22.13):

```bash
npm ci
npm test
npm run build
npm run dev
```

`dist/` è la cartella del sito da pubblicare. Per verificare una build per GitHub Pages:

```bash
npm run build -- --base /Emily/
```

La configurazione attuale è in `public-config.json`: URL Supabase e chiave **publishable**, sicuri per il frontend. Per un progetto diverso copia `.env.example` in `.env.local` e cambia le variabili. `.env.local` deve rimanere fuori dal repository. Le variabili `VITE_` vengono incluse nel browser: non usarle mai per password SMTP, chiavi `service_role`, `sb_secret_` o backup.

## Password, registrazione e recupero

Il progetto esistente usa già SMTP Brevo e la conferma e-mail è attiva. Non occorre reinserire le credenziali né creare un nuovo database.

- **Nuovi utenti:** Crea account → e-mail e password (almeno 8 caratteri) → codice di conferma e-mail → rubrica. Dal successivo accesso basta la password.
- **Account esistente già aperto:** Gestisci accesso → Imposta password. La modifica conserva l’identificativo dell’utente, profilo, contatti e foto.
- **Account esistente senza password, non collegato:** Ho già un account senza password → stessa e-mail → ultimo codice → scegli la password. Il codice non crea un secondo account.
- **Password dimenticata:** richiedi un link via e-mail → aprilo → scegli la nuova password. La risposta alla richiesta non rivela se un indirizzo è registrato.

Le password vengono inviate direttamente a Supabase Auth e gestite dal suo sistema di autenticazione. Non vengono salvate nei profili, nei contatti o nei log dell’app. La sessione viene mantenuta dal client Supabase fino all’uscita o alla scadenza. I link di recupero vengono convalidati dal servizio prima di mostrare il modulo; un vecchio accesso salvato non rende valido un link scaduto. Gli eventuali link di condivisione `?share=` restano disponibili dopo l’accesso.

In Supabase mantieni **Email** attivo e **Confirm email** abilitato. Site URL e Redirect URLs devono includere l’indirizzo esatto `https://fiorella9800.github.io/Emily/`. Il recupero usa il template **Reset Password** con `{{ .ConfirmationURL }}`, già presente nel template standard. Il file incluso serve se vuoi personalizzarlo. Modificare il file nel repository non modifica automaticamente il template del progetto Supabase.

Puoi applicare anche requisiti di password sul server nelle impostazioni Auth. Il controllo delle password già compromesse è un’opzione disponibile sui piani che lo supportano: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## E-mail e telefono

Per un **nuovo progetto Supabase**, abilita Email e la verifica dei recapiti, configura **Custom SMTP prima di modificare i template** e usa questi file:

| Template Supabase | File |
| --- | --- |
| Confirm sign up | `supabase/templates/confirm-signup.html` |
| Magic link or OTP | `supabase/templates/magic-link.html` |
| Reset Password | `supabase/templates/reset-password.html` |
| Change Email Address | `supabase/templates/change-email.html` |

Il template Confirm sign up deve includere `{{ .Token }}` per la verifica della registrazione. Magic link or OTP conserva il codice per consentire agli account precedenti di attivare la password. Reset Password deve includere `{{ .ConfirmationURL }}`: l’app gestisce il callback di recupero. Il provider e-mail ha limiti di invio propri. Configura Site URL e Redirect URLs con l’indirizzo reale, senza lasciare localhost.

Per il telefono configura un fornitore SMS supportato da Supabase, abilita Phone, verifica un SMS reale e poi imposta `VITE_PHONE_AUTH_ENABLED=true` nella build oppure `phoneAuthEnabled: true` nella configurazione pubblica. I messaggi possono avere costi.

**Gestisci accesso** consente di collegare un secondo recapito allo stesso account, dopo la verifica. Entrare separatamente con un recapito non collegato può creare un altro account; non vengono eseguite unioni automatiche.

## Hosting collegato a GitHub per sviluppi futuri

GitHub Pages serve questa prima versione personale/prototipo. GitHub ne limita l’uso come hosting gratuito per attività online, transazioni commerciali e SaaS commerciale. Per sviluppare Emily come servizio commerciale puoi conservare il codice su GitHub e collegarlo a un hosting adatto, per esempio Cloudflare. I dati possono restare nello stesso Supabase.

La configurazione `wrangler.jsonc` è già inclusa per Cloudflare Workers con asset statici. In un progetto Cloudflare collegato al repository autonomo usa la radice del repository, build `npm run build`, deploy `npx wrangler deploy` e directory asset `dist`. Le eventuali variabili VITE devono essere disponibili **durante la build**. La configurazione pubblica inclusa basta per usare il progetto Emily attuale. Non sono stati creati account o deployment Cloudflare.

## Dati, backup e vecchia rubrica

Per cambiare soltanto l’hosting di `/emily/` non occorre migrare il database Supabase. La vecchia rubrica del sito originale usa invece un backend diverso: il suo trasferimento richiede esportazione per utente, verifica della proprietà, importazione di dati e foto e controllo dei risultati. Non viene eseguito caricando questo repository.

Google Drive può essere usato in futuro per backup con accesso ristretto, ma non è il database operativo di Emily e non è stato collegato. Una copia recuperabile deve includere record, foto e configurazione, con una prova di ripristino. Non caricare dati personali o backup degli utenti su GitHub.

Questa pubblicazione rimane un’app web. PWA installabile e pacchetti per gli store sono sviluppi successivi.

## Documentazione ufficiale

- Pubblicare con GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Workflow Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Limiti di utilizzo: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Deploy Vite: https://vite.dev/guide/static-deploy.html
- Redirect Supabase: https://supabase.com/docs/guides/auth/redirect-urls
- Codici e-mail: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Accesso con password: https://supabase.com/docs/guides/auth/passwords
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
