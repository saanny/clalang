// Error chain — try propagation replaces nested error checks
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// In Go, Claude must write this:
//   val, err := step1()
//   if err != nil { return 0, err }
//   val2, err := step2(val)
//   if err != nil { return 0, err }
//   val3, err := step3(val2)
//   if err != nil { return 0, err }
//
// In clalang, 'try' does all of that:
//   let val = try step1()
//   let val2 = try step2(val)
//   let val3 = try step3(val2)
//
// Claude writes 3 lines instead of 9. Fewer lines = fewer bugs.

fn parse_age(input: str) -> i32 ! str {
  // Simulated: only "25" is valid
  if str_eq(input, "25") {
    return Ok(25)
  }
  return Err("invalid age format")
}

fn validate_age(age: i32) -> i32 ! str {
  if age < 0 {
    return Err("age cannot be negative")
  }
  if age > 150 {
    return Err("age unrealistically high")
  }
  return Ok(age)
}

fn categorize(age: i32) -> str ! str {
  if age < 13 {
    return Ok("child")
  }
  if age < 20 {
    return Ok("teenager")
  }
  if age < 65 {
    return Ok("adult")
  }
  return Ok("senior")
}

// Three fallible steps chained with try — any failure short-circuits
fn process_user(input: str) -> str ! str {
  let age = try parse_age(input)
  let valid = try validate_age(age)
  let category = try categorize(valid)
  return Ok(category)
}

fn main() {
  std.print("=== Error Chain with try ===")
  std.print("")

  // Success path
  match process_user("25") {
    Ok(cat) => std.print("'25' => {cat}")
    Err(e) => std.print("'25' => error: {e}")
  }

  // Failure path — error propagates automatically
  match process_user("abc") {
    Ok(cat) => std.print("'abc' => {cat}")
    Err(e) => std.print("'abc' => error: {e}")
  }

  std.print("")
  std.print("Notice: no manual error checks needed in process_user().")
  std.print("'try' propagates errors automatically — Claude can't forget.")
}
