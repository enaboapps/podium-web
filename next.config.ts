import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // mammoth has no exports map so Turbopack misses its browser field.
      // Alias the Node.js-only unzip to the browser build explicitly.
      'mammoth/lib/unzip': path.resolve('./node_modules/mammoth/browser/unzip.js'),
      'mammoth/lib/docx/files': path.resolve('./node_modules/mammoth/browser/docx/files.js'),
    },
  },
};

export default nextConfig;
