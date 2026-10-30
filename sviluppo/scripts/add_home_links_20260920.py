# -*- coding: utf-8 -*-
"""Aggiunge sezione 'tutte le guide' alle homepage. One-shot 2026-09-20."""
import os, re, sys

SLUGS = ["ad-blocker-chrome","ad-blocker-firefox","ad-blocker-safari","ad-blocker-brave",
"ad-blocker-edge","ad-blocker-mac","browser-ad-blocker","ad-blocker-extension",
"android-ad-blocker","android-dns","youtube-ad-blocker","block-video-ads",
"free-ad-blocker","best-ad-blocker-2026","lightweight-ad-blocker","private-ad-blocker",
"undetectable-ad-blocker","bypass-anti-adblock","manifest-v3-ad-blocker",
"tv-streaming-ad-blocker","ublock-origin-alternative","adblock-detector"]

# labels[slug] = {lang: label}
L = {
"ad-blocker-chrome": {"en":"Ad blocker for Chrome","it":"Ad blocker per Chrome","de":"Adblocker für Chrome","fr":"Bloqueur de pub pour Chrome","es":"Bloqueador de anuncios para Chrome","pt":"Bloqueador de anúncios para Chrome","ru":"Блокировщик рекламы для Chrome","ar":"مانع الإعلانات لمتصفح Chrome","zh":"Chrome 广告拦截器","hi":"Chrome के लिए ऐड ब्लॉकर","ja":"Chrome 広告ブロッカー","ko":"Chrome 광고 차단기","tr":"Chrome için reklam engelleyici","id":"Pemblokir iklan untuk Chrome","pl":"Blokader reklam dla Chrome"},
"ad-blocker-firefox": {"en":"Ad blocker for Firefox","it":"Ad blocker per Firefox","de":"Adblocker für Firefox","fr":"Bloqueur de pub pour Firefox","es":"Bloqueador de anuncios para Firefox","pt":"Bloqueador de anúncios para Firefox","ru":"Блокировщик рекламы для Firefox","ar":"مانع الإعلانات لمتصفح Firefox","zh":"Firefox 广告拦截器","hi":"Firefox के लिए ऐड ब्लॉकर","ja":"Firefox 広告ブロッカー","ko":"Firefox 광고 차단기","tr":"Firefox için reklam engelleyici","id":"Pemblokir iklan untuk Firefox","pl":"Blokader reklam dla Firefox"},
"ad-blocker-safari": {"en":"Ad blocker for Safari","it":"Ad blocker per Safari","de":"Adblocker für Safari","fr":"Bloqueur de pub pour Safari","es":"Bloqueador de anuncios para Safari","pt":"Bloqueador de anúncios para Safari","ru":"Блокировщик рекламы для Safari","ar":"مانع الإعلانات لمتصفح Safari","zh":"Safari 广告拦截器","hi":"Safari के लिए ऐड ब्लॉकर","ja":"Safari 広告ブロッカー","ko":"Safari 광고 차단기","tr":"Safari için reklam engelleyici","id":"Pemblokir iklan untuk Safari","pl":"Blokader reklam dla Safari"},
"ad-blocker-brave": {"en":"Ad blocker for Brave","it":"Ad blocker per Brave","de":"Adblocker für Brave","fr":"Bloqueur de pub pour Brave","es":"Bloqueador de anuncios para Brave","pt":"Bloqueador de anúncios para Brave","ru":"Блокировщик рекламы для Brave","ar":"مانع الإعلانات لمتصفح Brave","zh":"Brave 广告拦截器","hi":"Brave के लिए ऐड ब्लॉकर","ja":"Brave 広告ブロッカー","ko":"Brave 광고 차단기","tr":"Brave için reklam engelleyici","id":"Pemblokir iklan untuk Brave","pl":"Blokader reklam dla Brave"},
"ad-blocker-edge": {"en":"Ad blocker for Edge","it":"Ad blocker per Edge","de":"Adblocker für Edge","fr":"Bloqueur de pub pour Edge","es":"Bloqueador de anuncios para Edge","pt":"Bloqueador de anúncios para Edge","ru":"Блокировщик рекламы для Edge","ar":"مانع الإعلانات لمتصفح Edge","zh":"Edge 广告拦截器","hi":"Edge के लिए ऐड ब्लॉकर","ja":"Edge 広告ブロッカー","ko":"Edge 광고 차단기","tr":"Edge için reklam engelleyici","id":"Pemblokir iklan untuk Edge","pl":"Blokader reklam dla Edge"},
"ad-blocker-mac": {"en":"Ad blocker for Mac","it":"Ad blocker per Mac","de":"Adblocker für Mac","fr":"Bloqueur de pub pour Mac","es":"Bloqueador de anuncios para Mac","pt":"Bloqueador de anúncios para Mac","ru":"Блокировщик рекламы для Mac","ar":"مانع الإعلانات لأجهزة Mac","zh":"Mac 广告拦截器","hi":"Mac के लिए ऐड ब्लॉकर","ja":"Mac 広告ブロッカー","ko":"Mac 광고 차단기","tr":"Mac için reklam engelleyici","id":"Pemblokir iklan untuk Mac","pl":"Blokader reklam dla Mac"},
"browser-ad-blocker": {"en":"Browser ad blocker","it":"Ad blocker per browser","de":"Browser-Adblocker","fr":"Bloqueur de pub pour navigateur","es":"Bloqueador de anuncios para el navegador","pt":"Bloqueador de anúncios para o navegador","ru":"Блокировщик рекламы для браузера","ar":"مانع إعلانات المتصفح","zh":"浏览器广告拦截器","hi":"ब्राउज़र ऐड ब्लॉकर","ja":"ブラウザ広告ブロッカー","ko":"브라우저 광고 차단기","tr":"Tarayıcı reklam engelleyici","id":"Pemblokir iklan peramban","pl":"Blokader reklam dla przeglądarki"},
"ad-blocker-extension": {"en":"Ad blocker extensions, explained","it":"Come funzionano le estensioni ad blocker","de":"Wie Adblocker-Erweiterungen funktionieren","fr":"Comment fonctionnent les extensions bloqueuses","es":"Cómo funcionan las extensiones bloqueadoras","pt":"Como funcionam as extensões bloqueadoras","ru":"Как работают расширения-блокировщики","ar":"كيف تعمل إضافات مانع الإعلانات","zh":"广告拦截扩展的工作原理","hi":"ऐड ब्लॉकर एक्सटेंशन कैसे काम करते हैं","ja":"広告ブロッカー拡張機能の仕組み","ko":"광고 차단 확장 프로그램의 작동 방식","tr":"Reklam engelleyici uzantılar nasıl çalışır","id":"Cara kerja ekstensi pemblokir iklan","pl":"Jak działają rozszerzenia blokujące reklamy"},
"android-ad-blocker": {"en":"Ad blocker for Android","it":"Ad blocker per Android","de":"Adblocker für Android","fr":"Bloqueur de pub pour Android","es":"Bloqueador de anuncios para Android","pt":"Bloqueador de anúncios para Android","ru":"Блокировщик рекламы для Android","ar":"مانع الإعلانات لنظام Android","zh":"Android 广告拦截器","hi":"Android के लिए ऐड ब्लॉकर","ja":"Android 広告ブロッカー","ko":"Android 광고 차단기","tr":"Android için reklam engelleyici","id":"Pemblokir iklan untuk Android","pl":"Blokader reklam na Androida"},
"android-dns": {"en":"DNS ad blocking for Android","it":"Blocco ads via DNS su Android","de":"DNS-Werbeblockierung für Android","fr":"Blocage de pub par DNS sur Android","es":"Bloqueo de anuncios por DNS en Android","pt":"Bloqueio de anúncios por DNS no Android","ru":"Блокировка рекламы через DNS на Android","ar":"حظر الإعلانات عبر DNS على Android","zh":"Android DNS 广告拦截","hi":"Android पर DNS विज्ञापन ब्लॉकिंग","ja":"Android のDNS広告ブロック","ko":"Android DNS 광고 차단","tr":"Android'de DNS ile reklam engelleme","id":"Blokir iklan DNS di Android","pl":"Blokowanie reklam przez DNS na Androida"},
"youtube-ad-blocker": {"en":"YouTube ad blocker","it":"Ad blocker per YouTube","de":"YouTube-Adblocker","fr":"Bloqueur de pub YouTube","es":"Bloqueador de anuncios de YouTube","pt":"Bloqueador de anúncios do YouTube","ru":"Блокировщик рекламы YouTube","ar":"مانع إعلانات يوتيوب","zh":"YouTube 广告拦截器","hi":"YouTube ऐड ब्लॉकर","ja":"YouTube 広告ブロッカー","ko":"YouTube 광고 차단기","tr":"YouTube reklam engelleyici","id":"Pemblokir iklan YouTube","pl":"Blokader reklam YouTube"},
"block-video-ads": {"en":"Block video ads","it":"Bloccare le ads nei video","de":"Videoanzeige blockieren","fr":"Bloquer les pubs vidéo","es":"Bloquear anuncios de vídeo","pt":"Bloquear anúncios em vídeo","ru":"Блокировка видеорекламы","ar":"حظر إعلانات الفيديو","zh":"拦截视频广告","hi":"वीडियो विज्ञापन ब्लॉक करें","ja":"動画広告をブロック","ko":"동영상 광고 차단","tr":"Video reklamlarını engelleme","id":"Blokir iklan video","pl":"Blokowanie reklam w wideo"},
"free-ad-blocker": {"en":"Free ad blocker","it":"Ad blocker gratis","de":"Kostenloser Adblocker","fr":"Bloqueur de pub gratuit","es":"Bloqueador de anuncios gratis","pt":"Bloqueador de anúncios grátis","ru":"Бесплатный блокировщик рекламы","ar":"مانع إعلانات مجاني","zh":"免费广告拦截器","hi":"मुफ़्त ऐड ब्लॉकर","ja":"無料広告ブロッカー","ko":"무료 광고 차단기","tr":"Ücretsiz reklam engelleyici","id":"Pemblokir iklan gratis","pl":"Darmowy blokader reklam"},
"best-ad-blocker-2026": {"en":"Best ad blockers 2026","it":"I migliori ad blocker 2026","de":"Die besten Adblocker 2026","fr":"Les meilleurs bloqueurs 2026","es":"Los mejores bloqueadores 2026","pt":"Os melhores bloqueadores 2026","ru":"Лучшие блокировщики 2026","ar":"أفضل مانعات الإعلانات 2026","zh":"2026 最佳广告拦截器","hi":"सर्वश्रेष्ठ ऐड ब्लॉकर 2026","ja":"2026年の最優秀広告ブロッカー","ko":"2026 최고의 광고 차단기","tr":"2026'nın en iyi reklam engelleyicileri","id":"Pemblokir iklan terbaik 2026","pl":"Najlepsze blokady reklam 2026"},
"lightweight-ad-blocker": {"en":"Lightweight ad blocker","it":"Ad blocker leggero","de":"Leichter Adblocker","fr":"Bloqueur de pub léger","es":"Bloqueador de anuncios ligero","pt":"Bloqueador de anúncios leve","ru":"Легкий блокировщик рекламы","ar":"مانع إعلانات خفيف","zh":"轻量级广告拦截器","hi":"हल्का ऐड ब्लॉकर","ja":"軽量広告ブロッカー","ko":"가벼운 광고 차단기","tr":"Hafif reklam engelleyici","id":"Pemblokir iklan ringan","pl":"Lekki blokader reklam"},
"private-ad-blocker": {"en":"Private ad blocker","it":"Ad blocker privacy-first","de":"Datenschutz-Adblocker","fr":"Bloqueur de pub privé","es":"Bloqueador de anuncios privado","pt":"Bloqueador de anúncios privado","ru":"Приватный блокировщик рекламы","ar":"مانع إعلانات يحترم الخصوصية","zh":"注重隐私的广告拦截器","hi":"प्राइवेट ऐड ब्लॉकर","ja":"プライバシー重視の広告ブロッカー","ko":"프라이버시 광고 차단기","tr":"Gizlilik dostu reklam engelleyici","id":"Pemblokir iklan ramah privasi","pl":"Prywatny blokader reklam"},
"undetectable-ad-blocker": {"en":"Undetectable ad blocker","it":"Ad blocker non rilevabile","de":"Nicht erkennbarer Adblocker","fr":"Bloqueur de pub indétectable","es":"Bloqueador de anuncios indetectable","pt":"Bloqueador de anúncios indetectável","ru":"Незаметный блокировщик рекламы","ar":"مانع إعلانات غير قابل للاكتشاف","zh":"难以检测的广告拦截器","hi":"अनडिटेक्टेबल ऐड ब्लॉकर","ja":"検出されにくい広告ブロッカー","ko":"탐지되지 않는 광고 차단기","tr":"Yakalanmayan reklam engelleyici","id":"Pemblokir iklan tak terdeteksi","pl":"Niewykrywalny blokader reklam"},
"bypass-anti-adblock": {"en":"Bypass anti-adblock","it":"Aggirare l'anti-adblock","de":"Anti-Adblock umgehen","fr":"Contourner l'anti-pub","es":"Evitar el anti-adblock","pt":"Contornar o anti-adblock","ru":"Обход анти-адблока","ar":"تجاوز مكافحات مانع الإعلانات","zh":"绕过反广告拦截","hi":"एंटी-ऐडब्लॉक बायपास","ja":"アドブロック対策を回避","ko":"안티 애드블록 우회","tr":"Anti-reklam engeli aşma","id":"Melewati anti-adblock","pl":"Omijanie anti-adblock"},
"manifest-v3-ad-blocker": {"en":"Manifest V3 ad blocker","it":"Ad blocker e Manifest V3","de":"Adblocker mit Manifest V3","fr":"Bloqueur de pub et Manifest V3","es":"Bloqueador de anuncios y Manifest V3","pt":"Bloqueador de anúncios e Manifest V3","ru":"Блокировщик рекламы и Manifest V3","ar":"مانع إعلانات مع Manifest V3","zh":"Manifest V3 广告拦截器","hi":"Manifest V3 ऐड ब्लॉकर","ja":"Manifest V3 広告ブロッカー","ko":"Manifest V3 광고 차단기","tr":"Manifest V3 reklam engelleyici","id":"Pemblokir iklan Manifest V3","pl":"Blokader reklam Manifest V3"},
"tv-streaming-ad-blocker": {"en":"Ad blocker for TV streaming","it":"Ad blocker per TV e streaming","de":"Adblocker für TV-Streaming","fr":"Bloqueur de pub pour TV en streaming","es":"Bloqueador de anuncios para TV en streaming","pt":"Bloqueador de anúncios para TV e streaming","ru":"Блокировщик рекламы для ТВ и стриминга","ar":"مانع إعلانات لبث التلفاز","zh":"电视流媒体广告拦截","hi":"TV स्ट्रीमिंग ऐड ब्लॉकर","ja":"TVストリーミング広告ブロッカー","ko":"TV 스트리밍 광고 차단기","tr":"TV izleme için reklam engelleyici","id":"Pemblokir iklan streaming TV","pl":"Blokader reklam dla TV i streamingu"},
"ublock-origin-alternative": {"en":"uBlock Origin alternative","it":"Alternativa a uBlock Origin","de":"uBlock-Origin-Alternative","fr":"Alternative à uBlock Origin","es":"Alternativa a uBlock Origin","pt":"Alternativa ao uBlock Origin","ru":"Альтернатива uBlock Origin","ar":"بديل uBlock Origin","zh":"uBlock Origin 替代品","hi":"uBlock Origin विकल्प","ja":"uBlock Origin の代替","ko":"uBlock Origin 대안","tr":"uBlock Origin alternatifi","id":"Alternatif uBlock Origin","pl":"Alternatywa dla uBlock Origin"},
"adblock-detector": {"en":"Is your ad blocker detected?","it":"Il tuo ad blocker è rilevabile?","de":"Wird dein Adblocker erkannt?","fr":"Votre bloqueur est-il détecté ?","es":"¿Detectan tu bloqueador?","pt":"O seu bloqueador é detectado?","ru":"Ваш блокировщик легко обнаружить?","ar":"هل يتم اكتشاف مانع الإعلانات لديك؟","zh":"你的广告拦截器会被检测到吗？","hi":"क्या आपका ऐड ब्लॉकर पकड़ा जाता है?","ja":"あなたの広告ブロッカーは検出される？","ko":"내 광고 차단기가 탐지될까?","tr":"Reklam engelleyiciniz tespit ediliyor mu?","id":"Apakah pemblokir iklan Anda terdeteksi?","pl":"Czy twój blokader jest wykrywalny?"},
}

HEAD = {
"en":("Guides","All AdOff guides"),"it":("Guide","Tutte le guide AdOff"),
"de":("Ratgeber","Alle AdOff-Ratgeber"),"fr":("Guides","Tous les guides AdOff"),
"es":("Guías","Todas las guías de AdOff"),"pt":("Guias","Todos os guias do AdOff"),
"ru":("Руководства","Все руководства AdOff"),"ar":("أدلة","كل أدلة AdOff"),
"zh":("指南","AdOff 全部指南"),"hi":("गाइड","सभी AdOff गाइड"),
"ja":("ガイド","AdOff の全ガイド"),"ko":("가이드","AdOff 전체 가이드"),
"tr":("Rehberler","Tüm AdOff rehberleri"),"id":("Panduan","Semua panduan AdOff"),
"pl":("Poradniki","Wszystkie poradniki AdOff"),
}

ROOT = "/mnt/nvme2/projects/Progetti/ChromePlugin/site"
MARK = '<footer id="adoff-footer"></footer>'

def section(lang, base):
    label, title = HEAD[lang]
    cards = []
    for s in SLUGS:
        local = f"{base}/{s}" if base else f"/{s}"
        if base and not os.path.exists(f"{ROOT}/{base}/{s}.html"):
            local = f"/{s}"  # fallback EN
        cards.append(f'<div class="bcard"><div class="bcard__t"><a href="{local}">{L[s][lang]}</a></div></div>')
    return (f'  <!-- ======= GUIDE (linking interno) ======= -->\n'
            f'  <section class="sec">\n    <div class="container">\n'
            f'      <div class="sec__head reveal">\n'
            f'        <span class="sec__label">{label}</span>\n'
            f'        <h2 class="sec__title">{title}</h2>\n      </div>\n'
            f'      <div class="bgrid">\n        ' + "\n        ".join(cards) + '\n      </div>\n'
            f'    </div>\n  </section>\n\n')

targets = [("index.html", "")] + [(f"{l}/index.html", l) for l in
    ["en","de","fr","es","pt","ru","ar","zh","hi","ja","ko","tr","id","pl"]]

for rel, base in targets:
    p = os.path.join(ROOT, rel)
    html = open(p, encoding="utf-8").read()
    if 'GUIDE (linking interno)' in html:
        print(f"SKIP {rel} (già presente)"); continue
    if MARK not in html:
        print(f"ERR {rel}: marker footer non trovato"); sys.exit(1)
    lang = "it" if rel == "index.html" else rel.split("/")[0]
    html = html.replace(MARK, section(lang, base) + MARK, 1)
    open(p, "w", encoding="utf-8").write(html)
    n = html.count('GUIDE (linking interno)')
    fb = len(re.findall(r'href="/(ad-|browser-|android-|youtube-|block-|free-|best-|lightweight-|private-|undetectable-|bypass-|manifest-|tv-|ublock-|adblock-)', html))
    print(f"OK {rel}: lang={lang} sezione=1 links=22")
