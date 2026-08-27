const crypto = require("crypto");

/**
 * Encrypts a plain JSON payload using AES-256-GCM and encrypts the random session key with Mobikwik's RSA Public Key.
 * @param {Object} payload - Business payload (e.g., { memberId: "..." })
 * @param {string} publicKeyPem - RSA Public Key in PEM format
 * @param {string} keyVersion - Version string (e.g., "1.0")
 * @returns {Object} Encrypted envelope containing encryptedSessionKey, encryptedPayload, keyVersion, iv, timestamp
 */
function encryptPayload(payload, publicKeyPem, keyVersion = "1.0") {
  const jsonPayload = JSON.stringify(payload);

  // 1. Generate random 32-byte AES key & 16-byte IV
  const sessionKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  // 2. Encrypt payload with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv, {
    authTagLength: 16,
  });

  const encrypted = Buffer.concat([
    cipher.update(jsonPayload, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine encrypted data + 16-byte GCM authentication tag
  const encryptedPayload = Buffer.concat([encrypted, authTag]);

  // 3. Encrypt session key with RSA Public Key (PKCS#1 v1.5 padding)
  const encryptedSessionKey = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    sessionKey
  );

  return {
    encryptedSessionKey: encryptedSessionKey.toString("base64"),
    encryptedPayload: encryptedPayload.toString("base64"),
    keyVersion: keyVersion,
    iv: iv.toString("base64"),
    timestamp: Date.now().toString(),
  };
}

/**
 * Decrypts an encrypted envelope using private key (used for test verification / mock provider decryption).
 * @param {Object} envelope - { encryptedSessionKey, encryptedPayload, iv }
 * @param {string} privateKeyPem - RSA Private Key in PEM format
 * @returns {Object} Decrypted JSON payload
 */
function decryptPayload(envelope, privateKeyPem) {
  // 1. Decrypt RSA session key
  const sessionKey = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(envelope.encryptedSessionKey, "base64")
  );

  // 2. Separate ciphertext and 16-byte GCM auth tag
  const encBuffer = Buffer.from(envelope.encryptedPayload, "base64");
  const authTag = encBuffer.subarray(encBuffer.length - 16);
  const cipherText = encBuffer.subarray(0, encBuffer.length - 16);
  const iv = Buffer.from(envelope.iv, "base64");

  // 3. Decrypt payload with AES-256-GCM
  const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(cipherText),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

module.exports = {
  encryptPayload,
  decryptPayload,
};