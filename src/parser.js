// clalang — Parser
// Transforms token stream into an Abstract Syntax Tree (AST)

const { T, Lexer } = require('./lexer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // ── Helpers ──────────────────────────────────────────────

  current() { return this.tokens[this.pos]; }
  peek(offset = 0) { return this.tokens[this.pos + offset]; }
  at(type) { return this.current().type === type; }

  eat(type) {
    if (this.current().type !== type) {
      const tok = this.current();
      throw new Error(`Expected '${type}' but got '${tok.type}' ("${tok.value}") at ${tok.line}:${tok.col}`);
    }
    return this.tokens[this.pos++];
  }

  tryEat(type) {
    if (this.current().type === type) return this.tokens[this.pos++];
    return null;
  }

  skipSemis() { while (this.at(T.SEMI)) this.pos++; }

  // ── Program ──────────────────────────────────────────────

  parseProgram() {
    const body = [];
    this.skipSemis();
    while (!this.at(T.EOF)) {
      body.push(this.parseTopLevel());
      this.skipSemis();
    }
    return { type: 'Program', body };
  }

  parseTopLevel() {
    switch (this.current().type) {
      case T.FN:     return this.parseFnDecl();
      case T.LET:    return this.parseLetDecl();
      case T.TYPE:   return this.parseTypeDecl();
      case T.TEST:   return this.parseTestDecl();
      case T.IMPORT: return this.parseImport();
      default:       return this.parseStatement();
    }
  }

  // ── Declarations ─────────────────────────────────────────

  parseFnDecl() {
    this.eat(T.FN);
    const name = this.eat(T.IDENT).value;
    this.eat(T.LPAREN);
    const params = [];
    while (!this.at(T.RPAREN)) {
      const pName = this.eat(T.IDENT).value;
      this.eat(T.COLON);
      const pType = this.parseType();
      params.push({ name: pName, typeAnnotation: pType });
      if (!this.at(T.RPAREN)) this.eat(T.COMMA);
    }
    this.eat(T.RPAREN);

    let returnType = null;
    let errorType = null;
    if (this.tryEat(T.ARROW)) {
      returnType = this.parseType();
      // Result type: -> T ! E
      if (this.tryEat(T.BANG)) {
        errorType = this.parseType();
      }
    }

    const body = this.parseBlock();
    return { type: 'FnDecl', name, params, returnType, errorType, body };
  }

  parseLetDecl() {
    this.eat(T.LET);
    const mutable = !!this.tryEat(T.MUT);
    const name = this.eat(T.IDENT).value;
    let typeAnnotation = null;
    if (this.tryEat(T.COLON)) typeAnnotation = this.parseType();
    this.eat(T.EQ);
    const value = this.parseExpression();
    return { type: 'LetDecl', name, mutable, typeAnnotation, value };
  }

  parseTypeDecl() {
    this.eat(T.TYPE);
    const name = this.eat(T.IDENT).value;

    // Struct: type Point { x: f64, y: f64 }
    if (this.at(T.LBRACE)) {
      this.eat(T.LBRACE);
      const fields = [];
      this.skipSemis();
      while (!this.at(T.RBRACE)) {
        const fName = this.eat(T.IDENT).value;
        this.eat(T.COLON);
        const fType = this.parseType();
        fields.push({ name: fName, typeAnnotation: fType });
        this.skipSemis();
        this.tryEat(T.COMMA);
        this.skipSemis();
      }
      this.eat(T.RBRACE);
      return { type: 'TypeDecl', name, kind: 'struct', fields };
    }

    // Enum: type Shape = Circle(radius: f64) | Rect(w: f64, h: f64)
    if (this.tryEat(T.EQ)) {
      const variants = [];
      this.skipSemis();
      this.tryEat(T.PIPE); // optional leading |
      this.skipSemis();

      // Parse first variant
      variants.push(this.parseEnumVariant());

      // Parse remaining variants separated by |
      while (true) {
        this.skipSemis();
        if (!this.tryEat(T.PIPE)) break;
        this.skipSemis();
        variants.push(this.parseEnumVariant());
      }

      return { type: 'TypeDecl', name, kind: 'enum', variants };
    }

    throw new Error(`Expected '{' or '=' after type name at ${this.current().line}:${this.current().col}`);
  }

  parseEnumVariant() {
    const vName = this.eat(T.IDENT).value;
    let fields = [];
    if (this.tryEat(T.LPAREN)) {
      while (!this.at(T.RPAREN)) {
        // Try named field: name: type
        const tok = this.eat(T.IDENT);
        if (this.tryEat(T.COLON)) {
          const fType = this.parseType();
          fields.push({ name: tok.value, typeAnnotation: fType });
        } else {
          // Unnamed field — the identifier is the type name
          fields.push({ name: tok.value, typeAnnotation: { kind: 'name', name: tok.value } });
        }
        if (!this.at(T.RPAREN)) this.eat(T.COMMA);
      }
      this.eat(T.RPAREN);
    }
    return { name: vName, fields };
  }

  parseTestDecl() {
    this.eat(T.TEST);
    const name = this.eat(T.STRING).value;
    const body = this.parseBlock();
    return { type: 'TestDecl', name, body };
  }

  parseImport() {
    this.eat(T.IMPORT);
    const path = this.eat(T.STRING).value;
    return { type: 'ImportDecl', path };
  }

  // ── Types ────────────────────────────────────────────────

  parseType() {
    // Array type: [T]
    if (this.tryEat(T.LBRACKET)) {
      const inner = this.parseType();
      this.eat(T.RBRACKET);
      return { kind: 'array', inner };
    }
    const name = this.eat(T.IDENT).value;
    return { kind: 'name', name };
  }

  // ── Statements ───────────────────────────────────────────

  parseStatement() {
    switch (this.current().type) {
      case T.LET:    return this.parseLetDecl();
      case T.RETURN: return this.parseReturnStmt();
      case T.IF:     return this.parseIfExpr();
      case T.WHILE:  return this.parseWhileStmt();
      case T.FOR:    return this.parseForStmt();
      case T.ASSERT: return this.parseAssertStmt();
      case T.GUARD:  return this.parseGuardStmt();
      default:       return this.parseExpressionStatement();
    }
  }

  parseReturnStmt() {
    this.eat(T.RETURN);
    if (this.at(T.SEMI) || this.at(T.RBRACE) || this.at(T.EOF)) {
      return { type: 'ReturnStmt', value: null };
    }
    const value = this.parseExpression();
    return { type: 'ReturnStmt', value };
  }

  parseWhileStmt() {
    this.eat(T.WHILE);
    const condition = this.parseExpression();
    const body = this.parseBlock();
    return { type: 'WhileStmt', condition, body };
  }

  parseForStmt() {
    this.eat(T.FOR);
    const variable = this.eat(T.IDENT).value;
    this.eat(T.IN);
    const iterable = this.parseExpression();
    const body = this.parseBlock();
    return { type: 'ForStmt', variable, iterable, body };
  }

  parseAssertStmt() {
    this.eat(T.ASSERT);
    const expr = this.parseExpression();
    return { type: 'AssertStmt', expr };
  }

  parseGuardStmt() {
    this.eat(T.GUARD);
    const condition = this.parseExpression();
    this.eat(T.ELSE);
    const body = this.parseStatement();
    return { type: 'GuardStmt', condition, body };
  }

  parseExpressionStatement() {
    const expr = this.parseExpression();
    if (this.tryEat(T.EQ)) {
      const value = this.parseExpression();
      return { type: 'Assignment', target: expr, value };
    }
    return { type: 'ExprStmt', expr };
  }

  // ── Block ────────────────────────────────────────────────

  parseBlock() {
    this.eat(T.LBRACE);
    const stmts = [];
    this.skipSemis();
    while (!this.at(T.RBRACE)) {
      stmts.push(this.parseStatement());
      this.skipSemis();
    }
    this.eat(T.RBRACE);
    return { type: 'Block', stmts };
  }

  // ── Expressions ──────────────────────────────────────────

  parseExpression() { return this.parsePipeline(); }

  parsePipeline() {
    let left = this.parseOr();
    while (this.tryEat(T.PIPE_GT)) {
      const right = this.parseOr();
      left = { type: 'PipeExpr', left, right };
    }
    return left;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.tryEat(T.OR)) {
      left = { type: 'BinaryExpr', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.tryEat(T.AND)) {
      left = { type: 'BinaryExpr', op: '&&', left, right: this.parseEquality() };
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (true) {
      if (this.tryEat(T.EQEQ)) left = { type: 'BinaryExpr', op: '==', left, right: this.parseComparison() };
      else if (this.tryEat(T.NEQ)) left = { type: 'BinaryExpr', op: '!=', left, right: this.parseComparison() };
      else break;
    }
    return left;
  }

  parseComparison() {
    let left = this.parseRange();
    while (true) {
      if (this.tryEat(T.LT)) left = { type: 'BinaryExpr', op: '<', left, right: this.parseAddition() };
      else if (this.tryEat(T.GT)) left = { type: 'BinaryExpr', op: '>', left, right: this.parseAddition() };
      else if (this.tryEat(T.LTE)) left = { type: 'BinaryExpr', op: '<=', left, right: this.parseAddition() };
      else if (this.tryEat(T.GTE)) left = { type: 'BinaryExpr', op: '>=', left, right: this.parseAddition() };
      else break;
    }
    return left;
  }

  parseRange() {
    let left = this.parseAddition();
    if (this.tryEat(T.DOTDOT)) {
      left = { type: 'BinaryExpr', op: '..', left, right: this.parseAddition() };
    }
    return left;
  }

  parseAddition() {
    let left = this.parseMultiplication();
    while (true) {
      if (this.tryEat(T.PLUS)) left = { type: 'BinaryExpr', op: '+', left, right: this.parseMultiplication() };
      else if (this.tryEat(T.MINUS)) left = { type: 'BinaryExpr', op: '-', left, right: this.parseMultiplication() };
      else break;
    }
    return left;
  }

  parseMultiplication() {
    let left = this.parseUnary();
    while (true) {
      if (this.tryEat(T.STAR)) left = { type: 'BinaryExpr', op: '*', left, right: this.parseUnary() };
      else if (this.tryEat(T.SLASH)) left = { type: 'BinaryExpr', op: '/', left, right: this.parseUnary() };
      else if (this.tryEat(T.PERCENT)) left = { type: 'BinaryExpr', op: '%', left, right: this.parseUnary() };
      else break;
    }
    return left;
  }

  parseUnary() {
    if (this.tryEat(T.BANG)) return { type: 'UnaryExpr', op: '!', operand: this.parseUnary() };
    if (this.at(T.MINUS)) { this.pos++; return { type: 'UnaryExpr', op: '-', operand: this.parseUnary() }; }
    if (this.at(T.TRY)) return this.parseTryExpr();
    return this.parsePostfix();
  }

  parseTryExpr() {
    this.eat(T.TRY);
    const expr = this.parsePostfix();
    return { type: 'TryExpr', expr };
  }

  parsePostfix() {
    let expr = this.parsePrimary();
    while (true) {
      if (this.at(T.LPAREN)) {
        this.eat(T.LPAREN);
        const args = [];
        while (!this.at(T.RPAREN)) {
          args.push(this.parseExpression());
          if (!this.at(T.RPAREN)) this.eat(T.COMMA);
        }
        this.eat(T.RPAREN);
        expr = { type: 'CallExpr', callee: expr, args };
      } else if (this.tryEat(T.DOT)) {
        const prop = this.eat(T.IDENT).value;
        expr = { type: 'MemberExpr', object: expr, property: prop };
      } else if (this.tryEat(T.LBRACKET)) {
        const index = this.parseExpression();
        this.eat(T.RBRACKET);
        expr = { type: 'IndexExpr', object: expr, index };
      } else break;
    }
    return expr;
  }

  parsePrimary() {
    const tok = this.current();

    if (tok.type === T.INT) { this.pos++; return { type: 'IntLiteral', value: tok.value }; }
    if (tok.type === T.FLOAT) { this.pos++; return { type: 'FloatLiteral', value: tok.value }; }

    // String — check for interpolation
    if (tok.type === T.STRING) {
      this.pos++;
      if (tok.value.includes('{')) {
        return this.parseStringInterpolation(tok.value);
      }
      return { type: 'StringLiteral', value: tok.value };
    }

    if (tok.type === T.TRUE) { this.pos++; return { type: 'BoolLiteral', value: true }; }
    if (tok.type === T.FALSE) { this.pos++; return { type: 'BoolLiteral', value: false }; }

    if (tok.type === T.IDENT) {
      this.pos++;
      // Struct literal: TypeName { field: value, ... }
      if (this.at(T.LBRACE) && /^[A-Z]/.test(tok.value)) {
        this.eat(T.LBRACE);
        const fields = [];
        this.skipSemis();
        while (!this.at(T.RBRACE)) {
          const name = this.eat(T.IDENT).value;
          this.eat(T.COLON);
          const value = this.parseExpression();
          fields.push({ name, value });
          this.skipSemis();
          this.tryEat(T.COMMA);
          this.skipSemis();
        }
        this.eat(T.RBRACE);
        return { type: 'StructLiteral', name: tok.value, fields };
      }
      return { type: 'Identifier', name: tok.value };
    }

    if (tok.type === T.LPAREN) {
      this.eat(T.LPAREN);
      const expr = this.parseExpression();
      this.eat(T.RPAREN);
      return expr;
    }

    if (tok.type === T.LBRACKET) {
      this.eat(T.LBRACKET);
      const elements = [];
      while (!this.at(T.RBRACKET)) {
        elements.push(this.parseExpression());
        if (!this.at(T.RBRACKET)) this.eat(T.COMMA);
      }
      this.eat(T.RBRACKET);
      return { type: 'ArrayLiteral', elements };
    }

    if (tok.type === T.IF) return this.parseIfExpr();
    if (tok.type === T.MATCH) return this.parseMatchExpr();
    if (tok.type === T.FN) return this.parseLambda();

    // spawn { body }
    if (tok.type === T.SPAWN) {
      this.eat(T.SPAWN);
      const body = this.parseBlock();
      return { type: 'SpawnExpr', body };
    }

    throw new Error(`Unexpected token '${tok.type}' ("${tok.value}") at ${tok.line}:${tok.col}`);
  }

  // ── String Interpolation ─────────────────────────────────

  parseStringInterpolation(raw) {
    const parts = [];
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '{') {
        const end = this.findMatchingBrace(raw, i);
        const exprSrc = raw.slice(i + 1, end);
        // Lex and parse the expression inside { }
        const lexer = new Lexer(exprSrc);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const expr = parser.parseExpression();
        parts.push({ type: 'ExprPart', expr });
        i = end + 1;
      } else {
        let text = '';
        while (i < raw.length && raw[i] !== '{') { text += raw[i]; i++; }
        if (text) parts.push({ type: 'StringPart', value: text });
      }
    }
    return { type: 'StringInterp', parts };
  }

  findMatchingBrace(str, start) {
    let depth = 1, i = start + 1;
    while (i < str.length && depth > 0) {
      if (str[i] === '{') depth++;
      if (str[i] === '}') depth--;
      i++;
    }
    return i - 1;
  }

  // ── If / Match ───────────────────────────────────────────

  parseIfExpr() {
    this.eat(T.IF);
    const condition = this.parseExpression();
    const then = this.parseBlock();
    let otherwise = null;
    if (this.tryEat(T.ELSE)) {
      if (this.at(T.IF)) otherwise = this.parseIfExpr();
      else otherwise = this.parseBlock();
    }
    return { type: 'IfExpr', condition, then, else: otherwise };
  }

  parseMatchExpr() {
    this.eat(T.MATCH);
    const subject = this.parseExpression();
    this.eat(T.LBRACE);
    const arms = [];
    this.skipSemis();
    while (!this.at(T.RBRACE)) {
      const pattern = this.parseExpression();
      this.eat(T.FAT_ARROW);
      let body;
      if (this.at(T.LBRACE)) body = this.parseBlock();
      else if (this.at(T.RETURN)) body = this.parseReturnStmt();
      else body = this.parseExpression();
      arms.push({ pattern, body });
      this.skipSemis();
    }
    this.eat(T.RBRACE);
    return { type: 'MatchExpr', subject, arms };
  }

  // ── Lambda ───────────────────────────────────────────────

  parseLambda() {
    this.eat(T.FN);
    this.eat(T.LPAREN);
    const params = [];
    while (!this.at(T.RPAREN)) {
      const name = this.eat(T.IDENT).value;
      let typeAnnotation = null;
      if (this.tryEat(T.COLON)) typeAnnotation = this.parseType();
      params.push({ name, typeAnnotation });
      if (!this.at(T.RPAREN)) this.eat(T.COMMA);
    }
    this.eat(T.RPAREN);
    let body;
    if (this.at(T.LBRACE)) body = this.parseBlock();
    else body = this.parseExpression();
    return { type: 'Lambda', params, body };
  }
}

function parse(tokens) {
  return new Parser(tokens).parseProgram();
}

module.exports = { Parser, parse };
