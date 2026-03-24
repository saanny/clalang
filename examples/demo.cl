// === clalang — Full Demo ===
// Exercises all 8 phases

// ── Phase 4: Struct ──
type Point {
  x: f64
  y: f64
}

// ── Phase 4: Simple Enum ──
type Color = Red | Green | Blue

// ── Phase 4: Data Enum ──
type Shape = Circle(radius: f64) | Rect(w: f64, h: f64)

// ── Phase 4: Pattern Matching on data enum ──
fn area(s: Shape) -> f64 {
  match s {
    Circle(r) => 3.14159 * r * r
    Rect(w, h) => w * h
  }
}

// ── Phase 4: Pattern Matching on simple enum ──
fn color_name(c: Color) -> str {
  match c {
    Red => "red"
    Green => "green"
    Blue => "blue"
  }
}

// ── Phase 5: Functions for pipeline ──
fn double_val(x: i32) -> i32 {
  return x * 2
}

fn add_one(x: i32) -> i32 {
  return x + 1
}

// ── Phase 6: Result types ──
fn divide(a: f64, b: f64) -> f64 ! str {
  if b == 0.0 {
    return Err("division by zero")
  }
  return Ok(a / b)
}

fn safe_calc(a: f64, b: f64, c: f64) -> f64 ! str {
  let ab = try divide(a, b)
  let result = try divide(ab, c)
  return Ok(result)
}

fn main() {
  std.print("=== clalang Full Demo ===")

  // ── Phase 4: Structs ──
  std.print("")
  std.print("--- Structs ---")
  let p = Point { x: 3.0, y: 4.0 }
  let dist = sqrt(p.x * p.x + p.y * p.y)
  std.print("Point ({p.x}, {p.y}), distance = {dist}")

  // ── Phase 4: Enums + Match ──
  std.print("")
  std.print("--- Enums + Pattern Matching ---")
  let c = Circle(5.0)
  let r = Rect(3.0, 4.0)
  let ca = area(c)
  let ra = area(r)
  std.print("Circle area: {ca}")
  std.print("Rect area: {ra}")

  let color = Green
  let cname = color_name(color)
  std.print("Color: {cname}")

  // ── Phase 5: Pipelines ──
  std.print("")
  std.print("--- Pipelines ---")
  let piped = 5 |> double_val() |> add_one()
  std.print("5 |> double |> add_one = {piped}")

  // ── Phase 6: Result types + try ──
  std.print("")
  std.print("--- Result Types ---")
  match divide(10.0, 3.0) {
    Ok(v) => std.print("10 / 3 = {v}")
    Err(e) => std.print("Error: {e}")
  }

  match divide(10.0, 0.0) {
    Ok(v) => std.print("10 / 0 = {v}")
    Err(e) => std.print("Error: {e}")
  }

  match safe_calc(100.0, 5.0, 4.0) {
    Ok(v) => std.print("100/5/4 = {v}")
    Err(e) => std.print("Calc error: {e}")
  }

  match safe_calc(100.0, 0.0, 4.0) {
    Ok(v) => std.print("100/0/4 = {v}")
    Err(e) => std.print("Calc error: {e}")
  }

  // ── Phase 7: Standard Library ──
  std.print("")
  std.print("--- Standard Library ---")
  let s = "Hello, clalang!"
  let slen = str_len(s)
  std.print("String \"{s}\" length = {slen}")

  let sq = sqrt(144.0)
  std.print("sqrt(144) = {sq}")

  // ── Phase 3: Type checking ──
  std.print("")
  std.print("--- While + For loops ---")
  let mut i = 0
  while i < 3 {
    std.print("while i = {i}")
    i = i + 1
  }

  for j in 0..3 {
    std.print("for j = {j}")
  }

  // ── Phase 8: Concurrency ──
  std.print("")
  std.print("--- Concurrency ---")
  let ch = channel()
  spawn {
    ch.send(42)
  }
  let val = ch.recv()
  std.print("Channel received: {val}")

  std.print("")
  std.print("=== All phases complete! ===")
}
