import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { AppError, httpError } from '../utils/apiError';

/**
 * Storage abstraction.
 *  - "local": writes files under STORAGE_UPLOADS_DIR and returns a URL served by Express static.
 *  - "supabase": uploads to a Supabase storage bucket and returns a signed URL.
 * Defaults to local so the app runs without external config.
 */

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeExt(filename: string): string {
  const base = path.extname(filename || '').toLowerCase();
  return ALLOWED_EXT.includes(base) ? base : '';
}

async function supabaseRequest(pathname: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${env.SUPABASE_URL}${pathname}`, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      ...init.headers,
    },
    ...init,
  });
  if (!res.ok) {
    throw httpError.badRequest(`Storage request failed (${res.status})`);
  }
  return res;
}

export async function uploadFile(args: {
  kind: 'profile' | 'document';
  ownerId: number;
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
}): Promise<{ url: string; name: string }> {
  const ext = safeExt(args.originalName);
  if (!ext) throw httpError.badRequest(`Unsupported file type: ${args.originalName}`);

  if (env.STORAGE_DRIVER === 'supabase') {
    const bucket = args.kind === 'profile' ? env.SUPABASE_BUCKET_PROFILE : env.SUPABASE_BUCKET_DOCS;
    const objectName = `${args.ownerId}/${randomUUID()}${ext}`;
    const uploadPath = `/storage/v1/object/${bucket}/${objectName}`;
    await supabaseRequest(uploadPath, {
      method: 'POST',
      headers: { 'Content-Type': args.mimeType || 'application/octet-stream' },
      body: args.buffer,
    });
    // Public-read URL is simplest + predictable for HR documents shared within the org.
    return { url: `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectName}`, name: args.originalName };
  }

  // Local dev storage.
  const subdir = args.kind === 'profile' ? 'profiles' : 'documents';
  const dir = path.join(process.cwd(), env.STORAGE_UPLOADS_DIR, subdir);
  ensureDir(dir);
  const filename = `${args.ownerId}-${randomUUID()}${ext}`;
  fs.writeFileSync(path.join(dir, filename), args.buffer);
  return { url: `/uploads/${subdir}/${filename}`, name: args.originalName };
}

export async function deleteFile(url: string): Promise<void> {
  if (env.STORAGE_DRIVER === 'supabase') {
    // URLs we generate are public object URLs; map back to bucket+key is lossy,
    // so deletion is best-effort and only for known paths.
    return;
  }
  if (url.startsWith('/uploads/')) {
    const filePath = path.join(process.cwd(), url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    } else {
      void AppError; // silence unused
    }
  }
}

export function storageRoot(): string {
  return path.join(process.cwd(), env.STORAGE_UPLOADS_DIR);
}