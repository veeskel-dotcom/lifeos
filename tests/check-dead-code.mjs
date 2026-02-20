/**
 * Dead Code Finder — static analysis for unused components/exports.
 * No Playwright needed — pure Node.js file scan.
 * Run: node tests/check-dead-code.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, basename, relative } from 'path';

const ROOT = resolve(process.cwd());
const SRC_DIRS = ['components', 'screens', 'hooks', 'utils', 'services', 'ai', 'db', 'lib', 'theme', 'security'];

// Recursively get all .js/.jsx files
function getAllFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory()) {
          files.push(...getAllFiles(full));
        } else if (/\.(jsx?|mjs)$/.test(entry) && !entry.startsWith('_')) {
          files.push(full);
        }
      } catch {}
    }
  } catch {}
  return files;
}

// Extract default export name from file content
function getDefaultExportName(content, filePath) {
  // export default function Foo(
  const fnMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (fnMatch) return fnMatch[1];

  // export default class Foo
  const clsMatch = content.match(/export\s+default\s+class\s+(\w+)/);
  if (clsMatch) return clsMatch[1];

  // Fallback: use filename without extension
  const name = basename(filePath).replace(/\.(jsx?|mjs)$/, '');
  if (name === 'index') return null; // Skip index files
  return null; // Only count explicit named exports
}

// Extract named exports
function getNamedExports(content) {
  const names = [];
  // export function Foo
  for (const m of content.matchAll(/export\s+function\s+(\w+)/g)) {
    names.push(m[1]);
  }
  // export const Foo
  for (const m of content.matchAll(/export\s+const\s+(\w+)/g)) {
    names.push(m[1]);
  }
  // export { Foo, Bar }
  for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of m[1].split(',')) {
      const clean = name.trim().split(/\s+as\s+/).pop().trim();
      if (clean && /^[A-Z]/.test(clean)) names.push(clean);
    }
  }
  return names;
}

function run() {
  console.log('============================================================');
  console.log('  Dead Code Finder (static analysis)');
  console.log('============================================================\n');

  // Collect all source files
  const allFiles = [];
  for (const dir of SRC_DIRS) {
    allFiles.push(...getAllFiles(join(ROOT, dir)));
  }
  // Also include App.jsx
  allFiles.push(join(ROOT, 'App.jsx'));

  // Read all file contents into one big searchable string (for import checking)
  const allContents = new Map();
  let allText = '';
  for (const f of allFiles) {
    try {
      const content = readFileSync(f, 'utf-8');
      allContents.set(f, content);
      allText += content + '\n';
    } catch {}
  }

  // Build export registry: { name, file, type }
  const exports = [];
  for (const [file, content] of allContents) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');

    // Skip test files, index re-exports
    if (rel.startsWith('tests/')) continue;

    const defName = getDefaultExportName(content, file);
    if (defName) {
      exports.push({ name: defName, file: rel, type: 'default' });
    }

    for (const name of getNamedExports(content)) {
      // Skip common non-component exports
      if (/^(use|get|set|add|update|delete|create|toggle|mark|log|check|load|save|init|run|emit|format|parse|calculate)/.test(name)) continue;
      exports.push({ name, file: rel, type: 'named' });
    }
  }

  // Check each export: count how many files import it
  const dead = [];
  for (const exp of exports) {
    // Count occurrences of the name in import statements across all files
    // Pattern: import ... Name ... from or import { ... Name ... }
    const importRegex = new RegExp(`import\\s[^;]*\\b${exp.name}\\b[^;]*from`, 'g');
    const matches = allText.match(importRegex) || [];

    // Subtract self-import (file importing itself is not a real consumer)
    const selfContent = allContents.get(join(ROOT, exp.file)) || '';
    const selfMatches = selfContent.match(importRegex) || [];
    const externalImports = matches.length - selfMatches.length;

    // Also check JSX usage: <Name or {Name} — but only in other files
    // Skip this — import check is sufficient

    if (externalImports === 0) {
      dead.push(exp);
    }
  }

  // Report
  if (dead.length > 0) {
    console.log(`  Found ${dead.length} unused exports:\n`);
    // Group by directory
    const byDir = {};
    for (const d of dead) {
      const dir = d.file.split('/')[0];
      if (!byDir[dir]) byDir[dir] = [];
      byDir[dir].push(d);
    }
    for (const [dir, items] of Object.entries(byDir).sort()) {
      console.log(`  ${dir}/`);
      for (const d of items) {
        console.log(`    ${d.type === 'default' ? 'default' : 'named '} ${d.name.padEnd(25)} ${d.file}`);
      }
    }
  } else {
    console.log('  No unused exports found!');
  }

  console.log('\n============================================================');
  console.log(`  Total exports checked: ${exports.length}`);
  console.log(`  Unused: ${dead.length}`);
  console.log('============================================================\n');
}

run();
