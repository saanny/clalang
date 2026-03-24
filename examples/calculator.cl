// Calculator — enums + match + result types
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// - Enum variants are exhaustive: Claude CAN'T forget a case in match
// - Result type forces error handling: division by zero CAN'T be ignored
// - No null, no exceptions, no undefined — every path is explicit
// - In JS, Claude would need try/catch + null checks + typeof guards
//   Here: the type system handles all of it

type Op = Add | Sub | Mul | Div

fn op_name(op: Op) -> str {
  match op {
    Add => "+"
    Sub => "-"
    Mul => "*"
    Div => "/"
  }
}

fn calculate(a: f64, op: Op, b: f64) -> f64 ! str {
  match op {
    Add => return Ok(a + b)
    Sub => return Ok(a - b)
    Mul => return Ok(a * b)
    Div => {
      if b == 0.0 {
        return Err("division by zero")
      }
      return Ok(a / b)
    }
  }
}

fn main() {
  std.print("=== Calculator ===")

  let a = 42.0
  let b = 8.0

  let ops = [Add, Sub, Mul, Div]
  // Demonstrate all operations
  match calculate(a, Add, b) {
    Ok(v) => std.print("{a} + {b} = {v}")
    Err(e) => std.print("Error: {e}")
  }

  match calculate(a, Sub, b) {
    Ok(v) => std.print("{a} - {b} = {v}")
    Err(e) => std.print("Error: {e}")
  }

  match calculate(a, Mul, b) {
    Ok(v) => std.print("{a} * {b} = {v}")
    Err(e) => std.print("Error: {e}")
  }

  match calculate(a, Div, b) {
    Ok(v) => std.print("{a} / {b} = {v}")
    Err(e) => std.print("Error: {e}")
  }

  // Error case — forced to handle
  std.print("")
  std.print("Error handling:")
  match calculate(10.0, Div, 0.0) {
    Ok(v) => std.print("10 / 0 = {v}")
    Err(e) => std.print("10 / 0 => {e}")
  }
}
