import { Writable } from 'stream';

/**
 * Create a slow-drip stream that writes data at a glacial pace.
 * Useful for testing client timeout logic.
 */
export class ZombieStream extends Writable {
  private buffer: Buffer[] = [];
  private bytesPerSecond: number;
  private onFinish: () => void;

  constructor(bytesPerSecond: number, onFinish: () => void) {
    super();
    this.bytesPerSecond = bytesPerSecond;
    this.onFinish = onFinish;
  }

  _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    this.buffer.push(chunk);
    callback();
  }

  _final(callback: (error?: Error | null) => void): void {
    this.onFinish();
    callback();
  }

  async drip(targetStream: any): Promise<void> {
    const fullBuffer = Buffer.concat(this.buffer);
    const delayPerByte = 1000 / this.bytesPerSecond;

    for (let i = 0; i < fullBuffer.length; i++) {
      targetStream.write(Buffer.from([fullBuffer[i]]));
      await new Promise((resolve) => setTimeout(resolve, delayPerByte));
    }

    targetStream.end();
  }
}
