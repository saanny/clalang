// Concurrent workers — spawn + channels
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// - No async/await confusion (is it .then? await? callback?)
// - No mutex/lock management
// - No race condition footguns
// - Just: spawn { work }, channel.send(), channel.recv()
// - Claude writes concurrent code as simply as sequential code

fn heavy_computation(x: i32) -> i32 {
  // Simulate work
  return x * x + x * 2 + 1
}

fn main() {
  std.print("=== Concurrent Workers ===")
  std.print("")

  // Worker 1: compute something
  let ch1 = channel()
  spawn {
    let result = heavy_computation(10)
    ch1.send(result)
  }

  // Worker 2: compute something else
  let ch2 = channel()
  spawn {
    let result = heavy_computation(20)
    ch2.send(result)
  }

  // Worker 3: yet another computation
  let ch3 = channel()
  spawn {
    let result = heavy_computation(30)
    ch3.send(result)
  }

  // Collect results (blocks until each worker finishes)
  let r1 = ch1.recv()
  let r2 = ch2.recv()
  let r3 = ch3.recv()

  std.print("Worker 1 (n=10): {r1}")
  std.print("Worker 2 (n=20): {r2}")
  std.print("Worker 3 (n=30): {r3}")

  let total = r1 + r2 + r3
  std.print("")
  std.print("Total: {total}")
  std.print("")
  std.print("3 workers ran concurrently with zero boilerplate.")
  std.print("No async/await, no callbacks, no mutexes.")
}
