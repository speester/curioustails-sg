import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/**
 * Parse one CSV line respecting double-quoted fields (commas inside quotes,
 * doubled quotes as escapes). The old naive split() leaked literal quote
 * characters into GBP post titles and truncated notes at the first comma.
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current.trim());
  return values;
}

export function parseCSV(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error(`CSV file ${filePath} has no data rows`);
  }

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines

    const values = parseCSVLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

export function filterBlogRows(rows) {
  return rows.filter(row => row.page_type === 'blog');
}

export function extractDayNumber(notesText) {
  if (!notesText) return 0;
  const match = notesText.match(/Day\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function findNextBlog(blogRows) {
  // Find the maximum Day X that exists
  const maxDay = Math.max(...blogRows.map(row => extractDayNumber(row.notes)), 0);
  const nextDay = maxDay + 1;

  // Find the blog for nextDay
  const nextBlog = blogRows.find(row => extractDayNumber(row.notes) === nextDay);

  return {
    nextDay,
    nextBlog,
    isComplete: nextBlog === undefined,
  };
}

export function extractMetadata(blogRow) {
  if (!blogRow) {
    return null;
  }

  const dayNumber = extractDayNumber(blogRow.notes);

  return {
    dayNumber,
    title: blogRow.title,
    h1: blogRow.h1,
    targetKeyword: blogRow.target_keyword,
    searchVolume: parseInt(blogRow.search_volume) || 0,
    urlSlug: blogRow.url_slug,
    pageType: blogRow.page_type,
    intent: blogRow.intent,
    notes: blogRow.notes,
  };
}

export function validateBlogMetadata(metadata) {
  const required = ['title', 'h1', 'targetKeyword', 'urlSlug'];
  const missing = required.filter(field => !metadata[field]);

  if (missing.length > 0) {
    throw new Error(`Blog metadata missing required fields: ${missing.join(', ')}`);
  }

  return true;
}
