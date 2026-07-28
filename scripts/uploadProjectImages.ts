/**
 * Publishes a project's marketing images to Cloudinary.
 *
 * The building renders and floor plans live in the repo as 1.5-2.4 MB PNGs,
 * which is fine as source art and far too heavy to serve to a buyer's phone.
 * Cloudinary already holds every other uploaded asset in this system, so the
 * images go there too and are delivered through an `f_auto,q_auto` URL that
 * hands back WebP/AVIF at roughly a tenth of the size.
 *
 * The resulting URLs are written to `projectImages.json`, which `unitData.ts`
 * reads when it builds the inventory. That file is committed: seeding must work
 * on a fresh clone without anyone re-running this upload.
 *
 * Uses the same unsigned preset as the browser, so no API secret is involved.
 *
 * Usage:
 *   npm run upload:images -- THE_LEGASPI_PLACE
 *   npm run upload:images -- THE_LEGASPI_PLACE --force   # re-upload existing
 */

import { openAsBlob, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import {
  MANIFEST_PATH,
  optimizedUrl,
  slugify,
  type ImageManifest,
} from './projectImages';

process.loadEnvFile('.env');

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/** Everything this script publishes lands under one Cloudinary folder. */
const ROOT_FOLDER = 'sfsr/projects';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const args = process.argv.slice(2);
const force = args.includes('--force');
const folderArg = args.find((a) => !a.startsWith('--'));

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  bytes: number;
  width: number;
  height: number;
}

async function upload(
  filePath: string,
  folder: string,
  publicId: string,
): Promise<CloudinaryResponse> {
  const form = new FormData();
  form.append('file', await openAsBlob(filePath));
  form.append('upload_preset', UPLOAD_PRESET!);
  form.append('folder', folder);
  form.append('public_id', publicId);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudinary rejected ${publicId} (${response.status}): ${body}`);
  }
  return JSON.parse(body) as CloudinaryResponse;
}

function loadManifest(): ImageManifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ImageManifest;
  } catch {
    // First run — there is nothing to merge into yet.
    return {};
  }
}

async function main() {
  if (!folderArg) {
    console.error(
      'Usage: npm run upload:images -- <folderName> [--force]\n' +
        '\nExample:\n  npm run upload:images -- THE_LEGASPI_PLACE',
    );
    process.exit(1);
  }
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    console.error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and ' +
        'VITE_CLOUDINARY_UPLOAD_PRESET in .env.',
    );
    process.exit(1);
  }

  const sourceDir = resolve(process.cwd(), folderArg);
  const projectSlug = slugify(basename(sourceDir));

  const files = readdirSync(sourceDir)
    .filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`No images found in ${sourceDir}`);
    process.exit(1);
  }

  console.log(`\nUploading ${files.length} image(s) from ${folderArg}`);
  console.log(`  cloud:  ${CLOUD_NAME}`);
  console.log(`  folder: ${ROOT_FOLDER}/${projectSlug}\n`);

  const manifest = loadManifest();
  let uploaded = 0;
  let skipped = 0;

  for (const file of files) {
    const imageSlug = slugify(basename(file, extname(file)));
    const key = `${projectSlug}/${imageSlug}`;

    if (manifest[key] && !force) {
      console.log(`  = ${key} (already uploaded, pass --force to replace)`);
      skipped++;
      continue;
    }

    const result = await upload(
      resolve(sourceDir, file),
      `${ROOT_FOLDER}/${projectSlug}`,
      imageSlug,
    );

    manifest[key] = {
      url: optimizedUrl(result.secure_url),
      originalUrl: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    };

    console.log(`  + ${key}  (${(result.bytes / 1024 / 1024).toFixed(2)} MB source)`);
    uploaded++;
  }

  // Sorted keys keep the committed manifest's diffs readable as projects are
  // added one at a time.
  const ordered = Object.fromEntries(
    Object.keys(manifest)
      .sort()
      .map((key) => [key, manifest[key]]),
  );
  writeFileSync(MANIFEST_PATH, JSON.stringify(ordered, null, 2) + '\n');

  console.log(
    `\n${uploaded} uploaded, ${skipped} already present.` +
      `\nManifest: ${MANIFEST_PATH}` +
      `\n\nNext: reference these keys from PROJECTS in scripts/unitData.ts, ` +
      `then run npm run migrate:data.\n`,
  );
}

main().catch((error) => {
  console.error('\n' + ((error as Error).message ?? String(error)));
  process.exit(1);
});