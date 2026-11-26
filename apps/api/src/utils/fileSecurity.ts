import fs from 'node:fs';

export type VerifiedMediaFormat =
  | { kind: 'image'; mimeType: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp' }
  | { kind: 'video'; mimeType: 'video/mp4'; ext: 'mp4' };

/**
 * Inspects file header magic bytes rather than trusting client-supplied MIME types or extensions.
 */
export function inspectFileSignature(filePath: string): VerifiedMediaFormat | null {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, header, 0, 16, 0);
    if (bytesRead < 12) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      return { kind: 'image', mimeType: 'image/png', ext: 'png' };
    }

    // JPEG: FF D8 FF
    if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return { kind: 'image', mimeType: 'image/jpeg', ext: 'jpg' };
    }

    // WebP: RIFF....WEBP
    if (
      header.subarray(0, 4).toString('ascii') === 'RIFF' &&
      header.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { kind: 'image', mimeType: 'image/webp', ext: 'webp' };
    }

    // MP4 / ISO Base Media File Format: "ftyp" at offset 4
    if (header.subarray(4, 8).toString('ascii') === 'ftyp') {
      return { kind: 'video', mimeType: 'video/mp4', ext: 'mp4' };
    }

    return null;
  } finally {
    fs.closeSync(fd);
  }
}

export function safeUnlink(filePath: string | null | undefined): void {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}
