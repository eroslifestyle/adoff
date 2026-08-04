const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.resolve(__dirname, '../../app');
const TARGET_URL = process.env.TARGET_URL || 'https://streamingcommunityz.recipes/';
const OUT_DIR = path.resolve(__dirname, 'out');

const SELETTORI = [
    { etichetta: 'card titolo', selettore: 'a[href*="/titles/"]' },
    { etichetta: 'immagine poster', selettore: 'img' },
    { etichetta: 'pulsante', selettore: 'button' },
    { etichetta: 'voce menu', selettore: 'nav a, header a' },
    { etichetta: 'area generica', selettore: 'div' }
];

async function misura(conEstensione) {
    const windowOpenCalls = [];
    let context = null;

    const ctxOptions = {
        headless: false,
        viewport: { width: 1366, height: 900 },
        args: ['--mute-audio']
    };

    if (conEstensione) {
        ctxOptions.args.push(
            '--disable-extensions-except=' + EXTENSION_PATH,
            '--load-extension=' + EXTENSION_PATH
        );
        ctxOptions.ignoreDefaultArgs = ['--disable-extensions'];
    }

    try {
        context = await chromium.launchPersistentContext('', ctxOptions);

        await context.addInitScript(() => {
            window.__playwrightWindowOpens = [];

            const origOpen = window.open.bind(window);
            window.open = function(...args) {
                window.__playwrightWindowOpens.push({
                    url: args[0],
                    tipo: 'window.open'
                });
                return origOpen(...args);
            };

            document.addEventListener('click', e => {
                const a = e.target.closest('a[target="_blank"]');
                if (a) {
                    window.__playwrightWindowOpens.push({
                        url: a.href,
                        tipo: 'link _blank'
                    });
                }
            }, true);
        });

        let schedeAperte = 0;
        const domini = new Set();
        const schedeEstensione = [];

        context.on('page', async page => {
            const urlIniziale = page.url();
            await page.waitForTimeout(700);
            const urlFinale = page.url();

            if (urlIniziale.startsWith('chrome-extension://')) {
                schedeEstensione.push({ urlIniziale, urlFinale });
            } else {
                schedeAperte++;
                try {
                    const url = new URL(urlFinale);
                    domini.add(url.hostname);
                } catch {}
            }
            await page.close();
        });

        const risultatoPerLabel = {};

        for (const { etichetta, selettore } of SELETTORI) {
            risultatoPerLabel[etichetta] = { schede: 0, domini: [] };

            for (let elemIdx = 0; elemIdx < 3; elemIdx++) {
                try {
                    const page = await context.newPage();

                    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(4000);

                    const tutti = await page.locator(selettore).all();
                    const visibili = [];

                    for (const el of tutti) {
                        const box = await el.boundingBox();
                        if (box && box.width > 8 && box.height > 8) {
                            visibili.push(el);
                        }
                    }

                    if (elemIdx >= visibili.length) {
                        await page.close();
                        break;
                    }

                    const elem = visibili[elemIdx];
                    const schedePrima = context.pages().length;

                    try {
                        await elem.click({ timeout: 5000 });
                    } catch {
                        await page.close();
                        continue;
                    }

                    await page.waitForTimeout(2500);

                    const schedeDopo = context.pages().length;
                    const nuoveSchede = schedeDopo - schedePrima;
                    risultatoPerLabel[etichetta].schede += nuoveSchede;

                    const dominiAttuali = await page.evaluate(() => {
                        return window.__playwrightWindowOpens
                            .filter(w => w.tipo === 'window.open')
                            .map(w => {
                                try {
                                    return new URL(w.url).hostname;
                                } catch {
                                    return w.url;
                                }
                            });
                    });

                    risultatoPerLabel[etichetta].domini.push(...dominiAttuali);
                    await page.close();

                } catch (e) {
                    continue;
                }
            }
        }

        const woc = [];
        try {
            const pages = context.pages();
            if (pages.length > 0) {
                const lastPage = pages[pages.length - 1];
                woc.push(...(await lastPage.evaluate(() => window.__playwrightWindowOpens || [])));
            }
        } catch {}

        return {
            totale: schedeAperte,
            domini: Array.from(domini),
            dettaglio: risultatoPerLabel,
            schedeEstensione,
            windowOpenCalls: woc
        };

    } catch (e) {
        console.error('Errore misura:', e.message);
        return {
            totale: 0,
            domini: [],
            dettaglio: {},
            schedeEstensione: [],
            windowOpenCalls: [],
            errore: e.message
        };
    } finally {
        if (context) {
            try {
                await context.close();
            } catch {}
        }
    }
}

async function main() {
    let risultatoSenza, risultatoCon;

    try {
        fs.mkdirSync(OUT_DIR, { recursive: true });

        console.log('Test SENZA estensione...');
        risultatoSenza = await misura(false);

        console.log('Test CON estensione...');
        risultatoCon = await misura(true);

        const output = {
            senzaEstensione: risultatoSenza,
            conEstensione: risultatoCon,
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(OUT_DIR, 'click-conteggio.json'),
            JSON.stringify(output, null, 2)
        );

        console.log('\n=== COMPARAZIONE ===');
        console.log('Etichetta'.padEnd(18) + 'Senza'.padStart(8) + 'Con'.padStart(8));
        console.log('-'.repeat(36));

        for (const { etichetta } of SELETTORI) {
            const senza = risultatoSenza.dettaglio?.[etichetta]?.schede ?? 0;
            const con = risultatoCon.dettaglio?.[etichetta]?.schede ?? 0;
            console.log(etichetta.padEnd(18) + String(senza).padStart(8) + String(con).padStart(8));
        }

        console.log('-'.repeat(36));
        console.log('CONCLUSIONE:');
        console.log(`  Totale senza: ${risultatoSenza.totale}`);
        console.log(`  Totale con: ${risultatoCon.totale}`);
        if (risultatoCon.totale < risultatoSenza.totale) {
            console.log('  L\'estensione blocca le schede.');
        } else if (risultatoCon.totale === risultatoSenza.totale) {
            console.log('  Nessuna differenza rilevata.');
        } else {
            console.log('  L\'estensione non blocca.');
        }

    } catch (e) {
        console.error('Errore:', e);
    }
}

main();
