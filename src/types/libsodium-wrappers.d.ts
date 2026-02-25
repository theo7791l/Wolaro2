declare module 'libsodium-wrappers' {
  export const ready: Promise<void>;
  export function crypto_secretbox_easy(
    message: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array
  ): Uint8Array;
  export function crypto_secretbox_open_easy(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    key: Uint8Array
  ): Uint8Array;
  export function randombytes_buf(length: number): Uint8Array;
  export const crypto_secretbox_NONCEBYTES: number;
  export const crypto_secretbox_KEYBYTES: number;
  export const crypto_secretbox_MACBYTES: number;
}
