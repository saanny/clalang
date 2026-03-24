#!/usr/bin/env node
// clalang — CLI
// Usage:
//   clear build <file.cl>       Compile to native binary
//   clear run <file.cl>         Compile and run
//   clear emit <file.cl>        Print generated C code
//   clear check <file.cl>       Type check only

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Lexer } = require('./lexer');
const { parse } = require('./parser');
const { typecheck } = require('./typechecker');
const { generate } = require('./codegen');

const args = process.argv.slice(2);
const command = args[0];
const inputFile = args[1];

if (!command || !inputFile) {
  console.log('clalang Compiler v0.2.0');
  console.log('');
  console.log('Usage:');
  console.log('  node src/cli.js build <file.cl>   Compile to native binary');
  console.log('  node src/cli.js run <file.cl>     Compile and run');
  console.log('  node src/cli.js emit <file.cl>    Print generated C code');
  console.log('  node src/cli.js check <file.cl>   Type check only');
  process.exit(0);
}

const sourcePath = path.resolve(inputFile);
if (!fs.existsSync(sourcePath)) {
  console.error(`Error: File not found: ${sourcePath}`);
  process.exit(1);
}
const source = fs.readFileSync(sourcePath, 'utf-8');

try {
  // Lex
  const tokens = new Lexer(source).tokenize();

  // Parse
  const ast = parse(tokens);

  // Type check
  const { errors, warnings } = typecheck(ast);
  for (const w of warnings) console.warn(`Warning: ${w.message}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(`Error: ${e.message}`);
    if (command !== 'emit') process.exit(1);
  }

  if (command === 'check') {
    console.log(errors.length === 0 ? 'No errors found.' : `${errors.length} error(s) found.`);
    process.exit(errors.length > 0 ? 1 : 0);
  }

  // Codegen
  const cCode = generate(ast);

  if (command === 'emit') {
    console.log(cCode);
    process.exit(0);
  }

  // Write C and compile
  const baseName = path.basename(inputFile, '.cl');
  const runtimeDir = path.join(__dirname, '..', 'runtime');
  const outDir = path.join(path.dirname(sourcePath), 'build');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const cFile = path.join(outDir, `${baseName}.c`);
  const binFile = path.join(outDir, baseName);
  fs.writeFileSync(cFile, cCode);

  const cc = process.env.CC || 'cc';
  const compileCmd = `${cc} -std=c11 -O2 -I${runtimeDir} -o ${binFile} ${cFile} -lm -lpthread`;

  try {
    execSync(compileCmd, { stdio: 'pipe' });
  } catch (e) {
    console.error('C compilation failed:');
    console.error(e.stderr?.toString() || e.message);
    console.error('\nGenerated C code:');
    console.error(cCode);
    process.exit(1);
  }

  console.log(`Compiled: ${binFile}`);

  if (command === 'run') {
    try {
      const result = execSync(binFile, { stdio: 'pipe', encoding: 'utf-8' });
      process.stdout.write(result);
    } catch (e) {
      process.stdout.write(e.stdout || '');
      process.stderr.write(e.stderr || '');
      process.exit(e.status || 1);
    }
  }
} catch (e) {
  console.error(`Compile error: ${e.message}`);
  process.exit(1);
}
