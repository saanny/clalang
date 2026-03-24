// Pipelines — flat data flow replaces nested calls
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// Nested calls are the #1 source of LLM bracket errors:
//   result = square(add_one(double(add_one(5))))  ← easy to miscount parens
//
// Pipelines read left-to-right, one step per line:
//   result = 5 |> add_one() |> double() |> add_one() |> square()
//
// Claude generates each step independently — no bracket balancing needed.

fn add_one(x: i32) -> i32 { return x + 1 }
fn dbl(x: i32) -> i32 { return x * 2 }
fn square(x: i32) -> i32 { return x * x }
fn negate(x: i32) -> i32 { return 0 - x }

fn main() {
  std.print("=== Pipelines ===")
  std.print("")

  // Without pipeline (nested, error-prone):
  // square(add_one(double(add_one(5))))
  //
  // With pipeline (flat, readable):
  let result = 5
    |> add_one()
    |> dbl()
    |> add_one()
    |> square()

  std.print("5 |> +1 |> *2 |> +1 |> ^2 = {result}")

  // Step by step trace
  std.print("")
  std.print("Step by step:")
  let a = 5
  std.print("  start:  {a}")
  let b = a |> add_one()
  std.print("  +1:     {b}")
  let c = b |> dbl()
  std.print("  *2:     {c}")
  let d = c |> add_one()
  std.print("  +1:     {d}")
  let e = d |> square()
  std.print("  ^2:     {e}")

  // Chaining math transforms
  std.print("")
  let neg = 42 |> negate()
  std.print("negate(42) = {neg}")
}
