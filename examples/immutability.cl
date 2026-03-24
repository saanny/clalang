// Immutability — why default const matters for LLMs
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// LLMs lose track of mutable state after 5+ mutations.
// When everything is immutable by default, Claude can reason about
// values at any point — they don't change.
//
// 'let mut' is an explicit signal: "this WILL change, pay attention."
// In JS/Python, EVERY variable can change — Claude must track all of them.

fn factorial(n: i32) -> i32 {
  // Immutable approach — new binding per step
  if n <= 1 {
    return 1
  }
  return n * factorial(n - 1)
}

fn sum_to(n: i32) -> i32 {
  // When you need mutation, you explicitly opt in
  let mut total = 0
  let mut i = 1
  while i <= n {
    total = total + i
    i = i + 1
  }
  return total
}

fn main() {
  std.print("=== Immutability Demo ===")
  std.print("")

  // These values NEVER change — Claude can trust them
  let x = 10
  let y = 20
  let z = x + y
  std.print("x={x}, y={y}, z={z}")

  // Factorial — pure function, no state
  std.print("")
  for n in 1..11 {
    let f = factorial(n)
    std.print("{n}! = {f}")
  }

  // Sum — explicit mutation
  std.print("")
  let s = sum_to(100)
  std.print("Sum 1..100 = {s}")

  std.print("")
  std.print("In clalang, 'let' means NEVER changes.")
  std.print("'let mut' means WILL change — easy for Claude to track.")
}
