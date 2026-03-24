// clalang — Lexer
// Tokenizes .cl source files into a stream of tokens

const T = {
  // Literals
  INT:    'INT',
  FLOAT:  'FLOAT',
  STRING: 'STRING',

  // Identifier
  IDENT:  'IDENT',

  // Keywords
  FN:       'fn',
  LET:      'let',
  MUT:      'mut',
  RETURN:   'return',
  IF:       'if',
  ELSE:     'else',
  MATCH:    'match',
  TYPE:     'type',
  TEST:     'test',
  ASSERT:   'assert',
  GUARD:    'guard',
  TRY:      'try',
  SPAWN:    'spawn',
  TRUE:     'true',
  FALSE:    'false',
  IMPORT:   'import',
  FOR:      'for',
  IN:       'in',
  WHILE:    'while',
  BREAK:    'break',
  CONTINUE: 'continue',
  BOX:      'box',

  // Operators
  PLUS:      '+',
  MINUS:     '-',
  STAR:      '*',
  SLASH:     '/',
  PERCENT:   '%',
  EQEQ:     '==',
  NEQ:       '!=',
  LT:        '<',
  GT:        '>',
  LTE:       '<=',
  GTE:       '>=',
  AND:       '&&',
  OR:        '||',
  BANG:      '!',
  PIPE:      '|',
  PIPE_GT:   '|>',
  EQ:        '=',
  DOT:       '.',
  DOTDOT:    '..',
  COLON:     ':',
  ARROW:     '->',
  FAT_ARROW: '=>',

  // Delimiters
  LPAREN:   '(',
  RPAREN:   ')',
  LBRACE:   '{',
  RBRACE:   '}',
  LBRACKET: '[',
  RBRACKET: ']',
  COMMA:    ',',

  // Special
  SEMI: 'SEMI',
  EOF:  'EOF',
};

const KEYWORDS = {
  'fn':       T.FN,
  'let':      T.LET,
  'mut':      T.MUT,
  'return':   T.RETURN,
  'if':       T.IF,
  'else':     T.ELSE,
  'match':    T.MATCH,
  'type':     T.TYPE,
  'test':     T.TEST,
  'assert':   T.ASSERT,
  'guard':    T.GUARD,
  'try':      T.TRY,
  'spawn':    T.SPAWN,
  'true':     T.TRUE,
  'false':    T.FALSE,
  'import':   T.IMPORT,
  'for':      T.FOR,
  'in':       T.IN,
  'while':    T.WHILE,
  'break':    T.BREAK,
  'continue': T.CONTINUE,
  'box':      T.BOX,
};

class Token {
  constructor(type, value, line, col) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.col = col;
  }
}

class Lexer {
  constructor(source) {
    this.src = source;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  peek() {
    return this.pos < this.src.length ? this.src[this.pos] : '\0';
  }

  peekAt(offset) {
    const i = this.pos + offset;
    return i < this.src.length ? this.src[i] : '\0';
  }

  advance() {
    const ch = this.src[this.pos];
    this.pos++;
    if (ch === '\n') { this.line++; this.col = 1; }
    else { this.col++; }
    return ch;
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.src.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '/' && this.peekAt(1) === '/') {
        while (this.pos < this.src.length && this.peek() !== '\n') this.advance();
      } else {
        break;
      }
    }
  }

  readString() {
    const startLine = this.line, startCol = this.col;
    this.advance(); // skip "
    let value = '';
    while (this.pos < this.src.length && this.peek() !== '"') {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        switch (esc) {
          case 'n':  value += '\n'; break;
          case 't':  value += '\t'; break;
          case 'r':  value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"':  value += '"';  break;
          case '0':  value += '\0'; break;
          case '{':  value += '{';  break;
          case '}':  value += '}';  break;
          default:   value += esc;  break;
        }
      } else {
        value += this.advance();
      }
    }
    if (this.pos >= this.src.length) throw new Error(`Unterminated string at ${startLine}:${startCol}`);
    this.advance(); // skip closing "
    return new Token(T.STRING, value, startLine, startCol);
  }

  readNumber() {
    const startCol = this.col;
    let num = '';
    let isFloat = false;
    while (this.pos < this.src.length && /[0-9]/.test(this.peek())) num += this.advance();
    if (this.peek() === '.' && this.peekAt(1) !== '.') {
      isFloat = true;
      num += this.advance();
      while (this.pos < this.src.length && /[0-9]/.test(this.peek())) num += this.advance();
    }
    return new Token(isFloat ? T.FLOAT : T.INT, isFloat ? parseFloat(num) : parseInt(num, 10), this.line, startCol);
  }

  readIdentifier() {
    const startCol = this.col;
    let name = '';
    while (this.pos < this.src.length && /[a-zA-Z0-9_]/.test(this.peek())) name += this.advance();
    return new Token(KEYWORDS[name] || T.IDENT, name, this.line, startCol);
  }

  tokenize() {
    const tokens = [];
    while (this.pos < this.src.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.src.length) break;

      const ch = this.peek();
      const line = this.line, col = this.col;

      if (ch === '\n') { this.advance(); tokens.push(new Token('NEWLINE', '\n', line, col)); continue; }
      if (ch === '"') { tokens.push(this.readString()); continue; }
      if (/[0-9]/.test(ch)) { tokens.push(this.readNumber()); continue; }
      if (/[a-zA-Z_]/.test(ch)) { tokens.push(this.readIdentifier()); continue; }

      // Two-character operators
      const two = ch + this.peekAt(1);
      if (two === '==') { this.advance(); this.advance(); tokens.push(new Token(T.EQEQ, '==', line, col)); continue; }
      if (two === '!=') { this.advance(); this.advance(); tokens.push(new Token(T.NEQ, '!=', line, col)); continue; }
      if (two === '<=') { this.advance(); this.advance(); tokens.push(new Token(T.LTE, '<=', line, col)); continue; }
      if (two === '>=') { this.advance(); this.advance(); tokens.push(new Token(T.GTE, '>=', line, col)); continue; }
      if (two === '&&') { this.advance(); this.advance(); tokens.push(new Token(T.AND, '&&', line, col)); continue; }
      if (two === '||') { this.advance(); this.advance(); tokens.push(new Token(T.OR, '||', line, col)); continue; }
      if (two === '|>') { this.advance(); this.advance(); tokens.push(new Token(T.PIPE_GT, '|>', line, col)); continue; }
      if (two === '->') { this.advance(); this.advance(); tokens.push(new Token(T.ARROW, '->', line, col)); continue; }
      if (two === '=>') { this.advance(); this.advance(); tokens.push(new Token(T.FAT_ARROW, '=>', line, col)); continue; }
      if (two === '..') { this.advance(); this.advance(); tokens.push(new Token(T.DOTDOT, '..', line, col)); continue; }

      // Single-character tokens
      this.advance();
      switch (ch) {
        case '+': tokens.push(new Token(T.PLUS,     '+', line, col)); break;
        case '-': tokens.push(new Token(T.MINUS,    '-', line, col)); break;
        case '*': tokens.push(new Token(T.STAR,     '*', line, col)); break;
        case '/': tokens.push(new Token(T.SLASH,    '/', line, col)); break;
        case '%': tokens.push(new Token(T.PERCENT,  '%', line, col)); break;
        case '=': tokens.push(new Token(T.EQ,       '=', line, col)); break;
        case '<': tokens.push(new Token(T.LT,       '<', line, col)); break;
        case '>': tokens.push(new Token(T.GT,       '>', line, col)); break;
        case '!': tokens.push(new Token(T.BANG,      '!', line, col)); break;
        case '|': tokens.push(new Token(T.PIPE,     '|', line, col)); break;
        case '.': tokens.push(new Token(T.DOT,      '.', line, col)); break;
        case ':': tokens.push(new Token(T.COLON,    ':', line, col)); break;
        case ',': tokens.push(new Token(T.COMMA,    ',', line, col)); break;
        case '(': tokens.push(new Token(T.LPAREN,   '(', line, col)); break;
        case ')': tokens.push(new Token(T.RPAREN,   ')', line, col)); break;
        case '{': tokens.push(new Token(T.LBRACE,   '{', line, col)); break;
        case '}': tokens.push(new Token(T.RBRACE,   '}', line, col)); break;
        case '[': tokens.push(new Token(T.LBRACKET, '[', line, col)); break;
        case ']': tokens.push(new Token(T.RBRACKET, ']', line, col)); break;
        default: throw new Error(`Unexpected character '${ch}' at ${line}:${col}`);
      }
    }
    tokens.push(new Token(T.EOF, null, this.line, this.col));
    return insertSemicolons(tokens);
  }
}

const ENDS_STATEMENT = new Set([
  T.IDENT, T.INT, T.FLOAT, T.STRING, T.TRUE, T.FALSE,
  T.RPAREN, T.RBRACE, T.RBRACKET,
  T.RETURN, T.BREAK, T.CONTINUE,
]);

function insertSemicolons(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'NEWLINE') {
      if (result.length > 0 && ENDS_STATEMENT.has(result[result.length - 1].type)) {
        // Don't insert semi before | (enum variant separator)
        let next = i + 1;
        while (next < tokens.length && tokens[next].type === 'NEWLINE') next++;
        if (next < tokens.length && (tokens[next].type === T.PIPE || tokens[next].type === T.PIPE_GT)) continue;
        result.push(new Token(T.SEMI, ';', tok.line, tok.col));
      }
      continue;
    }
    result.push(tok);
  }
  return result;
}

module.exports = { Lexer, Token, T };
