// Redirect referral /r/:code -> /?ref=:code.
// Le Pages Functions corrono PRIMA di _redirects: questi path statici sono
// gia' gestiti lì (301 verso GitHub) e vanno lasciati passare.
// NB: /r/api/repo, /r/issues/new e /r/releases/v1.0.0 hanno due segmenti e
// non matchano mai [code] (un solo segmento): restano a _redirects da soli.
const STATIC_CODES = new Set(["apk", "rules", "github", "repo", "issues", "releases"]);

export async function onRequest(context) {
  const { code } = context.params;
  if (STATIC_CODES.has(code)) {
    return context.next();
  }
  return Response.redirect(`https://adoff.app/?ref=${encodeURIComponent(code)}`, 302);
}
