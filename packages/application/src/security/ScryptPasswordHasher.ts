import crypto from 'crypto';
import { IPasswordHasher } from '@medidesk/domain';

/**
 * Secure password hasher using Node's cryptographic scrypt algorithm.
 * Stores hash as: `scrypt$N=16384,r=8,p=1$<salt-hex>$<hash-hex>`
 */
export class ScryptPasswordHasher implements IPasswordHasher {
  private keyLength = 64;
  private cost = 16384;
  private blockSize = 8;
  private parallelization = 1;

  private deriveKey(password: string, salt: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        this.keyLength,
        {
          N: this.cost,
          r: this.blockSize,
          p: this.parallelization
        },
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  public async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await this.deriveKey(password, salt);

    return `scrypt$N=${this.cost},r=${this.blockSize},p=${this.parallelization}$${salt}$${derivedKey.toString('hex')}`;
  }

  public async verify(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const salt = parts[2];
    const key = parts[3];
    if (!salt || !key) return false;

    const derivedKey = await this.deriveKey(password, salt);
    const keyBuffer = Buffer.from(key, 'hex');

    if (keyBuffer.length !== derivedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }
}
