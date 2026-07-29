const fs = require('fs');
const path = require('path');

// PASSO 1: Estrazione del blocco LAYER D dal sorgente
const src = fs.readFileSync(path.resolve(__dirname, '../../app/src/stealth.js'), 'utf8');
const i = src.indexOf('// ---- LAYER D: Anti-stall watchdog ----');
const j = src.indexOf('yt-navigate-finish', i);
const k = src.indexOf('});', j);

if (i === -1 || j === -1 || k === -1) {
    console.error('ERRORE: Marcatori non trovati nel sorgente stealth.js');
    console.error('i =', i, 'j =', j, 'k =', k);
    process.exit(1);
}

const blocco = src.slice(i, k + 3);
console.log('Blocco estratto, lunghezza:', blocco.length, 'caratteri');

// Funzione per creare sandbox con mock freschi per ogni test
function makeSandbox(opts) {
    const timers = [];
    let timerIdCounter = 0;
    const events = [];
    const calls = [];

    // Video mock
    const video = {
        currentTime: opts.currentTime || 0,
        paused: opts.paused !== undefined ? opts.paused : false,
        ended: false,
        duration: opts.duration || 600,
        readyState: opts.readyState !== undefined ? opts.readyState : 4,
        buffered: {
            length: 1,
            end: () => opts.bufEnd || (video.currentTime + 30)
        },
        play: () => Promise.resolve()
    };

    // Player mock
    const player = {
        classList: {
            _s: new Set(),
            contains(c) { return this._s.has(c); },
            add(c) { this._s.add(c); },
            remove(c) { this._s.delete(c); }
        },
        querySelector: (s) => s === 'video' ? video : null,
        seekTo(t, a) { calls.push(['seekTo', t]); video.currentTime = t; },
        playVideo() { calls.push(['playVideo']); }
    };

    // Document mock
    const document = {
        getElementById: (id) => id === 'movie_player' ? player : null,
        addEventListener: () => {}
    };

    // Window mock
    const window = {
        dispatchEvent: (e) => events.push(e)
    };

    // CustomEvent mock
    class CustomEvent {
        constructor(type, opts) {
            this.type = type;
            this.detail = opts && opts.detail;
        }
    }

    // SetInterval e ClearInterval mock
    function setInterval(fn, ms) {
        const id = ++timerIdCounter;
        timers.push({ fn, everyMs: ms, accumulato: 0 });
        return id;
    }

    function clearInterval(id) {
        const idx = timers.findIndex(t => t.id === id);
        if (idx !== -1) {
            timers.splice(idx, 1);
        }
    }

    // Funzione tick: avanza il tempo e invoca i timer
    function tick(totalMs) {
        let tempoCorrente = 0;
        const step = 250;

        while (tempoCorrente < totalMs) {
            tempoCorrente += step;

            // Avanza currentTime se il video non e' in pausa
            if (!video.paused && opts.advanceTime) {
                video.currentTime += 0.25;
            }

            // Se il test vuole forzare stallo, riporta currentTime
            if (opts.forceStall) {
                video.currentTime = opts.stallTime || 100;
            }

            // Aggiorna i timer
            for (const timer of timers) {
                timer.accumulato += step;
                const multipli = Math.floor(timer.accumulato / timer.everyMs);
                if (multipli > 0) {
                    timer.accumulato -= multipli * timer.everyMs;
                    for (let m = 0; m < multipli; m++) {
                        timer.fn();
                    }
                }
            }
        }
    }

    return { video, player, document, window, CustomEvent, setInterval, clearInterval, tick, events, calls, timers };
}

// Esegue il blocco in sandbox e ritorna la sandbox
function eseguiBlocco(bloc, sb) {
    try {
        const fn = new Function('document', 'window', 'setInterval', 'clearInterval', 'CustomEvent', bloc);
        fn(sb.document, sb.window, sb.setInterval, sb.clearInterval, sb.CustomEvent);
        return true;
    } catch (e) {
        console.error('Errore esecuzione blocco:', e.message);
        return false;
    }
}

// Esegue un singolo test e ritorna il risultato
function runTest(n, desc, opts, expectedEvents, extraCheck) {
    const sb = makeSandbox(opts);

    // Esegui il blocco di codice estratto
    if (!eseguiBlocco(blocco, sb)) {
        return { pass: false, atteso: expectedEvents, ottenuto: 'errore esecuzione' };
    }

    // Esegui il tick per avanzare il tempo
    sb.tick(opts.tickMs);

    // Controlla il numero di eventi
    const obtainedEvents = sb.events.length;
    let pass = obtainedEvents === expectedEvents;

    // Controlli extra specifici per ogni test
    if (pass && extraCheck) {
        pass = extraCheck(sb);
    }

    if (pass) {
        console.log('PASS T' + n + ': ' + desc);
    } else {
        let extraInfo = '';
        if (extraCheck && !pass) {
            extraInfo = ' | ' + extraCheck.failReason || '';
        }
        console.log('FAIL T' + n + ': ' + desc + ' | atteso=' + expectedEvents + ' ottenuto=' + obtainedEvents + extraInfo);
    }

    return { pass };
}

// Raccolta risultati
let passed = 0;

// T1: Riproduzione normale - nessun evento atteso
{
    const opts = {
        currentTime: 10,
        paused: false,
        duration: 600,
        readyState: 4,
        bufEnd: 40,
        tickMs: 10000,
        advanceTime: true
    };
    const result = runTest(1, 'riproduzione normale', opts, 0, (sb) => {
        if (sb.events.length !== 0) {
            return { pass: false, failReason: 'eventi inaspettati durante riproduzione normale' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// T2: Stallo con buffer avanti - un evento atteso e seek
{
    const opts = {
        currentTime: 100,
        paused: false,
        duration: 600,
        readyState: 4,
        bufEnd: 130,
        tickMs: 2000,
        advanceTime: false,
        forceStall: true,
        stallTime: 100
    };
    const result = runTest(2, 'stallo con buffer avanti', opts, 1, (sb) => {
        if (sb.video.currentTime <= 100 || sb.video.currentTime > 130) {
            return { pass: false, failReason: 'currentTime=' + sb.video.currentTime + ' non in range (100,130]' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// T3: Video in pausa - nessun evento atteso
{
    const opts = {
        currentTime: 50,
        paused: true,
        duration: 600,
        readyState: 4,
        bufEnd: 80,
        tickMs: 10000,
        advanceTime: false
    };
    const result = runTest(3, 'video in pausa', opts, 0, (sb) => {
        if (sb.video.currentTime !== 50) {
            return { pass: false, failReason: 'currentTime modificato durante pausa' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// T4: Diretta live - nessun evento atteso (duration Infinity)
{
    const opts = {
        currentTime: 100,
        paused: false,
        duration: Infinity,
        readyState: 4,
        bufEnd: 130,
        tickMs: 10000,
        advanceTime: false
    };
    const result = runTest(4, 'diretta live', opts, 0, (sb) => {
        if (sb.events.length !== 0) {
            return { pass: false, failReason: 'eventi inaspettati su live' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// T5: Durante annuncio - nessun evento (ad-showing)
{
    const opts = {
        currentTime: 100,
        paused: false,
        duration: 600,
        readyState: 4,
        bufEnd: 130,
        tickMs: 2000,
        advanceTime: false,
        forceStall: true,
        stallTime: 100
    };
    const sb = makeSandbox(opts);

    // Aggiunge la classe ad-showing prima del tick
    sb.player.classList.add('ad-showing');

    if (!eseguiBlocco(blocco, sb)) {
        console.log('FAIL T5: durante annuncio | errore esecuzione');
    } else {
        sb.tick(opts.tickMs);
        if (sb.events.length === 0) {
            console.log('PASS T5: durante annuncio');
            passed++;
        } else {
            console.log('FAIL T5: durante annuncio | atteso=0 ottenuto=' + sb.events.length);
        }
    }
}

// T6: Budget massimo - 5 eventi esatti (60000ms / 12000ms = 5)
{
    const opts = {
        currentTime: 100,
        paused: false,
        duration: 600,
        readyState: 4,
        bufEnd: 130,
        tickMs: 60000,
        advanceTime: false,
        forceStall: true,
        stallTime: 100
    };
    const result = runTest(6, 'budget massimo', opts, 5, (sb) => {
        if (sb.events.length !== 5) {
            return { pass: false, failReason: 'numero eventi=' + sb.events.length + ' non 5' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// T7: ReadyState basso - nessun evento atteso
{
    const opts = {
        currentTime: 100,
        paused: false,
        duration: 600,
        readyState: 1,
        bufEnd: 130,
        tickMs: 10000,
        advanceTime: false,
        forceStall: true,
        stallTime: 100
    };
    const result = runTest(7, 'readyState basso', opts, 0, (sb) => {
        if (sb.events.length !== 0) {
            return { pass: false, failReason: 'eventi con readyState basso' };
        }
        return true;
    });
    if (result.pass) passed++;
}

// Output finale
console.log('RISULTATO: ' + passed + '/7 passati');

if (passed < 7) {
    process.exit(1);
} else {
    process.exit(0);
}
