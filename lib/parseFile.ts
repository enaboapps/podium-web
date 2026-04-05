import * as mammoth from 'mammoth';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Extract paragraphs from a .docx or .pdf file. Returns non-empty trimmed strings. */
export async function parseFile(file: File): Promise<string[]> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
  }

  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'docx') {
    return parseDocx(file);
  } else if (ext === 'pdf') {
    return parsePdf(file);
  }

  throw new Error('Unsupported file type. Please use .docx or .pdf');
}

/** Split an array of paragraphs into individual sentences using Intl.Segmenter. */
export function splitIntoSentences(paragraphs: string[]): string[] {
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  const sentences: string[] = [];

  for (const para of paragraphs) {
    for (const { segment } of segmenter.segment(para)) {
      const s = segment.trim();
      if (s.length > 0) sentences.push(s);
    }
  }

  return sentences;
}

/** Join paragraphs into a single full-text string. */
export function joinFullText(paragraphs: string[]): string {
  return paragraphs.join('\n\n');
}

// --- DOCX ---

async function parseDocx(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return splitParagraphs(result.value);
}

// --- PDF ---

async function parsePdf(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allParagraphs: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = groupIntoLines(content.items);
    const paragraphs = groupIntoParagraphs(lines);
    allParagraphs.push(...paragraphs);
  }

  return allParagraphs.filter((p) => p.trim().length > 0);
}

// --- PDF positional helpers ---

interface TextLine {
  y: number;
  text: string;
}

function groupIntoLines(items: object[]): TextLine[] {
  const textItems = items.filter(
    (item): item is { str: string; transform: number[] } =>
      'str' in item && typeof (item as { str: unknown }).str === 'string'
  );

  if (textItems.length === 0) return [];

  textItems.sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 2) return yDiff;
    return a.transform[4] - b.transform[4];
  });

  const lines: TextLine[] = [];
  let currentY = textItems[0].transform[5];
  let parts: string[] = [textItems[0].str];

  for (let i = 1; i < textItems.length; i++) {
    const { str, transform } = textItems[i];
    const y = transform[5];

    if (Math.abs(y - currentY) < 3) {
      parts.push(str);
    } else {
      const text = parts.join('').replace(/\s+/g, ' ').trim();
      if (text) lines.push({ y: currentY, text });
      currentY = y;
      parts = [str];
    }
  }

  const last = parts.join('').replace(/\s+/g, ' ').trim();
  if (last) lines.push({ y: currentY, text: last });

  return lines;
}

function groupIntoParagraphs(lines: TextLine[]): string[] {
  if (lines.length === 0) return [];
  if (lines.length === 1) return [lines[0].text];

  const gaps = lines.slice(1).map((line, i) => lines[i].y - line.y);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const threshold = median * 1.8;

  const paragraphs: string[] = [];
  let current: string[] = [lines[0].text];

  for (let i = 1; i < lines.length; i++) {
    if (gaps[i - 1] > threshold) {
      paragraphs.push(current.join(' ').trim());
      current = [lines[i].text];
    } else {
      current.push(lines[i].text);
    }
  }
  paragraphs.push(current.join(' ').trim());

  return paragraphs;
}

// --- DOCX helper ---

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}
