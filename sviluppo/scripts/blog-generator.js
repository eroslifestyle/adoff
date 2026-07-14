/**
 * blog-generator.js — AdOff Blog Generator
 * Genera pagine HTML statiche da template + markdown-like content
 */
const fs = require('fs');
const path = require('path');

const BLOG_DIR = path.join(__dirname, '../../site/blog');
const TEMPLATE = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{TITLE}} — AdOff Blog</title>
  <meta name="description" content="{{DESC}}" />
  <link rel="canonical" href="https://adoff.app/blog/{{SLUG}}" />
  <link rel="stylesheet" href="/style.css" />
  <style>
    body { background: #0a0a1a; color: #e2e2f0; font-family: 'Inter', sans-serif; }
    .blog-header { max-width: 700px; margin: 0 auto; padding: 80px 24px 40px; }
    .blog-back { color: #7c5cfc; text-decoration: none; font-size: 0.9rem; }
    .blog-back:hover { text-decoration: underline; }
    .blog-date { color: #8a8aaa; font-size: 0.85rem; margin-top: 24px; }
    .blog-title { font-size: 2.2rem; font-weight: 700; margin: 16px 0; line-height: 1.2; }
    .blog-content { max-width: 700px; margin: 0 auto; padding: 0 24px 80px; line-height: 1.8; }
    .blog-content h2 { font-size: 1.4rem; margin: 40px 0 16px; color: #fff; }
    .blog-content p { margin: 16px 0; }
    .blog-content a { color: #7c5cfc; }
    .blog-content ul, .blog-content ol { margin: 16px 0; padding-left: 24px; }
    .blog-cta { background: rgba(124,92,252,.1); border: 1px solid rgba(124,92,252,.3); border-radius: 12px; padding: 24px; margin: 40px 0; text-align: center; }
    .blog-cta a { display: inline-block; background: #7c5cfc; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <nav id="site-nav"></nav>
  <header class="blog-header">
    <a href="/blog/" class="blog-back">← Torna al Blog</a>
    <p class="blog-date">{{DATE}}</p>
    <h1 class="blog-title">{{TITLE}}</h1>
  </header>
  <article class="blog-content">
{{CONTENT}}
    <div class="blog-cta">
      <p style="margin:0 0 16px;color:#e2e2f0;">Prova AdOff — blocca gli ads su tutti i siti.</p>
      <a href="/install">Scarica AdOff →</a>
    </div>
  </article>
  <script src="/adoff-nav.js"></script>
  <script src="/adoff-footer.js"></script>
</body>
</html>`;

function generatePost(post) {
  const html = TEMPLATE
    .replace('{{TITLE}}', post.title)
    .replace('{{DESC}}', post.description)
    .replace('{{SLUG}}', post.slug)
    .replace('{{DATE}}', post.date)
    .replace('{{CONTENT}}', post.content);
  const filePath = path.join(BLOG_DIR, post.slug + '.html');
  fs.writeFileSync(filePath, html);
  console.log('Generated: ' + filePath);
}

// Post template
const posts = [
  {
    slug: 'annuncio-lancio-adblock-vpn',
    title: 'AdOff è online — blocca gli ads ovunque',
    date: '2026-07-14',
    description: 'Annunciamo il lancio di AdOff: l\'estensione che blocca pubblicità, tracker e popup su tutti i siti, con VPN Premium disponibile.',
    content: `
<p>Dopo mesi di sviluppo, siamo felici di annunciare il lancio di <strong>AdOff</strong> — l'estensione per browser che blocca pubblicità, tracker e popup su ogni sito web.</p>
<h2>Cosa fa AdOff</h2>
<p>AdOff è un'estensione per browser che si installa in pochi secondi e inizia a funzionare immediatamente. Non serve configurare nulla.</p>
<ul>
<li><strong>Blocca pubblicità</strong> — banner, popup, video ads, ads su YouTube</li>
<li><strong>Blocca tracker</strong> — niente profilazione pubblicitaria</li>
<li><strong>Anti-adblock bypass</strong> — continua a funzionare anche dove altri si arrendono</li>
<li><strong>Zero configurazione</strong> — installa e naviga</li>
</ul>
<h2>VPN Premium disponibile</h2>
<p>Con <strong>AdOff Premium VPN</strong> ottieni anche la crittografia del traffico e l'occultamento dell'IP. La VPN è già integrata nell'estensione.</p>
<h2>Prova gratis 15 giorni</h2>
<p>Ogni nuovo utente riceve 15 giorni di Pro gratis. Scarica AdOff, attiva il trial e decidi dopo.</p>
<p><a href="/install">Scarica AdOff per Chrome →</a></p>
    `
  }
];

// Generate all posts
if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

// Generate index
const indexHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog — AdOff</title>
  <meta name="description" content="Blog AdOff — novità, guide e tips sulla privacy online." />
  <link rel="canonical" href="https://adoff.app/blog/" />
  <link rel="stylesheet" href="/style.css" />
  <style>
    body { background: #0a0a1a; color: #e2e2f0; font-family: 'Inter', sans-serif; }
    .blog-index { max-width: 700px; margin: 0 auto; padding: 80px 24px; }
    .blog-index h1 { font-size: 2rem; margin-bottom: 40px; }
    .post-card { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .post-card h2 { font-size: 1.2rem; margin: 0 0 8px; }
    .post-card h2 a { color: #fff; text-decoration: none; }
    .post-card h2 a:hover { color: #7c5cfc; }
    .post-card p { color: #8a8aaa; font-size: 0.9rem; margin: 8px 0 0; }
    .post-card .date { color: #7c5cfc; font-size: 0.8rem; }
  </style>
</head>
<body>
  <nav id="site-nav"></nav>
  <main class="blog-index">
    <h1>Blog AdOff</h1>
    ${posts.map(p => `<div class="post-card"><h2><a href="/blog/${p.slug}">${p.title}</a></h2><p class="date">${p.date}</p><p>${p.description}</p></div>`).join('\n')}
  </main>
  <script src="/adoff-nav.js"></script>
  <script src="/adoff-footer.js"></script>
</body>
</html>`;
fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHtml);
console.log('Generated blog index');

// Generate posts
posts.forEach(generatePost);
