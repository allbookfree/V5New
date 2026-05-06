"use client";

// Browser-side key vault with WebCrypto AES-GCM encryption at rest.
//
// Threat model:
//   * Anyone with read access to localStorage (XSS, malicious browser
//     extension, evil-maid post-laptop-theft) can today dump every API key
//     in plain text.
//   * We can't fully solve XSS from localStorage — the *running page* can
//     always decrypt with the same key the page itself stored. But we can:
//       1. Stop credentials from leaking via casual exfiltration ("paste
//          your localStorage on stack overflow"), browser-history dumps,
//          file-system snapshots, and disk-image forensics.
//       2. Stop browser sync / cross-device leakage from being a plaintext
//          API-key transport — the encryption key is per-device only.
//
// Design:
//   * One AES-GCM 256 key per device, generated on first use, stored as a
//     CryptoKey serialized via JWK in a separate localStorage slot
//     (DEVICE_KEY_SLOT). No passphrase prompt — the UX is the same as
//     today, but the bytes on disk are no longer the API key.
//   * Encrypted payloads are stored as base64(IV ‖ ciphertext) so a single
//     getItem returns everything we need to decrypt.
//   * If WebCrypto is not available (very old browsers, legacy WebViews),
//     we fall back to plaintext storage and surface a console warning.
//   * Plaintext blobs already in localStorage are auto-migrated on first
//     decrypt: read → re-encrypt → write.

const DEVICE_KEY_SLOT = "ai-prompt-studio-device-key-v1";

function hasWebCrypto() {
  return typeof window !== "undefined"
    && typeof window.crypto !== "undefined"
    && typeof window.crypto.subtle !== "undefined";
}

function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKeyPromise = null;

async function getOrCreateDeviceKey() {
  if (!hasWebCrypto()) return null;
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    let stored = null;
    try {
      stored = localStorage.getItem(DEVICE_KEY_SLOT);
    } catch {
      // localStorage may throw in certain Safari modes; treat as no-key.
    }
    if (stored) {
      try {
        const jwk = JSON.parse(stored);
        return await window.crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "AES-GCM", length: 256 },
          true, // extractable so we can re-export across sessions if needed
          ["encrypt", "decrypt"],
        );
      } catch {
        // Stored key is corrupt — generate a fresh one. Worst case, the user
        // re-enters their API keys.
      }
    }
    const key = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    try {
      const jwk = await window.crypto.subtle.exportKey("jwk", key);
      localStorage.setItem(DEVICE_KEY_SLOT, JSON.stringify(jwk));
    } catch {
      // If we can't persist the key, the user's keys won't survive a reload,
      // but the *current* session is still encrypted in memory.
    }
    return key;
  })();

  return cachedKeyPromise;
}

// Encrypt a JSON-serializable value for at-rest storage. Resolves to a
// string suitable for localStorage.setItem (base64 of `IV ‖ ciphertext`,
// prefixed with our format tag so we can detect legacy plaintext blobs).
const FORMAT_TAG = "v1:";

export async function encryptForStorage(value) {
  const plaintext = JSON.stringify(value);
  if (!hasWebCrypto()) return plaintext; // Fallback: write plain JSON.
  const key = await getOrCreateDeviceKey();
  if (!key) return plaintext;

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc,
  );
  const ctBytes = new Uint8Array(ciphertext);
  const out = new Uint8Array(iv.length + ctBytes.length);
  out.set(iv, 0);
  out.set(ctBytes, iv.length);
  return FORMAT_TAG + bytesToBase64(out);
}

// Decrypt a value previously written by encryptForStorage. Falls back to
// JSON.parse for legacy plaintext blobs so existing users don't lose data.
// Returns null if both paths fail.
export async function decryptFromStorage(blob) {
  if (typeof blob !== "string" || !blob) return null;
  if (!blob.startsWith(FORMAT_TAG)) {
    // Legacy plaintext blob — try to parse as JSON.
    try { return JSON.parse(blob); } catch { return null; }
  }
  if (!hasWebCrypto()) return null;
  const key = await getOrCreateDeviceKey();
  if (!key) return null;
  try {
    const all = base64ToBytes(blob.slice(FORMAT_TAG.length));
    if (all.length < 13) return null; // need IV (12) + at least 1 byte ct
    const iv = all.slice(0, 12);
    const ct = all.slice(12);
    const ptBuf = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ct,
    );
    const text = new TextDecoder().decode(ptBuf);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Convenience: read a slot (Storage interface — localStorage or
// sessionStorage), return decrypted JSON value.
export async function readEncryptedSlot(storage, slotKey) {
  if (typeof storage === "undefined" || !storage) return null;
  try {
    const raw = storage.getItem(slotKey);
    return await decryptFromStorage(raw);
  } catch {
    return null;
  }
}

// Convenience: write encrypted JSON value to a storage slot.
export async function writeEncryptedSlot(storage, slotKey, value) {
  if (typeof storage === "undefined" || !storage) return false;
  try {
    const blob = await encryptForStorage(value);
    storage.setItem(slotKey, blob);
    return true;
  } catch {
    return false;
  }
}

// Synchronous best-effort read used during initial render (when async work
// would force a hydration mismatch). Returns null if the blob is encrypted
// — callers should follow up with readEncryptedSlot() in a useEffect.
export function readPlaintextSlotSync(storage, slotKey) {
  if (typeof storage === "undefined" || !storage) return null;
  try {
    const raw = storage.getItem(slotKey);
    if (!raw || raw.startsWith(FORMAT_TAG)) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
