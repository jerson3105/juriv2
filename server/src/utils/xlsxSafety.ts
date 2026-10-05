import { inflateRawSync } from 'node:zlib';
import { ValidationError } from './errors.js';

/**
 * Un .xlsx es un ZIP. Antes de dárselo a ExcelJS se revisa: firma, pocas entradas, sin ZIP64 y, sobre todo, cada parte
 * se descomprime de verdad con un tope (maxOutputLength). Así una «bomba zip» que mienta sobre sus tamaños se corta
 * antes de llenar la memoria.
 */

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL = 0x06054b50;

export interface XlsxLimits {
  maxEntries: number;
  maxUncompressedBytes: number;
}

const DEFAULT_LIMITS: XlsxLimits = { maxEntries: 300, maxUncompressedBytes: 40 * 1024 * 1024 };
const notExcel = () => new ValidationError('El archivo no es un Excel (.xlsx) válido');

export const assertSafeXlsx = (buffer: Buffer, limits: XlsxLimits = DEFAULT_LIMITS) => {
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== LOCAL_HEADER) throw notExcel();
  // El registro final está al cierre (puede seguirlo un comentario de hasta 65 535 bytes).
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === END_OF_CENTRAL) { end = i; break; }
  }
  if (end < 0) throw notExcel();
  const entries = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (entries === 0xffff || centralOffset === 0xffffffff) throw new ValidationError('El archivo es demasiado grande o está dañado');
  if (entries > limits.maxEntries) throw new ValidationError('El archivo tiene demasiadas partes: guárdalo de nuevo como .xlsx');
  if (centralOffset + centralSize > buffer.length) throw notExcel();

  let budget = limits.maxUncompressedBytes;
  let p = centralOffset;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > buffer.length || buffer.readUInt32LE(p) !== CENTRAL_HEADER) throw notExcel();
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLength = buffer.readUInt16LE(p + 28);
    const extraLength = buffer.readUInt16LE(p + 30);
    const commentLength = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) throw new ValidationError('El archivo es demasiado grande o está dañado');

    // Los datos de la parte empiezan después de su cabecera local (con su propio nombre y extra).
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_HEADER) throw notExcel();
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw notExcel();
    let size: number;
    if (method === 0) {
      size = compressedSize;
    } else if (method === 8) {
      try {
        size = inflateRawSync(buffer.subarray(dataStart, dataEnd), { maxOutputLength: Math.max(1, budget) }).length;
      } catch {
        throw new ValidationError('El archivo descomprimido es demasiado grande');
      }
    } else {
      throw notExcel();
    }
    budget -= size;
    if (budget < 0) throw new ValidationError('El archivo descomprimido es demasiado grande');
    p += 46 + nameLength + extraLength + commentLength;
  }
};
