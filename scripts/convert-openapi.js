#!/usr/bin/env node
/**
 * Convert an OpenAPI spec to a Bruno collection directory.
 *
 * Usage:
 *   node scripts/convert-openapi.js <input.[yaml|json]> <output-dir> [--group-by tags|path]
 *
 * Examples:
 *   node scripts/convert-openapi.js my-api.yaml ~/Desktop/my-collection
 *   node scripts/convert-openapi.js my-api.yaml ./out --group-by path
 *
 * Runs directly against the monorepo source — no build step needed.
 */

'use strict';

// Transpile ES modules (converters) and TypeScript (filestore) on the fly.
require('@babel/register')({
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript'
  ],
  extensions: ['.js', '.ts'],
  ignore: [/node_modules/]
});

const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
const chalk = require('chalk');

const openApiToBruno = require('../packages/bruno-converters/src/openapi/openapi-to-bruno.js').default;
const { stringifyCollection, stringifyFolder, stringifyRequest, stringifyEnvironment } = require('../packages/bruno-filestore/src/index.ts');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const groupByIdx = args.indexOf('--group-by');
const groupBy = groupByIdx !== -1 ? args.splice(groupByIdx, 2)[1] : 'tags';
const [inputFile, outputDir] = args;

if (!inputFile || !outputDir) {
  console.error(chalk.red('Usage: node scripts/convert-openapi.js <input> <output-dir> [--group-by tags|path]'));
  process.exit(1);
}

if (!['tags', 'path'].includes(groupBy)) {
  console.error(chalk.red('--group-by must be "tags" or "path"'));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read & parse the input spec
// ---------------------------------------------------------------------------

const inputPath = path.resolve(inputFile);
if (!fs.existsSync(inputPath)) {
  console.error(chalk.red(`File not found: ${inputPath}`));
  process.exit(1);
}

console.log(chalk.yellow(`Reading spec from ${inputPath}...`));
const raw = fs.readFileSync(inputPath, 'utf8');

let spec;
try {
  spec = JSON.parse(raw);
} catch {
  try {
    spec = jsyaml.load(raw);
  } catch {
    console.error(chalk.red('Failed to parse input as JSON or YAML'));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Convert
// ---------------------------------------------------------------------------

console.log(chalk.yellow('Converting to Bruno format...'));
const collection = openApiToBruno(spec, { groupBy });

// ---------------------------------------------------------------------------
// Write collection to disk
// ---------------------------------------------------------------------------

const sanitizeName = (name = '') =>
  name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const resolvedOutput = path.resolve(outputDir);
fs.mkdirSync(resolvedOutput, { recursive: true });

// Write bruno.json + collection.bru
const brunoConfig = {
  version: '1',
  name: collection.name,
  type: 'collection',
  ignore: ['node_modules', '.git']
};

fs.writeFileSync(path.join(resolvedOutput, 'bruno.json'), JSON.stringify(brunoConfig, null, 2));

if (collection.root) {
  const collectionContent = stringifyCollection(collection.root || {}, brunoConfig, { format: 'bru' });
  fs.writeFileSync(path.join(resolvedOutput, 'collection.bru'), collectionContent);
}

// Write environments
if (collection.environments?.length) {
  const envDir = path.join(resolvedOutput, 'environments');
  fs.mkdirSync(envDir, { recursive: true });
  for (const env of collection.environments) {
    const filename = sanitizeName(`${env.name}.bru`);
    fs.writeFileSync(path.join(envDir, filename), stringifyEnvironment(env, { format: 'bru' }));
  }
}

// Recursively write items
const writeItems = (items = [], dir) => {
  let seq = 1;
  for (const item of items) {
    if (item.type === 'folder') {
      const folderDir = path.join(dir, sanitizeName(item.name));
      fs.mkdirSync(folderDir, { recursive: true });

      if (item.root?.meta?.name) {
        const root = { ...item.root, meta: { ...item.root.meta, seq: seq++ } };
        fs.writeFileSync(path.join(folderDir, 'folder.bru'), stringifyFolder(root, { format: 'bru' }));
      }

      writeItems(item.items, folderDir);
    } else if (item.type === 'http-request' || item.type === 'graphql-request') {
      const filename = sanitizeName(`${item.name}.bru`);
      const itemJson = {
        type: item.type,
        name: item.name,
        seq: seq++,
        tags: item.tags || [],
        settings: {},
        request: {
          method: item.request?.method || 'GET',
          url: item.request?.url || '',
          headers: item.request?.headers || [],
          params: item.request?.params || [],
          auth: item.request?.auth || {},
          body: item.request?.body || {},
          script: item.request?.script || {},
          vars: item.request?.vars || { req: [], res: [] },
          assertions: item.request?.assertions || [],
          tests: item.request?.tests || '',
          docs: item.request?.docs || ''
        },
        examples: item.examples || []
      };
      fs.writeFileSync(path.join(dir, filename), stringifyRequest(itemJson, { format: 'bru' }));
    }
  }
};

writeItems(collection.items, resolvedOutput);

console.log(chalk.green(`\nCollection "${collection.name}" written to: ${resolvedOutput}`));
console.log(chalk.green(`  Items: ${collection.items?.length ?? 0} top-level entries`));
console.log(chalk.cyan('\nOpen Bruno and use File → Open Collection to load it.'));
