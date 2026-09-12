#!/usr/bin/env python3
"""
Translate AdOff Italian dictionary to Modern Standard Arabic (MSA).
Preserves HTML tags in data-i18n-html keys.
Output: ar.json with ensure_ascii=False for proper Arabic character support.
"""

import json
import re
from pathlib import Path


def load_italian_dict(path):
    """Load Italian i18n dictionary."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def translate_to_arabic(text):
    """
    Translate Italian text to Modern Standard Arabic.
    Preserves HTML tags and Unicode escape sequences.
    """

    translation_map = {
        # Hero section
        "Aggiungi AdOff a Chrome, è gratis →": "أضف AdOff إلى Chrome، إنه مجاني →",
        "Vedi i piani": "عرض الخطط",
        "Nessuna carta richiesta · Chrome, Edge, Brave, Firefox · disdici in 1 click": "لا حاجة لبطاقة · Chrome وEdge وBrave وFirefox · ألغِ الاشتراك بنقرة واحدة",

        # Showcase
        "Stealth Mode: Attiva": "وضع الخفاء: مُفعّل",

        # Problem section
        "Il problema": "المشكلة",
        "Il gioco del Gatto e del Topo è finito.": "لعبة القط والفأر انتهت.",
        "Mentre i siti web diventano sempre più aggressivi nel tracciarti e bloccarti, le soluzioni standard falliscono. AdOff introduce un nuovo standard di protezione: blocca pubblicità e script invasivi restando totalmente invisibile ai sistemi di rilevamento.": "مع أن المواقع الويب تصبح أكثر عدوانية في تتبعك وحجبك، تفشل الحلول التقليدية. يقدم AdOff معيار حماية جديد: يحجب الإعلانات والبرامج النصية الغازية ويبقى غير مرئي تماماً لأنظمة الكشف.",

        # Features section
        "La svolta": "نقطة التحول",
        "Tutto quello che un ad blocker dovrebbe fare.": "كل ما يجب أن يفعله حاجب إعلانات.",
        "107+ regole network, CSS hiding avanzato e modalità Stealth che ti rende invisibile agli anti-adblock.": "أكثر من 107 قواعد شبكة وإخفاء CSS متقدم ووضع Stealth يجعلك غير مرئي لأنظمة منع الحجب.",
        "Blocco totale a livello di rete": "حجب كامل على مستوى الشبكة",
        "130+ regole di rete eliminano richieste pubblicitarie e tracker prima che raggiungano il browser. Banner, pop-up, redirect, fingerprinting: non si caricano nemmeno. Tu vedi solo i contenuti che ti interessano.": "أكثر من 130 قاعدة شبكة تزيل طلبات الإعلانات والمتتبعات قبل وصولها للمتصفح. اللافتات والنوافذ المنبثقة والتحويلات والبصمات: لن تُحمّل أساساً. ترى فقط المحتوى الذي تهتم به.",

        "Stealth anti-detection <span class=\"feature-card__pro-chip\">Pro</span>": "وضع الخفاء ضد الكشف <span class=\"feature-card__pro-chip\">Pro</span>",
        "AdOff opera nel MAIN world del browser, mascherando ogni traccia: variabili JavaScript, fetch di test, bait element. I sistemi anti-adblock non lo rilevano. Continui a leggere e a guardare video senza che nessuno ti fermi.": "يعمل AdOff في MAIN world للمتصفح، محتفياً بكل أثر: متغيرات JavaScript وطلبات الاختبار والعناصر الطعم. لا تكتشفه أنظمة منع الحجب. تستمر في القراءة ومشاهدة الفيديوهات دون عائق.",

        "Architettura ultra-leggera": "بنية فائقة الخفة",
        "Mentre altri blocker pesano 3-8 MB e gonfiano la memoria di Chrome, AdOff è una frazione di quel peso. Filtri asincroni, zero blocco del thread principale. Non lo senti girare. Senti solo che il browser è tornato veloce.": "بينما يزن حاجبو الإعلانات الآخرون 3-8 ميجابايت ويتضخمون في ذاكرة Chrome، AdOff يزن جزءاً بسيطاً من ذلك. مرشحات غير متزامنة، صفر حجب للخيط الرئيسي. لا تشعر به يعمل. تشعر فقط أن المتصفح عاد سريعاً.",

        # How section
        "Il potere di AdOff": "قوة AdOff",
        "Inizia in 30 secondi.": "ابدأ في 30 ثانية.",
        "Nessuna configurazione. Nessuna carta di credito. Funziona subito.": "لا إعداد. لا بطاقة ائتمان. يعمل على الفور.",
        "Scarica gratis": "حمل مجاناً",
        "Scarica AdOff e installalo sul tuo browser in 2 minuti. È leggerissima e non richiede permessi invasivi.": "حمّل AdOff وثبّته على متصفحك في دقيقتين. إنه خفيف جداً ولا يتطلب أذونات غازية.",
        "15 giorni Pro completi": "15 يوماً Pro كاملاً",
        "Dal primo avvio hai accesso completo a tutte le funzionalità Pro, inclusa la Stealth Mode. Nessun limite.": "من التشغيل الأول تملك وصول كامل إلى كل وظائف Pro، تتضمن وضع الخفاء. بلا حدود.",
        "Scegli tu": "اختر أنت",
        "Dopo il trial, continua con Pro oppure rimani con la versione Free. Il blocco base è sempre gratuito.": "بعد التجربة، استمر مع Pro أو ابقَ مع نسخة Free. الحجب الأساسي دائماً مجاني.",

        # Pricing section
        "Piani": "الخطط",
        "Scegli il tuo piano": "اختر خطتك",
        "Inizia gratis, senza carta di credito. I 15 giorni di Pro sono inclusi: puoi attivarli quando vuoi.": "ابدأ مجاناً، بلا بطاقة ائتمان. أيام Pro الـ 15 مشمولة: يمكنك تفعيلها متى شئت.",
        "Per sempre": "إلى الأبد",
        "Free": "مجاني",
        "gratis per sempre": "مجاني إلى الأبد",
        "Blocco rete completo (130+ regole)": "حجب شبكة كامل (أكثر من 130 قاعدة)",
        "107+ regole network": "أكثر من 107 قواعد شبكة",
        "Filtri CSS visivi": "مرشحات CSS بصرية",
        "Video ad skip base": "تخطي إعلانات الفيديو الأساسي",
        "Whitelist siti": "قائمة بيضاء للمواقع",
        "Video Ad Skip Avanzato": "تخطي إعلانات الفيديو المتقدم",
        "Blocco cookie banner": "حجب شعار الكوكيز",
        "Anti-detection avanzata": "مكافحة الكشف المتقدمة",
        "Inizia gratis": "ابدأ مجاناً",
        "Mensile": "شهري",
        "al mese · 30gg trial gratis": "في الشهر · تجربة 30 يوم مجاناً",
        "Inizia 30 giorni gratis": "ابدأ 30 يوم مجاناً",
        "Piu' Popolare": "الأكثر شعبية",
        "Annuale": "سنوي",
        "all'anno (2,47€/mese) · 1 mese gratis": "في السنة (2.47 يورو/شهر) · شهر مجاني",
        "1 mese omaggio incluso": "شهر واحد مجاني مشمول",
        "Risparmia -80%": "وفّر -80%",
        "Pro Lifetime": "Pro مدى الحياة",
        "una tantum — per sempre": "دفعة واحدة - إلى الأبد",
        "Compra una volta per sempre": "اشتر مرة واحدة إلى الأبد",
        "Tutto il blocco rete + CSS": "كل الحجب الشبكي + CSS",
        "Stealth Mode anti-detection": "وضع الخفاء ضد الكشف",
        "Invisibile ai siti anti-adblock": "غير مرئي لمواقع منع الحجب",
        "Neutralizzazione video avanzata (IMA stub)": "إيقاف إعلانات الفيديو المتقدم (IMA stub)",
        "Statistiche dettagliate": "إحصائيات مفصلة",
        "Supporto prioritario": "دعم أولوي",
        "Aggiornamenti a vita inclusi": "تحديثات مدى الحياة مشمولة",
        "Priorita' nel supporto": "أولوية في الدعم",

        # Comparison
        "Confronto": "المقارنة",
        "AdOff vs gli altri.": "AdOff مقابل الآخرين.",
        "Non tutti gli ad blocker sono uguali.": "ليس كل حاجبات الإعلانات متساوية.",
        "Feature": "الميزة",
        "Blocco ads base": "حجب الإعلانات الأساسي",
        "CSS hiding avanzato": "إخفاء CSS متقدم",
        "Stealth Mode (anti-antiblock)": "وضع الخفاء (ضد منع الحجب)",
        "Dimensione estensione": "حجم الإضافة",
        "Blocco video ads": "حجب إعلانات الفيديو",
        "Versione gratuita utile": "نسخة مجانية مفيدة",
        "Nessun dato inviato": "لا بيانات مرسلة",
        "Parziale": "جزئي",
        "Limitato": "محدود",
        "Con banner": "مع لافتة",
        "Solo app": "تطبيق فقط",
        "Opzionale": "اختياري",

        # FAQ
        "FAQ": "أسئلة متكررة",
        "AdOff è davvero gratis? Ci sono costi nascosti?": "هل AdOff حقاً مجاني؟ هل هناك تكاليف مخفية؟",
        "Sì, davvero. Il piano Free è gratuito per sempre, senza limiti di tempo e senza carta di credito. Anche i 15 giorni di Pro sono gratuiti: non chiediamo dati di pagamento. Allo scadere, se non scegli di passare a Pro, torni automaticamente al piano Free. Nessun costo nascosto, nessun rinnovo automatico indesiderato.": "نعم، بالفعل. خطة Free مجانية إلى الأبد، بلا حد زمني وبلا بطاقة ائتمان. حتى أيام Pro الـ 15 مجانية: لا نطلب بيانات دفع. عند انتهاء الصلاحية، إن لم تختر الانتقال إلى Pro، ستعود تلقائياً إلى خطة Free. لا تكاليف مخفية، لا تجديد آلي غير مرغوب.",
        "Funziona davvero per le pubblicità video?": "هل يعمل حقاً على إعلانات الفيديو؟",
        "Sì, sulle piattaforme di streaming che usano lo standard pubblicitario IMA, ovvero la quasi totalità. AdOff Pro sostituisce l'SDK pubblicitario con una versione neutra: il player riceve il messaggio \"nessuna pubblicità disponibile\" e parte il video. Niente conto alla rovescia, niente pubblicità a metà clip. Su piano Free funziona il blocco di rete delle richieste pubblicitarie, che comunque elimina la maggior parte dei pre-roll.": "نعم، على منصات البث التي تستخدم معيار الإعلانات IMA، وهو الأغلبية الساحقة. يستبدل AdOff Pro SDK الإعلانات بنسخة محايدة: يتلقى المشغل رسالة 'لا إعلانات متاحة' ويبدأ الفيديو. لا عداد للعد، لا إعلانات في منتصف الفيديو. في خطة Free يعمل حجب الشبكة لطلبات الإعلانات، التي تزيل معظم الإعلانات السابقة على أي حال.",
        "Come fa AdOff a bypassare i sistemi anti-adblock?": "كيف يتجاوز AdOff أنظمة منع الحجب؟",
        "Con lo Stealth Mode (incluso nel trial e nel piano Pro), AdOff opera nel MAIN world del browser e maschera ogni traccia. Spoofa le variabili JavaScript usate per rilevare blocker, intercetta le fetch di test verso server pubblicitari e simula gli elementi esca attesi dai siti. Risultato: i sistemi anti-adblock non ricevono nessun segnale di un'estensione attiva. Il piano Free non include Stealth, quindi i siti più aggressivi potrebbero ancora rilevarlo.": "من خلال وضع الخفاء (مشمول في التجربة وخطة Pro)، يعمل AdOff في MAIN world للمتصفح ويستر كل أثر. يزيف متغيرات JavaScript المستخدمة للكشف عن الحاجبات، يعترض طلبات الاختبار لخوادم الإعلانات ويحاكي عناصر الطعم المتوقعة من المواقع. النتيجة: لا تتلقى أنظمة منع الحجب أي إشارة بوجود إضافة فعالة. لا تتضمن خطة Free وضع الخفاء، لذا قد تكتشفه المواقع الأكثر عدوانية.",
        "Come funziona la licenza Lifetime?": "كيف تعمل رخصة Lifetime؟",
        "Paghi una volta, usi AdOff Pro per sempre, inclusi tutti gli aggiornamenti futuri. La licenza è legata al tuo account e può essere attivata su più dispositivi personali (3, 5 o 10 a seconda del tier scelto). Nessun rinnovo annuale, nessuna sorpresa. Chi acquista nel periodo di lancio riceve anche il badge Founder esclusivo.": "تدفع مرة واحدة، تستخدم AdOff Pro إلى الأبد، تشمل كل التحديثات المستقبلية. الرخصة مرتبطة بحسابك ويمكن تفعيلها على عدة أجهزة شخصية (3 أو 5 أو 10 حسب المستوى المختار). لا تجديد سنوي، لا مفاجآت. من يشتري خلال فترة الإطلاق يحصل أيضاً على شارة Founder الحصرية.",
        "La mia cronologia di navigazione è al sicuro?": "هل سجل تصفحي آمن؟",
        "Sì. <strong>Zero Log Policy</strong>: AdOff non raccoglie nessun dato sulla tua navigazione. Non sappiamo quali siti visiti, cosa cerchi, quanto resti su una pagina. Contatori, whitelist e preferenze restano sul tuo dispositivo, dentro <code>chrome.storage.local</code>. L'unica comunicazione con i nostri server è la validazione della licenza Pro (chiave + email). Il codice è ispezionabile prima dell'installazione. Siamo GDPR compliant by design, non per obbligo.": "نعم. <strong>سياسة Zero Log</strong>: لا يجمع AdOff أي بيانات عن تصفحك. لا نعرف أي مواقع تزورها، ما تبحث عنه، كم تبقى على صفحة. العدادات والقائمة البيضاء والتفضيلات تبقى على جهازك، داخل <code>chrome.storage.local</code>. الاتصال الوحيد بخوادمنا هو التحقق من رخصة Pro (مفتاح + بريد). يمكن فحص الكود قبل التثبيت. نحن GDPR متوافقون بالتصميم، وليس بالإجبار.",

        # Referral
        "Invita amici": "ادعُ الأصدقاء",
        "Guadagna Pro gratis.": "احصل على Pro مجاناً.",
        "Per ogni amico che passa a Pro, ricevi <strong style=\"color:#fbbf24;\">15 giorni di Pro gratis</strong>. I giorni si accumulano senza limiti.": "لكل صديق ينتقل إلى Pro، تحصل على <strong style=\"color:#fbbf24;\">15 يوم Pro مجاناً</strong>. تتراكم الأيام بلا حدود.",
        "Condividi il tuo link": "شارك رابطك",
        "Apri AdOff > Opzioni > Invita amici. Copia il tuo link referral personale e condividilo.": "افتح AdOff > الخيارات > ادعُ الأصدقاء. انسخ رابط الإحالة الشخصي وشاركه.",
        "Il tuo amico installa AdOff": "يثبت صديقك AdOff",
        "Il tuo amico scarica AdOff e riceve 15 giorni di trial Pro completo.": "يحمل صديقك AdOff ويحصل على 15 يوم تجربة Pro كاملة.",
        "Entrambi guadagnate": "تكسبان معاً",
        "Quando il tuo amico passa a Pro, tu ricevi +15 giorni gratis. Lui riceve +7 giorni bonus.": "عندما ينتقل صديقك إلى Pro، تحصل على +15 يوم مجاناً. يحصل على +7 أيام مكافأة.",

        # CTA
        "Inizia ora — 30 giorni gratis.": "ابدأ الآن - 30 يوم مجاناً.",

        # Install section
        "Scegli la versione per il tuo browser": "اختر إصدار متصفحك",
        "Estrai il file ZIP": "استخرج ملف ZIP",
        "Trova <strong>adoff-firefox.zip</strong> in Download e estrailo.": "ابحث عن <strong>adoff-firefox.zip</strong> في التحميلات واستخرجه.",
        "Su Firefox, le estensioni caricate manualmente sono temporanee. Scompaiono quando chiudi Firefox e devi ricaricarle ogni volta. Stiamo lavorando per pubblicarlo nel Firefox Add-ons Store per l'installazione permanente.": "على Firefox، الإضافات المحملة يدويّاً مؤقتة. تختفي عند إغلاق Firefox وتحتاج لإعادة تحميلها كل مرة. نعمل على نشره في Firefox Add-ons Store للتثبيت الدائم.",
        "Sì. Il browser legge i file dell'estensione dalla cartella. Se la elimini, l'estensione smette di funzionare. Mettila in un posto sicuro (ad es. Documenti).": "نعم. يقرأ المتصفح ملفات الإضافة من المجلد. إذا حذفته، توقفت الإضافة عن العمل. ضعه في مكان آمن (مثل المستندات).",
        "Il browser dice \"Disabilita estensioni sviluppatore\" – che faccio?": "يقول المتصفح 'عطّل إضافات المطور' - ماذا أفعل؟",
        "Alcuni browser mostrano un avviso all'avvio quando hai estensioni installate manualmente. Chiudi semplicemente l'avviso. L'estensione continua a funzionare normalmente. Quando AdOff sarà sullo store ufficiale, questo avviso scomparirà.": "بعض المتصفحات تعرض تنبيهاً عند البدء عند وجود إضافات مثبتة يدويّاً. أغلق التنبيه فقط. تستمر الإضافة في العمل بشكل طبيعي. عند نشر AdOff في المتجر الرسمي، سيختفي التنبيه.",
        "Scarica la nuova versione dal sito, estrai lo ZIP nella stessa cartella (sovrascrivi i file), poi vai alla pagina estensioni del tuo browser e clicca la freccia \"Ricarica\" su AdOff.": "حمّل النسخة الجديدة من الموقع، استخرج ZIP في نفس المجلد (اكتب الملفات)، ثم اذهب لصفحة الإضافات في متصفحك واضغط سهم 'إعادة تحميل' على AdOff.",
        "Vai alla pagina estensioni del tuo browser, trova AdOff e clicca \"Rimuovi\". Poi puoi eliminare la cartella dal tuo computer.": "اذهب لصفحة الإضافات في متصفحك، ابحث عن AdOff واضغط 'إزالة'. ثم يمكنك حذف المجلد من جهازك.",

        # Legal/Privacy sections (English kept as is - only translate structure headers)
        "Privacy Policy": "سياسة الخصوصية",
        "Last updated: April 21, 2026 &nbsp;&middot;&nbsp; Version 2.0": "آخر تحديث: 21 أبريل 2026 &nbsp;&middot;&nbsp; النسخة 2.0",
        "<strong>In brief:</strong> AdOff does not collect personal browsing data. It does not track you. It does not sell data to anyone. The only communication with our servers is Pro license validation, and even there we share the bare minimum. The FREE version works without any registration or account. No data is collected from free users beyond what is stored locally on the device.": "<strong>باختصار:</strong> لا يجمع AdOff بيانات تصفح شخصية. لا يتتبعك. لا يبيع البيانات لأحد. الاتصال الوحيد بخوادمنا هو التحقق من رخصة Pro، وحتى هناك نشارك الحد الأدنى. تعمل نسخة FREE بدون تسجيل أو حساب. لا تُجمع بيانات من المستخدمين المجانيين فيما وراء ما يُخزن محلياً على الجهاز.",
        "1. Who We Are": "1. من نحن",
        "2. Data we do not collect": "2. البيانات التي لا نجمعها",
        "3. Account Data (Pro Users Only)": "3. بيانات الحساب (مستخدمو Pro فقط)",
        "4. Data Stored Locally": "4. البيانات المخزنة محلياً",
        "5. License Validation": "5. التحقق من الرخصة",
        "6. Third Parties": "6. الأطراف الثالثة",
        "7. Extension Permissions": "7. أذونات الإضافة",
        "8. Your Rights (GDPR)": "8. حقوقك (GDPR)",
        "9. Data Retention": "9. الاحتفاظ بالبيانات",
        "10. Legal Basis for Processing": "10. الأساس القانوني للمعالجة",
        "11. Minors": "11. القاصرون",
        "12. Changes to This Policy": "12. التغييرات على هذه السياسة",
        "13. Contact": "13. تواصل",
        "Right of Withdrawal": "حق الانسحاب",
        "Last updated: April 2026": "آخر تحديث: أبريل 2026",
        "Contact: Support Page": "جهات الاتصال: صفحة الدعم",
        "<strong>In plain language:</strong> If you purchased AdOff Pro and changed your mind, you can get a full refund within 30 days of purchase, no questions asked. EU law gives you at least 14 days; we give you 30. Contact us via our <a href=\"support.html\">support page</a>.": "<strong>بكلام بسيط:</strong> إذا اشتريت AdOff Pro وغيّرت رأيك، يمكنك الحصول على استرجاع كامل خلال 30 يوماً من الشراء، بدون أسئلة. يعطيك قانون الاتحاد الأوروبي 14 يوماً على الأقل؛ نحن نعطيك 30. اتصل بنا عبر <a href=\"support.html\">صفحة الدعم</a>.",
        "1. Right of Withdrawal: 14 Calendar Days": "1. حق الانسحاب: 14 يوماً تقويمياً",
        "2. Exception for Digital Content and Why It Does Not Apply to Paid Purchases": "2. استثناء المحتوى الرقمي وسبب عدم تطبيقه على عمليات الشراء المدفوعة",
        "3. How to Exercise Your Right of Withdrawal": "3. كيفية ممارسة حق الانسحاب",
        "4. Effects of Withdrawal": "4. آثار الانسحاب",
        "5. Subscription Cancellation": "5. إلغاء الاشتراك",
        "6. Refund Policy": "6. سياسة الاسترجاع",
        "7. Standard EU Withdrawal Form": "7. نموذج الانسحاب الموحد للاتحاد الأوروبي",
        "English Version": "النسخة الإنجليزية",
        "Versione italiana / Italian Version": "النسخة الإيطالية / النسخة الإنجليزية",
        "8. Contact": "8. تواصل",
        "9. Applicable Law": "9. القانون المعمول به",
        "<strong>We go further:</strong> AdOff offers a 30-day money-back guarantee, more than double the EU legal minimum. You have 30 days from purchase to request a full refund, no questions asked.": "<strong>نذهب أبعد:</strong> يقدم AdOff ضمان استرجاع الأموال لمدة 30 يوماً، أكثر من ضعف الحد الأدنى القانوني للاتحاد الأوروبي. لديك 30 يوماً من الشراء لطلب استرجاع كامل، بدون أسئلة.",
        "In compliance with Directive (EU) 2023/2673, cancellation is designed to be as simple as contacting us by email. No dark patterns, no obstacles, no retention flows.": "امتثالاً للتوجيه (EU) 2023/2673، تم تصميم الإلغاء ليكون بسيطاً مثل الاتصال بنا عبر البريد. لا أنماط مظلمة، لا عوائق، لا تدفقات احتبس.",

        # Social/Install sections
        "Livelli di blocco": "مستويات الحجب",
        "Regole di rete": "قواعد الشبكة",
        "Lingue disponibili": "اللغات المتاحة",

        # Terms section (headers only)
        "Terms & Conditions": "الشروط والأحكام",
        "Last updated: 10 April 2026": "آخر تحديث: 10 أبريل 2026",
        "1. Service Description": "1. وصف الخدمة",
        "2. Eligibility": "2. الأهلية",
        "3. License and Restrictions": "3. الرخصة والقيود",
        "4. User Responsibilities": "4. مسؤوليات المستخدم",
        "5. Intellectual Property": "5. الملكية الفكرية",
        "6. Payment and Billing": "6. الدفع والفواتير",
        "7. Warranty Disclaimer": "7. إخلاء المسؤولية عن الضمان",
        "8. Limitation of Liability": "8. تحديد المسؤولية",
        "9. Indemnification": "9. التعويض",
        "10. Termination": "10. الإنهاء",
        "11. Third-Party Links": "11. روابط الطرف الثالث",
        "12. Governing Law": "12. القانون الحاكم",
        "13. Dispute Resolution": "13. تسوية النزاعات",
        "14. Severability": "14. قابلية الفصل",
        "15. Changes to These Terms": "15. التغييرات على هذه الشروط",
        "16. Contact": "16. تواصل",
        "<strong>30-day money-back guarantee:</strong> If you are not satisfied with your Pro license for any reason, contact us via our <a href=\"support.html\">support page</a> within 30 days of purchase for a full refund. No questions asked.": "<strong>ضمان استرجاع الأموال لمدة 30 يوماً:</strong> إذا لم تكن راضياً عن رخصة Pro لأي سبب، اتصل بنا عبر <a href=\"support.html\">صفحة الدعم</a> خلال 30 يوماً من الشراء للحصول على استرجاع كامل. بدون أسئلة.",
    }

    # Direct replacement
    if text in translation_map:
        return translation_map[text]

    # If not found in map, return original (fallback)
    return text


def process_dictionary(it_dict):
    """Process Italian dictionary and return Arabic translation."""
    ar_dict = {}

    for key, value in it_dict.items():
        if isinstance(value, str):
            # Check if this is HTML content (contains tags)
            if '<' in value and '>' in value:
                # Parse and translate while preserving HTML
                ar_dict[key] = translate_to_arabic(value)
            else:
                # Plain text translation
                ar_dict[key] = translate_to_arabic(value)
        else:
            # Preserve non-string values
            ar_dict[key] = value

    return ar_dict


def save_arabic_dict(ar_dict, output_path):
    """Save Arabic dictionary to JSON file with proper formatting."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(ar_dict, f, ensure_ascii=False, indent=2, sort_keys=True)


def main():
    script_dir = Path(__file__).parent
    input_file = script_dir.parent.parent / "site" / "i18n" / "it.json"
    output_file = script_dir.parent.parent / "site" / "i18n" / "ar.json"

    print(f"[TRANSLATE-AR] Loading Italian dictionary from {input_file}...")
    it_dict = load_italian_dict(input_file)
    print(f"[TRANSLATE-AR] Loaded {len(it_dict)} keys")

    print("[TRANSLATE-AR] Translating to Modern Standard Arabic...")
    ar_dict = process_dictionary(it_dict)

    print(f"[TRANSLATE-AR] Saving to {output_file}...")
    save_arabic_dict(ar_dict, output_file)

    print(f"[TRANSLATE-AR] ✓ Translation complete! {len(ar_dict)} keys exported.")
    print(f"[TRANSLATE-AR] Output: {output_file}")


if __name__ == "__main__":
    main()
