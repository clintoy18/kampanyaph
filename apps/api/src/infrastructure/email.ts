import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface EmailService {
  sendInvitation(email: string, link: string): Promise<void>;
  sendPasswordReset(email: string, link: string): Promise<void>;
}

export class LocalEmailSink implements EmailService {
  private readonly directory: string;

  constructor(directory = join(process.cwd(), '.dev-outbox')) {
    this.directory = directory;
  }

  private async write(kind: 'invitation' | 'password_reset', email: string, link: string) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await appendFile(
      join(this.directory, 'messages.jsonl'),
      JSON.stringify({ kind, email, link, createdAt: new Date().toISOString() }) + '\n',
      { mode: 0o600 },
    );
  }

  sendInvitation(email: string, link: string) {
    return this.write('invitation', email, link);
  }

  sendPasswordReset(email: string, link: string) {
    return this.write('password_reset', email, link);
  }
}
