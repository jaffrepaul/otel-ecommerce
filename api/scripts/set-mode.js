#!/usr/bin/env node

/**
 * Script to switch between OpenTelemetry modes
 * Usage:
 *   node scripts/set-mode.js direct
 *   node scripts/set-mode.js collector
 *   node scripts/set-mode.js status
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const envPath = join(rootDir, '.env');

const mode = process.argv[2];

if (!mode || !['direct', 'collector', 'status'].includes(mode)) {
  console.error('Usage: node scripts/set-mode.js [direct|collector|status]');
  process.exit(1);
}

// Read current .env file
let envContent = '';
try {
  envContent = readFileSync(envPath, 'utf8');
} catch (error) {
  console.error('❌ Error: .env file not found. Please create one from .env.example');
  process.exit(1);
}

// Parse current mode
const currentModeMatch = envContent.match(/^OTEL_MODE=(.*)$/m);
const currentMode = currentModeMatch ? currentModeMatch[1].trim() : 'direct';

if (mode === 'status') {
  console.log('');
  console.log(`Current mode: ${currentMode.toUpperCase()}`);
  console.log('');
  
  if (currentMode === 'direct') {
    console.log('App → Sentry');
  } else {
    console.log('App → Collector → Sentry');
  }
  
  console.log('');
  console.log('Switch modes:');
  console.log('  npm run mode:direct');
  console.log('  npm run mode:collector');
  console.log('');
  
  process.exit(0);
}

// Update or add OTEL_MODE
if (currentModeMatch) {
  // Replace existing
  envContent = envContent.replace(/^OTEL_MODE=.*$/m, `OTEL_MODE=${mode}`);
} else {
  // Add new line at the end
  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }
  envContent += `\n# OpenTelemetry Mode: 'direct' or 'collector'\nOTEL_MODE=${mode}\n`;
}

// Write back to .env
writeFileSync(envPath, envContent, 'utf8');

console.log('');
console.log(`✅ Switched to ${mode.toUpperCase()} mode`);
console.log('');

if (mode === 'direct') {
  console.log('Next: npm start');
  console.log('Look for: "📡 Mode: DIRECT"');
  
} else if (mode === 'collector') {
  console.log('Next:');
  console.log('  1. Ensure .env has:');
  console.log('     OTEL_EXPORTER_OTLP_ENDPOINT=https://YOUR-ORG.ingest.us.sentry.io');
  console.log('     SENTRY_AUTH_HEADER=sentry_key=YOUR_PUBLIC_KEY,sentry_version=7');
  console.log('  2. npm run collector:start');
  console.log('  3. npm start');
  console.log('');
  console.log('Look for: "📡 Mode: COLLECTOR"');
}

console.log('');

