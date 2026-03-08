import CryptoJS from 'crypto-js';

/**
 * Encrypts a string using AES encryption and a provided passkey
 * @param {string} text - The plaintext to encrypt
 * @param {string} key - The encryption passkey
 * @returns {string} - The encrypted string (ciphertext)
 */
export const encryptPassword = (text, key) => {
    if (!text || !key) return '';
    return CryptoJS.AES.encrypt(text, key).toString();
};

/**
 * Decrypts an AES encrypted string using the provided passkey
 * @param {string} ciphertext - The encrypted string
 * @param {string} key - The encryption passkey
 * @returns {string} - The decrypted plaintext
 */
export const decryptPassword = (ciphertext, key) => {
    if (!ciphertext || !key) return '';
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText;
    } catch (error) {
        console.error("Failed to decrypt:", error);
        return '';
    }
};

/**
 * Hashes a password using SHA-256 via the browser's native Web Crypto API.
 * The result is used for authentication — the hash is stored, never the plaintext.
 * @param {string} password
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
