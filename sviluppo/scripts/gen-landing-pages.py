#!/usr/bin/env python3
"""
Generate a curated set of distinct long-tail landing pages (EN at root, IT under /it/).

Boilerplate (head/nav/footer/schema/styles) is templated; the CONTENT of each page is
hand-authored and unique per topic, to avoid thin/doorway content. Each page targets one
genuine AdOff differentiator.

Run:  python3 sviluppo/scripts/gen-landing-pages.py
"""
import html as _html
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / "site"
BASE = "https://adoff.app"
CSSV = "260520-205323"

# Each topic: slug, and per-lang content {title, desc, h1, answer, sections[(h2,[paras])], faq[(q,a)]}
TOPICS = [
    {
        "slug": "undetectable-ad-blocker",
        "en": {
            "title": "Undetectable Ad Blocker: Block Ads Without Being Detected (2026)",
            "desc": "Most ad blockers are easy for websites to detect. Learn how anti-adblock detection works and how an undetectable, stealth ad blocker keeps you invisible while removing every ad.",
            "h1": "The undetectable ad blocker",
            "answer": "An undetectable ad blocker removes ads <em>and</em> hides the fact that it did. Regular blockers leave measurable traces — empty ad slots, blocked requests — that anti-adblock scripts detect. AdOff's Stealth mode spoofs those signals so websites see nothing unusual.",
            "sections": [
                ("How websites detect ad blockers", [
                    "Anti-adblock systems plant decoy ad elements and check whether they get hidden, fire test requests to ad servers and check whether they're blocked, and probe for ad-related JavaScript globals. A normal blocker reacts to all of these in a way the page can measure.",
                    "Once detected, the site can hide its content behind a wall, show a nag, or quietly degrade your experience. You blocked the ads, but the site knows — and fights back."
                ]),
                ("What makes a blocker undetectable", [
                    "Being undetectable means passing those probes as if no blocker were present: the decoy element looks visible, the test requests look answered, the expected globals exist. AdOff operates in the page's main execution context and spoofs the bait elements, intercepts detection fetches, and masks the variables anti-adblock relies on.",
                    "The result: ads are removed at the network and cosmetic level, but the probes come back normal. No wall, no nag."
                ]),
                ("Test your current setup", [
                    "You can check whether your current ad blocker is detectable with our free, private in-browser test — it runs the same probes anti-adblock scripts use and shows the result in five seconds."
                ]),
            ],
            "faq": [
                ("Can websites tell if I'm using an ad blocker?", "Usually yes. Most blockers leave measurable traces. A stealth ad blocker like AdOff spoofs those signals so detection scripts see nothing unusual."),
                ("How do I make my ad blocker undetectable?", "Use a blocker with a dedicated stealth layer that runs in the page context and masks bait elements, test requests, and detection variables. AdOff includes this in its Pro and trial tiers."),
                ("Is an undetectable ad blocker against the rules?", "Blocking ads is your choice on your own device. AdOff simply blocks ads without leaving the traces that trigger anti-adblock walls."),
            ],
            "cta": ("Block ads — stay invisible", "AdOff's Stealth mode removes every ad and keeps you undetectable. Free, ultra-light, privacy-first."),
            "tool": ("Test if your ad blocker is detectable", "/adblock-detector"),
        },
        "it": {
            "title": "Ad blocker non rilevabile: blocca le pubblicità senza essere scoperto (2026)",
            "desc": "La maggior parte degli ad blocker è facile da rilevare per i siti. Scopri come funziona il rilevamento anti-adblock e come un ad blocker stealth non rilevabile ti tiene invisibile mentre rimuove ogni pubblicità.",
            "h1": "L'ad blocker non rilevabile",
            "answer": "Un ad blocker non rilevabile rimuove le pubblicità <em>e</em> nasconde di averlo fatto. I blocker normali lasciano tracce misurabili — spazi pubblicitari vuoti, richieste bloccate — che gli script anti-adblock rilevano. La modalità Stealth di AdOff falsifica quei segnali così i siti non vedono nulla di anomalo.",
            "sections": [
                ("Come i siti rilevano gli ad blocker", [
                    "I sistemi anti-adblock piazzano elementi pubblicitari esca e controllano se vengono nascosti, lanciano richieste di test verso i server pubblicitari e controllano se vengono bloccate, e cercano variabili JavaScript legate alle pubblicità. Un blocker normale reagisce a tutto questo in modo che la pagina può misurare.",
                    "Una volta rilevato, il sito può nascondere i contenuti dietro un muro, mostrare un messaggio insistente o degradare silenziosamente la tua esperienza. Hai bloccato le pubblicità, ma il sito lo sa — e reagisce."
                ]),
                ("Cosa rende un blocker non rilevabile", [
                    "Essere non rilevabili significa superare quelle sonde come se nessun blocker fosse presente: l'elemento esca sembra visibile, le richieste di test sembrano andate a buon fine, le variabili attese esistono. AdOff opera nel contesto di esecuzione principale della pagina e falsifica gli elementi esca, intercetta le fetch di rilevamento e maschera le variabili su cui si basa l'anti-adblock.",
                    "Il risultato: le pubblicità vengono rimosse a livello di rete e cosmetico, ma le sonde tornano normali. Niente muro, niente messaggi."
                ]),
                ("Testa la tua configurazione attuale", [
                    "Puoi verificare se il tuo ad blocker attuale è rilevabile con il nostro test gratuito e privato nel browser — esegue le stesse sonde usate dagli script anti-adblock e mostra il risultato in cinque secondi."
                ]),
            ],
            "faq": [
                ("I siti possono capire se uso un ad blocker?", "Di solito sì. La maggior parte dei blocker lascia tracce misurabili. Un ad blocker stealth come AdOff falsifica quei segnali così gli script di rilevamento non vedono nulla di anomalo."),
                ("Come rendo non rilevabile il mio ad blocker?", "Usa un blocker con uno strato stealth dedicato che gira nel contesto della pagina e maschera elementi esca, richieste di test e variabili di rilevamento. AdOff lo include nei piani Pro e trial."),
                ("Un ad blocker non rilevabile è contro le regole?", "Bloccare le pubblicità è una tua scelta sul tuo dispositivo. AdOff blocca semplicemente le pubblicità senza lasciare le tracce che fanno scattare i muri anti-adblock."),
            ],
            "cta": ("Blocca le pubblicità — resta invisibile", "La modalità Stealth di AdOff rimuove ogni pubblicità e ti tiene non rilevabile. Gratis, ultra-leggero, privacy-first."),
            "tool": ("Testa se il tuo ad blocker è rilevabile", "/it/adblock-detector"),
        },
    },
    {
        "slug": "lightweight-ad-blocker",
        "en": {
            "title": "Lightweight Ad Blocker for Chrome: Low RAM, Fast (2026)",
            "desc": "Heavy ad blockers can slow your browser and eat RAM. A lightweight ad blocker uses a tiny rule set and asynchronous blocking to speed up pages. Here's why size matters and what to choose.",
            "h1": "A lightweight ad blocker that speeds up your browser",
            "answer": "A lightweight ad blocker uses a small, precise rule set instead of giant filter lists, so it adds almost no memory or CPU overhead. AdOff is ultra-light — a fraction of the size of typical blockers (3–8 MB) — and actually speeds browsing up by cutting ad traffic.",
            "sections": [
                ("Why most blockers are heavy", [
                    "Many popular blockers load filter lists with 80,000+ rules. Every rule is matched against every request, and the lists sit in memory the whole time your browser runs. On low-end machines that means noticeable lag and higher RAM use.",
                ]),
                ("How a small rule set can block just as much", [
                    "The bulk of ads come from a relatively small number of ad networks. AdOff uses around 130 targeted rules that cover the vast majority of ad traffic, instead of tens of thousands of mostly-redundant ones. Fewer rules, matched faster, with a tiny footprint.",
                    "Because ad and tracker requests are blocked before they load, pages render faster and use less network — so the blocker pays for itself in speed."
                ]),
                ("Lightweight doesn't mean weak", [
                    "AdOff still does network blocking, cosmetic filtering, video ad neutralization and stealth anti-detection. It's small because it's precise, not because it cuts corners."
                ]),
            ],
            "faq": [
                ("Do ad blockers slow down Chrome?", "Heavy ones can, by loading huge filter lists into memory. A lightweight blocker like AdOff speeds Chrome up by blocking ad requests before they load."),
                ("What is the lightest ad blocker for Chrome?", "AdOff is ultra-light — a fraction of the size of typical blockers — because it uses a small, targeted rule set instead of giant filter lists."),
                ("Does a lightweight ad blocker block fewer ads?", "Not necessarily. AdOff's ~130 targeted rules cover the vast majority of ad networks, so it blocks effectively while staying small."),
            ],
            "cta": ("The ad blocker that makes Chrome faster", "Ultra-light, asynchronous, and precise. AdOff blocks ads while using a fraction of the RAM. Free."),
            "tool": None,
        },
        "it": {
            "title": "Ad blocker leggero per Chrome: poca RAM, veloce (2026)",
            "desc": "Gli ad blocker pesanti possono rallentare il browser e consumare RAM. Un ad blocker leggero usa un set di regole minimo e blocco asincrono per velocizzare le pagine. Ecco perché la dimensione conta.",
            "h1": "Un ad blocker leggero che velocizza il browser",
            "answer": "Un ad blocker leggero usa un set di regole piccolo e preciso invece di liste di filtri enormi, quindi aggiunge pochissimo overhead di memoria o CPU. AdOff è ultra-leggero — una frazione della dimensione dei blocker tipici (3–8 MB) — e di fatto velocizza la navigazione tagliando il traffico pubblicitario.",
            "sections": [
                ("Perché la maggior parte dei blocker è pesante", [
                    "Molti blocker popolari caricano liste di filtri con oltre 80.000 regole. Ogni regola viene confrontata con ogni richiesta, e le liste restano in memoria per tutto il tempo in cui il browser è acceso. Su macchine poco potenti questo significa lentezza evidente e maggior uso di RAM.",
                ]),
                ("Come un set di regole piccolo può bloccare altrettanto", [
                    "La maggior parte delle pubblicità proviene da un numero relativamente piccolo di reti pubblicitarie. AdOff usa circa 130 regole mirate che coprono la grande maggioranza del traffico pubblicitario, invece di decine di migliaia di regole quasi sempre ridondanti. Meno regole, confrontate più in fretta, con un'impronta minima.",
                    "Poiché le richieste di pubblicità e tracker vengono bloccate prima di caricarsi, le pagine si renderizzano più velocemente e usano meno rete — così il blocker si ripaga in velocità."
                ]),
                ("Leggero non significa debole", [
                    "AdOff fa comunque blocco di rete, filtri cosmetici, neutralizzazione video e stealth anti-rilevamento. È piccolo perché è preciso, non perché taglia gli angoli."
                ]),
            ],
            "faq": [
                ("Gli ad blocker rallentano Chrome?", "Quelli pesanti possono, caricando liste di filtri enormi in memoria. Un blocker leggero come AdOff velocizza Chrome bloccando le richieste pubblicitarie prima che si carichino."),
                ("Qual è l'ad blocker più leggero per Chrome?", "AdOff è ultra-leggero — una frazione della dimensione dei blocker tipici — perché usa un set di regole piccolo e mirato invece di liste di filtri enormi."),
                ("Un ad blocker leggero blocca meno pubblicità?", "Non necessariamente. Le circa 130 regole mirate di AdOff coprono la grande maggioranza delle reti pubblicitarie, quindi blocca in modo efficace restando piccolo."),
            ],
            "cta": ("L'ad blocker che rende Chrome più veloce", "Ultra-leggero, asincrono e preciso. AdOff blocca le pubblicità usando una frazione della RAM. Gratis."),
            "tool": None,
        },
    },
    {
        "slug": "manifest-v3-ad-blocker",
        "en": {
            "title": "Manifest V3 Ad Blocker That Still Works (2026)",
            "desc": "Chrome's Manifest V3 broke or weakened many classic ad blockers. Learn what changed, why some blockers lost power, and how a native Manifest V3 ad blocker keeps blocking everything.",
            "h1": "A Manifest V3 ad blocker that still works",
            "answer": "Manifest V3 changed how Chrome extensions block requests, weakening blockers built for the old system. A native Manifest V3 ad blocker like AdOff is designed around the new <code>declarativeNetRequest</code> rules from the ground up, so it keeps blocking ads fully and efficiently.",
            "sections": [
                ("What Manifest V3 changed", [
                    "Chrome's Manifest V3 replaced the old dynamic request-blocking API with a declarative one and capped how rules work. Blockers built on the old approach had to be rewritten, and some lost capability or were phased out, which is why long-time users noticed ads coming back.",
                ]),
                ("Why native MV3 blockers stay strong", [
                    "A blocker designed for Manifest V3 uses the declarative rule engine the way Chrome now intends, combined with content-script cosmetic filtering and main-world scripting for advanced cases. AdOff was built MV3-native: network rules, cosmetic hiding, video ad neutralization and stealth all work within the new model.",
                ]),
                ("What to check before installing", [
                    "Make sure the blocker explicitly supports Manifest V3 and is actively maintained. AdOff is MV3-native across Chrome, Edge, Opera, Brave, plus Firefox and Safari builds."
                ]),
            ],
            "faq": [
                ("Did Manifest V3 kill ad blockers?", "It weakened blockers built for the old system, but native Manifest V3 blockers like AdOff keep blocking fully using the new declarative rules."),
                ("What is the best Manifest V3 ad blocker?", "A strong choice is one built MV3-native with network blocking, cosmetic filtering and stealth. AdOff fits this and is lightweight."),
                ("Will my old ad blocker stop working?", "Some older blockers lost capability under Manifest V3. A native MV3 blocker avoids that problem."),
            ],
            "cta": ("Built for Manifest V3 from day one", "AdOff blocks fully under Chrome's new rules — network, cosmetic, video and stealth. Free."),
            "tool": None,
        },
        "it": {
            "title": "Ad blocker Manifest V3 che funziona ancora (2026)",
            "desc": "Il Manifest V3 di Chrome ha rotto o indebolito molti ad blocker classici. Scopri cosa è cambiato, perché alcuni blocker hanno perso potenza e come un ad blocker Manifest V3 nativo continua a bloccare tutto.",
            "h1": "Un ad blocker Manifest V3 che funziona ancora",
            "answer": "Il Manifest V3 ha cambiato il modo in cui le estensioni Chrome bloccano le richieste, indebolendo i blocker costruiti per il vecchio sistema. Un ad blocker Manifest V3 nativo come AdOff è progettato dall'inizio intorno alle nuove regole <code>declarativeNetRequest</code>, quindi continua a bloccare le pubblicità in modo completo ed efficiente.",
            "sections": [
                ("Cosa ha cambiato il Manifest V3", [
                    "Il Manifest V3 di Chrome ha sostituito la vecchia API dinamica di blocco delle richieste con una dichiarativa e ha posto limiti al funzionamento delle regole. I blocker basati sul vecchio approccio hanno dovuto essere riscritti, e alcuni hanno perso capacità o sono stati dismessi: ecco perché molti utenti storici hanno notato le pubblicità tornare.",
                ]),
                ("Perché i blocker MV3 nativi restano forti", [
                    "Un blocker progettato per il Manifest V3 usa il motore di regole dichiarativo come Chrome ora prevede, combinato con i filtri cosmetici del content script e lo scripting nel main world per i casi avanzati. AdOff è nato MV3-nativo: regole di rete, hiding cosmetico, neutralizzazione video e stealth funzionano tutti dentro il nuovo modello.",
                ]),
                ("Cosa verificare prima di installare", [
                    "Assicurati che il blocker supporti esplicitamente il Manifest V3 e sia mantenuto attivamente. AdOff è MV3-nativo su Chrome, Edge, Opera, Brave, oltre alle build Firefox e Safari."
                ]),
            ],
            "faq": [
                ("Il Manifest V3 ha ucciso gli ad blocker?", "Ha indebolito i blocker costruiti per il vecchio sistema, ma i blocker Manifest V3 nativi come AdOff continuano a bloccare in pieno usando le nuove regole dichiarative."),
                ("Qual è il miglior ad blocker Manifest V3?", "Una scelta forte è uno nato MV3-nativo con blocco di rete, filtri cosmetici e stealth. AdOff rientra in questo ed è leggero."),
                ("Il mio vecchio ad blocker smetterà di funzionare?", "Alcuni blocker più vecchi hanno perso capacità con il Manifest V3. Un blocker MV3 nativo evita questo problema."),
            ],
            "cta": ("Costruito per il Manifest V3 dal primo giorno", "AdOff blocca in pieno con le nuove regole di Chrome — rete, cosmetico, video e stealth. Gratis."),
            "tool": None,
        },
    },
    {
        "slug": "block-video-ads",
        "en": {
            "title": "How to Block Video Ads on Streaming Platforms (2026)",
            "desc": "Video ads are the hardest to block because players inject them at the SDK level. Learn why URL blocking fails on video, and how SDK neutralization removes pre-roll and mid-roll ads.",
            "h1": "How to block video ads",
            "answer": "Video ads are injected by the player's ad SDK, so simply blocking ad URLs often fails. The reliable way is <strong>SDK neutralization</strong>: replacing the advertising SDK with a neutral version that tells the player \"no ads to show.\" AdOff Pro does this, so videos start instantly with no pre-roll or mid-roll.",
            "sections": [
                ("Why video ads are the hardest to block", [
                    "On most streaming platforms the video player loads an advertising SDK that decides when to show pre-roll and mid-roll ads. Because the ad and the content can come through the same channel, blocking by URL is unreliable and can break playback.",
                ]),
                ("How SDK neutralization works", [
                    "Instead of fighting individual ad URLs, AdOff replaces the ad SDK in the page with a neutral stub. When the player asks the SDK for ads, the stub immediately responds that there are none and signals \"resume content.\" The video starts right away, with no countdown and no interruptions.",
                    "This approach is platform-agnostic: it works anywhere the common video ad standard is used, which covers the vast majority of online players."
                ]),
                ("Free vs Pro", [
                    "Network and cosmetic blocking on the free plan handle website ads. Video ad neutralization is part of AdOff Pro, included free in the 30-day trial."
                ]),
            ],
            "faq": [
                ("Why don't ad blockers stop video ads?", "Because video ads are injected at the SDK level, not as separate URLs. Blocking URLs is unreliable. SDK neutralization is the dependable approach."),
                ("How does AdOff block video ads?", "AdOff Pro replaces the advertising SDK with a neutral version that reports no ads, so the player resumes content immediately."),
                ("Does video ad blocking work on all platforms?", "It works anywhere the common video ad standard is used, which covers the vast majority of streaming players."),
            ],
            "cta": ("Video ads, gone", "AdOff Pro neutralizes the ad SDK so videos start instantly — no pre-roll, no mid-roll. Free 30-day trial."),
            "tool": None,
        },
        "it": {
            "title": "Come bloccare le pubblicità nei video sulle piattaforme di streaming (2026)",
            "desc": "Le pubblicità video sono le più difficili da bloccare perché i player le iniettano a livello di SDK. Scopri perché il blocco per URL fallisce sui video e come la neutralizzazione dell'SDK rimuove pre-roll e mid-roll.",
            "h1": "Come bloccare le pubblicità nei video",
            "answer": "Le pubblicità video vengono iniettate dall'SDK pubblicitario del player, quindi bloccare semplicemente gli URL spesso fallisce. Il metodo affidabile è la <strong>neutralizzazione dell'SDK</strong>: sostituire l'SDK pubblicitario con una versione neutra che dice al player \"nessuna pubblicità da mostrare.\" AdOff Pro fa questo, così i video partono subito senza pre-roll né mid-roll.",
            "sections": [
                ("Perché le pubblicità video sono le più difficili da bloccare", [
                    "Sulla maggior parte delle piattaforme di streaming il player video carica un SDK pubblicitario che decide quando mostrare pubblicità pre-roll e mid-roll. Poiché la pubblicità e il contenuto possono arrivare dallo stesso canale, bloccare per URL è inaffidabile e può rompere la riproduzione.",
                ]),
                ("Come funziona la neutralizzazione dell'SDK", [
                    "Invece di combattere i singoli URL pubblicitari, AdOff sostituisce l'SDK pubblicitario nella pagina con uno stub neutro. Quando il player chiede pubblicità all'SDK, lo stub risponde immediatamente che non ce ne sono e segnala \"riprendi il contenuto.\" Il video parte subito, senza conto alla rovescia e senza interruzioni.",
                    "Questo approccio è indipendente dalla piattaforma: funziona ovunque sia usato lo standard pubblicitario video comune, che copre la grande maggioranza dei player online."
                ]),
                ("Free vs Pro", [
                    "Il blocco di rete e cosmetico nel piano gratis gestisce le pubblicità dei siti. La neutralizzazione video fa parte di AdOff Pro, inclusa gratis nei 15 giorni di prova."
                ]),
            ],
            "faq": [
                ("Perché gli ad blocker non fermano le pubblicità video?", "Perché le pubblicità video vengono iniettate a livello di SDK, non come URL separati. Bloccare gli URL è inaffidabile. La neutralizzazione dell'SDK è l'approccio affidabile."),
                ("Come fa AdOff a bloccare le pubblicità video?", "AdOff Pro sostituisce l'SDK pubblicitario con una versione neutra che segnala nessuna pubblicità, così il player riprende subito il contenuto."),
                ("Il blocco delle pubblicità video funziona su tutte le piattaforme?", "Funziona ovunque sia usato lo standard pubblicitario video comune, che copre la grande maggioranza dei player di streaming."),
            ],
            "cta": ("Pubblicità video, sparite", "AdOff Pro neutralizza l'SDK pubblicitario così i video partono subito — niente pre-roll, niente mid-roll. Prova gratis 15 giorni."),
            "tool": None,
        },
    },
    {
        "slug": "bypass-anti-adblock",
        "en": {
            "title": "How to Bypass Anti-Adblock Walls (2026)",
            "desc": "Tired of 'please disable your ad blocker' walls? Learn how anti-adblock detection works and how a stealth ad blocker bypasses these walls while still removing every ad.",
            "h1": "How to bypass anti-adblock walls",
            "answer": "Anti-adblock walls appear when a site detects your blocker. To bypass them you need a blocker that stays <strong>undetected</strong> — one that blocks ads without leaving the traces detection scripts look for. AdOff's Stealth mode does exactly this, so the wall never triggers.",
            "sections": [
                ("Why the walls appear", [
                    "Anti-adblock scripts test whether ads are being blocked: they check decoy elements, fire test ad requests, and look for ad-related globals. When they detect blocking, they show a wall or hide the content.",
                ]),
                ("Bypassing by staying invisible", [
                    "The robust way to bypass these walls isn't to dismiss them after they appear — it's to never trigger them. AdOff's Stealth mode spoofs the bait elements, intercepts the detection requests, and masks the variables anti-adblock relies on, so the site's test comes back clean while the ads are still gone.",
                ]),
                ("What about the most aggressive sites", [
                    "Some sites are very aggressive. AdOff's stealth covers the most common detection techniques; if you find a site that still slips through, the support form lets you report it for the next filter update."
                ]),
            ],
            "faq": [
                ("How do I get past 'disable your ad blocker' messages?", "Use a stealth ad blocker that doesn't get detected in the first place. AdOff spoofs the signals anti-adblock scripts check, so the wall never appears."),
                ("Why do some sites detect my ad blocker?", "Because normal blockers leave measurable traces. Sites probe for those traces and show a wall when they find them."),
                ("Can anti-adblock walls always be bypassed?", "AdOff's stealth handles the most common detection methods. Rare aggressive cases can be reported for a filter update."),
            ],
            "cta": ("No more anti-adblock walls", "AdOff's Stealth mode keeps you undetected, so the walls never trigger. Free, ultra-light."),
            "tool": ("Test if sites can detect your blocker", "/adblock-detector"),
        },
        "it": {
            "title": "Come superare i muri anti-adblock (2026)",
            "desc": "Stanco dei muri 'disattiva il tuo ad blocker'? Scopri come funziona il rilevamento anti-adblock e come un ad blocker stealth supera questi muri continuando a rimuovere ogni pubblicità.",
            "h1": "Come superare i muri anti-adblock",
            "answer": "I muri anti-adblock compaiono quando un sito rileva il tuo blocker. Per superarli serve un blocker che resti <strong>non rilevato</strong> — uno che blocca le pubblicità senza lasciare le tracce che gli script di rilevamento cercano. La modalità Stealth di AdOff fa esattamente questo, così il muro non scatta mai.",
            "sections": [
                ("Perché compaiono i muri", [
                    "Gli script anti-adblock testano se le pubblicità vengono bloccate: controllano gli elementi esca, lanciano richieste pubblicitarie di test e cercano variabili globali legate alle pubblicità. Quando rilevano il blocco, mostrano un muro o nascondono il contenuto.",
                ]),
                ("Superarli restando invisibili", [
                    "Il modo robusto per superare questi muri non è chiuderli dopo che compaiono — è non farli scattare mai. La modalità Stealth di AdOff falsifica gli elementi esca, intercetta le richieste di rilevamento e maschera le variabili su cui si basa l'anti-adblock, così il test del sito torna pulito mentre le pubblicità restano sparite.",
                ]),
                ("E con i siti più aggressivi", [
                    "Alcuni siti sono molto aggressivi. Lo stealth di AdOff copre le tecniche di rilevamento più comuni; se trovi un sito che sfugge ancora, il modulo di supporto ti permette di segnalarlo per il prossimo aggiornamento dei filtri."
                ]),
            ],
            "faq": [
                ("Come supero i messaggi 'disattiva il tuo ad blocker'?", "Usa un ad blocker stealth che non viene rilevato in primo luogo. AdOff falsifica i segnali che gli script anti-adblock controllano, così il muro non compare."),
                ("Perché alcuni siti rilevano il mio ad blocker?", "Perché i blocker normali lasciano tracce misurabili. I siti cercano quelle tracce e mostrano un muro quando le trovano."),
                ("I muri anti-adblock si possono sempre superare?", "Lo stealth di AdOff gestisce i metodi di rilevamento più comuni. I rari casi aggressivi possono essere segnalati per un aggiornamento dei filtri."),
            ],
            "cta": ("Basta muri anti-adblock", "La modalità Stealth di AdOff ti tiene non rilevato, così i muri non scattano mai. Gratis, ultra-leggero."),
            "tool": ("Testa se i siti rilevano il tuo blocker", "/it/adblock-detector"),
        },
    },
    {
        "slug": "private-ad-blocker",
        "en": {
            "title": "Private Ad Blocker: Zero Data Collection (2026)",
            "desc": "Some ad blockers track you while claiming to protect you. A private ad blocker collects nothing, stores settings locally, and is auditable. Here's what real privacy looks like.",
            "h1": "A private ad blocker that collects nothing",
            "answer": "A truly private ad blocker doesn't log your browsing, doesn't phone home, and keeps everything on your device. AdOff has a zero-log policy: it doesn't know which sites you visit, counters and settings live in local storage, and the only server contact is Pro license validation.",
            "sections": [
                ("The privacy paradox of ad blockers", [
                    "An ad blocker sees every page you load — so it's in a powerful position to track you. Some blockers (and many fake ones) exploit that. Choosing a blocker is also choosing who to trust with your entire browsing history.",
                ]),
                ("What zero data collection actually means", [
                    "AdOff applies a zero-log policy by design. It doesn't record the sites you visit, what you search, or how long you stay. Counters, whitelist and preferences are stored locally on your device. The only network call is validating a Pro license (key and email). Nothing about your browsing leaves your machine.",
                    "Because it's privacy-first by design rather than by promise, it's GDPR-compliant from the ground up, and the code can be inspected before installation."
                ]),
                ("Privacy and blocking together", [
                    "Blocking trackers is itself a privacy win — fewer third parties profiling you. A private blocker that also blocks trackers gives you both: no ads, no tracking, and no new party watching you."
                ]),
            ],
            "faq": [
                ("Do ad blockers collect my data?", "Some do — they see every page you load. AdOff has a zero-log policy and collects nothing; settings stay on your device."),
                ("Is AdOff GDPR compliant?", "Yes, by design. It doesn't collect browsing data, stores settings locally, and only contacts the server to validate a Pro license."),
                ("What is the most private ad blocker?", "One with a zero-log policy and local-only storage, like AdOff, which also blocks trackers for additional privacy."),
            ],
            "cta": ("No ads. No tracking. No data collected.", "AdOff blocks ads and trackers with a strict zero-log policy. Free, privacy-first."),
            "tool": None,
        },
        "it": {
            "title": "Ad blocker privato: zero raccolta dati (2026)",
            "desc": "Alcuni ad blocker ti tracciano mentre dicono di proteggerti. Un ad blocker privato non raccoglie nulla, salva le impostazioni in locale ed è ispezionabile. Ecco com'è la vera privacy.",
            "h1": "Un ad blocker privato che non raccoglie nulla",
            "answer": "Un ad blocker davvero privato non registra la tua navigazione, non comunica di nascosto e tiene tutto sul tuo dispositivo. AdOff ha una zero-log policy: non sa quali siti visiti, contatori e impostazioni vivono nello storage locale, e l'unico contatto col server è la validazione della licenza Pro.",
            "sections": [
                ("Il paradosso privacy degli ad blocker", [
                    "Un ad blocker vede ogni pagina che carichi — quindi è in una posizione potente per tracciarti. Alcuni blocker (e molti falsi) lo sfruttano. Scegliere un blocker significa anche scegliere a chi affidare l'intera cronologia di navigazione.",
                ]),
                ("Cosa significa davvero zero raccolta dati", [
                    "AdOff applica una zero-log policy by design. Non registra i siti che visiti, cosa cerchi o quanto resti. Contatori, whitelist e preferenze sono salvati localmente sul tuo dispositivo. L'unica chiamata di rete è la validazione di una licenza Pro (chiave ed email). Niente della tua navigazione lascia la tua macchina.",
                    "Poiché è privacy-first per progettazione e non per promessa, è GDPR-compliant dalle fondamenta, e il codice è ispezionabile prima dell'installazione."
                ]),
                ("Privacy e blocco insieme", [
                    "Bloccare i tracker è di per sé un guadagno di privacy — meno terze parti che ti profilano. Un blocker privato che blocca anche i tracker ti dà entrambi: niente pubblicità, niente tracciamento e nessun nuovo soggetto che ti osserva."
                ]),
            ],
            "faq": [
                ("Gli ad blocker raccolgono i miei dati?", "Alcuni sì — vedono ogni pagina che carichi. AdOff ha una zero-log policy e non raccoglie nulla; le impostazioni restano sul tuo dispositivo."),
                ("AdOff è conforme al GDPR?", "Sì, per progettazione. Non raccoglie dati di navigazione, salva le impostazioni in locale e contatta il server solo per validare una licenza Pro."),
                ("Qual è l'ad blocker più privato?", "Uno con zero-log policy e storage solo locale, come AdOff, che blocca anche i tracker per privacy aggiuntiva."),
            ],
            "cta": ("Niente pubblicità. Niente tracciamento. Nessun dato raccolto.", "AdOff blocca pubblicità e tracker con una rigorosa zero-log policy. Gratis, privacy-first."),
            "tool": None,
        },
    },
]

ALL_HREF = [("en", ""), ("it", "it/")]


def esc(s):
    return s  # content authored safe; keep entities as-is


def render(topic, lang):
    c = topic[lang]
    slug = topic["slug"]
    en_url = f"{BASE}/{slug}"
    it_url = f"{BASE}/it/{slug}"
    self_url = en_url if lang == "en" else it_url
    install = "/install.html"

    sections_html = ""
    for h2, paras in c["sections"]:
        ps = "".join(f"<p>{p}</p>\n      " for p in paras)
        sections_html += f"      <h2>{h2}</h2>\n      {ps}\n"

    tool_html = ""
    if c.get("tool"):
        label, href = c["tool"]
        tool_html = f'      <p><a href="{href}" style="color:#7c5cfc;font-weight:600">→ {label}</a></p>\n'

    faq_html = ""
    for q, a in c["faq"]:
        faq_html += f'      <h3>{q}</h3>\n      <p>{a}</p>\n'

    faq_schema = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": _html.unescape(__import__("re").sub("<[^>]+>", "", a))}}
                       for q, a in c["faq"]]
    }
    art_schema = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": c["title"], "description": c["desc"],
        "image": f"{BASE}/assets/og-image.png",
        "author": {"@type": "Organization", "name": "AdOff"},
        "publisher": {"@type": "Organization", "name": "AdOff"},
        "datePublished": "2026-05-28", "dateModified": "2026-05-28"
    }

    cta_t, cta_p = c["cta"]
    html_doc = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{c['title']} | AdOff</title>
  <meta name="description" content="{c['desc']}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="{self_url}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{c['title']}" />
  <meta property="og:description" content="{c['desc']}" />
  <meta property="og:image" content="{BASE}/assets/og-image.png" />
  <meta property="og:url" content="{self_url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{c['title']}" />
  <meta name="twitter:description" content="{c['desc']}" />
  <meta name="twitter:image" content="{BASE}/assets/og-image.png" />
  <link rel="icon" href="/assets/icon128.png" type="image/png" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#0a0a1a" />
  <link rel="alternate" hreflang="en" href="{en_url}" />
  <link rel="alternate" hreflang="it" href="{it_url}" />
  <link rel="alternate" hreflang="x-default" href="{en_url}" />
  <link rel="stylesheet" href="/style.css?v={CSSV}" />
  <style>
    .article-page {{ max-width: 780px; margin: 0 auto; padding: 84px 24px 100px; }}
    .article-page h1 {{ font-size: clamp(1.8rem, 4vw, 2.6rem); color: #fff; margin-bottom: 16px; line-height: 1.2; }}
    .article-page h2 {{ font-size: 1.5rem; color: #fff; margin: 44px 0 14px; }}
    .article-page h3 {{ font-size: 1.15rem; color: #e2e2f0; margin: 28px 0 10px; }}
    .article-page p {{ color: #b0b0c8; line-height: 1.8; margin-bottom: 16px; }}
    .article-page strong {{ color: #fff; }}
    .article-page code {{ background:#1f1f3a; padding:2px 6px; border-radius:5px; color:#c9b8ff; font-size:0.92em; }}
    .answer-box {{ background:#12122a; border-left:4px solid #7c5cfc; border-radius:8px; padding:24px; margin:0 0 36px; }}
    .answer-box p {{ margin:0; color:#d8d8ea; font-size:1.05rem; }}
    .cta-section {{ background:linear-gradient(135deg,rgba(124,92,252,.14),rgba(124,92,252,.03)); border:1px solid #2a2a4a; border-radius:16px; padding:32px; text-align:center; margin-top:48px; }}
    .cta-section h3 {{ color:#fff; margin:0 0 8px; }}
    .cta-section p {{ margin:0 0 20px; color:#b0b0c8; }}
    .cta-section .btn {{ display:inline-block; padding:14px 28px; background:#fff; color:#0a0a1a; font-weight:700; border-radius:12px; text-decoration:none; }}
  </style>
  <script type="application/ld+json">
  {json.dumps(art_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
  {json.dumps(faq_schema, ensure_ascii=False, indent=2)}
  </script>
  <script src="/adoff-i18n.js?v={CSSV}"></script>
</head>
<body>
  <main>
    <article class="article-page">
      <h1>{c['h1']}</h1>
      <div class="answer-box"><p>{c['answer']}</p></div>
{sections_html}{tool_html}      <h2>{'Frequently asked questions' if lang=='en' else 'Domande frequenti'}</h2>
{faq_html}      <div class="cta-section">
        <h3>{cta_t}</h3>
        <p>{cta_p}</p>
        <a href="{install}" class="btn">{'Install AdOff — free →' if lang=='en' else 'Installa AdOff — gratis →'}</a>
      </div>
    </article>
  </main>
  <script src="/adoff-nav.js?v={CSSV}"></script>
  <script src="/adoff-footer.js?v=260523a"></script>
  <script>if("serviceWorker" in navigator){{window.addEventListener("load",()=>{{navigator.serviceWorker.register("/sw.js").catch(()=>{{}})}});}}</script>
</body>
</html>
"""
    return html_doc, self_url


def main():
    urls = []
    for topic in TOPICS:
        for lang in ("en", "it"):
            doc, url = render(topic, lang)
            out = SITE / (topic["slug"] + ".html") if lang == "en" else SITE / "it" / (topic["slug"] + ".html")
            out.parent.mkdir(exist_ok=True)
            out.write_text(doc, encoding="utf-8")
            urls.append((lang, topic["slug"], url, out.relative_to(SITE)))
            print(f"  [{lang}] {out.relative_to(SITE)}")
    print(f"Generated {len(urls)} landing pages.")
    return urls


if __name__ == "__main__":
    main()
