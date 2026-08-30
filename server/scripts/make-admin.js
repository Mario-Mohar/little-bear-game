#!/usr/bin/env node
/**
 * Grant, revoke and list admin rights, without opening a SQL console.
 *
 * `users.is_admin` decides who may use the admin panel. Setting it used to mean
 * going to the database -- on Railway: find the database plugin, open the query
 * window, type an UPDATE. For a project that otherwise runs on `npm install`
 * and a `.env`, that was the one break in the path.
 *
 * Deliberately a script and not a route. A "make me an admin" endpoint would be
 * exactly the hole that granting rights per account was meant to close, so this
 * needs a shell on the machine and the database credentials -- which is the
 * point.
 *
 *   npm run make-admin -- <username>
 *   npm run make-admin -- --revoke <username>
 *   npm run make-admin -- --list
 */
require('dotenv').config();

// Erst laden, wenn wirklich eine Abfrage ansteht: config/db.js beendet den
// Prozess, wenn DATABASE_URL fehlt, und `--help` soll auch ohne Datenbank
// etwas Vernünftiges sagen.
let cachedPool = null;
function getPool() {
    if (!cachedPool) cachedPool = require('../config/db').pool;
    return cachedPool;
}

// is_admin reist im JWT mit, und das lebt sieben Tage. Beide Richtungen
// brauchen deshalb einen Hinweis -- die unangenehmere ist das Entziehen.
const TOKEN_NOTE_GRANT =
    'Hinweis: is_admin steckt im JWT. Wer gerade angemeldet ist, muss sich neu\n' +
    '         anmelden, damit die Rechte im Token stehen.';
const TOKEN_NOTE_REVOKE =
    'Achtung: is_admin steckt im JWT, und das läuft erst nach sieben Tagen ab.\n' +
    '         Ein bereits ausgestelltes Token behält die Adminrechte bis dahin.\n' +
    '         Wenn das nicht reicht, muss JWT_SECRET gewechselt werden — das\n' +
    '         wirft alle Anmeldungen raus, nicht nur diese eine.';

function usage() {
    console.log(`Adminrechte verwalten.

  npm run make-admin -- <benutzername>            Rechte geben
  npm run make-admin -- --revoke <benutzername>   Rechte nehmen
  npm run make-admin -- --list                    Zeigen, wer Admin ist
`);
}

async function list() {
    const { rows } = await getPool().query(
        `SELECT username, email, last_login
           FROM users
          WHERE is_admin = TRUE
          ORDER BY LOWER(username)`
    );
    if (rows.length === 0) {
        console.log('Kein Konto hat Adminrechte.');
        return;
    }
    console.log(`${rows.length} Konto/Konten mit Adminrechten:`);
    for (const row of rows) {
        const seen = row.last_login
            ? new Date(row.last_login).toISOString().slice(0, 10)
            : 'nie angemeldet';
        console.log(`  ${row.username.padEnd(24)} ${row.email || '—'}  (${seen})`);
    }
}

async function setAdmin(username, value) {
    // LOWER auf beiden Seiten: Konten werden unter dem getippten Namen
    // angelegt, und wer hier den Namen abtippt, trifft die Groß- und
    // Kleinschreibung nicht zwingend.
    const { rows } = await getPool().query(
        `UPDATE users
            SET is_admin = $2
          WHERE LOWER(username) = LOWER($1)
      RETURNING username, is_admin`,
        [username, value]
    );

    if (rows.length === 0) {
        console.error(`Kein Konto mit dem Namen "${username}".`);
        console.error('Vorhandene Namen zeigt: npm run make-admin -- --list');
        return 1;
    }

    const name = rows[0].username;
    if (value) {
        console.log(`${name} hat jetzt Adminrechte.`);
        console.log(TOKEN_NOTE_GRANT);
    } else {
        console.log(`${name} hat keine Adminrechte mehr.`);
        console.log(TOKEN_NOTE_REVOKE);
    }
    return 0;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        usage();
        return args.length === 0 ? 1 : 0;
    }

    if (args[0] === '--list') {
        await list();
        return 0;
    }

    if (args[0] === '--revoke') {
        if (!args[1]) {
            console.error('--revoke braucht einen Benutzernamen.');
            return 1;
        }
        return setAdmin(args[1], false);
    }

    if (args[0].startsWith('-')) {
        console.error(`Unbekannte Option: ${args[0]}`);
        usage();
        return 1;
    }

    return setAdmin(args[0], true);
}

async function shutdown(code) {
    if (cachedPool) await cachedPool.end().catch(() => {});
    process.exit(code);
}

// Nur beim direkten Aufruf loslaufen, damit die Funktionen einzeln geprüft
// werden können, ohne dass ein Import den Prozess beendet.
if (require.main === module) {
    main()
        .then((code) => shutdown(code || 0))
        .catch((err) => {
            console.error(`Fehlgeschlagen: ${err.message}`);
            return shutdown(1);
        });
}

module.exports = { main, list, setAdmin };
