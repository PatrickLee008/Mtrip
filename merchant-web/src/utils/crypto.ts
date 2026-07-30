/**
 * 登录传输加密(与后端 shared TransportCipher 对齐):
 * AES-256-CBC,key = SHA256(VITE_LOGIN_AES_KEY),输出 base64(IV 16字节 + 密文)
 * 后端 PayloadDecryptMiddleware 以 MTRIP_MERCHANT_AES_KEY(同值)解密
 */

import CryptoJS from 'crypto-js';

/** 登录加密密钥(未配置则登录走明文,需后端 MTRIP_PAYLOAD_ENCRYPT=false 配合) */
export const LOGIN_AES_KEY: string = import.meta.env.VITE_LOGIN_AES_KEY ?? '';

/** 请求体 AES-256-CBC 加密为 payload 密文串 */
export function encryptPayload(data: Record<string, unknown>, secret: string): string {
  const key = CryptoJS.SHA256(secret);
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.clone().concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
}
