import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f !== 'runAll.test.js');
const testFiles = files.map(f => path.join(__dirname, f));

console.log(`Executing global node:test wrapper across: ${files.join(', ')}`);

const stream = run({ files: testFiles, concurrency: false });

stream.on('test:fail', () => { process.exitCode = 1; });
stream.compose(new spec()).pipe(process.stdout);
