// Todo — a real CLI app built in clalang
//
// A persistent task manager that reads/writes a file.
// Shows: CLI args, file I/O, string manipulation, control flow, enums
//
// Usage:
//   ./todo list              Show all tasks
//   ./todo add Buy milk      Add a new task
//   ./todo done 2            Mark task #2 as done
//   ./todo remove 1          Remove task #1

fn show_help() {
  std.print("todo — task manager built in clalang")
  std.print("")
  std.print("Usage:")
  std.print("  todo list              Show all tasks")
  std.print("  todo add <task>        Add a new task")
  std.print("  todo done <number>     Mark task as done")
  std.print("  todo remove <number>   Remove a task")
}

fn load_tasks(file: str) -> str {
  if fs_exists(file) {
    return fs_read(file)
  }
  return ""
}

fn count_tasks(content: str) -> i32 {
  if str_len(content) == 0 {
    return 0
  }
  return str_count_lines(content)
}

fn list_tasks(file: str) {
  let content = load_tasks(file)
  let total = count_tasks(content)
  if total == 0 {
    std.print("No tasks yet. Use 'add' to create one.")
    return
  }

  std.print("Tasks:")
  let mut done = 0
  for i in 0..total {
    let line = str_get_line(content, i)
    let num = i + 1
    std.print("  {num}. {line}")
    if str_starts_with(line, "[x]") {
      done = done + 1
    }
  }
  let pending = total - done
  std.print("")
  std.print("{total} total, {done} done, {pending} pending")
}

fn add_task(file: str, task: str) {
  let content = load_tasks(file)
  let entry = str_concat("[ ] ", str_concat(task, "\n"))
  let updated = str_concat(content, entry)
  fs_write(file, updated)
  std.print("Added: {task}")
}

fn mark_done(file: str, n: i32) {
  let content = load_tasks(file)
  let total = count_tasks(content)
  if n < 1 {
    std.print("Error: task number must be >= 1")
    return
  }
  if n > total {
    std.print("Error: only {total} tasks exist")
    return
  }
  let idx = n - 1
  let line = str_get_line(content, idx)
  if str_starts_with(line, "[x]") {
    std.print("Task {n} is already done")
    return
  }
  let new_line = str_replace(line, "[ ]", "[x]")
  let updated = str_set_line(content, idx, new_line)
  fs_write(file, updated)
  std.print("Done: {new_line}")
}

fn remove_task(file: str, n: i32) {
  let content = load_tasks(file)
  let total = count_tasks(content)
  if n < 1 {
    std.print("Error: task number must be >= 1")
    return
  }
  if n > total {
    std.print("Error: only {total} tasks exist")
    return
  }
  let idx = n - 1
  let line = str_get_line(content, idx)
  let updated = str_delete_line(content, idx)
  fs_write(file, updated)
  std.print("Removed: {line}")
}

fn main() {
  let file = "todos.txt"
  let argc = args_count()

  if argc < 2 {
    show_help()
    return
  }

  let cmd = arg(1)

  if str_eq(cmd, "list") {
    list_tasks(file)
  } else if str_eq(cmd, "add") {
    if argc < 3 {
      std.print("Usage: todo add <task description>")
      return
    }
    let task = args_join(2)
    add_task(file, task)
  } else if str_eq(cmd, "done") {
    if argc < 3 {
      std.print("Usage: todo done <number>")
      return
    }
    let n = str_to_int(arg(2))
    mark_done(file, n)
  } else if str_eq(cmd, "remove") {
    if argc < 3 {
      std.print("Usage: todo remove <number>")
      return
    }
    let n = str_to_int(arg(2))
    remove_task(file, n)
  } else {
    std.print("Unknown command: {cmd}")
    std.print("")
    show_help()
  }
}
