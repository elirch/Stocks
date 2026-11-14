/**
 * Embeds / extracts a portfolio inside a PNG as an uncompressed iTXt chunk,
 * so an "editable copy" of the infographic can be uploaded later to keep
 * editing. Pure byte manipulation: works in the browser and in Node tests.
 */

export const PNG_KEYWORD = "portfolio-atlas";
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Returns a new PNG with an iTXt chunk (keyword → UTF-8 text) inserted before IEND. */
export function embedText(png: Uint8Array, text: string, keyword = PNG_KEYWORD): Uint8Array {
  if (!isPng(png)) throw new Error("Not a PNG image.");
  const enc = new TextEncoder();
  // iTXt: keyword \0 compressionFlag(0) compressionMethod(0) languageTag \0 translatedKeyword \0 text
  const data = concat([enc.encode(keyword), new Uint8Array([0, 0, 0, 0, 0]), enc.encode(text)]);
  const type = enc.encode("iTXt");
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat([type, data])));

  const iend = findChunk(png, "IEND");
  if (iend < 0) throw new Error("Malformed PNG.");
  return concat([png.subarray(0, iend), chunk, png.subarray(iend)]);
}

/** Finds the iTXt/tEXt text stored under `keyword`, or null. */
export function extractText(png: Uint8Array, keyword = PNG_KEYWORD): string | null {
  if (!isPng(png)) return null;
  const dec = new TextDecoder();
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let pos = 8;
  while (pos + 12 <= png.length) {
    const len = view.getUint32(pos);
    const type = dec.decode(png.subarray(pos + 4, pos + 8));
    const start = pos + 8;
    const end = start + len;
    if (end + 4 > png.length) return null;
    if (type === "iTXt" || type === "tEXt") {
      const data = png.subarray(start, end);
      const nul = data.indexOf(0);
      if (nul > 0 && dec.decode(data.subarray(0, nul)) === keyword) {
        if (type === "tEXt") return dec.decode(data.subarray(nul + 1));
        if (data[nul + 1] !== 0) return null; // compressed iTXt not supported
        let p = nul + 3;
        p = data.indexOf(0, p) + 1; // language tag
        p = data.indexOf(0, p) + 1; // translated keyword
        if (p <= 0) return null;
        return dec.decode(data.subarray(p));
      }
    }
    if (type === "IEND") return null;
    pos = end + 4;
  }
  return null;
}

function findChunk(png: Uint8Array, name: string): number {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const dec = new TextDecoder();
  let pos = 8;
  while (pos + 12 <= png.length) {
    const len = view.getUint32(pos);
    if (dec.decode(png.subarray(pos + 4, pos + 8)) === name) return pos;
    pos += 12 + len;
  }
  return -1;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
