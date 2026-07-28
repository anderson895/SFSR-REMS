/**
 * The bridge between the image uploader and the inventory it feeds.
 *
 * `uploadProjectImages.ts` writes `projectImages.json`; `unitData.ts` reads it.
 * Both need the same key-building rule, so it lives here rather than being
 * spelled out twice and drifting the first time a file is renamed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ManifestEntry {
  /** Delivery URL with automatic format and quality — use this in the app. */
  url: string;
  /** Untransformed original, kept for reference and re-processing. */
  originalUrl: string;
  publicId: string;
  width: number;
  height: number;
}

export type ImageManifest = Record<string, ManifestEntry>;

/**
 * Resolved from the working directory, not from this file, to match how every
 * other script here behaves — `adminApp.ts` finds serviceAccountKey.json the
 * same way and `process.loadEnvFile('.env')` is cwd-relative too. All of them
 * assume the repo root, which is where npm scripts run.
 */
export const MANIFEST_PATH = resolve(process.cwd(), 'scripts/projectImages.json');

/**
 * Cloudinary transformation applied to every project image.
 *
 * `f_auto` serves AVIF/WebP to browsers that accept them, `q_auto` picks a
 * quality per image, and `c_limit,w_1600` caps the width without ever upscaling
 * a smaller source. 1600px is deliberate: the floor plans carry printed
 * dimension text that has to stay legible when a buyer zooms in.
 */
const TRANSFORMATION = 'f_auto,q_auto,c_limit,w_1600';

export function optimizedUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', `/upload/${TRANSFORMATION}/`);
}

/**
 * `THE_LEGASPI_PLACE` -> `the-legaspi-place`, `1-BR-LEGASPI` -> `1-br-legaspi`.
 * Applied to both folder and file names so a manifest key can be predicted from
 * what is on disk.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let cached: ImageManifest | null = null;

function manifest(): ImageManifest {
  if (cached) return cached;
  try {
    cached = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ImageManifest;
  } catch {
    cached = {};
  }
  return cached;
}

/**
 * A rectangle in source-image pixels, measured from the top-left.
 *
 * The renders arrive as A3 presentation boards — logo, body copy, elevations,
 * site plan and floor plates all on one sheet — so the whole file is unusable
 * as a listing photo. This picks the one region that reads as a photograph.
 */
export interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

const warned = new Set<string>();

/**
 * Looks up an uploaded image, optionally cropped to a region of it.
 *
 * The crop is chained ahead of the format/quality step because Cloudinary
 * applies transformations left to right: cropping after a resize would measure
 * the coordinates against the resized image, not the source they were read off.
 *
 * Returns '' when the image is missing. Seeding has to succeed on a machine
 * that has never run the uploader — a missing render should cost you a
 * placeholder tile, not the whole inventory. The warning names the exact key so
 * the fix is obvious.
 */
export function imageUrl(key: string, crop?: CropRegion): string {
  const entry = manifest()[key];

  if (!entry) {
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(
        `  ! no uploaded image for "${key}" — seeding without it.\n` +
          `    Run: npm run upload:images -- <folder>`,
      );
    }
    return '';
  }

  if (!crop) return entry.url;

  return entry.url.replace(
    '/upload/',
    `/upload/c_crop,x_${crop.x},y_${crop.y},w_${crop.w},h_${crop.h}/`,
  );
}
