/**
 * Secure Storage Module for Volty Trading Bot
 * 
 * Provides secure handling of sensitive credentials
 */

class SecureStorage {
  constructor() {
    this.sessionKeys = new Map();
    this.encryptionEnabled = !!window.crypto && !!window.crypto.subtle;
  }

  /**
   * Generate a secure encryption key
   * @returns {Promise<CryptoKey>}
   */
  async generateEncryptionKey() {
    return window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt sensitive data
   * @param {string} data - Data to encrypt
   * @param {CryptoKey} key - Encryption key
   * @returns {Promise<string>} - Base64 encoded encrypted data
   */
  async encrypt(data, key) {
    if (!this.encryptionEnabled) {
      throw new Error("Encryption is not supported in this browser");
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...new Uint8Array(combined)));
  }

  /**
   * Decrypt sensitive data
   * @param {string} encryptedData - Base64 encoded encrypted data
   * @param {CryptoKey} key - Decryption key
   * @returns {Promise<string>} - Decrypted data
   */
  async decrypt(encryptedData, key) {
    if (!this.encryptionEnabled) {
      throw new Error("Encryption is not supported in this browser");
    }

    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Store API credentials securely for the session
   * @param {string} apiKey - API key
   * @param {string} apiSecret - API secret
   * @returns {Promise<boolean>} - Success status
   */
  async storeCredentials(apiKey, apiSecret) {
    try {
      if (this.encryptionEnabled) {
        const key = await this.generateEncryptionKey();
        this.sessionKeys.set('apiKey', key);
        
        const encryptedApiKey = await this.encrypt(apiKey, key);
        sessionStorage.setItem('volty_api_key', encryptedApiKey);
        
        // Generate a separate key for the secret
        const secretKey = await this.generateEncryptionKey();
        this.sessionKeys.set('apiSecret', secretKey);
        
        const encryptedApiSecret = await this.encrypt(apiSecret, secretKey);
        sessionStorage.setItem('volty_api_secret', encryptedApiSecret);
        
        return true;
      } else {
        // Fallback for browsers without crypto API (not recommended)
        this.sessionKeys.set('apiKey', apiKey);
        this.sessionKeys.set('apiSecret', apiSecret);
        return true;
      }
    } catch (error) {
      console.error('Error storing credentials:', error);
      return false;
    }
  }

  /**
   * Retrieve API credentials
   * @returns {Promise<{apiKey: string, apiSecret: string}>}
   */
  async getCredentials() {
    try {
      if (this.encryptionEnabled) {
        const encryptedApiKey = sessionStorage.getItem('volty_api_key');
        const encryptedApiSecret = sessionStorage.getItem('volty_api_secret');
        
        if (!encryptedApiKey || !encryptedApiSecret) {
          return { apiKey: '', apiSecret: '' };
        }
        
        const apiKeyDecrypted = await this.decrypt(
          encryptedApiKey, 
          this.sessionKeys.get('apiKey')
        );
        
        const apiSecretDecrypted = await this.decrypt(
          encryptedApiSecret,
          this.sessionKeys.get('apiSecret')
        );
        
        return {
          apiKey: apiKeyDecrypted,
          apiSecret: apiSecretDecrypted
        };
      } else {
        // Fallback
        return {
          apiKey: this.sessionKeys.get('apiKey') || '',
          apiSecret: this.sessionKeys.get('apiSecret') || ''
        };
      }
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return { apiKey: '', apiSecret: '' };
    }
  }

  /**
   * Clear stored credentials
   */
  clearCredentials() {
    sessionStorage.removeItem('volty_api_key');
    sessionStorage.removeItem('volty_api_secret');
    this.sessionKeys.clear();
  }

  /**
   * Check if credentials are stored
   * @returns {boolean}
   */
  hasCredentials() {
    return this.encryptionEnabled
      ? !!sessionStorage.getItem('volty_api_key')
      : this.sessionKeys.has('apiKey');
  }
}

// Export as singleton
export const secureStorage = new SecureStorage();
