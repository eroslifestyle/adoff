import 'dart:convert';
import 'dart:typed_data';

/// ECDSA P-256 public key used to verify server-issued license tokens.
/// Mirror of TRIAL_MOBILE_PUBKEY_JWK from the Cloudflare worker.
/// Having this key client-side does NOT allow forging tokens — only verification.
/// Source: worker.js:677 (sviluppo/license-system/)
const trialMobilePubKeyJwk = {
  'kty': 'EC',
  'crv': 'P-256',
  'x': 'FnIroHHVzo3v01gENPaA2U70c58sduDD6hGS0EhCATc',
  'y': 'tAzRBzVK1O8ul76s2euNrqV0L4f1qmEtvcKB_HqpfrY',
};

/// Decode base64url string to bytes (standard base64url, no padding).
Uint8List base64UrlDecode(String input) {
  // Add padding if needed
  final padLen = (4 - input.length % 4) % 4;
  final padded = input + '=' * padLen;
  return base64Url.decode(padded);
}
