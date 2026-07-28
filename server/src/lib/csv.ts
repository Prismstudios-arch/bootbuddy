/**
 * CSV generation for the portfolio export.
 *
 * Two things matter here beyond joining strings with commas:
 *
 * 1. **Formula injection.** A spreadsheet treats a cell starting with =, +,
 *    -, @, tab or CR as a formula. An item called "=cmd|' /c calc'!A1"
 *    would execute on open in Excel. Since item names come from an AI model
 *    reading a photo, and notes are free text, every field gets prefixed
 *    with a single quote if it starts with one of those. Nobody is likely
 *    to attack themselves with this, but the export is meant to be emailed
 *    to an accountant.
 *
 * 2. **Money as decimal pounds.** Internally everything is integer pence,
 *    but a spreadsheet column of "1250" when you meant £12.50 is a
 *    genuinely expensive mistake at tax time.
 */
const RISKY_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (RISKY_PREFIX.test(text)) {
    text = `'${text}`;
  }
  // Quote if it contains a delimiter, quote or newline; double any quotes.
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Integer pence → "12.50", the form a spreadsheet and an accountant want. */
export function penceToDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return (value / 100).toFixed(2);
}

/** ISO timestamp → "2026-07-28", which sorts correctly in every locale. */
export function isoToDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(","));
  }
  // CRLF and a UTF-8 BOM: Excel on Windows mangles pound signs without them.
  return `﻿${lines.join("\r\n")}\r\n`;
}
