import * as mammoth from 'mammoth';

/** Extract paragraphs from a .docx or .pdf file. Returns non-empty trimmed strings. */
export async function parseFile(file: File): Promise<string[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'docx') {
    return parseDocx(file);
  } else if (ext === 'pdf') {
    return parsePdf(file);
  }

  throw new Error('Unsupported file type. Please use .docx or .pdf');
}

async function parseDocx(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return splitParagraphs(result.value);
}

async function parsePdf(file: File): Promise<string[]> {
  // Dynamic import keeps pdfjs out of the initial bundle
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  return splitParagraphs(pages.join('\n\n'));
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}
