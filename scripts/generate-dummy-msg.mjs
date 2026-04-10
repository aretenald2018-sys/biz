/**
 * 더미 .msg 파일 생성 스크립트
 * - 인라인 이미지 (1x1 red PNG)
 * - HTML 본문에 하이퍼링크
 * - 첨부파일 (sample.pdf placeholder)
 *
 * Usage: node scripts/generate-dummy-msg.mjs
 */

import CFB from "cfb";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "test-emails");

// ── helpers ──────────────────────────────────────────────────────────

/** Encode a JS string to UTF-16LE Buffer (msg property format) */
function utf16le(str) {
  const buf = Buffer.alloc(str.length * 2 + 2); // +2 for null terminator
  for (let i = 0; i < str.length; i++) {
    buf.writeUInt16LE(str.charCodeAt(i), i * 2);
  }
  buf.writeUInt16LE(0, str.length * 2);
  return buf;
}

/** 32-bit little-endian */
function int32(v) {
  const b = Buffer.alloc(4);
  b.writeInt32LE(v);
  return b;
}

/** 64-bit FILETIME (100-ns intervals since 1601-01-01) */
function filetime(date) {
  const EPOCH_DIFF = 116444736000000000n; // 1601→1970 in 100ns
  const ft = BigInt(date.getTime()) * 10000n + EPOCH_DIFF;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(ft);
  return buf;
}

/** Minimal 1×1 red pixel PNG */
function redPixelPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8" +
      "/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==",
    "base64"
  );
}

/** Minimal PDF (placeholder attachment) */
function samplePdf() {
  const content =
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n" +
    "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 100 700 Td (Dummy PDF) Tj ET\nendstream\nendobj\n" +
    "xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n" +
    "0000000115 00000 n \n0000000210 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n306\n%%EOF";
  return Buffer.from(content, "ascii");
}

// ── MSG property IDs ─────────────────────────────────────────────────
// https://docs.microsoft.com/en-us/office/client-developer/outlook/mapi/mapi-property-tags
const PT_UNICODE = 0x001f;
const PT_BINARY = 0x0102;
const PT_LONG = 0x0003;
const PT_SYSTIME = 0x0040;
const PT_BOOLEAN = 0x000b;

const PR_MESSAGE_CLASS = 0x001a;
const PR_SUBJECT = 0x0037;
const PR_SENDER_NAME = 0x0c1a;
const PR_SENDER_EMAIL = 0x0c1f;
const PR_DISPLAY_TO = 0x0e04;
const PR_BODY = 0x1000;
const PR_BODY_HTML = 0x1013; // PT_UNICODE for HTML
const PR_CLIENT_SUBMIT_TIME = 0x0039;
const PR_MESSAGE_DELIVERY_TIME = 0x0e06;

// Attachment properties
const PR_ATTACH_FILENAME = 0x3704;
const PR_ATTACH_LONG_FILENAME = 0x3707;
const PR_ATTACH_DATA = 0x3701;
const PR_ATTACH_METHOD = 0x3705;
const PR_ATTACH_MIME_TAG = 0x370e;
const PR_ATTACH_CONTENT_ID = 0x3712;
const PR_RENDERING_POSITION = 0x370b;
const PR_ATTACH_NUM = 0x0e21;

const ATTACH_BY_VALUE = 1;

// ── Build CFB ────────────────────────────────────────────────────────

function propStreamName(propId, propType) {
  return `__substg1.0_${propId.toString(16).toUpperCase().padStart(4, "0")}${propType.toString(16).toUpperCase().padStart(4, "0")}`;
}

const cfb = CFB.utils.cfb_new();

const now = new Date("2026-04-10T09:30:00+0900");

// Root message properties
const rootProps = [
  [PR_MESSAGE_CLASS, PT_UNICODE, utf16le("IPM.Note")],
  [PR_SUBJECT, PT_UNICODE, utf16le("[테스트] 이미지·링크·첨부 포함 더미 메일")],
  [PR_SENDER_NAME, PT_UNICODE, utf16le("김태현")],
  [PR_SENDER_EMAIL, PT_UNICODE, utf16le("taehyun.kim@company.co.kr")],
  [PR_DISPLAY_TO, PT_UNICODE, utf16le("박성현; 이정현")],
  [
    PR_BODY,
    PT_UNICODE,
    utf16le(
      "안녕하세요,\n\n첨부된 보고서를 확인 부탁드립니다.\n이미지와 링크도 본문에 포함되어 있습니다.\n\n감사합니다."
    ),
  ],
  [
    PR_BODY_HTML,
    PT_UNICODE,
    utf16le(
      `<html><head><meta charset="utf-8"></head><body>
<p>안녕하세요,</p>
<p>첨부된 보고서를 확인 부탁드립니다.</p>
<p><img src="cid:inline-image-001" alt="sample image" width="200" height="200" style="border:1px solid #ccc;"></p>
<p>참고 링크: <a href="https://finance.naver.com">네이버 금융</a></p>
<p>감사합니다.</p>
</body></html>`
    ),
  ],
  [PR_CLIENT_SUBMIT_TIME, PT_SYSTIME, filetime(now)],
  [PR_MESSAGE_DELIVERY_TIME, PT_SYSTIME, filetime(now)],
];

for (const [propId, propType, data] of rootProps) {
  CFB.utils.cfb_add(cfb, `/${propStreamName(propId, propType)}`, data);
}

// ── Attachment 0: inline image ───────────────────────────────────────
const att0 = "/__attach_version1.0_#00000000";
const imgData = redPixelPng();

const att0Props = [
  [PR_ATTACH_FILENAME, PT_UNICODE, utf16le("inline-image.png")],
  [PR_ATTACH_LONG_FILENAME, PT_UNICODE, utf16le("inline-image.png")],
  [PR_ATTACH_DATA, PT_BINARY, imgData],
  [PR_ATTACH_METHOD, PT_LONG, int32(ATTACH_BY_VALUE)],
  [PR_ATTACH_MIME_TAG, PT_UNICODE, utf16le("image/png")],
  [PR_ATTACH_CONTENT_ID, PT_UNICODE, utf16le("inline-image-001")],
  [PR_RENDERING_POSITION, PT_LONG, int32(-1)],
  [PR_ATTACH_NUM, PT_LONG, int32(0)],
];

for (const [propId, propType, data] of att0Props) {
  CFB.utils.cfb_add(cfb, `${att0}/${propStreamName(propId, propType)}`, data);
}

// ── Attachment 1: PDF file attachment ────────────────────────────────
const att1 = "/__attach_version1.0_#00000001";
const pdfData = samplePdf();

const att1Props = [
  [PR_ATTACH_FILENAME, PT_UNICODE, utf16le("2026-Q1-보고서.pdf")],
  [PR_ATTACH_LONG_FILENAME, PT_UNICODE, utf16le("2026-Q1-보고서.pdf")],
  [PR_ATTACH_DATA, PT_BINARY, pdfData],
  [PR_ATTACH_METHOD, PT_LONG, int32(ATTACH_BY_VALUE)],
  [PR_ATTACH_MIME_TAG, PT_UNICODE, utf16le("application/pdf")],
  [PR_RENDERING_POSITION, PT_LONG, int32(-1)],
  [PR_ATTACH_NUM, PT_LONG, int32(1)],
];

for (const [propId, propType, data] of att1Props) {
  CFB.utils.cfb_add(cfb, `${att1}/${propStreamName(propId, propType)}`, data);
}

// ── Write to file ────────────────────────────────────────────────────
const outPath = join(OUT_DIR, "dummy-with-attachments.msg");
const buf = CFB.write(cfb, { type: "buffer" });
writeFileSync(outPath, buf);

console.log(`✔ Created: ${outPath}`);
console.log(`  Size: ${buf.length} bytes`);
console.log(`  Subject: [테스트] 이미지·링크·첨부 포함 더미 메일`);
console.log(`  Attachments: inline-image.png (inline), 2026-Q1-보고서.pdf`);
