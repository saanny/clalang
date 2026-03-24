// Fibonacci — clean recursion, no ambiguity
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// - One return type, one way to write it
// - Pattern matching replaces if/else chains
// - No semicolons to forget, no braces to miscount

fn fib(n: i32) -> i32 {
  if n <= 1 {
    return n
  }
  return fib(n - 1) + fib(n - 2)
}

fn main() {
  std.print("Fibonacci sequence:")
  for i in 0..15 {
    let f = fib(i)
    std.print("  fib({i}) = {f}")
  }
}
