/** RFID EPC: 24 hex chars or ASCII ≤12 chars (space-padded to 12 bytes). */

export const EPC_HEX_LENGTH = 24;
export const EPC_ASCII_LENGTH = 12;

export type RfidCodeValidation = {
  ok: boolean;
  canonicalHex?: string;
  ascii?: string | null;
  error?: string;
};

function hexDigits(value: string): string {
  return value.trim().replace(/[\s-]/g, '').toUpperCase();
}

function isPrintableAscii(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

export function isHexEpc(value: string): boolean {
  const s = hexDigits(value);
  return s.length === EPC_HEX_LENGTH && /^[0-9A-F]+$/.test(s);
}

export function hexToAsciiEpc(hexCode: string, options?: { stripPadding?: boolean }): string | null {
  const s = hexDigits(hexCode);
  if (!isHexEpc(s)) return null;
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 2) {
    bytes.push(parseInt(s.slice(i, i + 2), 16));
  }
  if (bytes.length !== EPC_ASCII_LENGTH) return null;
  const ascii = String.fromCharCode(...bytes);
  if (!isPrintableAscii(ascii)) return null;
  return options?.stripPadding ? ascii.replace(/ +$/g, '') : ascii;
}

export function asciiToHexEpc(asciiCode: string): string | null {
  const s = asciiCode.replace(/[\n\r]/g, '');
  if (!s || s.length > EPC_ASCII_LENGTH || s.includes('-') || !isPrintableAscii(s)) {
    return null;
  }
  const padded = s.padEnd(EPC_ASCII_LENGTH, ' ');
  return Array.from(padded)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function validateRfidCode(raw: string): RfidCodeValidation {
  if (!raw.trim()) {
    return { ok: false, error: 'El código RFID es obligatorio.' };
  }

  if (isHexEpc(raw)) {
    const canonicalHex = hexDigits(raw);
    return {
      ok: true,
      canonicalHex,
      ascii: hexToAsciiEpc(canonicalHex, { stripPadding: true }),
    };
  }

  const hexFromAscii = asciiToHexEpc(raw);
  if (hexFromAscii) {
    return {
      ok: true,
      canonicalHex: hexFromAscii,
      ascii: hexToAsciiEpc(hexFromAscii, { stripPadding: true }) ?? raw.replace(/[\n\r]/g, ''),
    };
  }

  return {
    ok: false,
    error:
      'El código RFID debe ser 24 caracteres hexadecimales (EPC) o ASCII (hasta 12; se rellena con espacios).',
  };
}

/** Sync helpers for paired EPC / ASCII inputs. */
export function syncFromHex(hexInput: string): { hex: string; ascii: string } {
  const hex = hexDigits(hexInput).slice(0, EPC_HEX_LENGTH);
  if (isHexEpc(hex)) {
    return {
      hex,
      ascii: hexToAsciiEpc(hex, { stripPadding: true }) ?? '',
    };
  }
  return { hex, ascii: '' };
}

export function syncFromAscii(asciiInput: string): { hex: string; ascii: string } {
  const ascii = asciiInput.replace(/[\n\r]/g, '').slice(0, EPC_ASCII_LENGTH);
  const hex = asciiToHexEpc(ascii) ?? '';
  return { hex, ascii };
}

export function formatRfidHint(raw: string): string {
  const result = validateRfidCode(raw);
  if (!result.ok || !result.canonicalHex) return '';
  if (result.ascii) {
    return `EPC: ${result.canonicalHex} · ASCII: ${result.ascii}`;
  }
  return `EPC: ${result.canonicalHex}`;
}
