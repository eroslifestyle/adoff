'use strict';

/** Lunghezza massima ammessa per urlFilter in DNR */
const MAX_URLFILTER_LEN = 500;
/** Lunghezza minima ammessa per urlFilter in DNR */
const MIN_URLFILTER_LEN = 3;
/** Caratteri "significativi" minimi dopo rimozione metacaratteri ABP */
const MIN_SIGNIFICANT_CHARS = 4;
/** Lunghezza massima dominio DNS (RFC 1035) */
const MAX_DOMAIN_LEN = 253;

/**
 * Verifica se il pattern e' un dominio puro senza meta-char ABP.
 * Dominio puro = solo [a-z0-9.-], almeno un punto, niente / | * ^
 * @param {string} p
 * @returns {boolean}
 */
function isPureDomain(p) {
  return /^[a-z0-9.-]+$/.test(p) && p.indexOf('.') !== -1;
}

/**
 * Verifica presenza di meta-caratteri regex che NON sono validi in urlFilter DNR.
 * @param {string} f
 * @returns {boolean}
 */
function hasRegexMetacharacter(f) {
  return /[()\[\]{}\\]/.test(f) ||
    f.indexOf('https?') !== -1 ||
    f.indexOf('http://') !== -1 ||
    f.indexOf('https://') !== -1;
}

/**
 * Converte un pattern ABP grezzo in urlFilter per declarativeNetRequest.
 * Il pattern in input e' gia' privato di @@ e del trailing $.
 * La funzione restituisce il pattern quasi invariato, con normalizzazioni minime.
 *
 * @param {string} pattern - Pattern ABP grezzo
 * @returns {string|null} Pattern urlFilter oppure null se invalido
 */
function abpToUrlFilter(pattern) {
  if (pattern == null) return null;

  const trimmed = pattern.trim();
  if (trimmed === '') return null;

  if (/^\/.*\/$/.test(trimmed)) return null;

  if (trimmed.length > MAX_URLFILTER_LEN || trimmed.length < MIN_URLFILTER_LEN) return null;

  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed.codePointAt(i) > 127) return null;
  }

  if (trimmed.indexOf(' ') !== -1) return null;
  if (trimmed.indexOf('\\') !== -1) return null;

  // I metacaratteri ABP non contano: "*ad*" ha 2 caratteri utili, non 4.
  const significant = trimmed.replace(/[|^*]/g, '');
  if (significant.length < MIN_SIGNIFICANT_CHARS) return null;

  let result;
  const pureDomain = isPureDomain(trimmed);

  if (pureDomain) {
    result = '||' + trimmed + '^';
  } else {
    result = trimmed;
  }

  result = result.replace(/\*{2,}/g, '*');

  return result;
}

/**
 * Converte una entry hosts (0.0.0.0 dominio) in urlFilter DNR.
 * Valida che sia un dominio plausibile.
 *
 * @param {string} domain - Dominio dalla riga hosts
 * @returns {string|null} urlFilter ||dominio^ oppure null se invalido
 */
function hostsDomainToUrlFilter(domain) {
  if (domain == null) return null;

  const trimmed = domain.trim();
  if (trimmed === '') return null;
  if (trimmed.length > MAX_DOMAIN_LEN) return null;
  if (trimmed.indexOf(' ') !== -1) return null;

  if (!/^[A-Za-z0-9.-]+$/.test(trimmed)) return null;

  if (trimmed[0] === '.' || trimmed[0] === '-' || trimmed[trimmed.length - 1] === '.' || trimmed[trimmed.length - 1] === '-') {
    return null;
  }

  const dotIndex = trimmed.indexOf('.');
  if (dotIndex === -1) return null;

  const suffix = trimmed.slice(dotIndex + 1);
  if (suffix.length < 2) return null;

  return '||' + trimmed.toLowerCase() + '^';
}

/**
 * Verifica se una stringa e' un urlFilter DNR valido.
 * Controlla ASCII puro, assenza meta-char regex, lunghezza.
 *
 * @param {*} f - Valore da verificare
 * @returns {boolean}
 */
function isValidUrlFilter(f) {
  if (typeof f !== 'string') return false;
  if (f === '') return false;
  if (f.length > MAX_URLFILTER_LEN) return false;

  for (let i = 0; i < f.length; i++) {
    const cp = f.codePointAt(i);
    if (cp > 127 || cp === 32 || cp === 92) return false;
  }

  if (hasRegexMetacharacter(f)) return false;

  return true;
}

/**
 * Restituisce un'etichetta che descrive il motivo di invalidita'.
 *
 * @param {string} f - Valore da verificare
 * @returns {'regex-syntax'|'non-ascii'|'has-space'|'too-long'|'too-short'|'ok'}
 */
function describeInvalid(f) {
  if (typeof f === 'string' && f.length <= MAX_URLFILTER_LEN && f.length >= MIN_URLFILTER_LEN) {
    if (hasRegexMetacharacter(f)) return 'regex-syntax';

    for (let i = 0; i < f.length; i++) {
      if (f.codePointAt(i) > 127) return 'non-ascii';
    }

    if (f.indexOf(' ') !== -1) return 'has-space';
  }

  if (typeof f === 'string' && f.length > MAX_URLFILTER_LEN) return 'too-long';
  if (typeof f !== 'string' || f.length < MIN_URLFILTER_LEN) return 'too-short';

  return 'ok';
}

module.exports = { abpToUrlFilter, hostsDomainToUrlFilter, isValidUrlFilter, describeInvalid };
