// Mandelbrot Set — ASCII art renderer
//
// A real computation app in clalang.
// Renders the Mandelbrot set to terminal using ASCII characters.
// Shows: structs, math, nested loops, string building, std.write

fn mandelbrot(c_re: f64, c_im: f64, max_iter: i32) -> i32 {
  let mut zr = 0.0
  let mut zi = 0.0
  let mut i = 0
  while i < max_iter {
    let zr2 = zr * zr
    let zi2 = zi * zi
    if zr2 + zi2 > 4.0 {
      return i
    }
    let new_zi = 2.0 * zr * zi + c_im
    zr = zr2 - zi2 + c_re
    zi = new_zi
    i = i + 1
  }
  return max_iter
}

fn main() {
  let palette = " .'`^,:;Il!i><~+_-?][ 1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
  let plen = str_len(palette)
  let max_iter = 70

  let x_min = -2.0
  let x_max = 0.6
  let y_min = -1.2
  let y_max = 1.2
  let cols = 80
  let rows = 40

  let dx = (x_max - x_min) / 80.0
  let dy = (y_max - y_min) / 40.0

  std.print("Mandelbrot Set ({cols}x{rows})")
  std.print("")

  let mut row = 0
  while row < rows {
    let y = y_min + row * dy
    let mut line = ""
    let mut col = 0
    while col < cols {
      let x = x_min + col * dx
      let iter = mandelbrot(x, y, max_iter)
      let idx = iter % plen
      let ch = str_substr(palette, idx, 1)
      line = str_concat(line, ch)
      col = col + 1
    }
    std.print(line)
    row = row + 1
  }
}
