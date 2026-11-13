import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  IMAGE_NAME_RE, imageFilename, processImage, imageMetadata, isCleanWebp,
  downloadImage, downloadPupImages,
} from '../lib/images.mjs';
import { testHttp } from './_helpers.mjs';

const ID = 'imp-7f3a2c91de';

async function exifXmpJpeg({ width = 1200, height = 800 } = {}) {
  const jpeg = await sharp({ create: { width, height, channels: 3, background: { r: 180, g: 90, b: 40 } } })
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Copyright: 'K086 test', ImageDescription: 'exif fixture' }, GPS: { GPSLatitudeRef: 'N' } },
    })
    .toBuffer();
  // sharp/libvips does not write XMP itself, so add a real XMP APP1 segment
  // after SOI: this proves the processor drops XMP too.
  const xmp = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" dc:title="xmp fixture"/></rdf:RDF></x:xmpmeta>');
  const payload = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0'), xmp]);
  const len = payload.length + 2;
  const segment = Buffer.concat([Buffer.from([0xff, 0xe1, len >> 8, len & 0xff]), payload]);
  return Buffer.concat([jpeg.subarray(0, 2), segment, jpeg.subarray(2)]);
}

test('an output WebP has no EXIF, XMP or GPS (sharp metadata check)', async () => {
  const input = await exifXmpJpeg();
  const before = await imageMetadata(input);
  assert.ok(before.exif, 'fixture really carries EXIF/GPS');
  assert.ok(before.xmp, 'fixture really carries XMP');

  const out = await processImage(input);
  const detail = await imageMetadata(out.detail);
  const card = await imageMetadata(out.card);
  for (const [label, m] of [['detail', detail], ['card', card]]) {
    assert.equal(m.format, 'webp', label);
    assert.equal(m.exif, undefined, `${label} has EXIF/GPS`);
    assert.equal(m.xmp, undefined, `${label} has XMP`);
    assert.equal(m.iptc, undefined, `${label} has IPTC`);
    assert.equal(m.orientation, undefined, `${label} kept orientation metadata`);
  }
  assert.equal(out.dhash.length, 16);
  assert.match(out.dhash, /^[0-9a-f]{16}$/);
  assert.equal(await isCleanWebp(out.detail), true);
  assert.equal(await isCleanWebp(out.card), true);
});

test('filenames match /^imp-[0-9a-f]{10}-\\d+(-card)?\\.webp$/', () => {
  assert.equal(imageFilename(ID, 1), `${ID}-1.webp`);
  assert.equal(imageFilename(ID, 2, true), `${ID}-2-card.webp`);
  for (const n of [1, 2, 10, 99]) {
    assert.match(imageFilename(ID, n), IMAGE_NAME_RE);
    assert.match(imageFilename(ID, n, true), IMAGE_NAME_RE);
  }
  assert.throws(() => imageFilename('imp-NOTHEX0000', 1));
  assert.throws(() => imageFilename(ID, 0));
  assert.throws(() => imageFilename(ID, 1.5));
});

test('a 403 on an image returns null with no proxy attempt', async () => {
  const { http, fetchImpl } = testHttp({
    'https://origin.example/robots.txt': { body: '' },
    'https://origin.example/photo.jpg': { status: 403, body: 'blocked' },
  });
  const out = await downloadImage(http, 'https://origin.example/photo.jpg', { id: ID, n: 1 });
  assert.equal(out, null);
  assert.equal(fetchImpl.calls.length, 2, 'only robots.txt and the image were requested');
  assert.ok(fetchImpl.calls.every((u) => u.startsWith('https://origin.example/')));
  assert.equal(http.isBlocked('origin.example'), true);
});

test('a downloaded image is written only after processing, as a clean WebP', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ct-imports-img-'));
  try {
    const input = await exifXmpJpeg();
    const { http } = testHttp({
      'https://origin.example/robots.txt': { body: '' },
      'https://origin.example/photo.jpg': { body: input, headers: { 'content-type': 'image/jpeg' } },
    });
    const out = await downloadImage(http, 'https://origin.example/photo.jpg', { id: ID, n: 1, outDir: dir });
    assert.ok(out);
    assert.equal(out.filename, `${ID}-1.webp`);
    assert.equal(out.cardFilename, `${ID}-1-card.webp`);
    for (const name of [out.filename, out.cardFilename]) {
      assert.match(name, IMAGE_NAME_RE);
      assert.ok(statSync(join(dir, name)).size > 0);
      const m = await imageMetadata(readFileSync(join(dir, name)));
      assert.equal(m.format, 'webp');
      assert.equal(m.exif, undefined);
      assert.equal(m.xmp, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('downloadPupImages stops after a blocked host and never throws', async () => {
  const { http, fetchImpl } = testHttp({
    'https://origin.example/robots.txt': { body: '' },
    'https://origin.example/a.jpg': { status: 200, body: await exifXmpJpeg({ width: 400, height: 300 }) },
    'https://origin.example/b.jpg': { status: 403, body: 'no' },
    'https://origin.example/c.jpg': { status: 200, body: await exifXmpJpeg({ width: 400, height: 300 }) },
  });
  const out = await downloadPupImages(http, [
    'https://origin.example/a.jpg', 'https://origin.example/b.jpg', 'https://origin.example/c.jpg',
  ], { id: ID });
  assert.equal(out.images.length, 1);
  assert.equal(out.failed, 1);
  assert.equal(fetchImpl.calls.length, 3, 'robots + a + b; c is never requested after the block');
});
