// Shapes — structs + enums + pattern matching
//
// WHY CLALANG IS BETTER FOR CLAUDE:
// In TypeScript, Claude has to juggle:
//   interface Circle { kind: "circle"; radius: number }
//   interface Rect { kind: "rect"; w: number; h: number }
//   type Shape = Circle | Rect
//   function area(s: Shape): number {
//     switch (s.kind) {
//       case "circle": return Math.PI * s.radius ** 2;
//       case "rect": return s.w * s.h;
//     }
//   }
//
// In clalang:
//   type Shape = Circle(radius: f64) | Rect(w: f64, h: f64)
//   fn area(s: Shape) -> f64 {
//     match s {
//       Circle(r) => 3.14159 * r * r
//       Rect(w, h) => w * h
//     }
//   }
//
// Half the tokens. Zero boilerplate. Pattern destructuring built-in.

type Point {
  x: f64
  y: f64
}

type Shape = Circle(radius: f64) | Rect(w: f64, h: f64) | Triangle(base: f64, height: f64)

fn area(s: Shape) -> f64 {
  match s {
    Circle(r) => 3.14159 * r * r
    Rect(w, h) => w * h
    Triangle(b, h) => 0.5 * b * h
  }
}

fn describe(s: Shape) -> str {
  match s {
    Circle(r) => "circle"
    Rect(w, h) => "rectangle"
    Triangle(b, h) => "triangle"
  }
}

fn distance(a: Point, b: Point) -> f64 {
  let dx = a.x - b.x
  let dy = a.y - b.y
  return sqrt(dx * dx + dy * dy)
}

fn main() {
  std.print("=== Shapes ===")
  std.print("")

  let shapes_data = [Circle(5.0), Rect(3.0, 4.0), Triangle(6.0, 8.0)]

  let c = Circle(5.0)
  let r = Rect(3.0, 4.0)
  let t = Triangle(6.0, 8.0)

  let ca = area(c)
  let cd = describe(c)
  std.print("{cd}: area = {ca}")

  let ra = area(r)
  let rd = describe(r)
  std.print("{rd}: area = {ra}")

  let ta = area(t)
  let td = describe(t)
  std.print("{td}: area = {ta}")

  std.print("")
  std.print("--- Points ---")
  let p1 = Point { x: 0.0, y: 0.0 }
  let p2 = Point { x: 3.0, y: 4.0 }
  let d = distance(p1, p2)
  std.print("Distance from ({p1.x},{p1.y}) to ({p2.x},{p2.y}) = {d}")
}
