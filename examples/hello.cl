// Hello World in clalang

fn add(a: i32, b: i32) -> i32 {
  return a + b
}

fn multiply(x: f64, y: f64) -> f64 {
  return x * y
}

fn main() {
  let name = "clalang"
  let x = 10
  let y = 32
  let sum = add(x, y)

  std.print("Hello from {name}!")
  std.print("{x} + {y} = {sum}")

  if sum == 42 {
    std.print("The answer to everything!")
  } else {
    std.print("Not the answer")
  }

  let pi = 3.14159
  let area = multiply(pi, 100.0)
  std.print("Area: {area}")

  let mut counter = 0
  while counter < 5 {
    std.print("count: {counter}")
    counter = counter + 1
  }

  let is_fast = true
  std.print("clalang is fast: {is_fast}")
}
