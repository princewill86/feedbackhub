import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';

export function mailEnabled() {
  switch (env.MAIL_TRANSPORT ?? 'resend') {
    case 'resend': return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
    case 'smtp': return Boolean(env.SMTP_HOST && env.MAIL_FROM);
    case 'php': return Boolean(env.MAIL_FROM);
    default: return false;
  }
}

function run(command: string, args: string[], input: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'], timeout: 15000, killSignal: 'SIGKILL' });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('The local mail transport failed.'));
    });
    // The child may exit before it finishes reading its input.
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}

const phpScript = `
  $mail = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
  $headers = [
    'From' => $mail['from'],
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => 'base64'
  ];
  $subject = '=?UTF-8?B?' . base64_encode($mail['subject']) . '?=';
  exit(mail($mail['to'], $subject, chunk_split(base64_encode($mail['text'])), $headers) ? 0 : 1);
`;

function smtpOption(value: string) {
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error('Invalid SMTP configuration.');
  return '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
}

async function smtp(from: string, to: string, subject: string, text: string) {
  const host = env.SMTP_HOST ?? '';
  const tls = env.SMTP_TLS || 'starttls';
  const port = Number(env.SMTP_PORT || (tls === 'implicit' ? 465 : 587));
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)
    || !Number.isInteger(port) || port < 1 || port > 65535
    || (tls !== 'implicit' && tls !== 'starttls')
    || Boolean(env.SMTP_USERNAME) !== Boolean(env.SMTP_PASSWORD)) {
    throw new Error('Invalid SMTP configuration.');
  }
  const directory = await mkdtemp(join(tmpdir(), 'feedbackhub-mail-'));
  try {
    const upload = join(directory, 'message.eml');
    const encodedBody = Buffer.from(text).toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
    const message = [
      `From: ${from}`, `To: ${to}`, `Date: ${new Date().toUTCString()}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64', '', encodedBody, ''
    ].join('\r\n');
    await writeFile(upload, message, { mode: 0o600 });
    const config = [
      `url = "${tls === 'implicit' ? 'smtps' : 'smtp'}://${host}:${port}"`,
      'ssl-reqd', 'max-time = 12',
      `mail-from = ${smtpOption(from)}`, `mail-rcpt = ${smtpOption(to)}`,
      `upload-file = ${smtpOption(upload)}`
    ];
    if (env.SMTP_USERNAME && env.SMTP_PASSWORD) {
      config.push(`user = ${smtpOption(env.SMTP_USERNAME + ':' + env.SMTP_PASSWORD)}`);
    }
    // Credentials go through stdin and stay out of process arguments and logs.
    await run('curl', ['--disable', '--config', '-'], config.join('\n') + '\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function sendAccountMail(email: string, subject: string, text: string) {
  const from = env.MAIL_FROM;
  if (!mailEnabled() || !from) throw new Error('Account email is unavailable.');
  const mailbox = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z0-9-]+$/i;
  if (!mailbox.test(email) || /[\r\n]/u.test(subject)) throw new Error('Invalid email message.');

  switch (env.MAIL_TRANSPORT ?? 'resend') {
    case 'php':
      if (!mailbox.test(from)) throw new Error('Set MAIL_FROM to a bare email address for PHP mail.');
      await run(env.PHP_MAIL_BINARY || 'php', ['-r', phpScript], JSON.stringify({ from, to: email, subject, text }));
      return;
    case 'smtp':
      if (!mailbox.test(from)) throw new Error('Set MAIL_FROM to a bare email address for SMTP.');
      await smtp(from, email, subject, text);
      return;
    case 'resend': {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject, text }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Account email provider returned HTTP ${response.status}.`);
    }
  }
}
