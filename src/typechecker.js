// clalang — Type Checker
// Validates AST before code generation

class TypeChecker {
  constructor(ast) {
    this.ast = ast;
    this.errors = [];
    this.warnings = [];
    this.types = new Map();       // type name → definition
    this.functions = new Map();   // fn name → { params, returnType, errorType }
    this.variants = new Map();    // variant name → enum name
    this.scopes = [];
  }

  check() {
    this.collectDeclarations();
    for (const node of this.ast.body) {
      if (node.type === 'FnDecl') this.checkFnDecl(node);
    }
    return { errors: this.errors, warnings: this.warnings };
  }

  error(msg, node) {
    this.errors.push({ message: msg, line: node?.line, col: node?.col });
  }

  warn(msg, node) {
    this.warnings.push({ message: msg, line: node?.line, col: node?.col });
  }

  pushScope() { this.scopes.push(new Map()); }
  popScope() { this.scopes.pop(); }

  define(name, info) {
    if (this.scopes.length === 0) return;
    this.scopes[this.scopes.length - 1].set(name, info);
  }

  lookup(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    // Check global functions and types
    if (this.functions.has(name)) return { type: 'function', name };
    if (this.variants.has(name)) return { type: this.variants.get(name), name };
    // Built-ins
    if (['sqrt', 'abs', 'pow', 'sin', 'cos', 'floor', 'ceil', 'str_len',
         'str_concat', 'str_contains', 'channel', 'print', 'println',
         'filter', 'map', 'sum', 'len', 'push',
         'Ok', 'Err', 'std', 'str_eq', 'str_to_int', 'str_starts_with',
         'str_count_lines', 'str_get_line', 'str_set_line', 'str_delete_line', 'str_replace', 'str_substr',
         'fs_read', 'fs_write', 'fs_exists',
         'arg', 'args_count', 'args_join'].includes(name)) {
      return { type: 'builtin', name };
    }
    return null;
  }

  collectDeclarations() {
    for (const node of this.ast.body) {
      if (node.type === 'FnDecl') {
        this.functions.set(node.name, {
          params: node.params,
          returnType: node.returnType,
          errorType: node.errorType || null,
        });
      }
      if (node.type === 'TypeDecl') {
        this.types.set(node.name, node);
        if (node.kind === 'enum') {
          for (const v of node.variants) {
            this.variants.set(v.name, node.name);
          }
        }
      }
    }
  }

  checkFnDecl(node) {
    this.pushScope();
    for (const p of node.params) {
      this.define(p.name, { type: this.typeToString(p.typeAnnotation), mutable: false });
    }
    this.currentFn = node;
    this.checkBlock(node.body);
    this.currentFn = null;
    this.popScope();
  }

  checkBlock(block) {
    for (const stmt of block.stmts) {
      this.checkStatement(stmt);
    }
  }

  checkStatement(node) {
    switch (node.type) {
      case 'LetDecl':
        this.checkExpr(node.value);
        this.define(node.name, {
          type: node.typeAnnotation ? this.typeToString(node.typeAnnotation) : this.inferType(node.value),
          mutable: node.mutable,
        });
        break;

      case 'ReturnStmt':
        if (node.value) this.checkExpr(node.value);
        break;

      case 'IfExpr':
        this.checkExpr(node.condition);
        this.pushScope();
        this.checkBlock(node.then);
        this.popScope();
        if (node.else) {
          this.pushScope();
          if (node.else.type === 'Block') this.checkBlock(node.else);
          else this.checkStatement(node.else);
          this.popScope();
        }
        break;

      case 'WhileStmt':
        this.checkExpr(node.condition);
        this.pushScope();
        this.checkBlock(node.body);
        this.popScope();
        break;

      case 'ForStmt':
        this.checkExpr(node.iterable);
        this.pushScope();
        this.define(node.variable, { type: 'i32', mutable: false });
        this.checkBlock(node.body);
        this.popScope();
        break;

      case 'Assignment':
        this.checkExpr(node.value);
        if (node.target.type === 'Identifier') {
          const info = this.lookup(node.target.name);
          if (!info) {
            this.error(`Undefined variable '${node.target.name}'`, node.target);
          } else if (info.mutable === false && info.type !== 'builtin' && info.type !== 'function') {
            this.error(`Cannot assign to immutable variable '${node.target.name}'. Use 'let mut' to make it mutable`, node.target);
          }
        }
        break;

      case 'ExprStmt':
        this.checkExpr(node.expr);
        break;

      case 'AssertStmt':
        this.checkExpr(node.expr);
        break;

      case 'GuardStmt':
        this.checkExpr(node.condition);
        this.checkStatement(node.body);
        break;

      case 'Block':
        this.pushScope();
        this.checkBlock(node);
        this.popScope();
        break;
    }
  }

  checkExpr(node) {
    if (!node) return;
    switch (node.type) {
      case 'Identifier':
        if (node.name !== '_' && !this.lookup(node.name)) {
          this.error(`Undefined variable '${node.name}'`, node);
        }
        break;

      case 'CallExpr':
        this.checkExpr(node.callee);
        for (const a of node.args) this.checkExpr(a);
        // Check argument count for known functions (skip pipeline-transformed calls)
        if (node.callee.type === 'Identifier') {
          const fn = this.functions.get(node.callee.name);
          if (fn && fn.params.length !== node.args.length && node.args.length !== 0) {
            this.error(`Function '${node.callee.name}' expects ${fn.params.length} arguments, got ${node.args.length}`, node);
          }
        }
        break;

      case 'BinaryExpr':
        this.checkExpr(node.left);
        this.checkExpr(node.right);
        break;

      case 'UnaryExpr':
        this.checkExpr(node.operand);
        break;

      case 'MemberExpr':
        this.checkExpr(node.object);
        break;

      case 'IndexExpr':
        this.checkExpr(node.object);
        this.checkExpr(node.index);
        break;

      case 'IfExpr':
        this.checkStatement(node);
        break;

      case 'MatchExpr':
        this.checkExpr(node.subject);
        for (const arm of node.arms) {
          this.pushScope();
          this.bindPattern(arm.pattern);
          if (arm.body.type === 'Block') this.checkBlock(arm.body);
          else this.checkExpr(arm.body);
          this.popScope();
        }
        break;

      case 'ArrayLiteral':
        for (const el of node.elements) this.checkExpr(el);
        break;

      case 'StructLiteral':
        if (!this.types.has(node.name)) {
          this.error(`Undefined type '${node.name}'`, node);
        }
        for (const f of node.fields) this.checkExpr(f.value);
        break;

      case 'StringInterp':
        for (const part of node.parts) {
          if (part.type === 'ExprPart') this.checkExpr(part.expr);
        }
        break;

      case 'TryExpr':
        this.checkExpr(node.expr);
        break;

      case 'SpawnExpr':
        this.pushScope();
        this.checkBlock(node.body);
        this.popScope();
        break;

      case 'Lambda':
        this.pushScope();
        for (const p of node.params) {
          this.define(p.name, { type: p.typeAnnotation ? this.typeToString(p.typeAnnotation) : 'i32', mutable: false });
        }
        if (node.body.type === 'Block') this.checkBlock(node.body);
        else this.checkExpr(node.body);
        this.popScope();
        break;

      case 'PipeExpr':
        this.checkExpr(node.left);
        this.checkExpr(node.right);
        break;
    }
  }

  bindPattern(pattern) {
    if (pattern.type === 'Identifier' && pattern.name !== '_') {
      this.define(pattern.name, { type: 'unknown', mutable: false });
    }
    if (pattern.type === 'CallExpr') {
      for (const arg of pattern.args) this.bindPattern(arg);
    }
  }

  inferType(expr) {
    switch (expr.type) {
      case 'IntLiteral': return 'i32';
      case 'FloatLiteral': return 'f64';
      case 'StringLiteral': return 'str';
      case 'StringInterp': return 'str';
      case 'BoolLiteral': return 'bool';
      case 'Identifier': {
        const info = this.lookup(expr.name);
        return info?.type || 'unknown';
      }
      case 'ArrayLiteral': {
        if (expr.elements.length > 0) return '[' + this.inferType(expr.elements[0]) + ']';
        return '[i32]';
      }
      default: return 'unknown';
    }
  }

  typeToString(typeNode) {
    if (!typeNode) return 'void';
    if (typeNode.kind === 'name') return typeNode.name;
    if (typeNode.kind === 'array') return '[' + this.typeToString(typeNode.inner) + ']';
    return 'unknown';
  }
}

function typecheck(ast) {
  const checker = new TypeChecker(ast);
  return checker.check();
}

module.exports = { TypeChecker, typecheck };
