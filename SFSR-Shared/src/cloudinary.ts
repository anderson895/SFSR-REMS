/**
 * Unsigned Cloudinary uploads.
 *
 * Unsigned uploads require only the cloud name and an unsigned upload preset,
 * both of which are safe to expose in browser code. The Cloudinary API Secret
 * is deliberately NOT referenced anywhere in this file or anywhere else in the
 * client bundle — signing would require a server we do not have.
 */

import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from './constants';
import { readEnv } from './env';

const CLOUD_NAME = readEnv('VITE_CLOUDINARY_CLOUD_NAME');
const UPLOAD_PRESET = readEnv('VITE_CLOUDINARY_UPLOAD_PRESET');

export interface UploadedFile {
  url: string;
  publicId: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Validates a file against the manuscript's stated limits: PDF/JPG/JPEG/PNG,
 * maximum 3 MB. Returns an error message, or null when the file is acceptable.
 */
export function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return 'Only PDF, JPG, JPEG, and PNG files are accepted.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(2);
    return `File is ${mb} MB. The maximum allowed size is 3 MB.`;
  }
  return null;
}

/**
 * Uploads a file to Cloudinary and returns its permanent URL.
 *
 * `onProgress` reports 0..1. XMLHttpRequest is used rather than fetch because
 * fetch still cannot report upload progress, and these are scans of documents
 * on office connections where a progress bar genuinely matters.
 */
export function uploadToCloudinary(
  file: File,
  folder: string,
  onProgress?: (fraction: number) => void,
): Promise<UploadedFile> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return Promise.reject(
      new Error(
        'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and ' +
          'VITE_CLOUDINARY_UPLOAD_PRESET in your .env file.',
      ),
    );
  }

  const invalid = validateFile(file);
  if (invalid) return Promise.reject(new Error(invalid));

  // PDFs must go to the `raw`/`auto` endpoint; `image` would reject them.
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', folder);

  return new Promise<UploadedFile>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status}). ${xhr.responseText}`));
        return;
      }
      const body = JSON.parse(xhr.responseText);
      resolve({
        url: body.secure_url,
        publicId: body.public_id,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(form);
  });
}
