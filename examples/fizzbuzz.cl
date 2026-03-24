// FizzBuzz — guard clauses keep code flat
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// In JS/Python, Claude often generates nested if/else or forgets edge cases.
// Here: guard clauses force flat code, modulo is explicit, no nesting.
// Every path is visible at the same indentation level.

fn fizzbuzz(n: i32) -> str {
  if n % 15 == 0 {
    return "FizzBuzz"
  }
  if n % 3 == 0 {
    return "Fizz"
  }
  if n % 5 == 0 {
    return "Buzz"
  }
  return ""
}

fn main() {
  for i in 1..31 {
    let result = fizzbuzz(i)
    if str_len(result) > 0 {
      std.print("{i}: {result}")
    } else {
      std.print("{i}")
    }
  }
}
