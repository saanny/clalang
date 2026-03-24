// clalang — C Code Generator
// Transforms AST into C source code (all phases)

const TYPE_MAP = {
  'i8': 'int8_t', 'i16': 'int16_t', 'i32': 'int32_t', 'i64': 'int64_t',
  'u8': 'uint8_t', 'u16': 'uint16_t', 'u32': 'uint32_t', 'u64': 'uint64_t',
  'f32': 'float', 'f64': 'double', 'bool': 'bool', 'str': 'const char*',
};

const FMT = {
  'i8': '%d', 'i16': '%d', 'i32': '%d', 'i64': '%ld',
  'u8': '%u', 'u16': '%u', 'u32': '%u', 'u64': '%lu',
  'f32': '%g', 'f64': '%g', 'bool': '%s', 'str': '%s',
};

const MATH_BUILTINS = new Set(['sqrt', 'abs', 'pow', 'sin', 'cos', 'tan', 'floor', 'ceil', 'log', 'exp', 'fabs', 'round']);
const ARRAY_BUILTINS = new Set(['filter', 'map', 'sum', 'len', 'push']);

class CodeGen {
  constructor(ast) {
    this.ast = ast;
    // Output sections
    this.typeDecls = [];
    this.resultTypeDecls = [];
    this.enumCtors = [];
    this.lambdas = [];
    this.spawnFns = [];
    this.funcDecls = [];
    // Current output target
    this.target = null;
    this.indent = 0;
    // State
    this.env = new Map();
    this.mutables = new Set();
    this.functions = new Map();
    this.structs = new Map();
    this.enums = new Map();
    this.variantToEnum = new Map();
    this.resultTypes = new Set();
    this.currentFn = null;
    this.lambdaCount = 0;
    this.spawnCount = 0;
    this.matchCount = 0;
    this.tryCount = 0;
    this.tempCount = 0;
  }

  emit(line) { this.target.push('  '.repeat(this.indent) + line); }
  emitRaw(line) { this.target.push(line); }

  generate() {
    this.collectDeclarations();

    // Type declarations
    this.target = this.typeDecls;
    this.emitAllTypes();

    // Result type declarations
    this.target = this.resultTypeDecls;
    this.emitAllResultTypes();

    // Enum constructors
    this.target = this.enumCtors;
    this.emitAllEnumCtors();

    // Functions
    for (const node of this.ast.body) {
      if (node.type === 'FnDecl') this.emitFnDecl(node);
      if (node.type === 'TestDecl') this.emitTestDecl(node);
    }

    return [
      '#include "clear.h"', '',
      ...this.typeDecls,
      ...this.resultTypeDecls,
      ...this.enumCtors,
      ...this.lambdas,
      ...this.spawnFns,
      ...this.funcDecls,
    ].join('\n');
  }

  // ── Collection Pass ──────────────────────────────────────

  collectDeclarations() {
    for (const node of this.ast.body) {
      if (node.type === 'FnDecl') {
        const retType = node.returnType ? node.returnType.name : null;
        const errType = node.errorType ? node.errorType.name : null;
        this.functions.set(node.name, {
          params: node.params,
          returnType: errType ? `result:${retType}:${errType}` : retType,
          errorType: errType,
          okType: retType,
        });
      }
      if (node.type === 'TypeDecl') {
        if (node.kind === 'struct') {
          this.structs.set(node.name, node.fields);
        }
        if (node.kind === 'enum') {
          const isSimple = node.variants.every(v => v.fields.length === 0);
          this.enums.set(node.name, { variants: node.variants, isSimple });
          node.variants.forEach((v, i) => {
            this.variantToEnum.set(v.name, { enum: node.name, index: i, fields: v.fields, isSimple });
          });
        }
      }
    }
    // Collect result types from functions
    for (const [, fn] of this.functions) {
      if (fn.errorType) {
        this.resultTypes.add(`${fn.okType}:${fn.errorType}`);
      }
    }
  }

  // ── Type Declarations ────────────────────────────────────

  emitAllTypes() {
    for (const [name, fields] of this.structs) {
      this.emit(`typedef struct {`);
      this.indent++;
      for (const f of fields) this.emit(`${this.mapType(f.typeAnnotation)} ${f.name};`);
      this.indent--;
      this.emit(`} ${name};`);
      this.emitRaw('');
    }
    for (const [name, info] of this.enums) {
      if (info.isSimple) {
        // Simple enum → C enum
        const vals = info.variants.map((v, i) => `${name}_${v.name} = ${i}`).join(', ');
        this.emit(`typedef enum { ${vals} } ${name};`);
      } else {
        // Data enum → tagged union
        const tagVals = info.variants.map((v, i) => `${name}_${v.name}_tag = ${i}`).join(', ');
        this.emit(`enum ${name}_Tag { ${tagVals} };`);
        this.emit(`typedef struct {`);
        this.indent++;
        this.emit(`enum ${name}_Tag tag;`);
        this.emit(`union {`);
        this.indent++;
        for (const v of info.variants) {
          if (v.fields.length > 0) {
            const fieldDecls = v.fields.map(f => `${this.mapType(f.typeAnnotation)} ${f.name};`).join(' ');
            this.emit(`struct { ${fieldDecls} } ${v.name};`);
          }
        }
        this.indent--;
        this.emit(`};`);
        this.indent--;
        this.emit(`} ${name};`);
      }
      this.emitRaw('');
    }
  }

  emitAllResultTypes() {
    for (const rt of this.resultTypes) {
      const [okT, errT] = rt.split(':');
      const name = `ClearResult_${okT}_${errT}`;
      const okC = TYPE_MAP[okT] || okT;
      const errC = TYPE_MAP[errT] || errT;
      this.emit(`typedef struct { bool is_ok; union { ${okC} ok; ${errC} err; }; } ${name};`);
      this.emitRaw('');
    }
  }

  emitAllEnumCtors() {
    for (const [name, info] of this.enums) {
      if (info.isSimple) continue;
      for (const v of info.variants) {
        if (v.fields.length === 0) continue;
        const params = v.fields.map(f => `${this.mapType(f.typeAnnotation)} ${f.name}`).join(', ');
        const assigns = v.fields.map(f => `_s.${v.name}.${f.name} = ${f.name};`).join(' ');
        this.emit(`static inline ${name} ${name}_${v.name}_new(${params}) {`);
        this.indent++;
        this.emit(`${name} _s; _s.tag = ${name}_${v.name}_tag; ${assigns}`);
        this.emit(`return _s;`);
        this.indent--;
        this.emit(`}`);
        this.emitRaw('');
      }
    }
  }

  // ── Functions ────────────────────────────────────────────

  emitFnDecl(node) {
    const savedEnv = new Map(this.env);
    this.currentFn = this.functions.get(node.name);

    const isMain = node.name === 'main';
    const retC = isMain ? 'int' : this.getCReturnType(node);
    const params = isMain ? 'void' : node.params.map(p => {
      this.env.set(p.name, p.typeAnnotation.name);
      return `${this.mapType(p.typeAnnotation)} ${p.name}`;
    }).join(', ') || 'void';

    this.target = this.funcDecls;
    this.emit(`${retC} ${node.name}(${params}) {`);
    this.indent++;
    const hasReturnType = !isMain && (node.returnType || node.errorType);
    this.genBlock(node.body, !!hasReturnType);
    if (isMain) this.emit('return 0;');
    this.indent--;
    this.emit('}');
    this.emitRaw('');

    this.env = savedEnv;
    this.currentFn = null;
  }

  emitTestDecl(node) {
    const fnName = 'test_' + node.name.replace(/[^a-zA-Z0-9]/g, '_');
    this.target = this.funcDecls;
    this.emit(`void ${fnName}(void) {`);
    this.indent++;
    this.emit(`printf("  test: ${this.escC(node.name)} ... ");`);
    this.genBlock(node.body);
    this.emit(`printf("PASSED\\n");`);
    this.indent--;
    this.emit('}');
    this.emitRaw('');
  }

  getCReturnType(node) {
    if (node.errorType) {
      return `ClearResult_${node.returnType.name}_${node.errorType.name}`;
    }
    return this.mapType(node.returnType);
  }

  // ── Statements ───────────────────────────────────────────

  genBlock(block, implicitReturn = false) {
    for (let i = 0; i < block.stmts.length; i++) {
      const isLast = i === block.stmts.length - 1;
      if (isLast && implicitReturn) {
        this.genStmtImplicitReturn(block.stmts[i]);
      } else {
        this.genStmt(block.stmts[i]);
      }
    }
  }

  genStmtImplicitReturn(node) {
    if (node.type === 'ExprStmt') {
      if (node.expr.type === 'MatchExpr') {
        const val = this.genMatchExpr(node.expr);
        this.emit(`return ${val};`);
      } else {
        this.emit(`return ${this.genExpr(node.expr)};`);
      }
    } else if (node.type === 'IfExpr' && node.else) {
      // TODO: if-else as expression
      this.genStmt(node);
    } else {
      this.genStmt(node);
    }
  }

  genStmt(node) {
    switch (node.type) {
      case 'LetDecl': return this.genLet(node);
      case 'ReturnStmt': return this.genReturn(node);
      case 'IfExpr': return this.genIf(node);
      case 'WhileStmt': return this.genWhile(node);
      case 'ForStmt': return this.genFor(node);
      case 'Assignment': return this.genAssign(node);
      case 'AssertStmt': return this.genAssert(node);
      case 'GuardStmt': return this.genGuard(node);
      case 'ExprStmt': return this.genExprStmt(node);
      case 'Block': { this.emit('{'); this.indent++; this.genBlock(node); this.indent--; this.emit('}'); break; }
    }
  }

  genLet(node) {
    const clearType = this.resolveLetType(node);
    const val = this.genExpr(node.value);
    const cType = this.clearTypeToCType(clearType);
    const prefix = node.mutable || clearType === 'str' || clearType === 'channel' ? '' : 'const ';
    this.emit(`${prefix}${cType} ${node.name} = ${val};`);
    this.env.set(node.name, clearType);
    if (node.mutable) this.mutables.add(node.name);
  }

  genReturn(node) {
    if (!node.value) { this.emit('return;'); return; }
    this.emit(`return ${this.genExpr(node.value)};`);
  }

  genIf(node) {
    this.emit(`if (${this.genExpr(node.condition)}) {`);
    this.indent++;
    this.genBlock(node.then);
    this.indent--;
    if (node.else) {
      if (node.else.type === 'IfExpr') {
        this.emit('} else');
        this.genIf(node.else);
        return;
      }
      this.emit('} else {');
      this.indent++;
      this.genBlock(node.else);
      this.indent--;
    }
    this.emit('}');
  }

  genWhile(node) {
    this.emit(`while (${this.genExpr(node.condition)}) {`);
    this.indent++;
    this.genBlock(node.body);
    this.indent--;
    this.emit('}');
  }

  genFor(node) {
    if (node.iterable.type === 'BinaryExpr' && node.iterable.op === '..') {
      const s = this.genExpr(node.iterable.left);
      const e = this.genExpr(node.iterable.right);
      this.env.set(node.variable, 'i32');
      this.emit(`for (int32_t ${node.variable} = ${s}; ${node.variable} < ${e}; ${node.variable}++) {`);
    } else {
      const arr = this.genExpr(node.iterable);
      const elemType = this.inferArrayElemType(node.iterable);
      const cElem = TYPE_MAP[elemType] || 'int32_t';
      this.env.set(node.variable, elemType);
      this.emit(`for (int32_t _i = 0; _i < ${arr}.len; _i++) {`);
      this.indent++;
      this.emit(`${cElem} ${node.variable} = ${arr}.data[_i];`);
      this.indent--;
    }
    this.indent++;
    this.genBlock(node.body);
    this.indent--;
    this.emit('}');
  }

  genAssign(node) {
    this.emit(`${this.genExpr(node.target)} = ${this.genExpr(node.value)};`);
  }

  genAssert(node) {
    const code = this.genExpr(node.expr);
    this.emit(`if (!(${code})) { fprintf(stderr, "Assertion failed: ${this.escC(code)}\\n"); exit(1); }`);
  }

  genGuard(node) {
    this.emit(`if (!(${this.genExpr(node.condition)})) {`);
    this.indent++;
    this.genStmt(node.body);
    this.indent--;
    this.emit('}');
  }

  genExprStmt(node) {
    // std.print / std.println
    if (this.isStdPrint(node.expr)) return this.genStdPrint(node.expr);
    // spawn
    if (node.expr.type === 'SpawnExpr') return this.genSpawn(node.expr);
    // match as statement
    if (node.expr.type === 'MatchExpr') return this.genMatchStmt(node.expr);
    this.emit(`${this.genExpr(node.expr)};`);
  }

  // ── Expressions ──────────────────────────────────────────

  genExpr(node) {
    switch (node.type) {
      case 'IntLiteral': return String(node.value);
      case 'FloatLiteral': return Number.isInteger(node.value) ? node.value + '.0' : String(node.value);
      case 'StringLiteral': return `"${this.escC(node.value)}"`;
      case 'BoolLiteral': return node.value ? 'true' : 'false';
      case 'Identifier': return this.genIdent(node);
      case 'BinaryExpr': return `(${this.genExpr(node.left)} ${node.op} ${this.genExpr(node.right)})`;
      case 'UnaryExpr': return `(${node.op}${this.genExpr(node.operand)})`;
      case 'CallExpr': return this.genCall(node);
      case 'MemberExpr': return this.genMember(node);
      case 'IndexExpr': return `${this.genExpr(node.object)}.data[${this.genExpr(node.index)}]`;
      case 'ArrayLiteral': return this.genArrayLit(node);
      case 'StructLiteral': return this.genStructLit(node);
      case 'PipeExpr': return this.genPipe(node);
      case 'StringInterp': return this.genStringInterp(node);
      case 'TryExpr': return this.genTry(node);
      case 'Lambda': return this.genLambda(node);
      case 'MatchExpr': return this.genMatchExpr(node);
      case 'SpawnExpr': return this.genSpawn(node);
      default: return `/* TODO: ${node.type} */`;
    }
  }

  genIdent(node) {
    // Enum variant (simple, no args)
    const vi = this.variantToEnum.get(node.name);
    if (vi && vi.isSimple) return `${vi.enum}_${node.name}`;
    return node.name;
  }

  genCall(node) {
    const callee = node.callee;

    // Enum variant constructor: Circle(5.0)
    if (callee.type === 'Identifier' && this.variantToEnum.has(callee.name)) {
      const vi = this.variantToEnum.get(callee.name);
      if (!vi.isSimple && vi.fields.length > 0) {
        const args = node.args.map(a => this.genExpr(a)).join(', ');
        return `${vi.enum}_${callee.name}_new(${args})`;
      }
    }

    // Ok(value) / Err(value) — result constructors
    if (callee.type === 'Identifier' && callee.name === 'Ok' && this.currentFn?.errorType) {
      const rtName = `ClearResult_${this.currentFn.okType}_${this.currentFn.errorType}`;
      return `(${rtName}){ .is_ok = true, .ok = ${this.genExpr(node.args[0])} }`;
    }
    if (callee.type === 'Identifier' && callee.name === 'Err' && this.currentFn?.errorType) {
      const rtName = `ClearResult_${this.currentFn.okType}_${this.currentFn.errorType}`;
      return `(${rtName}){ .is_ok = false, .err = ${this.genExpr(node.args[0])} }`;
    }

    // Math builtins: sqrt(x) → sqrt(x)
    if (callee.type === 'Identifier' && MATH_BUILTINS.has(callee.name)) {
      return `${callee.name}(${node.args.map(a => this.genExpr(a)).join(', ')})`;
    }

    // channel()
    if (callee.type === 'Identifier' && callee.name === 'channel') {
      return 'clear_channel_new()';
    }

    // str_len, str_concat, str_contains, str_eq
    if (callee.type === 'Identifier' && callee.name.startsWith('str_')) {
      return `clear_${callee.name}(${node.args.map(a => this.genExpr(a)).join(', ')})`;
    }

    // Array builtins used directly: filter(arr, fn), map(arr, fn), sum(arr), len(arr)
    if (callee.type === 'Identifier' && ARRAY_BUILTINS.has(callee.name)) {
      return this.genArrayBuiltin(callee.name, node.args);
    }

    // std.method calls
    if (callee.type === 'MemberExpr' && callee.object.type === 'Identifier' && callee.object.name === 'std') {
      return null; // handled by genStdPrint in genExprStmt
    }

    // obj.send(val) / obj.recv() on channels
    if (callee.type === 'MemberExpr') {
      const obj = callee.object;
      const method = callee.property;
      if (obj.type === 'Identifier' && this.env.get(obj.name) === 'channel') {
        if (method === 'send') return `clear_channel_send(${obj.name}, (int64_t)(${this.genExpr(node.args[0])}))`;
        if (method === 'recv') return `(int32_t)clear_channel_recv(${obj.name})`;
      }
    }

    const c = this.genExpr(callee);
    const args = node.args.map(a => this.genExpr(a)).join(', ');
    return `${c}(${args})`;
  }

  genMember(node) {
    const obj = this.genExpr(node.object);
    return `${obj}.${node.property}`;
  }

  genArrayLit(node) {
    if (node.elements.length === 0) return 'clear_array_new_i32()';
    const elemType = this.inferType(node.elements[0]);
    const suffix = elemType === 'f64' ? 'f64' : 'i32';
    const args = node.elements.map(e => this.genExpr(e)).join(', ');
    return `clear_array_from_${suffix}(${node.elements.length}, ${args})`;
  }

  genStructLit(node) {
    const fields = node.fields.map(f => `.${f.name} = ${this.genExpr(f.value)}`).join(', ');
    return `(${node.name}){${fields}}`;
  }

  genPipe(node) {
    const left = this.genExpr(node.left);
    if (node.right.type === 'CallExpr') {
      const callee = node.right.callee;
      const args = node.right.args.map(a => this.genExpr(a));

      // Array builtins in pipeline: arr |> filter(fn) → clear_array_filter_i32(arr, fn)
      if (callee.type === 'Identifier' && ARRAY_BUILTINS.has(callee.name)) {
        return this.genArrayBuiltin(callee.name, [{ type: '_raw', code: left }, ...node.right.args]);
      }

      const c = this.genExpr(callee);
      return `${c}(${left}${args.length ? ', ' + args.join(', ') : ''})`;
    }
    return `${this.genExpr(node.right)}(${left})`;
  }

  genArrayBuiltin(name, args) {
    // Determine element type from first arg
    let suffix = 'i32';
    if (args.length > 0 && args[0].type !== '_raw') {
      const t = this.inferType(args[0]);
      if (t === 'f64' || t === '[f64]') suffix = 'f64';
      if (t === '[i32]') suffix = 'i32';
    }
    const cArgs = args.map(a => a.type === '_raw' ? a.code : this.genExpr(a)).join(', ');
    return `clear_array_${name}_${suffix}(${cArgs})`;
  }

  // ── String Interpolation ─────────────────────────────────

  genStringInterp(node) {
    // Build printf format and args
    let fmt = '';
    const args = [];
    for (const part of node.parts) {
      if (part.type === 'StringPart') {
        fmt += this.escC(part.value);
      } else {
        const exprType = this.inferType(part.expr);
        fmt += FMT[exprType] || '%d';
        if (exprType === 'bool') {
          args.push(`(${this.genExpr(part.expr)}) ? "true" : "false"`);
        } else {
          args.push(this.genExpr(part.expr));
        }
      }
    }
    // Return as a format-args pair (used by genStdPrint)
    // For non-print contexts, return as snprintf
    return { _interp: true, fmt, args };
  }

  // ── std.print ────────────────────────────────────────────

  isStdPrint(expr) {
    return expr.type === 'CallExpr' && expr.callee.type === 'MemberExpr' &&
      expr.callee.object.type === 'Identifier' && expr.callee.object.name === 'std' &&
      (expr.callee.property === 'print' || expr.callee.property === 'println');
  }

  genStdPrint(call) {
    if (call.args.length === 0) { this.emit('printf("\\n");'); return; }
    const arg = call.args[0];

    // String interpolation
    if (arg.type === 'StringInterp') {
      const interp = this.genStringInterp(arg);
      if (interp.args.length === 0) {
        this.emit(`printf("${interp.fmt}\\n");`);
      } else {
        this.emit(`printf("${interp.fmt}\\n", ${interp.args.join(', ')});`);
      }
      return;
    }

    // Plain string literal
    if (arg.type === 'StringLiteral') {
      this.emit(`printf("${this.escC(arg.value)}\\n");`);
      return;
    }

    // Expression
    const t = this.inferType(arg);
    const f = FMT[t] || '%d';
    const v = this.genExpr(arg);
    if (t === 'bool') this.emit(`printf("${f}\\n", ${v} ? "true" : "false");`);
    else this.emit(`printf("${f}\\n", ${v});`);
  }

  // ── Match ────────────────────────────────────────────────

  genMatchStmt(node) {
    const subjectType = this.inferType(node.subject);

    // Result match
    if (subjectType.startsWith('result:')) return this.genResultMatch(node, null);

    // Enum match
    if (this.enums.has(subjectType)) return this.genEnumMatch(node, null);

    // Value match (fallback)
    return this.genValueMatch(node, null);
  }

  genMatchExpr(node) {
    // Match as expression — use a temp variable
    const subjectType = this.inferType(node.subject);
    const resultType = this.inferMatchResultType(node);
    const cType = this.clearTypeToCType(resultType);
    const tmp = `_match_${this.matchCount++}`;
    this.emit(`${cType} ${tmp};`);

    if (subjectType.startsWith('result:')) this.genResultMatch(node, tmp);
    else if (this.enums.has(subjectType)) this.genEnumMatch(node, tmp);
    else this.genValueMatch(node, tmp);

    return tmp;
  }

  genEnumMatch(node, resultVar) {
    const subjectCode = this.genExpr(node.subject);
    const subjectType = this.inferType(node.subject);
    const enumInfo = this.enums.get(subjectType);
    const tmp = `_subj_${this.tempCount++}`;

    if (enumInfo.isSimple) {
      this.emit(`${subjectType} ${tmp} = ${subjectCode};`);
      this.emit(`switch (${tmp}) {`);
      this.indent++;
      for (const arm of node.arms) {
        const vName = arm.pattern.type === 'Identifier' ? arm.pattern.name : null;
        if (vName === '_') {
          this.emit(`default: {`);
        } else {
          this.emit(`case ${subjectType}_${vName}: {`);
        }
        this.indent++;
        this.genMatchArmBody(arm.body, resultVar);
        this.emit('break;');
        this.indent--;
        this.emit('}');
      }
      this.indent--;
      this.emit('}');
    } else {
      this.emit(`${subjectType} ${tmp} = ${subjectCode};`);
      this.emit(`switch (${tmp}.tag) {`);
      this.indent++;
      for (const arm of node.arms) {
        const pat = arm.pattern;
        if (pat.type === 'Identifier' && pat.name === '_') {
          this.emit(`default: {`);
        } else {
          const vName = pat.type === 'CallExpr' ? pat.callee.name : pat.name;
          const vi = this.variantToEnum.get(vName);
          this.emit(`case ${subjectType}_${vName}_tag: {`);
          this.indent++;
          // Bind pattern variables
          if (pat.type === 'CallExpr' && pat.args.length > 0) {
            for (let i = 0; i < pat.args.length && i < vi.fields.length; i++) {
              const binding = pat.args[i].name;
              const field = vi.fields[i];
              const fType = this.mapType(field.typeAnnotation);
              const clearT = field.typeAnnotation.name;
              this.env.set(binding, clearT);
              this.emit(`${fType} ${binding} = ${tmp}.${vName}.${field.name};`);
            }
          }
          this.indent--;
        }
        this.indent++;
        this.genMatchArmBody(arm.body, resultVar);
        this.emit('break;');
        this.indent--;
        this.emit('}');
      }
      this.indent--;
      this.emit('}');
    }
  }

  genResultMatch(node, resultVar) {
    const subjectCode = this.genExpr(node.subject);
    const subjectType = this.inferType(node.subject);
    const [, okT, errT] = subjectType.split(':');
    const rtName = `ClearResult_${okT}_${errT}`;
    const tmp = `_subj_${this.tempCount++}`;

    this.emit(`${rtName} ${tmp} = ${subjectCode};`);

    for (let i = 0; i < node.arms.length; i++) {
      const arm = node.arms[i];
      const pat = arm.pattern;
      const isOk = pat.type === 'CallExpr' && pat.callee.name === 'Ok';
      const isErr = pat.type === 'CallExpr' && pat.callee.name === 'Err';
      const isWild = pat.type === 'Identifier' && pat.name === '_';

      const cond = isOk ? `${tmp}.is_ok` : isErr ? `!${tmp}.is_ok` : null;
      const prefix = i === 0 ? 'if' : '} else if';

      if (isWild || !cond) {
        if (i > 0) this.emit('} else {');
        else this.emit('{');
      } else {
        this.emit(`${prefix} (${cond}) {`);
      }

      this.indent++;
      // Bind the destructured variable
      if (isOk && pat.args.length > 0) {
        const binding = pat.args[0].name;
        this.env.set(binding, okT);
        this.emit(`${TYPE_MAP[okT] || okT} ${binding} = ${tmp}.ok;`);
      }
      if (isErr && pat.args.length > 0) {
        const binding = pat.args[0].name;
        this.env.set(binding, errT);
        this.emit(`${TYPE_MAP[errT] || errT} ${binding} = ${tmp}.err;`);
      }

      this.genMatchArmBody(arm.body, resultVar);
      this.indent--;
    }
    this.emit('}');
  }

  genValueMatch(node, resultVar) {
    const subjectCode = this.genExpr(node.subject);
    const tmp = `_subj_${this.tempCount++}`;
    const subjectType = this.inferType(node.subject);
    const cType = this.clearTypeToCType(subjectType);
    this.emit(`${cType} ${tmp} = ${subjectCode};`);

    for (let i = 0; i < node.arms.length; i++) {
      const arm = node.arms[i];
      const isWild = arm.pattern.type === 'Identifier' && arm.pattern.name === '_';
      const prefix = i === 0 ? 'if' : '} else if';

      if (isWild) {
        this.emit(i > 0 ? '} else {' : '{');
      } else {
        this.emit(`${prefix} (${tmp} == ${this.genExpr(arm.pattern)}) {`);
      }
      this.indent++;
      this.genMatchArmBody(arm.body, resultVar);
      this.indent--;
    }
    this.emit('}');
  }

  genMatchArmBody(body, resultVar) {
    if (body.type === 'Block') {
      if (resultVar) {
        // Last expression in block is the value
        for (let i = 0; i < body.stmts.length - 1; i++) this.genStmt(body.stmts[i]);
        const last = body.stmts[body.stmts.length - 1];
        if (last.type === 'ExprStmt') {
          this.emit(`${resultVar} = ${this.genExpr(last.expr)};`);
        } else {
          this.genStmt(last);
        }
      } else {
        this.genBlock(body);
      }
    } else {
      if (resultVar) {
        this.emit(`${resultVar} = ${this.genExpr(body)};`);
      } else {
        // body is an expression used as a statement
        if (this.isStdPrint(body)) this.genStdPrint(body);
        else if (body.type === 'CallExpr') this.emit(`${this.genExpr(body)};`);
        else this.emit(`${this.genExpr(body)};`);
      }
    }
  }

  // ── Try ──────────────────────────────────────────────────

  genTry(node) {
    const innerType = this.inferType(node.expr);
    let okT, errT, rtName;
    if (innerType.startsWith('result:')) {
      [, okT, errT] = innerType.split(':');
      rtName = `ClearResult_${okT}_${errT}`;
    } else {
      // Guess from current function
      okT = this.currentFn?.okType || 'i32';
      errT = this.currentFn?.errorType || 'str';
      rtName = `ClearResult_${okT}_${errT}`;
    }

    const tmp = `_try_${this.tryCount++}`;
    const expr = this.genExpr(node.expr);

    // Emit the try check as statements before the expression
    const curRetType = this.currentFn ? `ClearResult_${this.currentFn.okType}_${this.currentFn.errorType}` : rtName;
    this.emit(`${rtName} ${tmp} = ${expr};`);
    this.emit(`if (!${tmp}.is_ok) return (${curRetType}){ .is_ok = false, .err = ${tmp}.err };`);

    return `${tmp}.ok`;
  }

  // ── Lambda ───────────────────────────────────────────────

  genLambda(node) {
    const name = `_lambda_${this.lambdaCount++}`;

    // Determine param types and return type
    const params = node.params.map(p => {
      const t = p.typeAnnotation ? this.mapType(p.typeAnnotation) : 'int32_t';
      return `${t} ${p.name}`;
    }).join(', ');

    // Determine return type from body
    let retType = 'int32_t';
    if (node.body.type === 'BinaryExpr' && ['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(node.body.op)) {
      retType = 'bool';
    }
    if (node.body.type === 'UnaryExpr' && node.body.op === '!') retType = 'bool';

    // Save state and generate lambda
    const savedTarget = this.target;
    const savedIndent = this.indent;
    this.target = this.lambdas;
    this.indent = 0;

    this.emit(`static ${retType} ${name}(${params}) {`);
    this.indent++;
    if (node.body.type === 'Block') {
      this.genBlock(node.body);
    } else {
      this.emit(`return ${this.genExpr(node.body)};`);
    }
    this.indent--;
    this.emit('}');
    this.emitRaw('');

    this.target = savedTarget;
    this.indent = savedIndent;
    return name;
  }

  // ── Spawn ────────────────────────────────────────────────

  genSpawn(node) {
    const id = this.spawnCount++;
    const ctxName = `_spawn_ctx_${id}`;
    const fnName = `_spawn_fn_${id}`;

    // Find captured variables
    const captures = new Map();
    this.walkAst(node.body, (n) => {
      if (n.type === 'Identifier' && this.env.has(n.name)) {
        captures.set(n.name, this.env.get(n.name));
      }
    });

    // Generate context struct and thread function
    const savedTarget = this.target;
    const savedIndent = this.indent;
    this.target = this.spawnFns;
    this.indent = 0;

    // Context struct
    this.emit(`struct ${ctxName} {`);
    this.indent++;
    for (const [name, type] of captures) {
      this.emit(`${this.clearTypeToCType(type)} ${name};`);
    }
    this.indent--;
    this.emit('};');
    this.emitRaw('');

    // Thread function
    this.emit(`void* ${fnName}(void* _arg) {`);
    this.indent++;
    this.emit(`struct ${ctxName}* _ctx = (struct ${ctxName}*)_arg;`);
    for (const [name, type] of captures) {
      this.emit(`${this.clearTypeToCType(type)} ${name} = _ctx->${name};`);
    }
    this.genBlock(node.body);
    this.emit('free(_ctx);');
    this.emit('return NULL;');
    this.indent--;
    this.emit('}');
    this.emitRaw('');

    this.target = savedTarget;
    this.indent = savedIndent;

    // Emit spawn call in current function
    this.emit(`struct ${ctxName}* _${ctxName} = malloc(sizeof(struct ${ctxName}));`);
    for (const [name] of captures) {
      this.emit(`_${ctxName}->${name} = ${name};`);
    }
    this.emit(`clear_spawn(${fnName}, _${ctxName});`);

    return 'NULL';
  }

  // ── Type Inference ───────────────────────────────────────

  resolveLetType(node) {
    if (node.typeAnnotation) return node.typeAnnotation.name;
    return this.inferType(node.value);
  }

  inferType(expr) {
    if (!expr) return 'void';
    switch (expr.type) {
      case 'IntLiteral': return 'i32';
      case 'FloatLiteral': return 'f64';
      case 'StringLiteral': return 'str';
      case 'StringInterp': return 'str';
      case 'BoolLiteral': return 'bool';
      case 'Identifier': {
        if (this.variantToEnum.has(expr.name)) return this.variantToEnum.get(expr.name).enum;
        return this.env.get(expr.name) || 'i32';
      }
      case 'BinaryExpr': {
        if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(expr.op)) return 'bool';
        if (expr.op === '..') return 'range';
        const lt = this.inferType(expr.left);
        const rt = this.inferType(expr.right);
        if (lt === 'f64' || lt === 'f32' || rt === 'f64' || rt === 'f32') return 'f64';
        return lt;
      }
      case 'UnaryExpr': return expr.op === '!' ? 'bool' : this.inferType(expr.operand);
      case 'CallExpr': {
        if (expr.callee.type === 'Identifier') {
          const name = expr.callee.name;
          if (name === 'channel') return 'channel';
          if (name === 'Ok' || name === 'Err') return this.currentFn?.returnType || 'i32';
          if (this.variantToEnum.has(name)) return this.variantToEnum.get(name).enum;
          if (MATH_BUILTINS.has(name)) return 'f64';
          if (name === 'str_len' || name === 'len') return 'i32';
          if (name === 'str_concat' || name === 'str_contains') return 'str';
          if (name === 'sum') return 'i32';
          const fn = this.functions.get(name);
          if (fn) return fn.returnType || 'void';
        }
        if (expr.callee.type === 'MemberExpr') {
          const method = expr.callee.property;
          if (method === 'recv') return 'i32';
          if (method === 'len') return 'i32';
        }
        return 'i32';
      }
      case 'MemberExpr': {
        const objType = this.inferType(expr.object);
        if (this.structs.has(objType)) {
          const fields = this.structs.get(objType);
          const field = fields.find(f => f.name === expr.property);
          if (field) return field.typeAnnotation.name;
        }
        return 'i32';
      }
      case 'ArrayLiteral': {
        if (expr.elements.length > 0) return '[' + this.inferType(expr.elements[0]) + ']';
        return '[i32]';
      }
      case 'PipeExpr': {
        if (expr.right.type === 'CallExpr' && expr.right.callee.type === 'Identifier') {
          const fn = expr.right.callee.name;
          if (fn === 'sum') return 'i32';
          if (fn === 'len') return 'i32';
          if (fn === 'filter') return this.inferType(expr.left);
          if (fn === 'map') return this.inferType(expr.left);
          return this.inferType(expr.right);
        }
        return this.inferType(expr.right);
      }
      case 'StructLiteral': return expr.name;
      case 'TryExpr': {
        const inner = this.inferType(expr.expr);
        if (inner.startsWith('result:')) return inner.split(':')[1];
        return inner;
      }
      case 'MatchExpr': return this.inferMatchResultType(expr);
      default: return 'i32';
    }
  }

  inferMatchResultType(node) {
    if (node.arms.length > 0) {
      const arm = node.arms[0];
      if (arm.body.type === 'Block' && arm.body.stmts.length > 0) {
        const last = arm.body.stmts[arm.body.stmts.length - 1];
        if (last.type === 'ExprStmt') return this.inferType(last.expr);
      }
      return this.inferType(arm.body);
    }
    return 'i32';
  }

  inferArrayElemType(expr) {
    const t = this.inferType(expr);
    if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1);
    return 'i32';
  }

  // ── Helpers ──────────────────────────────────────────────

  mapType(typeNode) {
    if (!typeNode) return 'void';
    if (typeNode.kind === 'name') return TYPE_MAP[typeNode.name] || typeNode.name;
    if (typeNode.kind === 'array') {
      const inner = typeNode.inner.name;
      return inner === 'f64' ? 'ClearArray_f64' : 'ClearArray_i32';
    }
    return 'void';
  }

  clearTypeToCType(clearType) {
    if (!clearType) return 'void';
    if (clearType === 'channel') return 'ClearChannel*';
    if (clearType.startsWith('[')) {
      const inner = clearType.slice(1, -1);
      return inner === 'f64' ? 'ClearArray_f64' : 'ClearArray_i32';
    }
    if (clearType.startsWith('result:')) {
      const [, okT, errT] = clearType.split(':');
      return `ClearResult_${okT}_${errT}`;
    }
    if (this.structs.has(clearType) || this.enums.has(clearType)) return clearType;
    return TYPE_MAP[clearType] || clearType;
  }

  escC(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
  }

  walkAst(node, visitor) {
    if (!node || typeof node !== 'object') return;
    visitor(node);
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) val.forEach(item => this.walkAst(item, visitor));
      else if (val && typeof val === 'object' && val.type) this.walkAst(val, visitor);
    }
  }
}

function generate(ast) {
  return new CodeGen(ast).generate();
}

module.exports = { CodeGen, generate };
