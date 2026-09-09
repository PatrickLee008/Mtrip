/**
 * 客户端签名与传输加密工具(与后端 shared 严格对齐):
 * - HMAC-SHA256 签名:hex(HMAC-SHA256(secret, clientId + METHOD + path + timestamp + nonce)),
 *   对应后端 ClientSignMiddleware,path 为纯路径不含 query
 * - AES-256-CBC 传输加密:base64(IV 16字节 + 密文),key = SHA256(secret),
 *   对应后端 PayloadDecryptMiddleware / TransportCipher
 */

import CryptoJS from 'crypto-js';

/**
 * 生成随机字节 WordArray:优先 Web Crypto(浏览器/Expo Web),
 * RN Hermes 无 crypto.getRandomValues 时回退 Math.random(nonce/IV 场景可接受)
 */
function randomWordArray(bytes: number): CryptoJS.lib.WordArray {
  const globalCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (globalCrypto?.getRandomValues) {
    const buf = new Uint8Array(bytes);
    globalCrypto.getRandomValues(buf);
    const words: number[] = [];
    for (let i = 0; i < bytes; i += 1) {
      words[i >>> 2] = (words[i >>> 2] ?? 0) | (buf[i] << (24 - (i % 4) * 8));
    }
    return CryptoJS.lib.WordArray.create(words, bytes);
  }
  const words: number[] = [];
  for (let i = 0; i < Math.ceil(bytes / 4); i += 1) {
    words.push((Math.random() * 0x100000000) | 0);
  }
  return CryptoJS.lib.WordArray.create(words, bytes);
}

/** 随机 nonce(hex 串,配合后端 Redis 去重防重放) */
export function genNonce(): string {
  return randomWordArray(16).toString(CryptoJS.enc.Hex);
}

/** 请求签名:clientId + METHOD + path + timestamp(秒) + nonce,输出小写 hex */
export function signRequest(
  clientId: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  secret: string,
): string {
  const raw = clientId + method.toUpperCase() + path + timestamp + nonce;
  return CryptoJS.HmacSHA256(raw, secret).toString(CryptoJS.enc.Hex);
}

/** 请求体 AES-256-CBC 加密:输出 base64(IV + 密文),后端 TransportCipher 可解 */
export function encryptPayload(data: Record<string, unknown>, secret: string): string {
  const key = CryptoJS.SHA256(secret);
  const iv = randomWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.clone().concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
}
