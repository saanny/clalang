# clalang

**clalang** — A fast, compiled programming language optimized for LLM + human collaboration.

clalang compiles to C, then to native binaries. It's designed to be simple, unambiguous, and easy for both humans and AI to read and write.

## Features

- **Compiles to native code** via C (gcc/clang) — real speed, not interpreted
- **Simple, minimal syntax** — one way to do each thing, no ambiguity
- **Type inference** — strong types without verbose annotations
- **Structs & enums** — algebraic data types with pattern matching
- **Result types** — `-> T ! E` with `try` error propagation, no exceptions
- **Pipelines** — `|>` operator for flat, readable data flow
- **String interpolation** — `"hello {name}"` built-in
- **Closures** — lambdas as first-class values
- **Concurrency** — `spawn` blocks and channels with send/recv
- **Immutable by default** — `let` is const, `let mut` for mutable

## Quick Start

```bash
# Clone
git clone https://github.com/saanny/clalang.git
cd clalang

# Run a program
node src/cli.js run examples/hello.cl

# Compile to binary
node src/cli.js build examples/demo.cl

# See generated C code
node src/cli.js emit examples/demo.cl

# Type check only
node src/cli.js check examples/demo.cl
```

Requires: Node.js and a C compiler (gcc or clang).

## Language Tour

### Variables & Types

```clear
let name = "Clear"         // immutable, type inferred as str
let x: i32 = 42            // explicit type
let mut counter = 0         // mutable
counter = counter + 1

// Types: i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 bool str
```

### Functions

```clear
fn add(a: i32, b: i32) -> i32 {
  return a + b
}

fn greet(name: str) {
  std.print("Hello, {name}!")
}
```

### Structs

```clear
type Point {
  x: f64
  y: f64
}

let p = Point { x: 3.0, y: 4.0 }
std.print("({p.x}, {p.y})")
```

### Enums & Pattern Matching

```clear
type Shape = Circle(radius: f64) | Rect(w: f64, h: f64)

fn area(s: Shape) -> f64 {
  match s {
    Circle(r) => 3.14159 * r * r
    Rect(w, h) => w * h
  }
}

// Simple enums (no data)
type Color = Red | Green | Blue
```

### Result Types & Error Handling

```clear
fn divide(a: f64, b: f64) -> f64 ! str {
  if b == 0.0 {
    return Err("division by zero")
  }
  return Ok(a / b)
}

// try propagates errors automatically
fn calc(a: f64, b: f64, c: f64) -> f64 ! str {
  let ab = try divide(a, b)
  let result = try divide(ab, c)
  return Ok(result)
}

// Match on results
match divide(10.0, 3.0) {
  Ok(v) => std.print("Result: {v}")
  Err(e) => std.print("Error: {e}")
}
```

### Pipelines

```clear
fn double(x: i32) -> i32 { return x * 2 }
fn square(x: i32) -> i32 { return x * x }

let result = 5 |> double() |> square()
// result = 100
```

### Concurrency

```clear
let ch = channel()

spawn {
  ch.send(42)
}

let val = ch.recv()
std.print("Got: {val}")
```

### Loops

```clear
// While
let mut i = 0
while i < 5 {
  std.print("i = {i}")
  i = i + 1
}

// For range
for j in 0..5 {
  std.print("j = {j}")
}
```

## Architecture

```
Source (.cl) → Lexer → Parser → Type Checker → C Codegen → gcc/clang → Native Binary
```

| File | Purpose |
|------|---------|
| `src/lexer.js` | Tokenizer with auto-semicolons |
| `src/parser.js` | Recursive descent parser → AST |
| `src/typechecker.js` | Type validation pass |
| `src/codegen.js` | AST → C code generator |
| `src/cli.js` | CLI: build, run, emit, check |
| `runtime/clear.h` | C runtime (strings, arrays, channels, threads) |

## Why "clalang"?

**cla** = Claude + Language. Built as an experiment in LLM-optimized language design:

- **Minimal syntax** → fewer tokens to generate, fewer errors
- **No ambiguity** → one obvious way to write each construct
- **Explicit semantics** → no hidden behavior or implicit conversions
- **Flat code** → pipelines and guard clauses instead of deep nesting
- **Forced error handling** → result types make it impossible to forget errors

## License

MIT
