#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ignore/index.js
var require_ignore = __commonJS({
  "node_modules/ignore/index.js"(exports, module) {
    function makeArray(subject) {
      return Array.isArray(subject) ? subject : [subject];
    }
    var UNDEFINED = void 0;
    var EMPTY = "";
    var SPACE = " ";
    var ESCAPE = "\\";
    var REGEX_TEST_BLANK_LINE = /^\s+$/;
    var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
    var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
    var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
    var REGEX_SPLITALL_CRLF = /\r?\n/g;
    var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
    var REGEX_TEST_TRAILING_SLASH = /\/$/;
    var SLASH = "/";
    var TMP_KEY_IGNORE = "node-ignore";
    if (typeof Symbol !== "undefined") {
      TMP_KEY_IGNORE = /* @__PURE__ */ Symbol.for("node-ignore");
    }
    var KEY_IGNORE = TMP_KEY_IGNORE;
    var define = (object, key, value) => {
      Object.defineProperty(object, key, { value });
      return value;
    };
    var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
    var RETURN_FALSE = () => false;
    var sanitizeRange = (range) => range.replace(
      REGEX_REGEXP_RANGE,
      (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
    );
    var negateRange = (range) => range.startsWith("!") || range.startsWith("\\^") ? `^${range.slice(range[0] === "!" ? 1 : 2)}` : range;
    var cleanRangeBackSlash = (slashes) => {
      const { length } = slashes;
      return slashes.slice(0, length - length % 2);
    };
    var REPLACERS = [
      [
        // Remove BOM
        // TODO:
        // Other similar zero-width characters?
        /^\uFEFF/,
        () => EMPTY
      ],
      // > Trailing spaces are ignored unless they are quoted with backslash ("\")
      [
        // (a\ ) -> (a )
        // (a  ) -> (a)
        // (a ) -> (a)
        // (a \ ) -> (a  )
        /((?:\\\\)*?)(\\?\s+)$/,
        (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
      ],
      // Replace (\ ) with ' '
      // (\ ) -> ' '
      // (\\ ) -> '\\ '
      // (\\\ ) -> '\\ '
      [
        /(\\+?)\s/g,
        (_, m1) => {
          const { length } = m1;
          return m1.slice(0, length - length % 2) + SPACE;
        }
      ],
      // Escape metacharacters
      // which is written down by users but means special for regular expressions.
      // > There are 12 characters with special meanings:
      // > - the backslash \,
      // > - the caret ^,
      // > - the dollar sign $,
      // > - the period or dot .,
      // > - the vertical bar or pipe symbol |,
      // > - the question mark ?,
      // > - the asterisk or star *,
      // > - the plus sign +,
      // > - the opening parenthesis (,
      // > - the closing parenthesis ),
      // > - and the opening square bracket [,
      // > - the opening curly brace {,
      // > These special characters are often called "metacharacters".
      [
        /[\\$.|*+(){^]/g,
        (match) => `\\${match}`
      ],
      [
        // > a question mark (?) matches a single character
        /(?!\\)\?/g,
        () => "[^/]"
      ],
      // leading slash
      [
        // > A leading slash matches the beginning of the pathname.
        // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
        // A leading slash matches the beginning of the pathname
        /^\//,
        () => "^"
      ],
      // replace special metacharacter slash after the leading slash
      [
        /\//g,
        () => "\\/"
      ],
      [
        // > A leading "**" followed by a slash means match in all directories.
        // > For example, "**/foo" matches file or directory "foo" anywhere,
        // > the same as pattern "foo".
        // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
        // >   under directory "foo".
        // Notice that the '*'s have been replaced as '\\*'
        /^\^*(?:\\\*\\\*\\\/)+/,
        // '**/foo' <-> 'foo'
        () => "^(?:.*\\/)?"
      ],
      // starting
      [
        // there will be no leading '/'
        //   (which has been replaced by section "leading slash")
        // If starts with '**', adding a '^' to the regular expression also works
        /^(?=[^^])/,
        function startingReplacer() {
          return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
        }
      ],
      // two globstars
      [
        // Use lookahead assertions so that we could match more than one `'/**'`
        /\\\/\\\*\\\*(?=\\\/|$)/g,
        // Zero, one or several directories
        // should not use '*', or it will be replaced by the next replacer
        // Check if it is not the last `'/**'`
        (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
      ],
      // normal intermediate wildcards
      [
        // Never replace escaped '*'
        // ignore rule '\*' will match the path '*'
        // 'abc.*/' -> go
        // 'abc.*'  -> skip this rule,
        //    coz trailing single wildcard will be handed by [trailing wildcard]
        /(^|[^\\]+)(\\\*)+(?=.+)/g,
        // '*.js' matches '.js'
        // '*.js' doesn't match 'abc'
        (_, p1, p2) => {
          const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
          return p1 + unescaped;
        }
      ],
      [
        // unescape, revert step 3 except for back slash
        // For example, if a user escape a '\\*',
        // after step 3, the result will be '\\\\\\*'
        /\\\\\\(?=[$.|*+(){^])/g,
        () => ESCAPE
      ],
      [
        // '\\\\' -> '\\'
        /\\\\/g,
        () => ESCAPE
      ],
      [
        // > The range notation, e.g. [a-zA-Z],
        // > can be used to match one of the characters in a range.
        // `\` is escaped by step 3
        /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
        (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${negateRange(sanitizeRange(range))}${endEscape}]` : "[]" : "[]"
      ],
      // ending
      [
        // 'js' will not match 'js.'
        // 'ab' will not match 'abc'
        /(?:[^*])$/,
        // WTF!
        // https://git-scm.com/docs/gitignore
        // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
        // which re-fixes #24, #38
        // > If there is a separator at the end of the pattern then the pattern
        // > will only match directories, otherwise the pattern can match both
        // > files and directories.
        // 'js*' will not match 'a.js'
        // 'js/' will not match 'a.js'
        // 'js' will match 'a.js' and 'a.js/'
        (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
      ]
    ];
    var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
    var MODE_IGNORE = "regex";
    var MODE_CHECK_IGNORE = "checkRegex";
    var UNDERSCORE = "_";
    var TRAILING_WILD_CARD_REPLACERS = {
      [MODE_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      },
      [MODE_CHECK_IGNORE](_, p1) {
        const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
        return `${prefix}(?=$|\\/$)`;
      }
    };
    var makeRegexPrefix = (pattern) => REPLACERS.reduce(
      (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
      pattern
    );
    var isString = (subject) => typeof subject === "string";
    var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
    var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);
    var IgnoreRule = class {
      constructor(pattern, mark, body, ignoreCase, negative, prefix) {
        this.pattern = pattern;
        this.mark = mark;
        this.negative = negative;
        define(this, "body", body);
        define(this, "ignoreCase", ignoreCase);
        define(this, "regexPrefix", prefix);
      }
      get regex() {
        const key = UNDERSCORE + MODE_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_IGNORE, key);
      }
      get checkRegex() {
        const key = UNDERSCORE + MODE_CHECK_IGNORE;
        if (this[key]) {
          return this[key];
        }
        return this._make(MODE_CHECK_IGNORE, key);
      }
      _make(mode, key) {
        const str = this.regexPrefix.replace(
          REGEX_REPLACE_TRAILING_WILDCARD,
          // It does not need to bind pattern
          TRAILING_WILD_CARD_REPLACERS[mode]
        );
        const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
        return define(this, key, regex);
      }
    };
    var createRule = ({
      pattern,
      mark
    }, ignoreCase) => {
      let negative = false;
      let body = pattern;
      if (body.indexOf("!") === 0) {
        negative = true;
        body = body.substr(1);
      }
      body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
      const regexPrefix = makeRegexPrefix(body);
      return new IgnoreRule(
        pattern,
        mark,
        body,
        ignoreCase,
        negative,
        regexPrefix
      );
    };
    var RuleManager = class {
      constructor(ignoreCase) {
        this._ignoreCase = ignoreCase;
        this._rules = [];
      }
      _add(pattern) {
        if (pattern && pattern[KEY_IGNORE]) {
          this._rules = this._rules.concat(pattern._rules._rules);
          this._added = true;
          return;
        }
        if (isString(pattern)) {
          pattern = {
            pattern
          };
        }
        if (checkPattern(pattern.pattern)) {
          const rule = createRule(pattern, this._ignoreCase);
          this._added = true;
          this._rules.push(rule);
        }
      }
      // @param {Array<string> | string | Ignore} pattern
      add(pattern) {
        this._added = false;
        makeArray(
          isString(pattern) ? splitPattern(pattern) : pattern
        ).forEach(this._add, this);
        return this._added;
      }
      // Test one single path without recursively checking parent directories
      //
      // - checkUnignored `boolean` whether should check if the path is unignored,
      //   setting `checkUnignored` to `false` could reduce additional
      //   path matching.
      // - check `string` either `MODE_IGNORE` or `MODE_CHECK_IGNORE`
      // @returns {TestResult} true if a file is ignored
      test(path18, checkUnignored, mode) {
        let ignored = false;
        let unignored = false;
        let matchedRule;
        this._rules.forEach((rule) => {
          const { negative } = rule;
          if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
            return;
          }
          const matched = rule[mode].test(path18);
          if (!matched) {
            return;
          }
          ignored = !negative;
          unignored = negative;
          matchedRule = negative ? UNDEFINED : rule;
        });
        const ret = {
          ignored,
          unignored
        };
        if (matchedRule) {
          ret.rule = matchedRule;
        }
        return ret;
      }
    };
    var throwError = (message, Ctor) => {
      throw new Ctor(message);
    };
    var checkPath = (path18, originalPath, doThrow) => {
      if (!isString(path18)) {
        return doThrow(
          `path must be a string, but got \`${originalPath}\``,
          TypeError
        );
      }
      if (!path18) {
        return doThrow(`path must not be empty`, TypeError);
      }
      if (checkPath.isNotRelative(path18)) {
        const r = "`path.relative()`d";
        return doThrow(
          `path should be a ${r} string, but got "${originalPath}"`,
          RangeError
        );
      }
      return true;
    };
    var isNotRelative = (path18) => REGEX_TEST_INVALID_PATH.test(path18);
    checkPath.isNotRelative = isNotRelative;
    checkPath.convert = (p) => p;
    var Ignore = class {
      constructor({
        ignorecase = true,
        ignoreCase = ignorecase,
        allowRelativePaths = false
      } = {}) {
        define(this, KEY_IGNORE, true);
        this._rules = new RuleManager(ignoreCase);
        this._strictPathCheck = !allowRelativePaths;
        this._initCache();
      }
      _initCache() {
        this._ignoreCache = /* @__PURE__ */ Object.create(null);
        this._testCache = /* @__PURE__ */ Object.create(null);
      }
      add(pattern) {
        if (this._rules.add(pattern)) {
          this._initCache();
        }
        return this;
      }
      // legacy
      addPattern(pattern) {
        return this.add(pattern);
      }
      // @returns {TestResult}
      _test(originalPath, cache, checkUnignored, slices) {
        const path18 = originalPath && checkPath.convert(originalPath);
        checkPath(
          path18,
          originalPath,
          this._strictPathCheck ? throwError : RETURN_FALSE
        );
        return this._t(path18, cache, checkUnignored, slices);
      }
      checkIgnore(path18) {
        if (!REGEX_TEST_TRAILING_SLASH.test(path18)) {
          return this.test(path18);
        }
        const slices = path18.split(SLASH).filter(Boolean);
        slices.pop();
        if (slices.length) {
          const parent = this._t(
            slices.join(SLASH) + SLASH,
            this._testCache,
            true,
            slices
          );
          if (parent.ignored) {
            return parent;
          }
        }
        return this._rules.test(path18, false, MODE_CHECK_IGNORE);
      }
      _t(path18, cache, checkUnignored, slices) {
        if (path18 in cache) {
          return cache[path18];
        }
        if (!slices) {
          slices = path18.split(SLASH).filter(Boolean);
        }
        slices.pop();
        if (!slices.length) {
          return cache[path18] = this._rules.test(path18, checkUnignored, MODE_IGNORE);
        }
        const parent = this._t(
          slices.join(SLASH) + SLASH,
          cache,
          checkUnignored,
          slices
        );
        return cache[path18] = parent.ignored ? parent : this._rules.test(path18, checkUnignored, MODE_IGNORE);
      }
      ignores(path18) {
        return this._test(path18, this._ignoreCache, false).ignored;
      }
      createFilter() {
        return (path18) => !this.ignores(path18);
      }
      filter(paths) {
        return makeArray(paths).filter(this.createFilter());
      }
      // @returns {TestResult}
      test(path18) {
        return this._test(path18, this._testCache, true);
      }
    };
    var factory = (options) => new Ignore(options);
    var isPathValid = (path18) => checkPath(path18 && checkPath.convert(path18), path18, RETURN_FALSE);
    var setupWindows = () => {
      const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
      checkPath.convert = makePosix;
      const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
      checkPath.isNotRelative = (path18) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path18) || isNotRelative(path18);
    };
    if (
      // Detect `process` so that it can run in browsers.
      typeof process !== "undefined" && process.platform === "win32"
    ) {
      setupWindows();
    }
    module.exports = factory;
    factory.default = factory;
    module.exports.isPathValid = isPathValid;
    define(module.exports, /* @__PURE__ */ Symbol.for("setupWindows"), setupWindows);
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code2) {
        super();
        this._items = typeof code2 === "string" ? [code2] : code2;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code2 = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code2, args[i]);
        code2.push(strs[++i]);
      }
      return new _Code(code2);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code2, arg) {
      if (arg instanceof _Code)
        code2.push(...arg._items);
      else if (arg instanceof Name)
        code2.push(arg);
      else
        code2.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify4(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify4;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line2 = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line2 : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code2 = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code2 = (0, code_1._)`${code2}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code2 = (0, code_1._)`${code2}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code2;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants2) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants2);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants2) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants2);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error2) {
        super();
        this.error = error2;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code2) {
        super();
        this.code = code2;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants2) {
        this.code = optimizeExpr(this.code, names, constants2);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code2, n) => code2 + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants2) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants2))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code2 = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code2 += "else " + this.else.render(opts);
        return code2;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants2) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants2);
        if (!(super.optimizeNames(names, constants2) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants2);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants2) {
        if (!super.optimizeNames(names, constants2))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants2);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants2) {
        if (!super.optimizeNames(names, constants2))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants2);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code2 = "try" + super.render(opts);
        if (this.catch)
          code2 += this.catch.render(opts);
        if (this.finally)
          code2 += this.finally.render(opts);
        return code2;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants2) {
        var _a, _b;
        super.optimizeNames(names, constants2);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants2);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants2);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error2) {
        super();
        this.error = error2;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code2 = ["{"];
        for (const [key, value] of keyValues) {
          if (code2.length > 1)
            code2.push(",");
          code2.push(key);
          if (key !== value || this.opts.es5) {
            code2.push(":");
            (0, code_1.addCodeArg)(code2, value);
          }
        }
        code2.push("}");
        return new code_1._Code(code2);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error2 = this.name("e");
          this._currNode = node.catch = new Catch(error2);
          catchCode(error2);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error2) {
        return this._leafNode(new Throw(error2));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants2) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants2[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants2[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema4) {
      if (typeof schema4 == "boolean")
        return schema4;
      if (Object.keys(schema4).length === 0)
        return true;
      checkUnknownRules(it, schema4);
      return !schemaHasRules(schema4, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema4 = it.schema) {
      const { opts, self: self2 } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema4 === "boolean")
        return;
      const rules = self2.RULES.keywords;
      for (const key in schema4) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema4, rules) {
      if (typeof schema4 == "boolean")
        return !schema4;
      for (const key in schema4)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema4, RULES) {
      if (typeof schema4 == "boolean")
        return !schema4;
      for (const key in schema4)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema4, keyword, $data) {
      if (!$data) {
        if (typeof schema4 == "number" || typeof schema4 == "boolean")
          return schema4;
        if (typeof schema4 == "string")
          return (0, codegen_1._)`${schema4}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error2 = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error2, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error2 = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error2, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error2, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error2, errorPaths);
    }
    function errorObject(cxt, error2, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error2, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema: schema4, validateName } = it;
      if (schema4 === false) {
        falseSchemaError(it, false);
      } else if (typeof schema4 == "object" && schema4.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema: schema4 } = it;
      if (schema4 === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema: schema4, self: self2 }, type) {
      const group = self2.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema4, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema4, group) {
      return group.rules.some((rule) => shouldUseRule(schema4, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema4, rule) {
      var _a;
      return schema4[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema4[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema4) {
      const types = getJSONTypes(schema4.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema4.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema4.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema4.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema: schema4 }) => `must be ${schema4}`,
      params: ({ schema: schema4, schemaValue }) => typeof schema4 == "string" ? (0, codegen_1._)`{type: ${schema4}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema: schema4 } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema4, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema4.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema4,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema: schema4, keyword, it } = cxt;
      if (!Array.isArray(schema4))
        throw new Error("ajv implementation error");
      const alwaysValid = schema4.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema4.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema: schema4, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema4, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema: schema4, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema4, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema4, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema4) : st === "object" ? schema4 && typeof schema4 == "object" && !Array.isArray(schema4) : typeof schema4 == st || allowUndefined && typeof schema4 == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema: schema4, opts, self: self2, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema4, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema4[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self2.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self2.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema: schema4, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema4 !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema4 !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema: schema4,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema4, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema4, "", schema4);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema4, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema4 && typeof schema4 == "object" && !Array.isArray(schema4)) {
        pre(schema4, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema4) {
          var sch = schema4[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema4, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema4, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema4);
          }
        }
        post(schema4, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema4, limit = true) {
      if (typeof schema4 == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema4);
      if (!limit)
        return false;
      return countKeys(schema4) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema4) {
      for (const key in schema4) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema4[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema4) {
      let count = 0;
      for (const key in schema4) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema4[key] == "object") {
          (0, util_1.eachItem)(schema4[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema4, baseId) {
      if (typeof schema4 == "boolean")
        return {};
      const { schemaId: schemaId2, uriResolver } = this.opts;
      const schId = normalizeId(schema4[schemaId2] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema4, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId2] == "string")
          innerBaseId = addRef.call(this, sch[schemaId2]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema: schema4, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema4, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema4, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema: schema4, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema4.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema4, opts) {
      const schId = typeof schema4 == "object" && schema4[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema: schema4, self: self2 }) {
      if (typeof schema4 == "boolean")
        return !schema4;
      for (const key in schema4)
        if (self2.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema: schema4, gen, opts } = it;
      if (opts.$comment && schema4.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema: schema4, errSchemaPath, opts, self: self2 } = it;
      if (schema4.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema4, self2.RULES)) {
        self2.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema: schema4, opts } = it;
      if (schema4.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema: schema4, errSchemaPath, opts }) {
      const msg = schema4.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema: schema4, data, allErrors, opts, self: self2 } = it;
      const { RULES } = self2;
      if (schema4.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema4, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema4, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema: schema4, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema4, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema4;
        if (typeof env.schema == "object")
          schema4 = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema4 === null || schema4 === void 0 ? void 0 : schema4[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema4 === null || schema4 === void 0 ? void 0 : schema4.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve.call(this, root, ref);
      if (_sch === void 0) {
        const schema4 = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId: schemaId2 } = this.opts;
        if (schema4)
          _sch = new SchemaEnv({ schema: schema4, schemaId: schemaId2, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema: schema4 } = schOrRef;
        const { schemaId: schemaId2 } = this.opts;
        const schId = schema4[schemaId2];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema: schema4, schemaId: schemaId2, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema: schema4, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema4 === "boolean")
          return;
        const partSchema = schema4[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema4 = partSchema;
        const schId = typeof schema4 === "object" && schema4[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema4 != "boolean" && schema4.$ref && !(0, util_1.schemaHasRulesButRef)(schema4, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema4.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId: schemaId2 } = this.opts;
      env = env || new SchemaEnv({ schema: schema4, schemaId: schemaId2, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code2 = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code2 = input[i].charCodeAt(0);
        if (code2 === 48) {
          continue;
        }
        if (!(code2 >= 48 && code2 <= 57 || code2 >= 65 && code2 <= 70 || code2 >= 97 && code2 <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code2 = input[i].charCodeAt(0);
        if (!(code2 >= 48 && code2 <= 57 || code2 >= 65 && code2 <= 70 || code2 >= 97 && code2 <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path18) {
      let input = path18;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output += input[i];
        } else {
          output += escape(input[i]);
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path18, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path18 && path18 !== "/" ? path18 : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse2(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse2(baseURI, schemelessOptions), parse2(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse2(serialize(base, options), options);
        relative = parse2(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse2(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve,
      resolveComponent,
      equal,
      serialize,
      parse: parse2
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId: schemaId2 } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId2 === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId2], false);
      }
      defaultMeta() {
        const { meta, schemaId: schemaId2 } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId2] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema4, _meta) {
        const sch = this._addSchema(schema4, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema4, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema4, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema4, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema4)) {
          for (const sch of schema4)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema4 === "object") {
          const { schemaId: schemaId2 } = this.opts;
          id = schema4[schemaId2];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId2} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema4, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema4, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema4, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema4, throwOrLogError) {
        if (typeof schema4 == "boolean")
          return true;
        let $schema;
        $schema = schema4.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema4);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId: schemaId2 } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId: schemaId2 });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema4 = keywords[key];
            if ($data && schema4)
              keywords[key] = schemaOrData(schema4);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas2, regex) {
        for (const keyRef in schemas2) {
          const sch = schemas2[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas2[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas2[keyRef];
            }
          }
        }
      }
      _addSchema(schema4, meta, baseId, validateSchema2 = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId: schemaId2 } = this.opts;
        if (typeof schema4 == "object") {
          id = schema4[schemaId2];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema4 != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema4);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema4, baseId);
        sch = new compile_1.SchemaEnv({ schema: schema4, schemaId: schemaId2, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema2)
          this.validateSchema(schema4, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema4) {
      return { anyOf: [schema4, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self: self2 } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self2, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error2 = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error: error2,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error2 = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error2 = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error: error2,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error2 = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, $data, schema: schema4, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema4);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error2 = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error: error2,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema4.length === 0)
          return;
        const useLoop = schema4.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema4) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema4) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema4, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error2 = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error: error2,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error2 = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, $data, schema: schema4, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema4)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error2 = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema: schema4 } = cxt;
        if ($data || schema4 && typeof schema4 == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema4} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error2 = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, $data, schema: schema4, schemaCode, it } = cxt;
        if (!$data && schema4.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema4.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema4))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema4.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema4[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error: error2,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema: schema4, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema4 === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema4 == "object" && !(0, util_1.alwaysValidSchema)(it, schema4)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema: schema4, it } = cxt;
        if (Array.isArray(schema4))
          return validateTuple(cxt, "additionalItems", schema4);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema4))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error2 = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error: error2,
      code(cxt) {
        const { schema: schema4, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema4))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema4)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema: schema4 }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema4) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema4[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema4[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema4))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error2 = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema4))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema4 === false) {
            deleteAdditional(key);
            return;
          }
          if (schema4 === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema4 == "object" && !(0, util_1.alwaysValidSchema)(it, schema4)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema4, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema4);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema4[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema4[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema: schema4, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema4);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema4[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema: schema4, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema4)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, parentSchema, it } = cxt;
        if (!Array.isArray(schema4))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema4;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema: schema4, it } = cxt;
        if (!Array.isArray(schema4))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema4.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error: error2,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema4 = it.schema[keyword];
      return schema4 !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema4);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v}`, () => gen.assign(v, validate));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema: schema4, self: self2 } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId: schemaId2 } = self2.opts;
      const sch = new compile_1.SchemaEnv({ schema: schema4, schemaId: schemaId2, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self2, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v, _callRef(v, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error2 = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema4 === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema4)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error2 = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error: error2,
      code(cxt) {
        const { gen, schema: schema4, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema4 === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema4 == "object" && !(0, util_1.alwaysValidSchema)(it, schema4)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error2 = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error: error2,
      code(cxt, ruleType) {
        const { gen, data, $data, schema: schema4, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self: self2 } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self2.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self2.formats[schema4];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self2.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema4}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code2 = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema4)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema4, ref: fmtDef, code: code2 });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error2 = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error: error2,
      code(cxt) {
        const { gen, data, schema: schema4, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema4.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema4.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv, sch) {
        return $data ? ajv.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches)
        return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches)
          return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module) {
    module.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv;
    module.exports = exports = Ajv;
    module.exports.Ajv = Ajv;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/limit.js
var require_limit = __commonJS({
  "node_modules/ajv-formats/dist/limit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatLimitDefinition = void 0;
    var ajv_1 = require_ajv();
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      formatMaximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      formatMinimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      formatExclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      formatExclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error2 = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`should be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    exports.formatLimitDefinition = {
      keyword: Object.keys(KWDs),
      type: "string",
      schemaType: "string",
      $data: true,
      error: error2,
      code(cxt) {
        const { gen, data, schemaCode, keyword, it } = cxt;
        const { opts, self: self2 } = it;
        if (!opts.validateFormats)
          return;
        const fCxt = new ajv_1.KeywordCxt(it, self2.RULES.all.format.definition, "format");
        if (fCxt.$data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self2.formats,
            code: opts.code.formats
          });
          const fmt = gen.const("fmt", (0, codegen_1._)`${fmts}[${fCxt.schemaCode}]`);
          cxt.fail$data((0, codegen_1.or)((0, codegen_1._)`typeof ${fmt} != "object"`, (0, codegen_1._)`${fmt} instanceof RegExp`, (0, codegen_1._)`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
        }
        function validateFormat() {
          const format = fCxt.schema;
          const fmtDef = self2.formats[format];
          if (!fmtDef || fmtDef === true)
            return;
          if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function") {
            throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
          }
          const fmt = gen.scopeValue("formats", {
            key: format,
            ref: fmtDef,
            code: opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(format)}` : void 0
          });
          cxt.fail$data(compareCode(fmt));
        }
        function compareCode(fmt) {
          return (0, codegen_1._)`${fmt}.compare(${data}, ${schemaCode}) ${KWDs[keyword].fail} 0`;
        }
      },
      dependencies: ["format"]
    };
    var formatLimitPlugin = (ajv) => {
      ajv.addKeyword(exports.formatLimitDefinition);
      return ajv;
    };
    exports.default = formatLimitPlugin;
  }
});

// node_modules/ajv-formats/dist/index.js
var require_dist = __commonJS({
  "node_modules/ajv-formats/dist/index.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var formats_1 = require_formats();
    var limit_1 = require_limit();
    var codegen_1 = require_codegen();
    var fullName = new codegen_1.Name("fullFormats");
    var fastName = new codegen_1.Name("fastFormats");
    var formatsPlugin = (ajv, opts = { keywords: true }) => {
      if (Array.isArray(opts)) {
        addFormats(ajv, opts, formats_1.fullFormats, fullName);
        return ajv;
      }
      const [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName];
      const list = opts.formats || formats_1.formatNames;
      addFormats(ajv, list, formats, exportName);
      if (opts.keywords)
        (0, limit_1.default)(ajv);
      return ajv;
    };
    formatsPlugin.get = (name, mode = "full") => {
      const formats = mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats;
      const f = formats[name];
      if (!f)
        throw new Error(`Unknown format "${name}"`);
      return f;
    };
    function addFormats(ajv, list, fs2, exportName) {
      var _a;
      var _b;
      (_a = (_b = ajv.opts.code).formats) !== null && _a !== void 0 ? _a : _b.formats = (0, codegen_1._)`require("ajv-formats/dist/formats").${exportName}`;
      for (const f of list)
        ajv.addFormat(f, fs2[f]);
    }
    module.exports = exports = formatsPlugin;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = formatsPlugin;
  }
});

// src/cli/main.ts
import { pathToFileURL } from "node:url";
import { hostname } from "node:os";

// node_modules/commander/lib/error.js
var CommanderError = class extends Error {
  /**
   * Constructs the CommanderError class
   * @param {number} exitCode suggested exit code which could be used with process.exit
   * @param {string} code an id string representing the error
   * @param {string} message human-readable description of the error
   */
  constructor(exitCode, code2, message) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = code2;
    this.exitCode = exitCode;
    this.nestedError = void 0;
  }
};
var InvalidArgumentError = class extends CommanderError {
  /**
   * Constructs the InvalidArgumentError class
   * @param {string} [message] explanation of why argument is invalid
   */
  constructor(message) {
    super(1, "commander.invalidArgument", message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
  }
};

// node_modules/commander/lib/argument.js
var Argument = class {
  /**
   * Initialize a new command argument with the given name and description.
   * The default is that the argument is required, and you can explicitly
   * indicate this with <> around the name. Put [] around the name for an optional argument.
   *
   * @param {string} name
   * @param {string} [description]
   */
  constructor(name, description) {
    this.description = description || "";
    this.variadic = false;
    this.parseArg = void 0;
    this.defaultValue = void 0;
    this.defaultValueDescription = void 0;
    this.argChoices = void 0;
    switch (name[0]) {
      case "<":
        this.required = true;
        this._name = name.slice(1, -1);
        break;
      case "[":
        this.required = false;
        this._name = name.slice(1, -1);
        break;
      default:
        this.required = true;
        this._name = name;
        break;
    }
    if (this._name.endsWith("...")) {
      this.variadic = true;
      this._name = this._name.slice(0, -3);
    }
  }
  /**
   * Return argument name.
   *
   * @return {string}
   */
  name() {
    return this._name;
  }
  /**
   * @package
   */
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  /**
   * Set the default value, and optionally supply the description to be displayed in the help.
   *
   * @param {*} value
   * @param {string} [description]
   * @return {Argument}
   */
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  /**
   * Set the custom handler for processing CLI command arguments into argument values.
   *
   * @param {Function} [fn]
   * @return {Argument}
   */
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  /**
   * Only allow argument value to be one of choices.
   *
   * @param {string[]} values
   * @return {Argument}
   */
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(
          `Allowed choices are ${this.argChoices.join(", ")}.`
        );
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  /**
   * Make argument required.
   *
   * @returns {Argument}
   */
  argRequired() {
    this.required = true;
    return this;
  }
  /**
   * Make argument optional.
   *
   * @returns {Argument}
   */
  argOptional() {
    this.required = false;
    return this;
  }
};
function humanReadableArgName(arg) {
  const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
  return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
}

// node_modules/commander/lib/command.js
import { EventEmitter } from "node:events";
import childProcess from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import process2 from "node:process";
import { stripVTControlCharacters as stripVTControlCharacters2 } from "node:util";

// node_modules/commander/lib/help.js
import { stripVTControlCharacters } from "node:util";
var Help = class {
  constructor() {
    this.helpWidth = void 0;
    this.minWidthToWrap = 40;
    this.sortSubcommands = false;
    this.sortOptions = false;
    this.showGlobalOptions = false;
  }
  /**
   * prepareContext is called by Commander after applying overrides from `Command.configureHelp()`
   * and just before calling `formatHelp()`.
   *
   * Commander just uses the helpWidth and the rest is provided for optional use by more complex subclasses.
   *
   * @param {{ error?: boolean, helpWidth?: number, outputHasColors?: boolean }} contextOptions
   */
  prepareContext(contextOptions) {
    this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
  }
  /**
   * Get an array of the visible subcommands. Includes a placeholder for the implicit help command, if there is one.
   *
   * @param {Command} cmd
   * @returns {Command[]}
   */
  visibleCommands(cmd) {
    const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
    const helpCommand = cmd._getHelpCommand();
    if (helpCommand && !helpCommand._hidden) {
      visibleCommands.push(helpCommand);
    }
    if (this.sortSubcommands) {
      visibleCommands.sort((a, b) => {
        return a.name().localeCompare(b.name());
      });
    }
    return visibleCommands;
  }
  /**
   * Compare options for sort.
   *
   * @param {Option} a
   * @param {Option} b
   * @returns {number}
   */
  compareOptions(a, b) {
    const getSortKey = (option) => {
      return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
    };
    return getSortKey(a).localeCompare(getSortKey(b));
  }
  /**
   * Get an array of the visible options. Includes a placeholder for the implicit help option, if there is one.
   *
   * @param {Command} cmd
   * @returns {Option[]}
   */
  visibleOptions(cmd) {
    const visibleOptions = cmd.options.filter((option) => !option.hidden);
    const helpOption = cmd._getHelpOption();
    if (helpOption && !helpOption.hidden) {
      const removeShort = helpOption.short && cmd._findOption(helpOption.short);
      const removeLong = helpOption.long && cmd._findOption(helpOption.long);
      if (!removeShort && !removeLong) {
        visibleOptions.push(helpOption);
      } else if (helpOption.long && !removeLong) {
        visibleOptions.push(
          cmd.createOption(helpOption.long, helpOption.description)
        );
      } else if (helpOption.short && !removeShort) {
        visibleOptions.push(
          cmd.createOption(helpOption.short, helpOption.description)
        );
      }
    }
    if (this.sortOptions) {
      visibleOptions.sort(this.compareOptions);
    }
    return visibleOptions;
  }
  /**
   * Get an array of the visible global options. (Not including help.)
   *
   * @param {Command} cmd
   * @returns {Option[]}
   */
  visibleGlobalOptions(cmd) {
    if (!this.showGlobalOptions) return [];
    const globalOptions = [];
    for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      const visibleOptions = ancestorCmd.options.filter(
        (option) => !option.hidden
      );
      globalOptions.push(...visibleOptions);
    }
    if (this.sortOptions) {
      globalOptions.sort(this.compareOptions);
    }
    return globalOptions;
  }
  /**
   * Get an array of the arguments if any have a description.
   *
   * @param {Command} cmd
   * @returns {Argument[]}
   */
  visibleArguments(cmd) {
    if (cmd._argsDescription) {
      cmd.registeredArguments.forEach((argument) => {
        argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
      });
    }
    if (cmd.registeredArguments.find((argument) => argument.description)) {
      return cmd.registeredArguments;
    }
    return [];
  }
  /**
   * Get the command term to show in the list of subcommands.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  subcommandTerm(cmd) {
    const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
    return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + // simplistic check for non-help option
    (args ? " " + args : "");
  }
  /**
   * Get the option term to show in the list of options.
   *
   * @param {Option} option
   * @returns {string}
   */
  optionTerm(option) {
    return option.flags;
  }
  /**
   * Get the argument term to show in the list of arguments.
   *
   * @param {Argument} argument
   * @returns {string}
   */
  argumentTerm(argument) {
    return argument.name();
  }
  /**
   * Get the longest command term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestSubcommandTermLength(cmd, helper) {
    return helper.visibleCommands(cmd).reduce((max, command) => {
      return Math.max(
        max,
        this.displayWidth(
          helper.styleSubcommandTerm(helper.subcommandTerm(command))
        )
      );
    }, 0);
  }
  /**
   * Get the longest option term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestOptionTermLength(cmd, helper) {
    return helper.visibleOptions(cmd).reduce((max, option) => {
      return Math.max(
        max,
        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
      );
    }, 0);
  }
  /**
   * Get the longest global option term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestGlobalOptionTermLength(cmd, helper) {
    return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
      return Math.max(
        max,
        this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option)))
      );
    }, 0);
  }
  /**
   * Get the longest argument term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  longestArgumentTermLength(cmd, helper) {
    return helper.visibleArguments(cmd).reduce((max, argument) => {
      return Math.max(
        max,
        this.displayWidth(
          helper.styleArgumentTerm(helper.argumentTerm(argument))
        )
      );
    }, 0);
  }
  /**
   * Get the command usage to be displayed at the top of the built-in help.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  commandUsage(cmd) {
    let cmdName = cmd._name;
    if (cmd._aliases[0]) {
      cmdName = cmdName + "|" + cmd._aliases[0];
    }
    let ancestorCmdNames = "";
    for (let ancestorCmd = cmd.parent; ancestorCmd; ancestorCmd = ancestorCmd.parent) {
      ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
    }
    return ancestorCmdNames + cmdName + " " + cmd.usage();
  }
  /**
   * Get the description for the command.
   *
   * @param {Command} cmd
   * @returns {string}
   */
  commandDescription(cmd) {
    return cmd.description();
  }
  /**
   * Get the subcommand summary to show in the list of subcommands.
   * (Fallback to description for backwards compatibility.)
   *
   * @param {Command} cmd
   * @returns {string}
   */
  subcommandDescription(cmd) {
    return cmd.summary() || cmd.description();
  }
  /**
   * Get the option description to show in the list of options.
   *
   * @param {Option} option
   * @return {string}
   */
  optionDescription(option) {
    const extraInfo = [];
    if (option.argChoices) {
      extraInfo.push(
        // use stringify to match the display of the default value
        `choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
      );
    }
    if (option.defaultValue !== void 0) {
      const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
      if (showDefault) {
        extraInfo.push(
          `default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`
        );
      }
    }
    if (option.presetArg !== void 0 && option.optional) {
      extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
    }
    if (option.envVar !== void 0) {
      extraInfo.push(`env: ${option.envVar}`);
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (option.description) {
        return `${option.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return option.description;
  }
  /**
   * Get the argument description to show in the list of arguments.
   *
   * @param {Argument} argument
   * @return {string}
   */
  argumentDescription(argument) {
    const extraInfo = [];
    if (argument.argChoices) {
      extraInfo.push(
        // use stringify to match the display of the default value
        `choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`
      );
    }
    if (argument.defaultValue !== void 0) {
      extraInfo.push(
        `default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`
      );
    }
    if (extraInfo.length > 0) {
      const extraDescription = `(${extraInfo.join(", ")})`;
      if (argument.description) {
        return `${argument.description} ${extraDescription}`;
      }
      return extraDescription;
    }
    return argument.description;
  }
  /**
   * Format a list of items, given a heading and an array of formatted items.
   *
   * @param {string} heading
   * @param {string[]} items
   * @param {Help} helper
   * @returns string[]
   */
  formatItemList(heading, items, helper) {
    if (items.length === 0) return [];
    return [helper.styleTitle(heading), ...items, ""];
  }
  /**
   * Group items by their help group heading.
   *
   * @param {Command[] | Option[]} unsortedItems
   * @param {Command[] | Option[]} visibleItems
   * @param {Function} getGroup
   * @returns {Map<string, Command[] | Option[]>}
   */
  groupItems(unsortedItems, visibleItems, getGroup) {
    const result = /* @__PURE__ */ new Map();
    unsortedItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group)) result.set(group, []);
    });
    visibleItems.forEach((item) => {
      const group = getGroup(item);
      if (!result.has(group)) {
        result.set(group, []);
      }
      result.get(group).push(item);
    });
    return result;
  }
  /**
   * Generate the built-in help text.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {string}
   */
  formatHelp(cmd, helper) {
    const termWidth = helper.padWidth(cmd, helper);
    const helpWidth = helper.helpWidth ?? 80;
    function callFormatItem(term, description) {
      return helper.formatItem(term, termWidth, description, helper);
    }
    let output = [
      `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
      ""
    ];
    const commandDescription = helper.commandDescription(cmd);
    if (commandDescription.length > 0) {
      output = output.concat([
        helper.boxWrap(
          helper.styleCommandDescription(commandDescription),
          helpWidth
        ),
        ""
      ]);
    }
    const argumentList = helper.visibleArguments(cmd).map((argument) => {
      return callFormatItem(
        helper.styleArgumentTerm(helper.argumentTerm(argument)),
        helper.styleArgumentDescription(helper.argumentDescription(argument))
      );
    });
    output = output.concat(
      this.formatItemList("Arguments:", argumentList, helper)
    );
    const optionGroups = this.groupItems(
      cmd.options,
      helper.visibleOptions(cmd),
      (option) => option.helpGroupHeading ?? "Options:"
    );
    optionGroups.forEach((options, group) => {
      const optionList = options.map((option) => {
        return callFormatItem(
          helper.styleOptionTerm(helper.optionTerm(option)),
          helper.styleOptionDescription(helper.optionDescription(option))
        );
      });
      output = output.concat(this.formatItemList(group, optionList, helper));
    });
    if (helper.showGlobalOptions) {
      const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
        return callFormatItem(
          helper.styleOptionTerm(helper.optionTerm(option)),
          helper.styleOptionDescription(helper.optionDescription(option))
        );
      });
      output = output.concat(
        this.formatItemList("Global Options:", globalOptionList, helper)
      );
    }
    const commandGroups = this.groupItems(
      cmd.commands,
      helper.visibleCommands(cmd),
      (sub) => sub.helpGroup() || "Commands:"
    );
    commandGroups.forEach((commands, group) => {
      const commandList = commands.map((sub) => {
        return callFormatItem(
          helper.styleSubcommandTerm(helper.subcommandTerm(sub)),
          helper.styleSubcommandDescription(helper.subcommandDescription(sub))
        );
      });
      output = output.concat(this.formatItemList(group, commandList, helper));
    });
    return output.join("\n");
  }
  /**
   * Return display width of string, ignoring ANSI escape sequences. Used in padding and wrapping calculations.
   *
   * @param {string} str
   * @returns {number}
   */
  displayWidth(str) {
    return stripVTControlCharacters(str).length;
  }
  /**
   * Style the title for displaying in the help. Called with 'Usage:', 'Options:', etc.
   *
   * @param {string} str
   * @returns {string}
   */
  styleTitle(str) {
    return str;
  }
  styleUsage(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]") return this.styleOptionText(word);
      if (word === "[command]") return this.styleSubcommandText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleCommandText(word);
    }).join(" ");
  }
  styleCommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleOptionDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleSubcommandDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleArgumentDescription(str) {
    return this.styleDescriptionText(str);
  }
  styleDescriptionText(str) {
    return str;
  }
  styleOptionTerm(str) {
    return this.styleOptionText(str);
  }
  styleSubcommandTerm(str) {
    return str.split(" ").map((word) => {
      if (word === "[options]") return this.styleOptionText(word);
      if (word[0] === "[" || word[0] === "<")
        return this.styleArgumentText(word);
      return this.styleSubcommandText(word);
    }).join(" ");
  }
  styleArgumentTerm(str) {
    return this.styleArgumentText(str);
  }
  styleOptionText(str) {
    return str;
  }
  styleArgumentText(str) {
    return str;
  }
  styleSubcommandText(str) {
    return str;
  }
  styleCommandText(str) {
    return str;
  }
  /**
   * Calculate the pad width from the maximum term length.
   *
   * @param {Command} cmd
   * @param {Help} helper
   * @returns {number}
   */
  padWidth(cmd, helper) {
    return Math.max(
      helper.longestOptionTermLength(cmd, helper),
      helper.longestGlobalOptionTermLength(cmd, helper),
      helper.longestSubcommandTermLength(cmd, helper),
      helper.longestArgumentTermLength(cmd, helper)
    );
  }
  /**
   * Detect manually wrapped and indented strings by checking for line break followed by whitespace.
   *
   * @param {string} str
   * @returns {boolean}
   */
  preformatted(str) {
    return /\n[^\S\r\n]/.test(str);
  }
  /**
   * Format the "item", which consists of a term and description. Pad the term and wrap the description, indenting the following lines.
   *
   * So "TTT", 5, "DDD DDDD DD DDD" might be formatted for this.helpWidth=17 like so:
   *   TTT  DDD DDDD
   *        DD DDD
   *
   * @param {string} term
   * @param {number} termWidth
   * @param {string} description
   * @param {Help} helper
   * @returns {string}
   */
  formatItem(term, termWidth, description, helper) {
    const itemIndent = 2;
    const itemIndentStr = " ".repeat(itemIndent);
    if (!description) return itemIndentStr + term;
    const paddedTerm = term.padEnd(
      termWidth + term.length - helper.displayWidth(term)
    );
    const spacerWidth = 2;
    const helpWidth = this.helpWidth ?? 80;
    const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
    let formattedDescription;
    if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
      formattedDescription = description;
    } else {
      const wrappedDescription = helper.boxWrap(description, remainingWidth);
      formattedDescription = wrappedDescription.replace(
        /\n/g,
        "\n" + " ".repeat(termWidth + spacerWidth)
      );
    }
    return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
  }
  /**
   * Wrap a string at whitespace, preserving existing line breaks.
   * Wrapping is skipped if the width is less than `minWidthToWrap`.
   *
   * @param {string} str
   * @param {number} width
   * @returns {string}
   */
  boxWrap(str, width) {
    if (width < this.minWidthToWrap) return str;
    const rawLines = str.split(/\r\n|\n/);
    const chunkPattern = /[\s]*[^\s]+/g;
    const wrappedLines = [];
    rawLines.forEach((line2) => {
      const chunks = line2.match(chunkPattern);
      if (chunks === null) {
        wrappedLines.push("");
        return;
      }
      let sumChunks = [chunks.shift()];
      let sumWidth = this.displayWidth(sumChunks[0]);
      chunks.forEach((chunk) => {
        const visibleWidth = this.displayWidth(chunk);
        if (sumWidth + visibleWidth <= width) {
          sumChunks.push(chunk);
          sumWidth += visibleWidth;
          return;
        }
        wrappedLines.push(sumChunks.join(""));
        const nextChunk = chunk.trimStart();
        sumChunks = [nextChunk];
        sumWidth = this.displayWidth(nextChunk);
      });
      wrappedLines.push(sumChunks.join(""));
    });
    return wrappedLines.join("\n");
  }
};

// node_modules/commander/lib/option.js
var Option = class {
  /**
   * Initialize a new `Option` with the given `flags` and `description`.
   *
   * @param {string} flags
   * @param {string} [description]
   */
  constructor(flags, description) {
    this.flags = flags;
    this.description = description || "";
    this.required = flags.includes("<");
    this.optional = flags.includes("[");
    this.variadic = /\w\.\.\.[>\]]$/.test(flags);
    this.mandatory = false;
    const optionFlags = splitOptionFlags(flags);
    this.short = optionFlags.shortFlag;
    this.long = optionFlags.longFlag;
    this.negate = false;
    if (this.long) {
      this.negate = this.long.startsWith("--no-");
    }
    this.defaultValue = void 0;
    this.defaultValueDescription = void 0;
    this.presetArg = void 0;
    this.envVar = void 0;
    this.parseArg = void 0;
    this.hidden = false;
    this.argChoices = void 0;
    this.conflictsWith = [];
    this.implied = void 0;
    this.helpGroupHeading = void 0;
  }
  /**
   * Set the default value, and optionally supply the description to be displayed in the help.
   *
   * @param {*} value
   * @param {string} [description]
   * @return {Option}
   */
  default(value, description) {
    this.defaultValue = value;
    this.defaultValueDescription = description;
    return this;
  }
  /**
   * Preset to use when option used without option-argument, especially optional but also boolean and negated.
   * The custom processing (parseArg) is called.
   *
   * @example
   * new Option('--color').default('GREYSCALE').preset('RGB');
   * new Option('--donate [amount]').preset('20').argParser(parseFloat);
   *
   * @param {*} arg
   * @return {Option}
   */
  preset(arg) {
    this.presetArg = arg;
    return this;
  }
  /**
   * Add option name(s) that conflict with this option.
   * An error will be displayed if conflicting options are found during parsing.
   *
   * @example
   * new Option('--rgb').conflicts('cmyk');
   * new Option('--js').conflicts(['ts', 'jsx']);
   *
   * @param {(string | string[])} names
   * @return {Option}
   */
  conflicts(names) {
    this.conflictsWith = this.conflictsWith.concat(names);
    return this;
  }
  /**
   * Specify implied option values for when this option is set and the implied options are not.
   *
   * The custom processing (parseArg) is not called on the implied values.
   *
   * @example
   * program
   *   .addOption(new Option('--log', 'write logging information to file'))
   *   .addOption(new Option('--trace', 'log extra details').implies({ log: 'trace.txt' }));
   *
   * @param {object} impliedOptionValues
   * @return {Option}
   */
  implies(impliedOptionValues) {
    let newImplied = impliedOptionValues;
    if (typeof impliedOptionValues === "string") {
      newImplied = { [impliedOptionValues]: true };
    }
    this.implied = Object.assign(this.implied || {}, newImplied);
    return this;
  }
  /**
   * Set environment variable to check for option value.
   *
   * An environment variable is only used if when processed the current option value is
   * undefined, or the source of the current value is 'default' or 'config' or 'env'.
   *
   * @param {string} name
   * @return {Option}
   */
  env(name) {
    this.envVar = name;
    return this;
  }
  /**
   * Set the custom handler for processing CLI option arguments into option values.
   *
   * @param {Function} [fn]
   * @return {Option}
   */
  argParser(fn) {
    this.parseArg = fn;
    return this;
  }
  /**
   * Whether the option is mandatory and must have a value after parsing.
   *
   * @param {boolean} [mandatory=true]
   * @return {Option}
   */
  makeOptionMandatory(mandatory = true) {
    this.mandatory = !!mandatory;
    return this;
  }
  /**
   * Hide option in help.
   *
   * @param {boolean} [hide=true]
   * @return {Option}
   */
  hideHelp(hide = true) {
    this.hidden = !!hide;
    return this;
  }
  /**
   * @package
   */
  _collectValue(value, previous) {
    if (previous === this.defaultValue || !Array.isArray(previous)) {
      return [value];
    }
    previous.push(value);
    return previous;
  }
  /**
   * Only allow option value to be one of choices.
   *
   * @param {string[]} values
   * @return {Option}
   */
  choices(values) {
    this.argChoices = values.slice();
    this.parseArg = (arg, previous) => {
      if (!this.argChoices.includes(arg)) {
        throw new InvalidArgumentError(
          `Allowed choices are ${this.argChoices.join(", ")}.`
        );
      }
      if (this.variadic) {
        return this._collectValue(arg, previous);
      }
      return arg;
    };
    return this;
  }
  /**
   * Return option name.
   *
   * @return {string}
   */
  name() {
    if (this.long) {
      return this.long.replace(/^--/, "");
    }
    return this.short.replace(/^-/, "");
  }
  /**
   * Return option name, in a camelcase format that can be used
   * as an object attribute key.
   *
   * @return {string}
   */
  attributeName() {
    if (this.negate) {
      return camelcase(this.name().replace(/^no-/, ""));
    }
    return camelcase(this.name());
  }
  /**
   * Set the help group heading.
   *
   * @param {string} heading
   * @return {Option}
   */
  helpGroup(heading) {
    this.helpGroupHeading = heading;
    return this;
  }
  /**
   * Check if `arg` matches the short or long flag.
   *
   * @param {string} arg
   * @return {boolean}
   * @package
   */
  is(arg) {
    return this.short === arg || this.long === arg;
  }
  /**
   * Return whether a boolean option.
   *
   * Options are one of boolean, negated, required argument, or optional argument.
   *
   * @return {boolean}
   * @package
   */
  isBoolean() {
    return !this.required && !this.optional && !this.negate;
  }
};
var DualOptions = class {
  /**
   * @param {Option[]} options
   */
  constructor(options) {
    this.positiveOptions = /* @__PURE__ */ new Map();
    this.negativeOptions = /* @__PURE__ */ new Map();
    this.dualOptions = /* @__PURE__ */ new Set();
    options.forEach((option) => {
      if (option.negate) {
        this.negativeOptions.set(option.attributeName(), option);
      } else {
        this.positiveOptions.set(option.attributeName(), option);
      }
    });
    this.negativeOptions.forEach((value, key) => {
      if (this.positiveOptions.has(key)) {
        this.dualOptions.add(key);
      }
    });
  }
  /**
   * Did the value come from the option, and not from possible matching dual option?
   *
   * @param {*} value
   * @param {Option} option
   * @returns {boolean}
   */
  valueFromOption(value, option) {
    const optionKey = option.attributeName();
    if (!this.dualOptions.has(optionKey)) return true;
    const preset = this.negativeOptions.get(optionKey).presetArg;
    const negativeValue = preset !== void 0 ? preset : false;
    return option.negate === (negativeValue === value);
  }
};
function camelcase(str) {
  return str.split("-").reduce((str2, word) => {
    return str2 + word[0].toUpperCase() + word.slice(1);
  });
}
function splitOptionFlags(flags) {
  let shortFlag;
  let longFlag;
  const shortFlagExp = /^-[^-]$/;
  const longFlagExp = /^--[^-]/;
  const flagParts = flags.split(/[ |,]+/).concat("guard");
  if (shortFlagExp.test(flagParts[0])) shortFlag = flagParts.shift();
  if (longFlagExp.test(flagParts[0])) longFlag = flagParts.shift();
  if (!shortFlag && shortFlagExp.test(flagParts[0]))
    shortFlag = flagParts.shift();
  if (!shortFlag && longFlagExp.test(flagParts[0])) {
    shortFlag = longFlag;
    longFlag = flagParts.shift();
  }
  if (flagParts[0].startsWith("-")) {
    const unsupportedFlag = flagParts[0];
    const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
    if (/^-[^-][^-]/.test(unsupportedFlag))
      throw new Error(
        `${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`
      );
    if (shortFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many short flags`);
    if (longFlagExp.test(unsupportedFlag))
      throw new Error(`${baseError}
- too many long flags`);
    throw new Error(`${baseError}
- unrecognised flag format`);
  }
  if (shortFlag === void 0 && longFlag === void 0)
    throw new Error(
      `option creation failed due to no flags found in '${flags}'.`
    );
  return { shortFlag, longFlag };
}

// node_modules/commander/lib/suggestSimilar.js
var maxDistance = 3;
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > maxDistance)
    return Math.max(a.length, b.length);
  const d = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      let cost;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
      } else {
        cost = 1;
      }
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        // deletion
        d[i][j - 1] + 1,
        // insertion
        d[i - 1][j - 1] + cost
        // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
function suggestSimilar(word, candidates) {
  if (!candidates || candidates.length === 0) return "";
  candidates = Array.from(new Set(candidates));
  const searchingOptions = word.startsWith("--");
  if (searchingOptions) {
    word = word.slice(2);
    candidates = candidates.map((candidate) => candidate.slice(2));
  }
  let similar = [];
  let bestDistance = maxDistance;
  const minSimilarity = 0.4;
  candidates.forEach((candidate) => {
    if (candidate.length <= 1) return;
    const distance = editDistance(word, candidate);
    const length = Math.max(word.length, candidate.length);
    const similarity = (length - distance) / length;
    if (similarity > minSimilarity) {
      if (distance < bestDistance) {
        bestDistance = distance;
        similar = [candidate];
      } else if (distance === bestDistance) {
        similar.push(candidate);
      }
    }
  });
  similar.sort((a, b) => a.localeCompare(b));
  if (searchingOptions) {
    similar = similar.map((candidate) => `--${candidate}`);
  }
  if (similar.length > 1) {
    return `
(Did you mean one of ${similar.join(", ")}?)`;
  }
  if (similar.length === 1) {
    return `
(Did you mean ${similar[0]}?)`;
  }
  return "";
}

// node_modules/commander/lib/command.js
var Command = class _Command extends EventEmitter {
  /**
   * Initialize a new `Command`.
   *
   * @param {string} [name]
   */
  constructor(name) {
    super();
    this.commands = [];
    this.options = [];
    this.parent = null;
    this._allowUnknownOption = false;
    this._allowExcessArguments = false;
    this.registeredArguments = [];
    this._args = this.registeredArguments;
    this.args = [];
    this.rawArgs = [];
    this.processedArgs = [];
    this._scriptPath = null;
    this._name = name || "";
    this._optionValues = {};
    this._optionValueSources = {};
    this._storeOptionsAsProperties = false;
    this._actionHandler = null;
    this._executableHandler = false;
    this._executableFile = null;
    this._executableDir = null;
    this._defaultCommandName = null;
    this._exitCallback = null;
    this._aliases = [];
    this._combineFlagAndOptionalValue = true;
    this._description = "";
    this._summary = "";
    this._argsDescription = void 0;
    this._enablePositionalOptions = false;
    this._passThroughOptions = false;
    this._lifeCycleHooks = {};
    this._showHelpAfterError = false;
    this._showSuggestionAfterError = true;
    this._savedState = null;
    this._outputConfiguration = {
      writeOut: (str) => process2.stdout.write(str),
      writeErr: (str) => process2.stderr.write(str),
      outputError: (str, write) => write(str),
      getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : void 0,
      getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : void 0,
      getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
      getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
      stripColor: (str) => stripVTControlCharacters2(str)
    };
    this._hidden = false;
    this._helpOption = void 0;
    this._addImplicitHelpCommand = void 0;
    this._helpCommand = void 0;
    this._helpConfiguration = {};
    this._helpGroupHeading = void 0;
    this._defaultCommandGroup = void 0;
    this._defaultOptionGroup = void 0;
  }
  /**
   * Copy settings that are useful to have in common across root command and subcommands.
   *
   * (Used internally when adding a command using `.command()` so subcommands inherit parent settings.)
   *
   * @param {Command} sourceCommand
   * @return {Command} `this` command for chaining
   */
  copyInheritedSettings(sourceCommand) {
    this._outputConfiguration = sourceCommand._outputConfiguration;
    this._helpOption = sourceCommand._helpOption;
    this._helpCommand = sourceCommand._helpCommand;
    this._helpConfiguration = sourceCommand._helpConfiguration;
    this._exitCallback = sourceCommand._exitCallback;
    this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
    this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
    this._allowExcessArguments = sourceCommand._allowExcessArguments;
    this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
    this._showHelpAfterError = sourceCommand._showHelpAfterError;
    this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
    return this;
  }
  /**
   * @returns {Command[]}
   * @private
   */
  _getCommandAndAncestors() {
    const result = [];
    for (let command = this; command; command = command.parent) {
      result.push(command);
    }
    return result;
  }
  /**
   * Define a command.
   *
   * There are two styles of command: pay attention to where to put the description.
   *
   * @example
   * // Command implemented using action handler (description is supplied separately to `.command`)
   * program
   *   .command('clone <source> [destination]')
   *   .description('clone a repository into a newly created directory')
   *   .action((source, destination) => {
   *     console.log('clone command called');
   *   });
   *
   * // Command implemented using separate executable file (description is second parameter to `.command`)
   * program
   *   .command('start <service>', 'start named service')
   *   .command('stop [service]', 'stop named service, or all if no name supplied');
   *
   * @param {string} nameAndArgs - command name and arguments, args are `<required>` or `[optional]` and last may also be `variadic...`
   * @param {(object | string)} [actionOptsOrExecDesc] - configuration options (for action), or description (for executable)
   * @param {object} [execOpts] - configuration options (for executable)
   * @return {Command} returns new command for action handler, or `this` for executable command
   */
  command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
    let desc = actionOptsOrExecDesc;
    let opts = execOpts;
    if (typeof desc === "object" && desc !== null) {
      opts = desc;
      desc = null;
    }
    opts = opts || {};
    const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const cmd = this.createCommand(name);
    if (desc) {
      cmd.description(desc);
      cmd._executableHandler = true;
    }
    if (opts.isDefault) this._defaultCommandName = cmd._name;
    cmd._hidden = !!(opts.noHelp || opts.hidden);
    cmd._executableFile = opts.executableFile || null;
    if (args) cmd.arguments(args);
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd.copyInheritedSettings(this);
    if (desc) return this;
    return cmd;
  }
  /**
   * Factory routine to create a new unattached command.
   *
   * See .command() for creating an attached subcommand, which uses this routine to
   * create the command. You can override createCommand to customise subcommands.
   *
   * @param {string} [name]
   * @return {Command} new command
   */
  createCommand(name) {
    return new _Command(name);
  }
  /**
   * You can customise the help with a subclass of Help by overriding createHelp,
   * or by overriding Help properties using configureHelp().
   *
   * @return {Help}
   */
  createHelp() {
    return Object.assign(new Help(), this.configureHelp());
  }
  /**
   * You can customise the help by overriding Help properties using configureHelp(),
   * or with a subclass of Help by overriding createHelp().
   *
   * @param {object} [configuration] - configuration options
   * @return {(Command | object)} `this` command for chaining, or stored configuration
   */
  configureHelp(configuration) {
    if (configuration === void 0) return this._helpConfiguration;
    this._helpConfiguration = configuration;
    return this;
  }
  /**
   * The default output goes to stdout and stderr. You can customise this for special
   * applications. You can also customise the display of errors by overriding outputError.
   *
   * The configuration properties are all functions:
   *
   *     // change how output being written, defaults to stdout and stderr
   *     writeOut(str)
   *     writeErr(str)
   *     // change how output being written for errors, defaults to writeErr
   *     outputError(str, write) // used for displaying errors and not used for displaying help
   *     // specify width for wrapping help
   *     getOutHelpWidth()
   *     getErrHelpWidth()
   *     // color support, currently only used with Help
   *     getOutHasColors()
   *     getErrHasColors()
   *     stripColor() // used to remove ANSI escape codes if output does not have colors
   *
   * @param {object} [configuration] - configuration options
   * @return {(Command | object)} `this` command for chaining, or stored configuration
   */
  configureOutput(configuration) {
    if (configuration === void 0) return this._outputConfiguration;
    this._outputConfiguration = {
      ...this._outputConfiguration,
      ...configuration
    };
    return this;
  }
  /**
   * Display the help or a custom message after an error occurs.
   *
   * @param {(boolean|string)} [displayHelp]
   * @return {Command} `this` command for chaining
   */
  showHelpAfterError(displayHelp = true) {
    if (typeof displayHelp !== "string") displayHelp = !!displayHelp;
    this._showHelpAfterError = displayHelp;
    return this;
  }
  /**
   * Display suggestion of similar commands for unknown commands, or options for unknown options.
   *
   * @param {boolean} [displaySuggestion]
   * @return {Command} `this` command for chaining
   */
  showSuggestionAfterError(displaySuggestion = true) {
    this._showSuggestionAfterError = !!displaySuggestion;
    return this;
  }
  /**
   * Add a prepared subcommand.
   *
   * See .command() for creating an attached subcommand which inherits settings from its parent.
   *
   * @param {Command} cmd - new subcommand
   * @param {object} [opts] - configuration options
   * @return {Command} `this` command for chaining
   */
  addCommand(cmd, opts) {
    if (!cmd._name) {
      throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
    }
    opts = opts || {};
    if (opts.isDefault) this._defaultCommandName = cmd._name;
    if (opts.noHelp || opts.hidden) cmd._hidden = true;
    this._registerCommand(cmd);
    cmd.parent = this;
    cmd._checkForBrokenPassThrough();
    return this;
  }
  /**
   * Factory routine to create a new unattached argument.
   *
   * See .argument() for creating an attached argument, which uses this routine to
   * create the argument. You can override createArgument to return a custom argument.
   *
   * @param {string} name
   * @param {string} [description]
   * @return {Argument} new argument
   */
  createArgument(name, description) {
    return new Argument(name, description);
  }
  /**
   * Define argument syntax for command.
   *
   * The default is that the argument is required, and you can explicitly
   * indicate this with <> around the name. Put [] around the name for an optional argument.
   *
   * @example
   * program.argument('<input-file>');
   * program.argument('[output-file]');
   *
   * @param {string} name
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom argument processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  argument(name, description, parseArg, defaultValue) {
    const argument = this.createArgument(name, description);
    if (typeof parseArg === "function") {
      argument.default(defaultValue).argParser(parseArg);
    } else {
      argument.default(parseArg);
    }
    this.addArgument(argument);
    return this;
  }
  /**
   * Define argument syntax for command, adding multiple at once (without descriptions).
   *
   * See also .argument().
   *
   * @example
   * program.arguments('<cmd> [env]');
   *
   * @param {string} names
   * @return {Command} `this` command for chaining
   */
  arguments(names) {
    names.trim().split(/ +/).forEach((detail) => {
      this.argument(detail);
    });
    return this;
  }
  /**
   * Define argument syntax for command, adding a prepared argument.
   *
   * @param {Argument} argument
   * @return {Command} `this` command for chaining
   */
  addArgument(argument) {
    const previousArgument = this.registeredArguments.slice(-1)[0];
    if (previousArgument?.variadic) {
      throw new Error(
        `only the last argument can be variadic '${previousArgument.name()}'`
      );
    }
    if (argument.required && argument.defaultValue !== void 0 && argument.parseArg === void 0) {
      throw new Error(
        `a default value for a required argument is never used: '${argument.name()}'`
      );
    }
    this.registeredArguments.push(argument);
    return this;
  }
  /**
   * Customise or override default help command. By default a help command is automatically added if your command has subcommands.
   *
   * @example
   *    program.helpCommand('help [cmd]');
   *    program.helpCommand('help [cmd]', 'show help');
   *    program.helpCommand(false); // suppress default help command
   *    program.helpCommand(true); // add help command even if no subcommands
   *
   * @param {string|boolean} enableOrNameAndArgs - enable with custom name and/or arguments, or boolean to override whether added
   * @param {string} [description] - custom description
   * @return {Command} `this` command for chaining
   */
  helpCommand(enableOrNameAndArgs, description) {
    if (typeof enableOrNameAndArgs === "boolean") {
      this._addImplicitHelpCommand = enableOrNameAndArgs;
      if (enableOrNameAndArgs && this._defaultCommandGroup) {
        this._initCommandGroup(this._getHelpCommand());
      }
      return this;
    }
    const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
    const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
    const helpDescription = description ?? "display help for command";
    const helpCommand = this.createCommand(helpName);
    helpCommand.helpOption(false);
    if (helpArgs) helpCommand.arguments(helpArgs);
    if (helpDescription) helpCommand.description(helpDescription);
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    if (enableOrNameAndArgs || description) this._initCommandGroup(helpCommand);
    return this;
  }
  /**
   * Add prepared custom help command.
   *
   * @param {(Command|string|boolean)} helpCommand - custom help command, or deprecated enableOrNameAndArgs as for `.helpCommand()`
   * @param {string} [deprecatedDescription] - deprecated custom description used with custom name only
   * @return {Command} `this` command for chaining
   */
  addHelpCommand(helpCommand, deprecatedDescription) {
    if (typeof helpCommand !== "object") {
      this.helpCommand(helpCommand, deprecatedDescription);
      return this;
    }
    this._addImplicitHelpCommand = true;
    this._helpCommand = helpCommand;
    this._initCommandGroup(helpCommand);
    return this;
  }
  /**
   * Lazy create help command.
   *
   * @return {(Command|null)}
   * @package
   */
  _getHelpCommand() {
    const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
    if (hasImplicitHelpCommand) {
      if (this._helpCommand === void 0) {
        this.helpCommand(void 0, void 0);
      }
      return this._helpCommand;
    }
    return null;
  }
  /**
   * Add hook for life cycle event.
   *
   * @param {string} event
   * @param {Function} listener
   * @return {Command} `this` command for chaining
   */
  hook(event, listener) {
    const allowedValues = ["preSubcommand", "preAction", "postAction"];
    if (!allowedValues.includes(event)) {
      throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    if (this._lifeCycleHooks[event]) {
      this._lifeCycleHooks[event].push(listener);
    } else {
      this._lifeCycleHooks[event] = [listener];
    }
    return this;
  }
  /**
   * Register callback to use as replacement for calling process.exit.
   *
   * @param {Function} [fn] optional callback which will be passed a CommanderError, defaults to throwing
   * @return {Command} `this` command for chaining
   */
  exitOverride(fn) {
    if (fn) {
      this._exitCallback = fn;
    } else {
      this._exitCallback = (err) => {
        if (err.code !== "commander.executeSubCommandAsync") {
          throw err;
        } else {
        }
      };
    }
    return this;
  }
  /**
   * Call process.exit, and _exitCallback if defined.
   *
   * @param {number} exitCode exit code for using with process.exit
   * @param {string} code an id string representing the error
   * @param {string} message human-readable description of the error
   * @return never
   * @private
   */
  _exit(exitCode, code2, message) {
    if (this._exitCallback) {
      this._exitCallback(new CommanderError(exitCode, code2, message));
    }
    process2.exit(exitCode);
  }
  /**
   * Register callback `fn` for the command.
   *
   * @example
   * program
   *   .command('serve')
   *   .description('start service')
   *   .action(function() {
   *      // do work here
   *   });
   *
   * @param {Function} fn
   * @return {Command} `this` command for chaining
   */
  action(fn) {
    const listener = (args) => {
      const expectedArgsCount = this.registeredArguments.length;
      const actionArgs = args.slice(0, expectedArgsCount);
      if (this._storeOptionsAsProperties) {
        actionArgs[expectedArgsCount] = this;
      } else {
        actionArgs[expectedArgsCount] = this.opts();
      }
      actionArgs.push(this);
      return fn.apply(this, actionArgs);
    };
    this._actionHandler = listener;
    return this;
  }
  /**
   * Factory routine to create a new unattached option.
   *
   * See .option() for creating an attached option, which uses this routine to
   * create the option. You can override createOption to return a custom option.
   *
   * @param {string} flags
   * @param {string} [description]
   * @return {Option} new option
   */
  createOption(flags, description) {
    return new Option(flags, description);
  }
  /**
   * Wrap parseArgs to catch 'commander.invalidArgument'.
   *
   * @param {(Option | Argument)} target
   * @param {string} value
   * @param {*} previous
   * @param {string} invalidArgumentMessage
   * @private
   */
  _callParseArg(target, value, previous, invalidArgumentMessage) {
    try {
      return target.parseArg(value, previous);
    } catch (err) {
      if (err.code === "commander.invalidArgument") {
        const message = `${invalidArgumentMessage} ${err.message}`;
        this.error(message, { exitCode: err.exitCode, code: err.code });
      }
      throw err;
    }
  }
  /**
   * Check for option flag conflicts.
   * Register option if no conflicts found, or throw on conflict.
   *
   * @param {Option} option
   * @private
   */
  _registerOption(option) {
    const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
    if (matchingOption) {
      const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
      throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
    }
    this._initOptionGroup(option);
    this.options.push(option);
  }
  /**
   * Check for command name and alias conflicts with existing commands.
   * Register command if no conflicts found, or throw on conflict.
   *
   * @param {Command} command
   * @private
   */
  _registerCommand(command) {
    const knownBy = (cmd) => {
      return [cmd.name()].concat(cmd.aliases());
    };
    const alreadyUsed = knownBy(command).find(
      (name) => this._findCommand(name)
    );
    if (alreadyUsed) {
      const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
      const newCmd = knownBy(command).join("|");
      throw new Error(
        `cannot add command '${newCmd}' as already have command '${existingCmd}'`
      );
    }
    this._initCommandGroup(command);
    this.commands.push(command);
  }
  /**
   * Add an option.
   *
   * @param {Option} option
   * @return {Command} `this` command for chaining
   */
  addOption(option) {
    this._registerOption(option);
    const oname = option.name();
    const name = option.attributeName();
    if (option.defaultValue !== void 0) {
      this.setOptionValueWithSource(name, option.defaultValue, "default");
    }
    const handleOptionValue = (val, invalidValueMessage, valueSource) => {
      if (val == null && option.presetArg !== void 0) {
        val = option.presetArg;
      }
      const oldValue = this.getOptionValue(name);
      if (val !== null && option.parseArg) {
        val = this._callParseArg(option, val, oldValue, invalidValueMessage);
      } else if (val !== null && option.variadic) {
        val = option._collectValue(val, oldValue);
      }
      if (val == null) {
        if (option.negate) {
          val = false;
        } else if (option.isBoolean() || option.optional) {
          val = true;
        } else {
          val = "";
        }
      }
      this.setOptionValueWithSource(name, val, valueSource);
    };
    this.on("option:" + oname, (val) => {
      const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
      handleOptionValue(val, invalidValueMessage, "cli");
    });
    if (option.envVar) {
      this.on("optionEnv:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "env");
      });
    }
    return this;
  }
  /**
   * Internal implementation shared by .option() and .requiredOption()
   *
   * @return {Command} `this` command for chaining
   * @private
   */
  _optionEx(config, flags, description, fn, defaultValue) {
    if (typeof flags === "object" && flags instanceof Option) {
      throw new Error(
        "To add an Option object use addOption() instead of option() or requiredOption()"
      );
    }
    const option = this.createOption(flags, description);
    option.makeOptionMandatory(!!config.mandatory);
    if (typeof fn === "function") {
      option.default(defaultValue).argParser(fn);
    } else if (fn instanceof RegExp) {
      const regex = fn;
      fn = (val, def) => {
        const m = regex.exec(val);
        return m ? m[0] : def;
      };
      option.default(defaultValue).argParser(fn);
    } else {
      option.default(fn);
    }
    return this.addOption(option);
  }
  /**
   * Define option with `flags`, `description`, and optional argument parsing function or `defaultValue` or both.
   *
   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space. A required
   * option-argument is indicated by `<>` and an optional option-argument by `[]`.
   *
   * See the README for more details, and see also addOption() and requiredOption().
   *
   * @example
   * program
   *     .option('-p, --pepper', 'add pepper')
   *     .option('--pt, --pizza-type <TYPE>', 'type of pizza') // required option-argument
   *     .option('-c, --cheese [CHEESE]', 'add extra cheese', 'mozzarella') // optional option-argument with default
   *     .option('-t, --tip <VALUE>', 'add tip to purchase cost', parseFloat) // custom parse function
   *
   * @param {string} flags
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom option processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  option(flags, description, parseArg, defaultValue) {
    return this._optionEx({}, flags, description, parseArg, defaultValue);
  }
  /**
   * Add a required option which must have a value after parsing. This usually means
   * the option must be specified on the command line. (Otherwise the same as .option().)
   *
   * The `flags` string contains the short and/or long flags, separated by comma, a pipe or space.
   *
   * @param {string} flags
   * @param {string} [description]
   * @param {(Function|*)} [parseArg] - custom option processing function or default value
   * @param {*} [defaultValue]
   * @return {Command} `this` command for chaining
   */
  requiredOption(flags, description, parseArg, defaultValue) {
    return this._optionEx(
      { mandatory: true },
      flags,
      description,
      parseArg,
      defaultValue
    );
  }
  /**
   * Alter parsing of short flags with optional values.
   *
   * @example
   * // for `.option('-f,--flag [value]'):
   * program.combineFlagAndOptionalValue(true);  // `-f80` is treated like `--flag=80`, this is the default behaviour
   * program.combineFlagAndOptionalValue(false) // `-fb` is treated like `-f -b`
   *
   * @param {boolean} [combine] - if `true` or omitted, an optional value can be specified directly after the flag.
   * @return {Command} `this` command for chaining
   */
  combineFlagAndOptionalValue(combine = true) {
    this._combineFlagAndOptionalValue = !!combine;
    return this;
  }
  /**
   * Allow unknown options on the command line.
   *
   * @param {boolean} [allowUnknown] - if `true` or omitted, no error will be thrown for unknown options.
   * @return {Command} `this` command for chaining
   */
  allowUnknownOption(allowUnknown = true) {
    this._allowUnknownOption = !!allowUnknown;
    return this;
  }
  /**
   * Allow excess command-arguments on the command line. Pass false to make excess arguments an error.
   *
   * @param {boolean} [allowExcess] - if `true` or omitted, no error will be thrown for excess arguments.
   * @return {Command} `this` command for chaining
   */
  allowExcessArguments(allowExcess = true) {
    this._allowExcessArguments = !!allowExcess;
    return this;
  }
  /**
   * Enable positional options. Positional means global options are specified before subcommands which lets
   * subcommands reuse the same option names, and also enables subcommands to turn on passThroughOptions.
   * The default behaviour is non-positional and global options may appear anywhere on the command line.
   *
   * @param {boolean} [positional]
   * @return {Command} `this` command for chaining
   */
  enablePositionalOptions(positional = true) {
    this._enablePositionalOptions = !!positional;
    return this;
  }
  /**
   * Pass through options that come after command-arguments rather than treat them as command-options,
   * so actual command-options come before command-arguments. Turning this on for a subcommand requires
   * positional options to have been enabled on the program (parent commands).
   * The default behaviour is non-positional and options may appear before or after command-arguments.
   *
   * @param {boolean} [passThrough] for unknown options.
   * @return {Command} `this` command for chaining
   */
  passThroughOptions(passThrough = true) {
    this._passThroughOptions = !!passThrough;
    this._checkForBrokenPassThrough();
    return this;
  }
  /**
   * @private
   */
  _checkForBrokenPassThrough() {
    if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
      throw new Error(
        `passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`
      );
    }
  }
  /**
   * Whether to store option values as properties on command object,
   * or store separately (specify false). In both cases the option values can be accessed using .opts().
   *
   * @param {boolean} [storeAsProperties=true]
   * @return {Command} `this` command for chaining
   */
  storeOptionsAsProperties(storeAsProperties = true) {
    if (this.options.length) {
      throw new Error("call .storeOptionsAsProperties() before adding options");
    }
    if (Object.keys(this._optionValues).length) {
      throw new Error(
        "call .storeOptionsAsProperties() before setting option values"
      );
    }
    this._storeOptionsAsProperties = !!storeAsProperties;
    return this;
  }
  /**
   * Retrieve option value.
   *
   * @param {string} key
   * @return {object} value
   */
  getOptionValue(key) {
    if (this._storeOptionsAsProperties) {
      return this[key];
    }
    return this._optionValues[key];
  }
  /**
   * Store option value.
   *
   * @param {string} key
   * @param {object} value
   * @return {Command} `this` command for chaining
   */
  setOptionValue(key, value) {
    return this.setOptionValueWithSource(key, value, void 0);
  }
  /**
   * Store option value and where the value came from.
   *
   * @param {string} key
   * @param {object} value
   * @param {string} source - expected values are default/config/env/cli/implied
   * @return {Command} `this` command for chaining
   */
  setOptionValueWithSource(key, value, source) {
    if (this._storeOptionsAsProperties) {
      this[key] = value;
    } else {
      this._optionValues[key] = value;
    }
    this._optionValueSources[key] = source;
    return this;
  }
  /**
   * Get source of option value.
   * Expected values are default | config | env | cli | implied
   *
   * @param {string} key
   * @return {string}
   */
  getOptionValueSource(key) {
    return this._optionValueSources[key];
  }
  /**
   * Get source of option value. See also .optsWithGlobals().
   * Expected values are default | config | env | cli | implied
   *
   * @param {string} key
   * @return {string}
   */
  getOptionValueSourceWithGlobals(key) {
    let source;
    this._getCommandAndAncestors().forEach((cmd) => {
      if (cmd.getOptionValueSource(key) !== void 0) {
        source = cmd.getOptionValueSource(key);
      }
    });
    return source;
  }
  /**
   * Get user arguments from implied or explicit arguments.
   * Side-effects: set _scriptPath if args included script. Used for default program name, and subcommand searches.
   *
   * @private
   */
  _prepareUserArgs(argv, parseOptions2) {
    if (argv !== void 0 && !Array.isArray(argv)) {
      throw new Error("first parameter to parse must be array or undefined");
    }
    parseOptions2 = parseOptions2 || {};
    if (argv === void 0 && parseOptions2.from === void 0) {
      if (process2.versions?.electron) {
        parseOptions2.from = "electron";
      }
      const execArgv = process2.execArgv ?? [];
      if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
        parseOptions2.from = "eval";
      }
    }
    if (argv === void 0) {
      argv = process2.argv;
    }
    this.rawArgs = argv.slice();
    let userArgs;
    switch (parseOptions2.from) {
      case void 0:
      case "node":
        this._scriptPath = argv[1];
        userArgs = argv.slice(2);
        break;
      case "electron":
        if (process2.defaultApp) {
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
        } else {
          userArgs = argv.slice(1);
        }
        break;
      case "user":
        userArgs = argv.slice(0);
        break;
      case "eval":
        userArgs = argv.slice(1);
        break;
      default:
        throw new Error(
          `unexpected parse option { from: '${parseOptions2.from}' }`
        );
    }
    if (!this._name && this._scriptPath)
      this.nameFromFilename(this._scriptPath);
    this._name = this._name || "program";
    return userArgs;
  }
  /**
   * Parse `argv`, setting options and invoking commands when defined.
   *
   * Use parseAsync instead of parse if any of your action handlers are async.
   *
   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
   *
   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
   * - `'user'`: just user arguments
   *
   * @example
   * program.parse(); // parse process.argv and auto-detect electron and special node flags
   * program.parse(process.argv); // assume argv[0] is app and argv[1] is script
   * program.parse(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
   *
   * @param {string[]} [argv] - optional, defaults to process.argv
   * @param {object} [parseOptions] - optionally specify style of options with from: node/user/electron
   * @param {string} [parseOptions.from] - where the args are from: 'node', 'user', 'electron'
   * @return {Command} `this` command for chaining
   */
  parse(argv, parseOptions2) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions2);
    this._parseCommand([], userArgs);
    return this;
  }
  /**
   * Parse `argv`, setting options and invoking commands when defined.
   *
   * Call with no parameters to parse `process.argv`. Detects Electron and special node options like `node --eval`. Easy mode!
   *
   * Or call with an array of strings to parse, and optionally where the user arguments start by specifying where the arguments are `from`:
   * - `'node'`: default, `argv[0]` is the application and `argv[1]` is the script being run, with user arguments after that
   * - `'electron'`: `argv[0]` is the application and `argv[1]` varies depending on whether the electron application is packaged
   * - `'user'`: just user arguments
   *
   * @example
   * await program.parseAsync(); // parse process.argv and auto-detect electron and special node flags
   * await program.parseAsync(process.argv); // assume argv[0] is app and argv[1] is script
   * await program.parseAsync(my-args, { from: 'user' }); // just user supplied arguments, nothing special about argv[0]
   *
   * @param {string[]} [argv]
   * @param {object} [parseOptions]
   * @param {string} parseOptions.from - where the args are from: 'node', 'user', 'electron'
   * @return {Promise}
   */
  async parseAsync(argv, parseOptions2) {
    this._prepareForParse();
    const userArgs = this._prepareUserArgs(argv, parseOptions2);
    await this._parseCommand([], userArgs);
    return this;
  }
  _prepareForParse() {
    if (this._savedState === null) {
      this.options.filter(
        (option) => option.negate && option.defaultValue === void 0 && this.getOptionValue(option.attributeName()) === void 0
      ).forEach((option) => {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(
            option.attributeName(),
            true,
            "default"
          );
        }
      });
      this.saveStateBeforeParse();
    } else {
      this.restoreStateBeforeParse();
    }
  }
  /**
   * Called the first time parse is called to save state and allow a restore before subsequent calls to parse.
   * Not usually called directly, but available for subclasses to save their custom state.
   *
   * This is called in a lazy way. Only commands used in parsing chain will have state saved.
   */
  saveStateBeforeParse() {
    this._savedState = {
      // name is stable if supplied by author, but may be unspecified for root command and deduced during parsing
      _name: this._name,
      // option values before parse have default values (including false for negated options)
      // shallow clones
      _optionValues: { ...this._optionValues },
      _optionValueSources: { ...this._optionValueSources }
    };
  }
  /**
   * Restore state before parse for calls after the first.
   * Not usually called directly, but available for subclasses to save their custom state.
   *
   * This is called in a lazy way. Only commands used in parsing chain will have state restored.
   */
  restoreStateBeforeParse() {
    if (this._storeOptionsAsProperties)
      throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
    this._name = this._savedState._name;
    this._scriptPath = null;
    this.rawArgs = [];
    this._optionValues = { ...this._savedState._optionValues };
    this._optionValueSources = { ...this._savedState._optionValueSources };
    this.args = [];
    this.processedArgs = [];
  }
  /**
   * Throw if expected executable is missing. Add lots of help for author.
   *
   * @param {string} executableFile
   * @param {string} executableDir
   * @param {string} subcommandName
   */
  _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
    if (fs.existsSync(executableFile)) return;
    const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
    const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
    throw new Error(executableMissing);
  }
  /**
   * Execute a sub-command executable.
   *
   * @private
   */
  _executeSubCommand(subcommand, args) {
    args = args.slice();
    const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
    function findFile(baseDir, baseName) {
      const localBin = path.resolve(baseDir, baseName);
      if (fs.existsSync(localBin)) return localBin;
      if (sourceExt.includes(path.extname(baseName))) return void 0;
      const foundExt = sourceExt.find(
        (ext) => fs.existsSync(`${localBin}${ext}`)
      );
      if (foundExt) return `${localBin}${foundExt}`;
      return void 0;
    }
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
    let executableDir = this._executableDir || "";
    if (this._scriptPath) {
      let resolvedScriptPath;
      try {
        resolvedScriptPath = fs.realpathSync(this._scriptPath);
      } catch {
        resolvedScriptPath = this._scriptPath;
      }
      executableDir = path.resolve(
        path.dirname(resolvedScriptPath),
        executableDir
      );
    }
    if (executableDir) {
      let localFile = findFile(executableDir, executableFile);
      if (!localFile && !subcommand._executableFile && this._scriptPath) {
        const legacyName = path.basename(
          this._scriptPath,
          path.extname(this._scriptPath)
        );
        if (legacyName !== this._name) {
          localFile = findFile(
            executableDir,
            `${legacyName}-${subcommand._name}`
          );
        }
      }
      executableFile = localFile || executableFile;
    }
    const launchWithNode = sourceExt.includes(path.extname(executableFile));
    let proc;
    if (process2.platform !== "win32") {
      if (launchWithNode) {
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
      } else {
        proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
      }
    } else {
      this._checkForMissingExecutable(
        executableFile,
        executableDir,
        subcommand._name
      );
      args.unshift(executableFile);
      args = incrementNodeInspectorPort(process2.execArgv).concat(args);
      proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
    }
    if (!proc.killed) {
      const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
      signals.forEach((signal) => {
        process2.on(signal, () => {
          if (proc.killed === false && proc.exitCode === null) {
            proc.kill(signal);
          }
        });
      });
    }
    const exitCallback = this._exitCallback;
    proc.on("close", (code2) => {
      code2 = code2 ?? 1;
      if (!exitCallback) {
        process2.exit(code2);
      } else {
        exitCallback(
          new CommanderError(
            code2,
            "commander.executeSubCommandAsync",
            "(close)"
          )
        );
      }
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        this._checkForMissingExecutable(
          executableFile,
          executableDir,
          subcommand._name
        );
      } else if (err.code === "EACCES") {
        throw new Error(`'${executableFile}' not executable`);
      }
      if (!exitCallback) {
        process2.exit(1);
      } else {
        const wrappedError = new CommanderError(
          1,
          "commander.executeSubCommandAsync",
          "(error)"
        );
        wrappedError.nestedError = err;
        exitCallback(wrappedError);
      }
    });
    this.runningCommand = proc;
  }
  /**
   * @private
   */
  _dispatchSubcommand(commandName, operands, unknown) {
    const subCommand = this._findCommand(commandName);
    if (!subCommand) this.help({ error: true });
    subCommand._prepareForParse();
    let promiseChain;
    promiseChain = this._chainOrCallSubCommandHook(
      promiseChain,
      subCommand,
      "preSubcommand"
    );
    promiseChain = this._chainOrCall(promiseChain, () => {
      if (subCommand._executableHandler) {
        this._executeSubCommand(subCommand, operands.concat(unknown));
      } else {
        return subCommand._parseCommand(operands, unknown);
      }
    });
    return promiseChain;
  }
  /**
   * Invoke help directly if possible, or dispatch if necessary.
   * e.g. help foo
   *
   * @private
   */
  _dispatchHelpCommand(subcommandName) {
    if (!subcommandName) {
      this.help();
    }
    const subCommand = this._findCommand(subcommandName);
    if (subCommand && !subCommand._executableHandler) {
      subCommand.help();
    }
    return this._dispatchSubcommand(
      subcommandName,
      [],
      [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]
    );
  }
  /**
   * Check this.args against expected this.registeredArguments.
   *
   * @private
   */
  _checkNumberOfArguments() {
    this.registeredArguments.forEach((arg, i) => {
      if (arg.required && this.args[i] == null) {
        this.missingArgument(arg.name());
      }
    });
    if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
      return;
    }
    if (this.args.length > this.registeredArguments.length) {
      this._excessArguments(this.args);
    }
  }
  /**
   * Process this.args using this.registeredArguments and save as this.processedArgs!
   *
   * @private
   */
  _processArguments() {
    const myParseArg = (argument, value, previous) => {
      let parsedValue = value;
      if (value !== null && argument.parseArg) {
        const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
        parsedValue = this._callParseArg(
          argument,
          value,
          previous,
          invalidValueMessage
        );
      }
      return parsedValue;
    };
    this._checkNumberOfArguments();
    const processedArgs = [];
    this.registeredArguments.forEach((declaredArg, index) => {
      let value = declaredArg.defaultValue;
      if (declaredArg.variadic) {
        if (index < this.args.length) {
          value = this.args.slice(index);
          if (declaredArg.parseArg) {
            value = value.reduce((processed, v) => {
              return myParseArg(declaredArg, v, processed);
            }, declaredArg.defaultValue);
          }
        } else if (value === void 0) {
          value = [];
        }
      } else if (index < this.args.length) {
        value = this.args[index];
        if (declaredArg.parseArg) {
          value = myParseArg(declaredArg, value, declaredArg.defaultValue);
        }
      }
      processedArgs[index] = value;
    });
    this.processedArgs = processedArgs;
  }
  /**
   * Once we have a promise we chain, but call synchronously until then.
   *
   * @param {(Promise|undefined)} promise
   * @param {Function} fn
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCall(promise, fn) {
    if (promise?.then && typeof promise.then === "function") {
      return promise.then(() => fn());
    }
    return fn();
  }
  /**
   *
   * @param {(Promise|undefined)} promise
   * @param {string} event
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCallHooks(promise, event) {
    let result = promise;
    const hooks = [];
    this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== void 0).forEach((hookedCommand) => {
      hookedCommand._lifeCycleHooks[event].forEach((callback) => {
        hooks.push({ hookedCommand, callback });
      });
    });
    if (event === "postAction") {
      hooks.reverse();
    }
    hooks.forEach((hookDetail) => {
      result = this._chainOrCall(result, () => {
        return hookDetail.callback(hookDetail.hookedCommand, this);
      });
    });
    return result;
  }
  /**
   *
   * @param {(Promise|undefined)} promise
   * @param {Command} subCommand
   * @param {string} event
   * @return {(Promise|undefined)}
   * @private
   */
  _chainOrCallSubCommandHook(promise, subCommand, event) {
    let result = promise;
    if (this._lifeCycleHooks[event] !== void 0) {
      this._lifeCycleHooks[event].forEach((hook) => {
        result = this._chainOrCall(result, () => {
          return hook(this, subCommand);
        });
      });
    }
    return result;
  }
  /**
   * Process arguments in context of this command.
   * Returns action result, in case it is a promise.
   *
   * @private
   */
  _parseCommand(operands, unknown) {
    const parsed = this.parseOptions(unknown);
    this._parseOptionsEnv();
    this._parseOptionsImplied();
    operands = operands.concat(parsed.operands);
    unknown = parsed.unknown;
    this.args = operands.concat(unknown);
    if (operands && this._findCommand(operands[0])) {
      return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
    }
    if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
      return this._dispatchHelpCommand(operands[1]);
    }
    if (this._defaultCommandName) {
      this._outputHelpIfRequested(unknown);
      return this._dispatchSubcommand(
        this._defaultCommandName,
        operands,
        unknown
      );
    }
    if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
      this.help({ error: true });
    }
    this._outputHelpIfRequested(parsed.unknown);
    this._checkForMissingMandatoryOptions();
    this._checkForConflictingOptions();
    const checkForUnknownOptions = () => {
      if (parsed.unknown.length > 0) {
        this.unknownOption(parsed.unknown[0]);
      }
    };
    const commandEvent = `command:${this.name()}`;
    if (this._actionHandler) {
      checkForUnknownOptions();
      this._processArguments();
      let promiseChain;
      promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
      promiseChain = this._chainOrCall(
        promiseChain,
        () => this._actionHandler(this.processedArgs)
      );
      if (this.parent) {
        promiseChain = this._chainOrCall(promiseChain, () => {
          this.parent.emit(commandEvent, operands, unknown);
        });
      }
      promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
      return promiseChain;
    }
    if (this.parent?.listenerCount(commandEvent)) {
      checkForUnknownOptions();
      this._processArguments();
      this.parent.emit(commandEvent, operands, unknown);
    } else if (operands.length) {
      if (this._findCommand("*")) {
        return this._dispatchSubcommand("*", operands, unknown);
      }
      if (this.listenerCount("command:*")) {
        this.emit("command:*", operands, unknown);
      } else if (this.commands.length) {
        this.unknownCommand();
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    } else if (this.commands.length) {
      checkForUnknownOptions();
      this.help({ error: true });
    } else {
      checkForUnknownOptions();
      this._processArguments();
    }
  }
  /**
   * Find matching command.
   *
   * @private
   * @return {Command | undefined}
   */
  _findCommand(name) {
    if (!name) return void 0;
    return this.commands.find(
      (cmd) => cmd._name === name || cmd._aliases.includes(name)
    );
  }
  /**
   * Return an option matching `arg` if any.
   *
   * @param {string} arg
   * @return {Option}
   * @package
   */
  _findOption(arg) {
    return this.options.find((option) => option.is(arg));
  }
  /**
   * Display an error message if a mandatory option does not have a value.
   * Called after checking for help flags in leaf subcommand.
   *
   * @private
   */
  _checkForMissingMandatoryOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd.options.forEach((anOption) => {
        if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === void 0) {
          cmd.missingMandatoryOptionValue(anOption);
        }
      });
    });
  }
  /**
   * Display an error message if conflicting options are used together in this.
   *
   * @private
   */
  _checkForConflictingLocalOptions() {
    const definedNonDefaultOptions = this.options.filter((option) => {
      const optionKey = option.attributeName();
      if (this.getOptionValue(optionKey) === void 0) {
        return false;
      }
      return this.getOptionValueSource(optionKey) !== "default";
    });
    const optionsWithConflicting = definedNonDefaultOptions.filter(
      (option) => option.conflictsWith.length > 0
    );
    optionsWithConflicting.forEach((option) => {
      const conflictingAndDefined = definedNonDefaultOptions.find(
        (defined) => option.conflictsWith.includes(defined.attributeName())
      );
      if (conflictingAndDefined) {
        this._conflictingOption(option, conflictingAndDefined);
      }
    });
  }
  /**
   * Display an error message if conflicting options are used together.
   * Called after checking for help flags in leaf subcommand.
   *
   * @private
   */
  _checkForConflictingOptions() {
    this._getCommandAndAncestors().forEach((cmd) => {
      cmd._checkForConflictingLocalOptions();
    });
  }
  /**
   * Parse options from `argv` removing known options,
   * and return argv split into operands and unknown arguments.
   *
   * Side effects: modifies command by storing options. Does not reset state if called again.
   *
   * Examples:
   *
   *     argv => operands, unknown
   *     --known kkk op => [op], []
   *     op --known kkk => [op], []
   *     sub --unknown uuu op => [sub], [--unknown uuu op]
   *     sub -- --unknown uuu op => [sub --unknown uuu op], []
   *
   * @param {string[]} args
   * @return {{operands: string[], unknown: string[]}}
   */
  parseOptions(args) {
    const operands = [];
    const unknown = [];
    let dest = operands;
    function maybeOption(arg) {
      return arg.length > 1 && arg[0] === "-";
    }
    const negativeNumberArg = (arg) => {
      if (!/^-(\d+|\d*\.\d+)(e[+-]?\d+)?$/.test(arg)) return false;
      return !this._getCommandAndAncestors().some(
        (cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short))
      );
    };
    let activeVariadicOption = null;
    let activeGroup = null;
    let i = 0;
    while (i < args.length || activeGroup) {
      const arg = activeGroup ?? args[i++];
      activeGroup = null;
      if (arg === "--") {
        if (dest === unknown) dest.push(arg);
        dest.push(...args.slice(i));
        break;
      }
      if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
        this.emit(`option:${activeVariadicOption.name()}`, arg);
        continue;
      }
      activeVariadicOption = null;
      if (maybeOption(arg)) {
        const option = this._findOption(arg);
        if (option) {
          if (option.required) {
            const value = args[i++];
            if (value === void 0) this.optionMissingArgument(option);
            this.emit(`option:${option.name()}`, value);
          } else if (option.optional) {
            let value = null;
            if (i < args.length && (!maybeOption(args[i]) || negativeNumberArg(args[i]))) {
              value = args[i++];
            }
            this.emit(`option:${option.name()}`, value);
          } else {
            this.emit(`option:${option.name()}`);
          }
          activeVariadicOption = option.variadic ? option : null;
          continue;
        }
      }
      if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
        const option = this._findOption(`-${arg[1]}`);
        if (option) {
          if (option.required || option.optional && this._combineFlagAndOptionalValue) {
            this.emit(`option:${option.name()}`, arg.slice(2));
          } else {
            this.emit(`option:${option.name()}`);
            activeGroup = `-${arg.slice(2)}`;
          }
          continue;
        }
      }
      if (/^--[^=]+=/.test(arg)) {
        const index = arg.indexOf("=");
        const option = this._findOption(arg.slice(0, index));
        if (option && (option.required || option.optional)) {
          this.emit(`option:${option.name()}`, arg.slice(index + 1));
          continue;
        }
      }
      if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
        dest = unknown;
      }
      if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
        if (this._findCommand(arg)) {
          operands.push(arg);
          unknown.push(...args.slice(i));
          break;
        } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
          operands.push(arg, ...args.slice(i));
          break;
        } else if (this._defaultCommandName) {
          unknown.push(arg, ...args.slice(i));
          break;
        }
      }
      if (this._passThroughOptions) {
        dest.push(arg, ...args.slice(i));
        break;
      }
      dest.push(arg);
    }
    return { operands, unknown };
  }
  /**
   * Return an object containing local option values as key-value pairs.
   *
   * @return {object}
   */
  opts() {
    if (this._storeOptionsAsProperties) {
      const result = {};
      const len = this.options.length;
      for (let i = 0; i < len; i++) {
        const key = this.options[i].attributeName();
        result[key] = key === this._versionOptionName ? this._version : this[key];
      }
      return result;
    }
    return this._optionValues;
  }
  /**
   * Return an object containing merged local and global option values as key-value pairs.
   *
   * @return {object}
   */
  optsWithGlobals() {
    return this._getCommandAndAncestors().reduce(
      (combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()),
      {}
    );
  }
  /**
   * Display error message and exit (or call exitOverride).
   *
   * @param {string} message
   * @param {object} [errorOptions]
   * @param {string} [errorOptions.code] - an id string representing the error
   * @param {number} [errorOptions.exitCode] - used with process.exit
   */
  error(message, errorOptions) {
    this._outputConfiguration.outputError(
      `${message}
`,
      this._outputConfiguration.writeErr
    );
    if (typeof this._showHelpAfterError === "string") {
      this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
    } else if (this._showHelpAfterError) {
      this._outputConfiguration.writeErr("\n");
      this.outputHelp({ error: true });
    }
    const config = errorOptions || {};
    const exitCode = config.exitCode || 1;
    const code2 = config.code || "commander.error";
    this._exit(exitCode, code2, message);
  }
  /**
   * Apply any option related environment variables, if option does
   * not have a value from cli or client code.
   *
   * @private
   */
  _parseOptionsEnv() {
    this.options.forEach((option) => {
      if (option.envVar && option.envVar in process2.env) {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === void 0 || ["default", "config", "env"].includes(
          this.getOptionValueSource(optionKey)
        )) {
          if (option.required || option.optional) {
            this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
          } else {
            this.emit(`optionEnv:${option.name()}`);
          }
        }
      }
    });
  }
  /**
   * Apply any implied option values, if option is undefined or default value.
   *
   * @private
   */
  _parseOptionsImplied() {
    const dualHelper = new DualOptions(this.options);
    const hasCustomOptionValue = (optionKey) => {
      return this.getOptionValue(optionKey) !== void 0 && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
    };
    this.options.filter(
      (option) => option.implied !== void 0 && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(
        this.getOptionValue(option.attributeName()),
        option
      )
    ).forEach((option) => {
      Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
        this.setOptionValueWithSource(
          impliedKey,
          option.implied[impliedKey],
          "implied"
        );
      });
    });
  }
  /**
   * Argument `name` is missing.
   *
   * @param {string} name
   * @private
   */
  missingArgument(name) {
    const message = `error: missing required argument '${name}'`;
    this.error(message, { code: "commander.missingArgument" });
  }
  /**
   * `Option` is missing an argument.
   *
   * @param {Option} option
   * @private
   */
  optionMissingArgument(option) {
    const message = `error: option '${option.flags}' argument missing`;
    this.error(message, { code: "commander.optionMissingArgument" });
  }
  /**
   * `Option` does not have a value, and is a mandatory option.
   *
   * @param {Option} option
   * @private
   */
  missingMandatoryOptionValue(option) {
    const message = `error: required option '${option.flags}' not specified`;
    this.error(message, { code: "commander.missingMandatoryOptionValue" });
  }
  /**
   * `Option` conflicts with another option.
   *
   * @param {Option} option
   * @param {Option} conflictingOption
   * @private
   */
  _conflictingOption(option, conflictingOption) {
    const findBestOptionFromValue = (option2) => {
      const optionKey = option2.attributeName();
      const optionValue = this.getOptionValue(optionKey);
      const negativeOption = this.options.find(
        (target) => target.negate && optionKey === target.attributeName()
      );
      const positiveOption = this.options.find(
        (target) => !target.negate && optionKey === target.attributeName()
      );
      if (negativeOption && (negativeOption.presetArg === void 0 && optionValue === false || negativeOption.presetArg !== void 0 && optionValue === negativeOption.presetArg)) {
        return negativeOption;
      }
      return positiveOption || option2;
    };
    const getErrorMessage = (option2) => {
      const bestOption = findBestOptionFromValue(option2);
      const optionKey = bestOption.attributeName();
      const source = this.getOptionValueSource(optionKey);
      if (source === "env") {
        return `environment variable '${bestOption.envVar}'`;
      }
      return `option '${bestOption.flags}'`;
    };
    const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
    this.error(message, { code: "commander.conflictingOption" });
  }
  /**
   * Unknown option `flag`.
   *
   * @param {string} flag
   * @private
   */
  unknownOption(flag) {
    if (this._allowUnknownOption) return;
    let suggestion = "";
    if (flag.startsWith("--") && this._showSuggestionAfterError) {
      let candidateFlags = [];
      let command = this;
      do {
        const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
        candidateFlags = candidateFlags.concat(moreFlags);
        command = command.parent;
      } while (command && !command._enablePositionalOptions);
      suggestion = suggestSimilar(flag, candidateFlags);
    }
    const message = `error: unknown option '${flag}'${suggestion}`;
    this.error(message, { code: "commander.unknownOption" });
  }
  /**
   * Excess arguments, more than expected.
   *
   * @param {string[]} receivedArgs
   * @private
   */
  _excessArguments(receivedArgs) {
    if (this._allowExcessArguments) return;
    const expected = this.registeredArguments.length;
    const s = expected === 1 ? "" : "s";
    const received = receivedArgs.length;
    const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
    const details = receivedArgs.join(", ");
    const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${received}: ${details}.`;
    this.error(message, { code: "commander.excessArguments" });
  }
  /**
   * Unknown command.
   *
   * @private
   */
  unknownCommand() {
    const unknownName = this.args[0];
    let suggestion = "";
    if (this._showSuggestionAfterError) {
      const candidateNames = [];
      this.createHelp().visibleCommands(this).forEach((command) => {
        candidateNames.push(command.name());
        if (command.alias()) candidateNames.push(command.alias());
      });
      suggestion = suggestSimilar(unknownName, candidateNames);
    }
    const message = `error: unknown command '${unknownName}'${suggestion}`;
    this.error(message, { code: "commander.unknownCommand" });
  }
  /**
   * Get or set the program version.
   *
   * This method auto-registers the "-V, --version" option which will print the version number.
   *
   * You can optionally supply the flags and description to override the defaults.
   *
   * @param {string} [str]
   * @param {string} [flags]
   * @param {string} [description]
   * @return {(this | string | undefined)} `this` command for chaining, or version string if no arguments
   */
  version(str, flags, description) {
    if (str === void 0) return this._version;
    this._version = str;
    flags = flags || "-V, --version";
    description = description || "output the version number";
    const versionOption = this.createOption(flags, description);
    this._versionOptionName = versionOption.attributeName();
    this._registerOption(versionOption);
    this.on("option:" + versionOption.name(), () => {
      this._outputConfiguration.writeOut(`${str}
`);
      this._exit(0, "commander.version", str);
    });
    return this;
  }
  /**
   * Set the description.
   *
   * @param {string} [str]
   * @param {object} [argsDescription]
   * @return {(string|Command)}
   */
  description(str, argsDescription) {
    if (str === void 0 && argsDescription === void 0)
      return this._description;
    this._description = str;
    if (argsDescription) {
      this._argsDescription = argsDescription;
    }
    return this;
  }
  /**
   * Set the summary. Used when listed as subcommand of parent.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  summary(str) {
    if (str === void 0) return this._summary;
    this._summary = str;
    return this;
  }
  /**
   * Set an alias for the command.
   *
   * You may call more than once to add multiple aliases. Only the first alias is shown in the auto-generated help.
   *
   * @param {string} [alias]
   * @return {(string|Command)}
   */
  alias(alias) {
    if (alias === void 0) return this._aliases[0];
    let command = this;
    if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
      command = this.commands[this.commands.length - 1];
    }
    if (alias === command._name)
      throw new Error("Command alias can't be the same as its name");
    const matchingCommand = this.parent?._findCommand(alias);
    if (matchingCommand) {
      const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
      throw new Error(
        `cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`
      );
    }
    command._aliases.push(alias);
    return this;
  }
  /**
   * Set aliases for the command.
   *
   * Only the first alias is shown in the auto-generated help.
   *
   * @param {string[]} [aliases]
   * @return {(string[]|Command)}
   */
  aliases(aliases) {
    if (aliases === void 0) return this._aliases;
    aliases.forEach((alias) => this.alias(alias));
    return this;
  }
  /**
   * Set / get the command usage `str`.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  usage(str) {
    if (str === void 0) {
      if (this._usage) return this._usage;
      const args = this.registeredArguments.map((arg) => {
        return humanReadableArgName(arg);
      });
      return [].concat(
        this.options.length || this._helpOption !== null ? "[options]" : [],
        this.commands.length ? "[command]" : [],
        this.registeredArguments.length ? args : []
      ).join(" ");
    }
    this._usage = str;
    return this;
  }
  /**
   * Get or set the name of the command.
   *
   * @param {string} [str]
   * @return {(string|Command)}
   */
  name(str) {
    if (str === void 0) return this._name;
    this._name = str;
    return this;
  }
  /**
   * Set/get the help group heading for this subcommand in parent command's help.
   *
   * @param {string} [heading]
   * @return {Command | string}
   */
  helpGroup(heading) {
    if (heading === void 0) return this._helpGroupHeading ?? "";
    this._helpGroupHeading = heading;
    return this;
  }
  /**
   * Set/get the default help group heading for subcommands added to this command.
   * (This does not override a group set directly on the subcommand using .helpGroup().)
   *
   * @example
   * program.commandsGroup('Development Commands:);
   * program.command('watch')...
   * program.command('lint')...
   * ...
   *
   * @param {string} [heading]
   * @returns {Command | string}
   */
  commandsGroup(heading) {
    if (heading === void 0) return this._defaultCommandGroup ?? "";
    this._defaultCommandGroup = heading;
    return this;
  }
  /**
   * Set/get the default help group heading for options added to this command.
   * (This does not override a group set directly on the option using .helpGroup().)
   *
   * @example
   * program
   *   .optionsGroup('Development Options:')
   *   .option('-d, --debug', 'output extra debugging')
   *   .option('-p, --profile', 'output profiling information')
   *
   * @param {string} [heading]
   * @returns {Command | string}
   */
  optionsGroup(heading) {
    if (heading === void 0) return this._defaultOptionGroup ?? "";
    this._defaultOptionGroup = heading;
    return this;
  }
  /**
   * @param {Option} option
   * @private
   */
  _initOptionGroup(option) {
    if (this._defaultOptionGroup && !option.helpGroupHeading)
      option.helpGroup(this._defaultOptionGroup);
  }
  /**
   * @param {Command} cmd
   * @private
   */
  _initCommandGroup(cmd) {
    if (this._defaultCommandGroup && !cmd.helpGroup())
      cmd.helpGroup(this._defaultCommandGroup);
  }
  /**
   * Set the name of the command from script filename, such as process.argv[1],
   * or import.meta.filename.
   *
   * (Used internally and public although not documented in README.)
   *
   * @example
   * program.nameFromFilename(import.meta.filename);
   *
   * @param {string} filename
   * @return {Command}
   */
  nameFromFilename(filename) {
    this._name = path.basename(filename, path.extname(filename));
    return this;
  }
  /**
   * Get or set the directory for searching for executable subcommands of this command.
   *
   * @example
   * program.executableDir(import.meta.dirname);
   * // or
   * program.executableDir('subcommands');
   *
   * @param {string} [path]
   * @return {(string|null|Command)}
   */
  executableDir(path18) {
    if (path18 === void 0) return this._executableDir;
    this._executableDir = path18;
    return this;
  }
  /**
   * Return program help documentation.
   *
   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to wrap for stderr instead of stdout
   * @return {string}
   */
  helpInformation(contextOptions) {
    const helper = this.createHelp();
    const context = this._getOutputContext(contextOptions);
    helper.prepareContext({
      error: context.error,
      helpWidth: context.helpWidth,
      outputHasColors: context.hasColors
    });
    const text = helper.formatHelp(this, helper);
    if (context.hasColors) return text;
    return this._outputConfiguration.stripColor(text);
  }
  /**
   * @typedef HelpContext
   * @type {object}
   * @property {boolean} error
   * @property {number} helpWidth
   * @property {boolean} hasColors
   * @property {function} write - includes stripColor if needed
   *
   * @returns {HelpContext}
   * @private
   */
  _getOutputContext(contextOptions) {
    contextOptions = contextOptions || {};
    const error2 = !!contextOptions.error;
    let baseWrite;
    let hasColors;
    let helpWidth;
    if (error2) {
      baseWrite = (str) => this._outputConfiguration.writeErr(str);
      hasColors = this._outputConfiguration.getErrHasColors();
      helpWidth = this._outputConfiguration.getErrHelpWidth();
    } else {
      baseWrite = (str) => this._outputConfiguration.writeOut(str);
      hasColors = this._outputConfiguration.getOutHasColors();
      helpWidth = this._outputConfiguration.getOutHelpWidth();
    }
    const write = (str) => {
      if (!hasColors) str = this._outputConfiguration.stripColor(str);
      return baseWrite(str);
    };
    return { error: error2, write, hasColors, helpWidth };
  }
  /**
   * Output help information for this command.
   *
   * Outputs built-in help, and custom text added using `.addHelpText()`.
   *
   * @param {{ error: boolean } | Function} [contextOptions] - pass {error:true} to write to stderr instead of stdout
   */
  outputHelp(contextOptions) {
    let deprecatedCallback;
    if (typeof contextOptions === "function") {
      deprecatedCallback = contextOptions;
      contextOptions = void 0;
    }
    const outputContext = this._getOutputContext(contextOptions);
    const eventContext = {
      error: outputContext.error,
      write: outputContext.write,
      command: this
    };
    this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
    this.emit("beforeHelp", eventContext);
    let helpInformation = this.helpInformation({ error: outputContext.error });
    if (deprecatedCallback) {
      helpInformation = deprecatedCallback(helpInformation);
      if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
        throw new Error("outputHelp callback must return a string or a Buffer");
      }
    }
    outputContext.write(helpInformation);
    if (this._getHelpOption()?.long) {
      this.emit(this._getHelpOption().long);
    }
    this.emit("afterHelp", eventContext);
    this._getCommandAndAncestors().forEach(
      (command) => command.emit("afterAllHelp", eventContext)
    );
  }
  /**
   * You can pass in flags and a description to customise the built-in help option.
   * Pass in false to disable the built-in help option.
   *
   * @example
   * program.helpOption('-?, --help' 'show help'); // customise
   * program.helpOption(false); // disable
   *
   * @param {(string | boolean)} flags
   * @param {string} [description]
   * @return {Command} `this` command for chaining
   */
  helpOption(flags, description) {
    if (typeof flags === "boolean") {
      if (flags) {
        if (this._helpOption === null) this._helpOption = void 0;
        if (this._defaultOptionGroup) {
          this._initOptionGroup(this._getHelpOption());
        }
      } else {
        this._helpOption = null;
      }
      return this;
    }
    this._helpOption = this.createOption(
      flags ?? "-h, --help",
      description ?? "display help for command"
    );
    if (flags || description) this._initOptionGroup(this._helpOption);
    return this;
  }
  /**
   * Lazy create help option.
   * Returns null if has been disabled with .helpOption(false).
   *
   * @returns {(Option | null)} the help option
   * @package
   */
  _getHelpOption() {
    if (this._helpOption === void 0) {
      this.helpOption(void 0, void 0);
    }
    return this._helpOption;
  }
  /**
   * Supply your own option to use for the built-in help option.
   * This is an alternative to using helpOption() to customise the flags and description etc.
   *
   * @param {Option} option
   * @return {Command} `this` command for chaining
   */
  addHelpOption(option) {
    this._helpOption = option;
    this._initOptionGroup(option);
    return this;
  }
  /**
   * Output help information and exit.
   *
   * Outputs built-in help, and custom text added using `.addHelpText()`.
   *
   * @param {{ error: boolean }} [contextOptions] - pass {error:true} to write to stderr instead of stdout
   */
  help(contextOptions) {
    this.outputHelp(contextOptions);
    let exitCode = Number(process2.exitCode ?? 0);
    if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
      exitCode = 1;
    }
    this._exit(exitCode, "commander.help", "(outputHelp)");
  }
  /**
   * // Do a little typing to coordinate emit and listener for the help text events.
   * @typedef HelpTextEventContext
   * @type {object}
   * @property {boolean} error
   * @property {Command} command
   * @property {function} write
   */
  /**
   * Add additional text to be displayed with the built-in help.
   *
   * Position is 'before' or 'after' to affect just this command,
   * and 'beforeAll' or 'afterAll' to affect this command and all its subcommands.
   *
   * @param {string} position - before or after built-in help
   * @param {(string | Function)} text - string to add, or a function returning a string
   * @return {Command} `this` command for chaining
   */
  addHelpText(position, text) {
    const allowedValues = ["beforeAll", "before", "after", "afterAll"];
    if (!allowedValues.includes(position)) {
      throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
    }
    const helpEvent = `${position}Help`;
    this.on(helpEvent, (context) => {
      let helpStr;
      if (typeof text === "function") {
        helpStr = text({ error: context.error, command: context.command });
      } else {
        helpStr = text;
      }
      if (helpStr) {
        context.write(`${helpStr}
`);
      }
    });
    return this;
  }
  /**
   * Output help information if help flags specified
   *
   * @param {Array} args - array of options to search for help flags
   * @private
   */
  _outputHelpIfRequested(args) {
    const helpOption = this._getHelpOption();
    const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
    if (helpRequested) {
      this.outputHelp();
      this._exit(0, "commander.helpDisplayed", "(outputHelp)");
    }
  }
};
function incrementNodeInspectorPort(args) {
  return args.map((arg) => {
    if (!arg.startsWith("--inspect")) {
      return arg;
    }
    let debugOption;
    let debugHost = "127.0.0.1";
    let debugPort = "9229";
    let match;
    if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
      debugOption = match[1];
    } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
      debugOption = match[1];
      if (/^\d+$/.test(match[3])) {
        debugPort = match[3];
      } else {
        debugHost = match[3];
      }
    } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
      debugOption = match[1];
      debugHost = match[3];
      debugPort = match[4];
    }
    if (debugOption && debugPort !== "0") {
      return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
    }
    return arg;
  });
}
function useColor() {
  if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
    return false;
  if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== void 0)
    return true;
  return void 0;
}

// node_modules/commander/index.js
var program = new Command();

// src/application/adopt-project.ts
import { timingSafeEqual } from "node:crypto";

// src/domain/adoption.ts
import { createHash } from "node:crypto";

// node_modules/ulid/dist/node/index.js
import crypto from "node:crypto";
var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var ENCODING_LEN = 32;
var RANDOM_LEN = 16;
var TIME_LEN = 10;
var TIME_MAX = 281474976710655;
var ULIDErrorCode;
(function(ULIDErrorCode2) {
  ULIDErrorCode2["Base32IncorrectEncoding"] = "B32_ENC_INVALID";
  ULIDErrorCode2["DecodeTimeInvalidCharacter"] = "DEC_TIME_CHAR";
  ULIDErrorCode2["DecodeTimeValueMalformed"] = "DEC_TIME_MALFORMED";
  ULIDErrorCode2["EncodeTimeNegative"] = "ENC_TIME_NEG";
  ULIDErrorCode2["EncodeTimeSizeExceeded"] = "ENC_TIME_SIZE_EXCEED";
  ULIDErrorCode2["EncodeTimeValueMalformed"] = "ENC_TIME_MALFORMED";
  ULIDErrorCode2["PRNGDetectFailure"] = "PRNG_DETECT";
  ULIDErrorCode2["ULIDInvalid"] = "ULID_INVALID";
  ULIDErrorCode2["Unexpected"] = "UNEXPECTED";
  ULIDErrorCode2["UUIDInvalid"] = "UUID_INVALID";
})(ULIDErrorCode || (ULIDErrorCode = {}));
var ULIDError = class extends Error {
  constructor(errorCode, message) {
    super(`${message} (${errorCode})`);
    this.name = "ULIDError";
    this.code = errorCode;
  }
};
function randomChar(prng) {
  const randomPosition = Math.floor(prng() * ENCODING_LEN) % ENCODING_LEN;
  return ENCODING.charAt(randomPosition);
}
function replaceCharAt(str, index, char) {
  if (index > str.length - 1) {
    return str;
  }
  return str.substr(0, index) + char + str.substr(index + 1);
}
function incrementBase32(str) {
  let done = void 0, index = str.length, char, charIndex, output = str;
  const maxCharIndex = ENCODING_LEN - 1;
  while (!done && index-- >= 0) {
    char = output[index];
    charIndex = ENCODING.indexOf(char);
    if (charIndex === -1) {
      throw new ULIDError(ULIDErrorCode.Base32IncorrectEncoding, "Incorrectly encoded string");
    }
    if (charIndex === maxCharIndex) {
      output = replaceCharAt(output, index, ENCODING[0]);
      continue;
    }
    done = replaceCharAt(output, index, ENCODING[charIndex + 1]);
  }
  if (typeof done === "string") {
    return done;
  }
  throw new ULIDError(ULIDErrorCode.Base32IncorrectEncoding, "Failed incrementing string");
}
function decodeTime(id) {
  if (id.length !== TIME_LEN + RANDOM_LEN) {
    throw new ULIDError(ULIDErrorCode.DecodeTimeValueMalformed, "Malformed ULID");
  }
  const time = id.substr(0, TIME_LEN).toUpperCase().split("").reverse().reduce((carry, char, index) => {
    const encodingIndex = ENCODING.indexOf(char);
    if (encodingIndex === -1) {
      throw new ULIDError(ULIDErrorCode.DecodeTimeInvalidCharacter, `Time decode error: Invalid character: ${char}`);
    }
    return carry += encodingIndex * Math.pow(ENCODING_LEN, index);
  }, 0);
  if (time > TIME_MAX) {
    throw new ULIDError(ULIDErrorCode.DecodeTimeValueMalformed, `Malformed ULID: timestamp too large: ${time}`);
  }
  return time;
}
function detectPRNG(root) {
  const rootLookup = detectRoot();
  const globalCrypto = rootLookup && (rootLookup.crypto || rootLookup.msCrypto) || (typeof crypto !== "undefined" ? crypto : null);
  if (typeof globalCrypto?.getRandomValues === "function") {
    return () => {
      const buffer = new Uint8Array(1);
      globalCrypto.getRandomValues(buffer);
      return buffer[0] / 256;
    };
  } else if (typeof globalCrypto?.randomBytes === "function") {
    return () => globalCrypto.randomBytes(1).readUInt8() / 256;
  } else if (crypto?.randomBytes) {
    return () => crypto.randomBytes(1).readUInt8() / 256;
  }
  throw new ULIDError(ULIDErrorCode.PRNGDetectFailure, "Failed to find a reliable PRNG");
}
function detectRoot() {
  if (inWebWorker())
    return self;
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  return null;
}
function encodeRandom(len, prng) {
  let str = "";
  for (; len > 0; len--) {
    str = randomChar(prng) + str;
  }
  return str;
}
function encodeTime(now, len = TIME_LEN) {
  if (isNaN(now)) {
    throw new ULIDError(ULIDErrorCode.EncodeTimeValueMalformed, `Time must be a number: ${now}`);
  } else if (now > TIME_MAX) {
    throw new ULIDError(ULIDErrorCode.EncodeTimeSizeExceeded, `Cannot encode a time larger than ${TIME_MAX}: ${now}`);
  } else if (now < 0) {
    throw new ULIDError(ULIDErrorCode.EncodeTimeNegative, `Time must be positive: ${now}`);
  } else if (Number.isInteger(now) === false) {
    throw new ULIDError(ULIDErrorCode.EncodeTimeValueMalformed, `Time must be an integer: ${now}`);
  }
  let mod, str = "";
  for (let currentLen = len; currentLen > 0; currentLen--) {
    mod = now % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    now = (now - mod) / ENCODING_LEN;
  }
  return str;
}
function inWebWorker() {
  return typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
}
function monotonicFactory(prng) {
  const currentPRNG = prng || detectPRNG();
  let lastTime = 0, lastRandom;
  return function _ulid(seedTime) {
    const seed = !seedTime || isNaN(seedTime) ? Date.now() : seedTime;
    if (seed <= lastTime) {
      const incrementedRandom = lastRandom = incrementBase32(lastRandom);
      return encodeTime(lastTime, TIME_LEN) + incrementedRandom;
    }
    lastTime = seed;
    const newRandom = lastRandom = encodeRandom(RANDOM_LEN, currentPRNG);
    return encodeTime(seed, TIME_LEN) + newRandom;
  };
}
function ulid(seedTime, prng) {
  const currentPRNG = prng || detectPRNG();
  const seed = !seedTime || isNaN(seedTime) ? Date.now() : seedTime;
  return encodeTime(seed, TIME_LEN) + encodeRandom(RANDOM_LEN, currentPRNG);
}

// src/domain/adoption.ts
var ADOPTION_SCHEMA_VERSION = 1;
var REQUIRED_ADOPTION_DOCUMENTS = [
  "knowledge/10-overview.md",
  "knowledge/20-architecture.md",
  "knowledge/30-source-map.md",
  "knowledge/40-build-and-tooling.md",
  "knowledge/50-domain-and-invariants.md",
  "operations/10-working-agreement.md",
  "operations/20-plan.md",
  "operations/30-decisions.md"
];
var AdoptionError = class extends Error {
  constructor(code2, message, mutated = false, recoveryRoot) {
    super(message);
    this.code = code2;
    this.mutated = mutated;
    this.recoveryRoot = recoveryRoot;
    this.name = "AdoptionError";
  }
  code;
  mutated;
  recoveryRoot;
};
function normalizeText(value) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function normalizedJsonValue(value) {
  if (Array.isArray(value)) return value.map((item) => normalizedJsonValue(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, normalizedJsonValue(item)])
    );
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(normalizedJsonValue(value));
}
function deterministicUlid(seed) {
  const bytes = createHash("sha256").update(seed).digest();
  let index = 0;
  return ulid(1, () => {
    const value = bytes[index % bytes.length];
    index += 1;
    return (value ?? 0) / 256;
  });
}
function createMutationPlan(input) {
  const operationSeed = canonicalJson(input.operations);
  const coverageDigest = input.classification === "C" ? input.coverageDigest : void 0;
  const operations = input.operations.map((operation) => ({
    operation_id: deterministicUlid(
      canonicalJson([
        input.inventory.digest,
        operation.action,
        operation.path,
        operation.source_path,
        operation.content_digest,
        operation.preimage_digest
      ])
    ),
    ...operation
  }));
  const planWithoutDigest = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    plan_id: deterministicUlid(
      canonicalJson([input.inventory.digest, operationSeed, coverageDigest])
    ),
    generated_at: input.generatedAt,
    classification: input.classification,
    candidate_inventory_digest: input.inventory.digest,
    ...coverageDigest === void 0 ? {} : { coverage_digest: coverageDigest },
    operations,
    validations: [...input.validations].sort()
  };
  return {
    ...planWithoutDigest,
    plan_digest: sha256(canonicalJson(planWithoutDigest))
  };
}

// src/domain/inspection.ts
var INSPECTION_SCHEMA_VERSION = 1;
function comparePortablePaths(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
var InspectionError = class extends Error {
  constructor(code2, message) {
    super(message);
    this.code = code2;
    this.name = "InspectionError";
  }
  code;
};

// src/infrastructure/filesystem-inventory.ts
var import_ignore = __toESM(require_ignore(), 1);
import { createHash as createHash2 } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, opendir, readFile, readlink, realpath, stat } from "node:fs/promises";
import path2 from "node:path";
var generatedDirectoryNames = /* @__PURE__ */ new Set([
  ".cache",
  ".gradle",
  ".next",
  ".nuxt",
  ".parcel-cache",
  ".pytest_cache",
  ".terraform",
  ".turbo",
  ".venv",
  "__pycache__",
  "bin",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "obj",
  "out",
  "target",
  "vendor",
  "venv"
]);
var versionControlDirectoryNames = /* @__PURE__ */ new Set([".git", ".hg", ".svn"]);
var generatedFileNames = /* @__PURE__ */ new Set([".ds_store", "thumbs.db"]);
function toPortablePath(value) {
  return value.split(path2.sep).join("/");
}
function isWithinRoot(root, candidate) {
  const relative = path2.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path2.sep}`) && relative !== ".." && !path2.isAbsolute(relative);
}
async function resolveCandidateRoot(candidate) {
  const resolved = path2.resolve(candidate);
  if (path2.parse(resolved).root === resolved) {
    throw new InspectionError(
      "PCP_UNSAFE_ROOT",
      "Refusing to inspect an entire filesystem root; select a project directory instead."
    );
  }
  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch (error2) {
    const detail = error2 instanceof Error ? error2.message : String(error2);
    throw new InspectionError("PCP_CANDIDATE_UNREADABLE", `Cannot inspect candidate: ${detail}`);
  }
  if (metadata.isSymbolicLink()) {
    throw new InspectionError(
      "PCP_UNSAFE_ROOT",
      "The candidate root is a symbolic link; select its real directory explicitly."
    );
  }
  if (!metadata.isDirectory()) {
    throw new InspectionError("PCP_CANDIDATE_NOT_DIRECTORY", "The candidate must be a directory.");
  }
  return resolved;
}
function exclusionForName(name, isDirectory) {
  const normalized = name.toLowerCase();
  if (isDirectory && versionControlDirectoryNames.has(normalized)) {
    return "version-control-metadata";
  }
  if (isDirectory && generatedDirectoryNames.has(normalized)) {
    return "generated-or-vendor";
  }
  if (!isDirectory && generatedFileNames.has(normalized)) {
    return "generated-or-vendor";
  }
  return void 0;
}
function mutationPathExclusion(candidatePath) {
  const segments = candidatePath.split("/");
  if (segments.some((segment) => versionControlDirectoryNames.has(segment.toLowerCase()))) {
    return "version-control-metadata";
  }
  for (const segment of segments.slice(0, -1)) {
    const reason = exclusionForName(segment, true);
    if (reason !== void 0) return reason;
  }
  const finalSegment = segments.at(-1);
  return finalSegment === void 0 ? void 0 : exclusionForName(finalSegment, false);
}
function relativeFromBase(candidate, base) {
  if (base === "") return candidate;
  if (candidate === base) return "";
  const prefix = `${base}/`;
  return candidate.startsWith(prefix) ? candidate.slice(prefix.length) : void 0;
}
function isIgnored(candidate, isDirectory, contexts) {
  let ignored = false;
  const portableCandidate = isDirectory ? `${candidate}/` : candidate;
  for (const context of contexts) {
    const relative = relativeFromBase(portableCandidate, context.base);
    if (relative === void 0 || relative === "") continue;
    const result = context.matcher.test(relative);
    if (result.ignored) ignored = true;
    if (result.unignored) ignored = false;
  }
  return ignored;
}
async function loadIgnoreContext(absoluteDirectory, relativeDirectory) {
  const ignorePath = path2.join(absoluteDirectory, ".gitignore");
  try {
    const contents = await readFile(ignorePath, "utf8");
    return {
      base: relativeDirectory,
      matcher: (0, import_ignore.default)({ allowRelativePaths: true, ignorecase: false }).add(contents)
    };
  } catch (error2) {
    const code2 = error2.code;
    if (code2 === "ENOENT" || code2 === "EISDIR") return void 0;
    throw error2;
  }
}
async function mutationIgnoreContexts(root, candidatePath) {
  const contexts = [];
  let absoluteDirectory = root;
  let relativeDirectory = "";
  const rootContext = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
  if (rootContext !== void 0) contexts.push(rootContext);
  for (const segment of candidatePath.split("/").slice(0, -1)) {
    absoluteDirectory = path2.join(absoluteDirectory, segment);
    relativeDirectory = relativeDirectory === "" ? segment : `${relativeDirectory}/${segment}`;
    let metadata;
    try {
      metadata = await lstat(absoluteDirectory);
    } catch (error2) {
      if (error2.code === "ENOENT") break;
      throw error2;
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) break;
    const context = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
    if (context !== void 0) contexts.push(context);
  }
  return contexts;
}
async function isMutationPathIgnored(root, candidatePath) {
  const contexts = await mutationIgnoreContexts(root, candidatePath);
  return isIgnored(candidatePath, false, contexts);
}
async function isMutationDirectoryIgnored(root, candidatePath) {
  const contexts = await mutationIgnoreContexts(root, candidatePath);
  return isIgnored(candidatePath, true, contexts);
}
async function hasNestedRepositoryMarker(absoluteDirectory) {
  try {
    await lstat(path2.join(absoluteDirectory, ".git"));
    return true;
  } catch (error2) {
    if (error2.code === "ENOENT") return false;
    throw error2;
  }
}
async function sha256File(absolutePath) {
  const before = await stat(absolutePath);
  const hash = createHash2("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  const after = await stat(absolutePath);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new InspectionError(
      "PCP_SOURCE_CHANGED",
      `A file changed while it was being inspected: ${toPortablePath(absolutePath)}`
    );
  }
  return hash.digest("hex");
}
async function inspectSymlink(root, absolutePath, relativePath) {
  const rawTarget = await readlink(absolutePath);
  const targetSha256 = createHash2("sha256").update(rawTarget).digest("hex");
  let boundary;
  try {
    const realTarget = await realpath(absolutePath);
    boundary = isWithinRoot(root, realTarget) ? "internal" : "external";
  } catch (error2) {
    if (error2.code === "ENOENT") {
      boundary = "broken";
    } else {
      throw error2;
    }
  }
  return {
    path: relativePath,
    target: path2.isAbsolute(rawTarget) ? "<absolute>" : toPortablePath(rawTarget),
    targetSha256,
    boundary
  };
}
async function scanDirectory(root, absoluteDirectory, relativeDirectory, inheritedContexts, inventory) {
  const localContext = await loadIgnoreContext(absoluteDirectory, relativeDirectory);
  const contexts = localContext === void 0 ? inheritedContexts : [...inheritedContexts, localContext];
  const directory = await opendir(absoluteDirectory);
  for await (const entry of directory) {
    const absoluteEntry = path2.join(absoluteDirectory, entry.name);
    const relativeEntry = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
    const portableEntry = toPortablePath(relativeEntry);
    const metadata = await lstat(absoluteEntry);
    const isDirectory = metadata.isDirectory();
    const staticReason = exclusionForName(entry.name, isDirectory);
    if (staticReason !== void 0) {
      inventory.exclusions.push({ path: portableEntry, reason: staticReason });
      continue;
    }
    if (isIgnored(portableEntry, isDirectory, contexts)) {
      inventory.exclusions.push({ path: portableEntry, reason: "gitignore" });
      continue;
    }
    if (metadata.isSymbolicLink()) {
      inventory.symlinks.push(await inspectSymlink(root, absoluteEntry, portableEntry));
      continue;
    }
    if (isDirectory) {
      if (await hasNestedRepositoryMarker(absoluteEntry)) {
        inventory.nestedRepositories.push(portableEntry);
        inventory.exclusions.push({ path: portableEntry, reason: "nested-repository" });
        continue;
      }
      inventory.directories.push(portableEntry);
      await scanDirectory(root, absoluteEntry, portableEntry, contexts, inventory);
      continue;
    }
    if (metadata.isFile()) {
      const sha2563 = await sha256File(absoluteEntry);
      inventory.files.push({ path: portableEntry, size: metadata.size, sha256: sha2563 });
      inventory.bytes += metadata.size;
    }
  }
}
function inventoryDigest(inventory) {
  const hash = createHash2("sha256");
  for (const directory of inventory.directories) {
    hash.update(`${JSON.stringify(["directory", directory])}
`);
  }
  for (const file of inventory.files) {
    hash.update(`${JSON.stringify(["file", file.path, file.size, file.sha256])}
`);
  }
  for (const link of inventory.symlinks) {
    hash.update(
      `${JSON.stringify(["symlink", link.path, link.target, link.targetSha256, link.boundary])}
`
    );
  }
  for (const nestedRepository of inventory.nestedRepositories) {
    hash.update(`${JSON.stringify(["nested-repository", nestedRepository])}
`);
  }
  return hash.digest("hex");
}
async function inventoryRepository(root) {
  const inventory = {
    directories: ["."],
    files: [],
    symlinks: [],
    exclusions: [],
    nestedRepositories: [],
    bytes: 0
  };
  await scanDirectory(root, root, "", [], inventory);
  inventory.directories.sort(comparePortablePaths);
  inventory.files.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.symlinks.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.exclusions.sort((left, right) => comparePortablePaths(left.path, right.path));
  inventory.nestedRepositories.sort(comparePortablePaths);
  return {
    digest: inventoryDigest(inventory),
    counts: {
      files: inventory.files.length,
      directories: inventory.directories.length,
      symlinks: inventory.symlinks.length,
      bytes: inventory.bytes,
      excluded: inventory.exclusions.length,
      nestedRepositories: inventory.nestedRepositories.length
    },
    directories: inventory.directories,
    files: inventory.files,
    symlinks: inventory.symlinks,
    exclusions: inventory.exclusions,
    nestedRepositories: inventory.nestedRepositories
  };
}

// src/infrastructure/filesystem-transaction.ts
import { createHash as createHash3 } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat as lstat2,
  mkdir,
  mkdtemp,
  open,
  readFile as readFile2,
  rename,
  rm,
  rmdir,
  statfs,
  unlink,
  utimes,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path3 from "node:path";
function rootHash(root) {
  const resolved = path3.resolve(root);
  return createHash3("sha256").update(process.platform === "win32" ? resolved.toLowerCase() : resolved).digest("hex");
}
function isInside(root, candidate) {
  const relative = path3.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path3.sep}`) && relative !== ".." && !path3.isAbsolute(relative);
}
function resolveApprovedPath(root, portablePath2) {
  const normalized = path3.posix.normalize(portablePath2);
  if (portablePath2 === "." || normalized !== portablePath2 || portablePath2.startsWith("/") || portablePath2.includes("\\")) {
    throw new AdoptionError("PCP_ADOPTION_PATH_UNSAFE", `Unsafe transaction path: ${portablePath2}`);
  }
  const resolved = path3.resolve(root, ...portablePath2.split("/"));
  if (!isInside(root, resolved) || resolved === path3.resolve(root)) {
    throw new AdoptionError(
      "PCP_ADOPTION_PATH_UNSAFE",
      `Path escapes the candidate: ${portablePath2}`
    );
  }
  return resolved;
}
async function metadataOrUndefined(target) {
  try {
    return await lstat2(target);
  } catch (error2) {
    if (error2.code === "ENOENT") return void 0;
    throw error2;
  }
}
async function assertNoSymlinkAncestor(root, target) {
  let current = path3.dirname(target);
  while (current !== root) {
    const metadata = await metadataOrUndefined(current);
    if (metadata?.isSymbolicLink() === true) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_BOUNDARY",
        `A transaction target acquired a symbolic-link ancestor: ${path3.relative(root, target)}`
      );
    }
    current = path3.dirname(current);
  }
}
async function appendWal(walPath, sequence, operation, status, preimage) {
  const record = {
    sequence,
    operation_id: operation.operation_id,
    action: operation.action,
    path: operation.path,
    source_path: operation.source_path,
    status,
    preimage: preimage === void 0 ? void 0 : `preimages/${operation.operation_id}`
  };
  const handle = await open(walPath, "a");
  try {
    await handle.writeFile(`${JSON.stringify(record)}
`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncFile(target) {
  const handle = await open(target, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function captureFilePreimage(target, operation, preimageRoot) {
  const metadata = await lstat2(target);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new AdoptionError(
      "PCP_ADOPTION_PREIMAGE_UNSUPPORTED",
      `This release can mutate only regular-file preimages: ${operation.path}`
    );
  }
  const bytes = await readFile2(target);
  if (operation.preimage_digest !== sha256(bytes)) {
    throw new AdoptionError(
      "PCP_SOURCE_CHANGED",
      `Preimage digest changed before transaction: ${operation.path}`
    );
  }
  const backupPath = path3.join(preimageRoot, operation.operation_id);
  await copyFile(target, backupPath, constants.COPYFILE_EXCL);
  await syncFile(backupPath);
  return {
    backupPath,
    mode: metadata.mode,
    atime: metadata.atime,
    mtime: metadata.mtime
  };
}
async function restoreFilePreimage(target, preimage) {
  const existing = await metadataOrUndefined(target);
  if (existing !== void 0) {
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error(`Rollback target changed type: ${target}`);
    }
    await unlink(target);
  }
  await copyFile(preimage.backupPath, target, constants.COPYFILE_EXCL);
  await chmod(target, preimage.mode);
  await utimes(target, preimage.atime, preimage.mtime);
}
async function durableTemporaryFile(target, stagedPath, operation) {
  const temporaryPath = path3.join(
    path3.dirname(target),
    `.${path3.basename(target)}.pcp-${operation.operation_id}.tmp`
  );
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(await readFile2(stagedPath));
    await handle.sync();
    return temporaryPath;
  } catch (error2) {
    await handle.close();
    await unlink(temporaryPath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error2;
  } finally {
    if (await metadataOrUndefined(temporaryPath) !== void 0) {
      await handle.close().catch(() => void 0);
    }
  }
}
async function atomicWrite(target, stagedPath, operation, replaceExisting) {
  const temporaryPath = await durableTemporaryFile(target, stagedPath, operation);
  try {
    if (!replaceExisting && await metadataOrUndefined(target) !== void 0) {
      throw new AdoptionError(
        "PCP_SOURCE_CHANGED",
        `A planned write target appeared before apply: ${operation.path}`
      );
    }
    try {
      await rename(temporaryPath, target);
    } catch (error2) {
      const code2 = error2.code;
      if (!replaceExisting || code2 !== "EEXIST" && code2 !== "EPERM") throw error2;
      const heldPath = `${temporaryPath}.previous`;
      await rename(target, heldPath);
      try {
        await rename(temporaryPath, target);
        await unlink(heldPath);
      } catch (replacementError) {
        if (await metadataOrUndefined(target) !== void 0) await unlink(target);
        await rename(heldPath, target);
        throw replacementError;
      }
    }
  } finally {
    if (await metadataOrUndefined(temporaryPath) !== void 0) await unlink(temporaryPath);
  }
}
async function stageContent(plan, contentByPath, stagingRoot) {
  const result = /* @__PURE__ */ new Map();
  const contentOperations = plan.operations.filter(
    (operation) => operation.action === "write" || operation.action === "replace"
  );
  if (contentOperations.length !== contentByPath.size) {
    throw new AdoptionError(
      "PCP_ADOPTION_PLAN_CONTENT_MISMATCH",
      "The approved plan and staged content do not cover the same paths."
    );
  }
  for (const operation of contentOperations) {
    const content = contentByPath.get(operation.path);
    if (content === void 0 || operation.content_digest !== sha256(content)) {
      throw new AdoptionError(
        "PCP_ADOPTION_PLAN_CONTENT_MISMATCH",
        `Staged content does not match the approved digest: ${operation.path}`
      );
    }
    const target = path3.join(stagingRoot, operation.operation_id);
    await writeFile(target, content, { flag: "wx" });
    result.set(operation.operation_id, target);
  }
  return result;
}
async function checkSpace(root, plan, content) {
  const required = [...content.values()].reduce((total, bytes) => total + bytes.length, 0) * 3 + plan.operations.length * 4096;
  const filesystem = await statfs(root);
  const available = Number(filesystem.bavail) * Number(filesystem.bsize);
  if (Number.isFinite(available) && available < required) {
    throw new AdoptionError(
      "PCP_ADOPTION_SPACE_INSUFFICIENT",
      `The candidate filesystem does not have the ${required} bytes required for staged apply and recovery.`
    );
  }
}
async function applyOperation(root, operation, stagedContent, preimageRoot) {
  const target = resolveApprovedPath(root, operation.path);
  await assertNoSymlinkAncestor(root, target);
  let preimage;
  if (operation.action === "replace" || operation.action === "remove") {
    preimage = await captureFilePreimage(target, operation, preimageRoot);
  } else if (operation.action === "move") {
    if (operation.source_path === void 0)
      throw new Error("Move operation is missing source_path.");
    preimage = await captureFilePreimage(
      resolveApprovedPath(root, operation.source_path),
      operation,
      preimageRoot
    );
  }
  switch (operation.action) {
    case "mkdir":
      await mkdir(target);
      break;
    case "write": {
      const stagedPath = stagedContent.get(operation.operation_id);
      if (stagedPath === void 0) throw new Error(`Missing staged content: ${operation.path}`);
      await atomicWrite(target, stagedPath, operation, false);
      break;
    }
    case "replace": {
      const stagedPath = stagedContent.get(operation.operation_id);
      if (stagedPath === void 0) throw new Error(`Missing staged content: ${operation.path}`);
      await atomicWrite(target, stagedPath, operation, true);
      break;
    }
    case "remove":
      await unlink(target);
      break;
    case "move": {
      if (operation.source_path === void 0)
        throw new Error("Move operation is missing source_path.");
      const source = resolveApprovedPath(root, operation.source_path);
      await assertNoSymlinkAncestor(root, source);
      const sourceMetadata = await lstat2(source);
      if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink()) {
        throw new AdoptionError(
          "PCP_ADOPTION_PREIMAGE_UNSUPPORTED",
          `This release can move only regular files: ${operation.source_path}`
        );
      }
      if (operation.preimage_digest !== sha256(await readFile2(source))) {
        throw new AdoptionError(
          "PCP_SOURCE_CHANGED",
          `Move source changed before transaction: ${operation.source_path}`
        );
      }
      if (await metadataOrUndefined(target) !== void 0) {
        throw new AdoptionError(
          "PCP_ADOPTION_PATH_COLLISION",
          `A move target already exists: ${operation.path}`
        );
      }
      await rename(source, target);
      break;
    }
  }
  return preimage === void 0 ? { operation } : { operation, preimage };
}
async function rollbackOperation(root, applied) {
  const { operation, preimage } = applied;
  const target = resolveApprovedPath(root, operation.path);
  switch (operation.action) {
    case "mkdir":
      await rmdir(target);
      break;
    case "write":
      await unlink(target);
      break;
    case "replace":
    case "remove":
      if (preimage === void 0) throw new Error(`Missing rollback preimage: ${operation.path}`);
      await restoreFilePreimage(target, preimage);
      break;
    case "move": {
      if (operation.source_path === void 0)
        throw new Error("Move operation is missing source_path.");
      const source = resolveApprovedPath(root, operation.source_path);
      if (await metadataOrUndefined(target) !== void 0) {
        await rename(target, source);
      } else if (await metadataOrUndefined(source) === void 0 && preimage !== void 0) {
        await restoreFilePreimage(source, preimage);
      }
      break;
    }
  }
}
async function verifyDesiredContent(root, plan) {
  for (const operation of plan.operations) {
    const target = resolveApprovedPath(root, operation.path);
    if (operation.action === "mkdir") {
      const metadata = await metadataOrUndefined(target);
      if (metadata === void 0 || !metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new AdoptionError(
          "PCP_ADOPTION_LIVE_MISMATCH",
          `An applied directory does not match the approved plan: ${operation.path}`,
          true
        );
      }
    } else if (operation.action === "write" || operation.action === "replace") {
      const bytes = await readFile2(target);
      if (operation.content_digest !== sha256(bytes)) {
        throw new AdoptionError(
          "PCP_ADOPTION_LIVE_MISMATCH",
          `Applied content differs from the approved plan: ${operation.path}`,
          true
        );
      }
    } else if (operation.action === "remove" && await metadataOrUndefined(target) !== void 0) {
      throw new AdoptionError(
        "PCP_ADOPTION_LIVE_MISMATCH",
        `A removed target still exists: ${operation.path}`,
        true
      );
    } else if (operation.action === "move") {
      const source = operation.source_path === void 0 ? void 0 : resolveApprovedPath(root, operation.source_path);
      if (source === void 0 || await metadataOrUndefined(source) !== void 0 || await metadataOrUndefined(target) === void 0) {
        throw new AdoptionError(
          "PCP_ADOPTION_LIVE_MISMATCH",
          `A move does not match the approved source and target state: ${operation.path}`,
          true
        );
      }
    }
  }
}
async function acquireLock(root) {
  const lockRoot = path3.join(tmpdir(), "pcp-project-locks");
  await mkdir(lockRoot, { recursive: true });
  const lockPath = path3.join(lockRoot, `${rootHash(root)}.lock`);
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch (error2) {
    if (error2.code === "EEXIST") {
      throw new AdoptionError(
        "PCP_ADOPTION_LOCKED",
        "Another PCP structural transaction already holds the project lock."
      );
    }
    throw error2;
  }
  await handle.writeFile(
    `${JSON.stringify({ pid: process.pid, created_at: (/* @__PURE__ */ new Date()).toISOString() })}
`
  );
  await handle.sync();
  return {
    path: lockPath,
    close: async () => {
      await handle.close();
      await unlink(lockPath).catch((error2) => {
        if (error2.code !== "ENOENT") throw error2;
      });
    }
  };
}
async function executeFilesystemTransaction(root, plan, contentByPath, options) {
  const resolvedRoot = path3.resolve(root);
  const lock = await acquireLock(resolvedRoot);
  let recoveryRoot;
  const applied = [];
  let mutationStarted = false;
  try {
    const currentInventory = await inventoryRepository(resolvedRoot);
    if (currentInventory.digest !== plan.candidate_inventory_digest) {
      throw new AdoptionError(
        "PCP_SOURCE_CHANGED",
        "Candidate inventory changed after the approved adoption preview."
      );
    }
    await checkSpace(resolvedRoot, plan, contentByPath);
    recoveryRoot = await mkdtemp(
      path3.join(tmpdir(), `pcp-transaction-${rootHash(root).slice(0, 12)}-`)
    );
    const stagingRoot = path3.join(recoveryRoot, "staging");
    const preimageRoot = path3.join(recoveryRoot, "preimages");
    const walPath = path3.join(recoveryRoot, "operations.jsonl");
    await mkdir(stagingRoot);
    await mkdir(preimageRoot);
    await writeFile(walPath, "", { flag: "wx" });
    const stagedContent = await stageContent(plan, contentByPath, stagingRoot);
    for (const [index, operation] of plan.operations.entries()) {
      const sequence = index + 1;
      await appendWal(walPath, sequence, operation, "prepared");
      mutationStarted = true;
      const completed = await applyOperation(resolvedRoot, operation, stagedContent, preimageRoot);
      applied.push(completed);
      await appendWal(walPath, sequence, operation, "applied", completed.preimage);
      if (options.fail_after_operation === sequence) {
        throw new AdoptionError(
          "PCP_FAULT_INJECTED",
          `Injected failure after operation ${sequence}.`,
          true
        );
      }
    }
    if (options.fail_after_operation === plan.operations.length + 1) {
      throw new AdoptionError(
        "PCP_FAULT_INJECTED",
        "Injected failure at the post-apply validation boundary.",
        true
      );
    }
    await verifyDesiredContent(resolvedRoot, plan);
    await options.verify_source_stability?.();
    await options.validate_live();
    await options.verify_source_stability?.();
    await verifyDesiredContent(resolvedRoot, plan);
    await rm(recoveryRoot, { recursive: true, force: false });
    recoveryRoot = void 0;
    return { applied_operations: applied.length, recovery_cleaned: true };
  } catch (error2) {
    if (mutationStarted) {
      const rollbackErrors = [];
      for (const [reverseIndex, completed] of [...applied].reverse().entries()) {
        try {
          await rollbackOperation(resolvedRoot, completed);
          if (recoveryRoot !== void 0) {
            const walPath = path3.join(recoveryRoot, "operations.jsonl");
            await appendWal(
              walPath,
              applied.length - reverseIndex,
              completed.operation,
              "rolled-back",
              completed.preimage
            );
          }
        } catch (rollbackError) {
          rollbackErrors.push(
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          );
        }
      }
      const restored = await inventoryRepository(resolvedRoot);
      if (restored.digest !== plan.candidate_inventory_digest) {
        const remaining = [
          ...restored.directories.filter((item) => item !== "."),
          ...restored.files.map((item) => item.path),
          ...restored.symlinks.map((item) => item.path)
        ];
        rollbackErrors.push(
          `The restored candidate inventory digest does not match the preimage; remaining paths: ${remaining.join(", ") || "none"}.`
        );
      }
      if (rollbackErrors.length > 0) {
        const originalMessage = error2 instanceof Error ? error2.message : String(error2);
        throw new AdoptionError(
          "PCP_ROLLBACK_VERIFICATION_FAILED",
          `Adoption failed (${originalMessage}) and exact rollback could not be verified: ${rollbackErrors.join("; ")}`,
          true,
          recoveryRoot
        );
      }
    } else if (recoveryRoot !== void 0) {
      await rm(recoveryRoot, { recursive: true, force: true });
      recoveryRoot = void 0;
    }
    const original = error2 instanceof AdoptionError ? error2 : new AdoptionError(
      "PCP_ADOPTION_TRANSACTION_FAILED",
      error2 instanceof Error ? error2.message : String(error2)
    );
    throw new AdoptionError(original.code, original.message, false, recoveryRoot);
  } finally {
    await lock.close();
  }
}

// src/application/inspect-repository.ts
import { createHash as createHash4 } from "node:crypto";
import { readFile as readFile3 } from "node:fs/promises";
import path5 from "node:path";

// node_modules/yaml/browser/dist/nodes/identity.js
var ALIAS = /* @__PURE__ */ Symbol.for("yaml.alias");
var DOC = /* @__PURE__ */ Symbol.for("yaml.document");
var MAP = /* @__PURE__ */ Symbol.for("yaml.map");
var PAIR = /* @__PURE__ */ Symbol.for("yaml.pair");
var SCALAR = /* @__PURE__ */ Symbol.for("yaml.scalar");
var SEQ = /* @__PURE__ */ Symbol.for("yaml.seq");
var NODE_TYPE = /* @__PURE__ */ Symbol.for("yaml.node.type");
var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
function isCollection(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case MAP:
      case SEQ:
        return true;
    }
  return false;
}
function isNode(node) {
  if (node && typeof node === "object")
    switch (node[NODE_TYPE]) {
      case ALIAS:
      case MAP:
      case SCALAR:
      case SEQ:
        return true;
    }
  return false;
}
var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;

// node_modules/yaml/browser/dist/visit.js
var BREAK = /* @__PURE__ */ Symbol("break visit");
var SKIP = /* @__PURE__ */ Symbol("skip children");
var REMOVE = /* @__PURE__ */ Symbol("remove node");
function visit(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    visit_(null, node, visitor_, Object.freeze([]));
}
visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;
function visit_(key, node, visitor, path18) {
  const ctrl = callVisitor(key, node, visitor, path18);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path18, ctrl);
    return visit_(key, ctrl, visitor, path18);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path18 = Object.freeze(path18.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = visit_(i, node.items[i], visitor, path18);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path18 = Object.freeze(path18.concat(node));
      const ck = visit_("key", node.key, visitor, path18);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = visit_("value", node.value, visitor, path18);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
async function visitAsync(node, visitor) {
  const visitor_ = initVisitor(visitor);
  if (isDocument(node)) {
    const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
    if (cd === REMOVE)
      node.contents = null;
  } else
    await visitAsync_(null, node, visitor_, Object.freeze([]));
}
visitAsync.BREAK = BREAK;
visitAsync.SKIP = SKIP;
visitAsync.REMOVE = REMOVE;
async function visitAsync_(key, node, visitor, path18) {
  const ctrl = await callVisitor(key, node, visitor, path18);
  if (isNode(ctrl) || isPair(ctrl)) {
    replaceNode(key, path18, ctrl);
    return visitAsync_(key, ctrl, visitor, path18);
  }
  if (typeof ctrl !== "symbol") {
    if (isCollection(node)) {
      path18 = Object.freeze(path18.concat(node));
      for (let i = 0; i < node.items.length; ++i) {
        const ci = await visitAsync_(i, node.items[i], visitor, path18);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK)
          return BREAK;
        else if (ci === REMOVE) {
          node.items.splice(i, 1);
          i -= 1;
        }
      }
    } else if (isPair(node)) {
      path18 = Object.freeze(path18.concat(node));
      const ck = await visitAsync_("key", node.key, visitor, path18);
      if (ck === BREAK)
        return BREAK;
      else if (ck === REMOVE)
        node.key = null;
      const cv = await visitAsync_("value", node.value, visitor, path18);
      if (cv === BREAK)
        return BREAK;
      else if (cv === REMOVE)
        node.value = null;
    }
  }
  return ctrl;
}
function initVisitor(visitor) {
  if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
    return Object.assign({
      Alias: visitor.Node,
      Map: visitor.Node,
      Scalar: visitor.Node,
      Seq: visitor.Node
    }, visitor.Value && {
      Map: visitor.Value,
      Scalar: visitor.Value,
      Seq: visitor.Value
    }, visitor.Collection && {
      Map: visitor.Collection,
      Seq: visitor.Collection
    }, visitor);
  }
  return visitor;
}
function callVisitor(key, node, visitor, path18) {
  if (typeof visitor === "function")
    return visitor(key, node, path18);
  if (isMap(node))
    return visitor.Map?.(key, node, path18);
  if (isSeq(node))
    return visitor.Seq?.(key, node, path18);
  if (isPair(node))
    return visitor.Pair?.(key, node, path18);
  if (isScalar(node))
    return visitor.Scalar?.(key, node, path18);
  if (isAlias(node))
    return visitor.Alias?.(key, node, path18);
  return void 0;
}
function replaceNode(key, path18, node) {
  const parent = path18[path18.length - 1];
  if (isCollection(parent)) {
    parent.items[key] = node;
  } else if (isPair(parent)) {
    if (key === "key")
      parent.key = node;
    else
      parent.value = node;
  } else if (isDocument(parent)) {
    parent.contents = node;
  } else {
    const pt = isAlias(parent) ? "alias" : "scalar";
    throw new Error(`Cannot replace node with ${pt} parent`);
  }
}

// node_modules/yaml/browser/dist/doc/directives.js
var escapeChars = {
  "!": "%21",
  ",": "%2C",
  "[": "%5B",
  "]": "%5D",
  "{": "%7B",
  "}": "%7D"
};
var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
var Directives = class _Directives {
  constructor(yaml, tags) {
    this.docStart = null;
    this.docEnd = false;
    this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
    this.tags = Object.assign({}, _Directives.defaultTags, tags);
  }
  clone() {
    const copy = new _Directives(this.yaml, this.tags);
    copy.docStart = this.docStart;
    return copy;
  }
  /**
   * During parsing, get a Directives instance for the current document and
   * update the stream state according to the current version's spec.
   */
  atDocument() {
    const res = new _Directives(this.yaml, this.tags);
    switch (this.yaml.version) {
      case "1.1":
        this.atNextDocument = true;
        break;
      case "1.2":
        this.atNextDocument = false;
        this.yaml = {
          explicit: _Directives.defaultYaml.explicit,
          version: "1.2"
        };
        this.tags = Object.assign({}, _Directives.defaultTags);
        break;
    }
    return res;
  }
  /**
   * @param onError - May be called even if the action was successful
   * @returns `true` on success
   */
  add(line2, onError) {
    if (this.atNextDocument) {
      this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
      this.tags = Object.assign({}, _Directives.defaultTags);
      this.atNextDocument = false;
    }
    const parts = line2.trim().split(/[ \t]+/);
    const name = parts.shift();
    switch (name) {
      case "%TAG": {
        if (parts.length !== 2) {
          onError(0, "%TAG directive should contain exactly two parts");
          if (parts.length < 2)
            return false;
        }
        const [handle, prefix] = parts;
        this.tags[handle] = prefix;
        return true;
      }
      case "%YAML": {
        this.yaml.explicit = true;
        if (parts.length !== 1) {
          onError(0, "%YAML directive should contain exactly one part");
          return false;
        }
        const [version] = parts;
        if (version === "1.1" || version === "1.2") {
          this.yaml.version = version;
          return true;
        } else {
          const isValid = /^\d+\.\d+$/.test(version);
          onError(6, `Unsupported YAML version ${version}`, isValid);
          return false;
        }
      }
      default:
        onError(0, `Unknown directive ${name}`, true);
        return false;
    }
  }
  /**
   * Resolves a tag, matching handles to those defined in %TAG directives.
   *
   * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
   *   `'!local'` tag, or `null` if unresolvable.
   */
  tagName(source, onError) {
    if (source === "!")
      return "!";
    if (source[0] !== "!") {
      onError(`Not a valid tag: ${source}`);
      return null;
    }
    if (source[1] === "<") {
      const verbatim = source.slice(2, -1);
      if (verbatim === "!" || verbatim === "!!") {
        onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
        return null;
      }
      if (source[source.length - 1] !== ">")
        onError("Verbatim tags must end with a >");
      return verbatim;
    }
    const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
    if (!suffix)
      onError(`The ${source} tag has no suffix`);
    const prefix = this.tags[handle];
    if (prefix) {
      try {
        return prefix + decodeURIComponent(suffix);
      } catch (error2) {
        onError(String(error2));
        return null;
      }
    }
    if (handle === "!")
      return source;
    onError(`Could not resolve tag: ${source}`);
    return null;
  }
  /**
   * Given a fully resolved tag, returns its printable string form,
   * taking into account current tag prefixes and defaults.
   */
  tagString(tag) {
    for (const [handle, prefix] of Object.entries(this.tags)) {
      if (tag.startsWith(prefix))
        return handle + escapeTagName(tag.substring(prefix.length));
    }
    return tag[0] === "!" ? tag : `!<${tag}>`;
  }
  toString(doc) {
    const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
    const tagEntries = Object.entries(this.tags);
    let tagNames;
    if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
      const tags = {};
      visit(doc.contents, (_key, node) => {
        if (isNode(node) && node.tag)
          tags[node.tag] = true;
      });
      tagNames = Object.keys(tags);
    } else
      tagNames = [];
    for (const [handle, prefix] of tagEntries) {
      if (handle === "!!" && prefix === "tag:yaml.org,2002:")
        continue;
      if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
        lines.push(`%TAG ${handle} ${prefix}`);
    }
    return lines.join("\n");
  }
};
Directives.defaultYaml = { explicit: false, version: "1.2" };
Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };

// node_modules/yaml/browser/dist/doc/anchors.js
function anchorIsValid(anchor) {
  if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
    const sa = JSON.stringify(anchor);
    const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
    throw new Error(msg);
  }
  return true;
}
function anchorNames(root) {
  const anchors = /* @__PURE__ */ new Set();
  visit(root, {
    Value(_key, node) {
      if (node.anchor)
        anchors.add(node.anchor);
    }
  });
  return anchors;
}
function findNewAnchor(prefix, exclude) {
  for (let i = 1; true; ++i) {
    const name = `${prefix}${i}`;
    if (!exclude.has(name))
      return name;
  }
}
function createNodeAnchors(doc, prefix) {
  const aliasObjects = [];
  const sourceObjects = /* @__PURE__ */ new Map();
  let prevAnchors = null;
  return {
    onAnchor: (source) => {
      aliasObjects.push(source);
      prevAnchors ?? (prevAnchors = anchorNames(doc));
      const anchor = findNewAnchor(prefix, prevAnchors);
      prevAnchors.add(anchor);
      return anchor;
    },
    /**
     * With circular references, the source node is only resolved after all
     * of its child nodes are. This is why anchors are set only after all of
     * the nodes have been created.
     */
    setAnchors: () => {
      for (const source of aliasObjects) {
        const ref = sourceObjects.get(source);
        if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) {
          ref.node.anchor = ref.anchor;
        } else {
          const error2 = new Error("Failed to resolve repeated object (this should not happen)");
          error2.source = source;
          throw error2;
        }
      }
    },
    sourceObjects
  };
}

// node_modules/yaml/browser/dist/doc/applyReviver.js
function applyReviver(reviver, obj, key, val) {
  if (val && typeof val === "object") {
    if (Array.isArray(val)) {
      for (let i = 0, len = val.length; i < len; ++i) {
        const v0 = val[i];
        const v1 = applyReviver(reviver, val, String(i), v0);
        if (v1 === void 0)
          delete val[i];
        else if (v1 !== v0)
          val[i] = v1;
      }
    } else if (val instanceof Map) {
      for (const k of Array.from(val.keys())) {
        const v0 = val.get(k);
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          val.delete(k);
        else if (v1 !== v0)
          val.set(k, v1);
      }
    } else if (val instanceof Set) {
      for (const v0 of Array.from(val)) {
        const v1 = applyReviver(reviver, val, v0, v0);
        if (v1 === void 0)
          val.delete(v0);
        else if (v1 !== v0) {
          val.delete(v0);
          val.add(v1);
        }
      }
    } else {
      for (const [k, v0] of Object.entries(val)) {
        const v1 = applyReviver(reviver, val, k, v0);
        if (v1 === void 0)
          delete val[k];
        else if (v1 !== v0)
          val[k] = v1;
      }
    }
  }
  return reviver.call(obj, key, val);
}

// node_modules/yaml/browser/dist/nodes/toJS.js
function toJS(value, arg, ctx) {
  if (Array.isArray(value))
    return value.map((v, i) => toJS(v, String(i), ctx));
  if (value && typeof value.toJSON === "function") {
    if (!ctx || !hasAnchor(value))
      return value.toJSON(arg, ctx);
    const data = { aliasCount: 0, count: 1, res: void 0 };
    ctx.anchors.set(value, data);
    ctx.onCreate = (res2) => {
      data.res = res2;
      delete ctx.onCreate;
    };
    const res = value.toJSON(arg, ctx);
    if (ctx.onCreate)
      ctx.onCreate(res);
    return res;
  }
  if (typeof value === "bigint" && !ctx?.keep)
    return Number(value);
  return value;
}

// node_modules/yaml/browser/dist/nodes/Node.js
var NodeBase = class {
  constructor(type) {
    Object.defineProperty(this, NODE_TYPE, { value: type });
  }
  /** Create a copy of this node.  */
  clone() {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** A plain JavaScript representation of this node. */
  toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    if (!isDocument(doc))
      throw new TypeError("A document argument is required");
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc,
      keep: true,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this, "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
};

// node_modules/yaml/browser/dist/nodes/Alias.js
var Alias = class extends NodeBase {
  constructor(source) {
    super(ALIAS);
    this.source = source;
    Object.defineProperty(this, "tag", {
      set() {
        throw new Error("Alias nodes cannot have tags");
      }
    });
  }
  /**
   * Resolve the value of this alias within `doc`, finding the last
   * instance of the `source` anchor before this node.
   */
  resolve(doc, ctx) {
    if (ctx?.maxAliasCount === 0)
      throw new ReferenceError("Alias resolution is disabled");
    let nodes;
    if (ctx?.aliasResolveCache) {
      nodes = ctx.aliasResolveCache;
    } else {
      nodes = [];
      visit(doc, {
        Node: (_key, node) => {
          if (isAlias(node) || hasAnchor(node))
            nodes.push(node);
        }
      });
      if (ctx)
        ctx.aliasResolveCache = nodes;
    }
    let found = void 0;
    for (const node of nodes) {
      if (node === this)
        break;
      if (node.anchor === this.source)
        found = node;
    }
    return found;
  }
  toJSON(_arg, ctx) {
    if (!ctx)
      return { source: this.source };
    const { anchors, doc, maxAliasCount } = ctx;
    const source = this.resolve(doc, ctx);
    if (!source) {
      const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
      throw new ReferenceError(msg);
    }
    let data = anchors.get(source);
    if (!data) {
      toJS(source, null, ctx);
      data = anchors.get(source);
    }
    if (data?.res === void 0) {
      const msg = "This should not happen: Alias anchor was not resolved?";
      throw new ReferenceError(msg);
    }
    if (maxAliasCount >= 0) {
      data.count += 1;
      if (data.aliasCount === 0)
        data.aliasCount = getAliasCount(doc, source, anchors);
      if (data.count * data.aliasCount > maxAliasCount) {
        const msg = "Excessive alias count indicates a resource exhaustion attack";
        throw new ReferenceError(msg);
      }
    }
    return data.res;
  }
  toString(ctx, _onComment, _onChompKeep) {
    const src = `*${this.source}`;
    if (ctx) {
      anchorIsValid(this.source);
      if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new Error(msg);
      }
      if (ctx.implicitKey)
        return `${src} `;
    }
    return src;
  }
};
function getAliasCount(doc, node, anchors) {
  if (isAlias(node)) {
    const source = node.resolve(doc);
    const anchor = anchors && source && anchors.get(source);
    return anchor ? anchor.count * anchor.aliasCount : 0;
  } else if (isCollection(node)) {
    let count = 0;
    for (const item of node.items) {
      const c = getAliasCount(doc, item, anchors);
      if (c > count)
        count = c;
    }
    return count;
  } else if (isPair(node)) {
    const kc = getAliasCount(doc, node.key, anchors);
    const vc = getAliasCount(doc, node.value, anchors);
    return Math.max(kc, vc);
  }
  return 1;
}

// node_modules/yaml/browser/dist/nodes/Scalar.js
var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
var Scalar = class extends NodeBase {
  constructor(value) {
    super(SCALAR);
    this.value = value;
  }
  toJSON(arg, ctx) {
    return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
  }
  toString() {
    return String(this.value);
  }
};
Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
Scalar.PLAIN = "PLAIN";
Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";

// node_modules/yaml/browser/dist/doc/createNode.js
var defaultTagPrefix = "tag:yaml.org,2002:";
function findTagObject(value, tagName, tags) {
  if (tagName) {
    const match = tags.filter((t) => t.tag === tagName);
    const tagObj = match.find((t) => !t.format) ?? match[0];
    if (!tagObj)
      throw new Error(`Tag ${tagName} not found`);
    return tagObj;
  }
  return tags.find((t) => t.identify?.(value) && !t.format);
}
function createNode(value, tagName, ctx) {
  if (isDocument(value))
    value = value.contents;
  if (isNode(value))
    return value;
  if (isPair(value)) {
    const map2 = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
    map2.items.push(value);
    return map2;
  }
  if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
    value = value.valueOf();
  }
  const { aliasDuplicateObjects, onAnchor, onTagObj, schema: schema4, sourceObjects } = ctx;
  let ref = void 0;
  if (aliasDuplicateObjects && value && typeof value === "object") {
    ref = sourceObjects.get(value);
    if (ref) {
      ref.anchor ?? (ref.anchor = onAnchor(value));
      return new Alias(ref.anchor);
    } else {
      ref = { anchor: null, node: null };
      sourceObjects.set(value, ref);
    }
  }
  if (tagName?.startsWith("!!"))
    tagName = defaultTagPrefix + tagName.slice(2);
  let tagObj = findTagObject(value, tagName, schema4.tags);
  if (!tagObj) {
    if (value && typeof value.toJSON === "function") {
      value = value.toJSON();
    }
    if (!value || typeof value !== "object") {
      const node2 = new Scalar(value);
      if (ref)
        ref.node = node2;
      return node2;
    }
    tagObj = value instanceof Map ? schema4[MAP] : Symbol.iterator in Object(value) ? schema4[SEQ] : schema4[MAP];
  }
  if (onTagObj) {
    onTagObj(tagObj);
    delete ctx.onTagObj;
  }
  const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
  if (tagName)
    node.tag = tagName;
  else if (!tagObj.default)
    node.tag = tagObj.tag;
  if (ref)
    ref.node = node;
  return node;
}

// node_modules/yaml/browser/dist/nodes/Collection.js
function collectionFromPath(schema4, path18, value) {
  let v = value;
  for (let i = path18.length - 1; i >= 0; --i) {
    const k = path18[i];
    if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
      const a = [];
      a[k] = v;
      v = a;
    } else {
      v = /* @__PURE__ */ new Map([[k, v]]);
    }
  }
  return createNode(v, void 0, {
    aliasDuplicateObjects: false,
    keepUndefined: false,
    onAnchor: () => {
      throw new Error("This should not happen, please report a bug.");
    },
    schema: schema4,
    sourceObjects: /* @__PURE__ */ new Map()
  });
}
var isEmptyPath = (path18) => path18 == null || typeof path18 === "object" && !!path18[Symbol.iterator]().next().done;
var Collection = class extends NodeBase {
  constructor(type, schema4) {
    super(type);
    Object.defineProperty(this, "schema", {
      value: schema4,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
  /**
   * Create a copy of this collection.
   *
   * @param schema - If defined, overwrites the original's schema
   */
  clone(schema4) {
    const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
    if (schema4)
      copy.schema = schema4;
    copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema4) : it);
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /**
   * Adds a value to the collection. For `!!map` and `!!omap` the value must
   * be a Pair instance or a `{ key, value }` object, which may not have a key
   * that already exists in the map.
   */
  addIn(path18, value) {
    if (isEmptyPath(path18))
      this.add(value);
    else {
      const [key, ...rest] = path18;
      const node = this.get(key, true);
      if (isCollection(node))
        node.addIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
  /**
   * Removes a value from the collection.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path18) {
    const [key, ...rest] = path18;
    if (rest.length === 0)
      return this.delete(key);
    const node = this.get(key, true);
    if (isCollection(node))
      return node.deleteIn(rest);
    else
      throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path18, keepScalar) {
    const [key, ...rest] = path18;
    const node = this.get(key, true);
    if (rest.length === 0)
      return !keepScalar && isScalar(node) ? node.value : node;
    else
      return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
  }
  hasAllNullValues(allowScalar) {
    return this.items.every((node) => {
      if (!isPair(node))
        return false;
      const n = node.value;
      return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
    });
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   */
  hasIn(path18) {
    const [key, ...rest] = path18;
    if (rest.length === 0)
      return this.has(key);
    const node = this.get(key, true);
    return isCollection(node) ? node.hasIn(rest) : false;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path18, value) {
    const [key, ...rest] = path18;
    if (rest.length === 0) {
      this.set(key, value);
    } else {
      const node = this.get(key, true);
      if (isCollection(node))
        node.setIn(rest, value);
      else if (node === void 0 && this.schema)
        this.set(key, collectionFromPath(this.schema, rest, value));
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyComment.js
var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
function indentComment(comment, indent) {
  if (/^\n+$/.test(comment))
    return comment.substring(1);
  return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
}
var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;

// node_modules/yaml/browser/dist/stringify/foldFlowLines.js
var FOLD_FLOW = "flow";
var FOLD_BLOCK = "block";
var FOLD_QUOTED = "quoted";
function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
  if (!lineWidth || lineWidth < 0)
    return text;
  if (lineWidth < minContentWidth)
    minContentWidth = 0;
  const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
  if (text.length <= endStep)
    return text;
  const folds = [];
  const escapedFolds = {};
  let end = lineWidth - indent.length;
  if (typeof indentAtStart === "number") {
    if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
      folds.push(0);
    else
      end = lineWidth - indentAtStart;
  }
  let split = void 0;
  let prev = void 0;
  let overflow = false;
  let i = -1;
  let escStart = -1;
  let escEnd = -1;
  if (mode === FOLD_BLOCK) {
    i = consumeMoreIndentedLines(text, i, indent.length);
    if (i !== -1)
      end = i + endStep;
  }
  for (let ch; ch = text[i += 1]; ) {
    if (mode === FOLD_QUOTED && ch === "\\") {
      escStart = i;
      switch (text[i + 1]) {
        case "x":
          i += 3;
          break;
        case "u":
          i += 5;
          break;
        case "U":
          i += 9;
          break;
        default:
          i += 1;
      }
      escEnd = i;
    }
    if (ch === "\n") {
      if (mode === FOLD_BLOCK)
        i = consumeMoreIndentedLines(text, i, indent.length);
      end = i + indent.length + endStep;
      split = void 0;
    } else {
      if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
        const next = text[i + 1];
        if (next && next !== " " && next !== "\n" && next !== "	")
          split = i;
      }
      if (i >= end) {
        if (split) {
          folds.push(split);
          end = split + endStep;
          split = void 0;
        } else if (mode === FOLD_QUOTED) {
          while (prev === " " || prev === "	") {
            prev = ch;
            ch = text[i += 1];
            overflow = true;
          }
          const j = i > escEnd + 1 ? i - 2 : escStart - 1;
          if (escapedFolds[j])
            return text;
          folds.push(j);
          escapedFolds[j] = true;
          end = j + endStep;
          split = void 0;
        } else {
          overflow = true;
        }
      }
    }
    prev = ch;
  }
  if (overflow && onOverflow)
    onOverflow();
  if (folds.length === 0)
    return text;
  if (onFold)
    onFold();
  let res = text.slice(0, folds[0]);
  for (let i2 = 0; i2 < folds.length; ++i2) {
    const fold = folds[i2];
    const end2 = folds[i2 + 1] || text.length;
    if (fold === 0)
      res = `
${indent}${text.slice(0, end2)}`;
    else {
      if (mode === FOLD_QUOTED && escapedFolds[fold])
        res += `${text[fold]}\\`;
      res += `
${indent}${text.slice(fold + 1, end2)}`;
    }
  }
  return res;
}
function consumeMoreIndentedLines(text, i, indent) {
  let end = i;
  let start = i + 1;
  let ch = text[start];
  while (ch === " " || ch === "	") {
    if (i < start + indent) {
      ch = text[++i];
    } else {
      do {
        ch = text[++i];
      } while (ch && ch !== "\n");
      end = i;
      start = i + 1;
      ch = text[start];
    }
  }
  return end;
}

// node_modules/yaml/browser/dist/stringify/stringifyString.js
var getFoldOptions = (ctx, isBlock2) => ({
  indentAtStart: isBlock2 ? ctx.indent.length : ctx.indentAtStart,
  lineWidth: ctx.options.lineWidth,
  minContentWidth: ctx.options.minContentWidth
});
var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
function lineLengthOverLimit(str, lineWidth, indentLength) {
  if (!lineWidth || lineWidth < 0)
    return false;
  const limit = lineWidth - indentLength;
  const strLen = str.length;
  if (strLen <= limit)
    return false;
  for (let i = 0, start = 0; i < strLen; ++i) {
    if (str[i] === "\n") {
      if (i - start > limit)
        return true;
      start = i + 1;
      if (strLen - start <= limit)
        return false;
    }
  }
  return true;
}
function doubleQuotedString(value, ctx) {
  const json = JSON.stringify(value);
  if (ctx.options.doubleQuotedAsJSON)
    return json;
  const { implicitKey } = ctx;
  const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  let str = "";
  let start = 0;
  for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
    if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
      str += json.slice(start, i) + "\\ ";
      i += 1;
      start = i;
      ch = "\\";
    }
    if (ch === "\\")
      switch (json[i + 1]) {
        case "u":
          {
            str += json.slice(start, i);
            const code2 = json.substr(i + 2, 4);
            switch (code2) {
              case "0000":
                str += "\\0";
                break;
              case "0007":
                str += "\\a";
                break;
              case "000b":
                str += "\\v";
                break;
              case "001b":
                str += "\\e";
                break;
              case "0085":
                str += "\\N";
                break;
              case "00a0":
                str += "\\_";
                break;
              case "2028":
                str += "\\L";
                break;
              case "2029":
                str += "\\P";
                break;
              default:
                if (code2.substr(0, 2) === "00")
                  str += "\\x" + code2.substr(2);
                else
                  str += json.substr(i, 6);
            }
            i += 5;
            start = i + 1;
          }
          break;
        case "n":
          if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
            i += 1;
          } else {
            str += json.slice(start, i) + "\n\n";
            while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
              str += "\n";
              i += 2;
            }
            str += indent;
            if (json[i + 2] === " ")
              str += "\\";
            i += 1;
            start = i + 1;
          }
          break;
        default:
          i += 1;
      }
  }
  str = start ? str + json.slice(start) : json;
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
}
function singleQuotedString(value, ctx) {
  if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
    return doubleQuotedString(value, ctx);
  const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
  const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
  return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function quotedString(value, ctx) {
  const { singleQuote } = ctx.options;
  let qs;
  if (singleQuote === false)
    qs = doubleQuotedString;
  else {
    const hasDouble = value.includes('"');
    const hasSingle = value.includes("'");
    if (hasDouble && !hasSingle)
      qs = singleQuotedString;
    else if (hasSingle && !hasDouble)
      qs = doubleQuotedString;
    else
      qs = singleQuote ? singleQuotedString : doubleQuotedString;
  }
  return qs(value, ctx);
}
var blockEndNewlines;
try {
  blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
} catch {
  blockEndNewlines = /\n+(?!\n|$)/g;
}
function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
  const { blockQuote, commentString, lineWidth } = ctx.options;
  if (!blockQuote || /\n[\t ]+$/.test(value)) {
    return quotedString(value, ctx);
  }
  const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
  const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
  if (!value)
    return literal ? "|\n" : ">\n";
  let chomp;
  let endStart;
  for (endStart = value.length; endStart > 0; --endStart) {
    const ch = value[endStart - 1];
    if (ch !== "\n" && ch !== "	" && ch !== " ")
      break;
  }
  let end = value.substring(endStart);
  const endNlPos = end.indexOf("\n");
  if (endNlPos === -1) {
    chomp = "-";
  } else if (value === end || endNlPos !== end.length - 1) {
    chomp = "+";
    if (onChompKeep)
      onChompKeep();
  } else {
    chomp = "";
  }
  if (end) {
    value = value.slice(0, -end.length);
    if (end[end.length - 1] === "\n")
      end = end.slice(0, -1);
    end = end.replace(blockEndNewlines, `$&${indent}`);
  }
  let startWithSpace = false;
  let startEnd;
  let startNlPos = -1;
  for (startEnd = 0; startEnd < value.length; ++startEnd) {
    const ch = value[startEnd];
    if (ch === " ")
      startWithSpace = true;
    else if (ch === "\n")
      startNlPos = startEnd;
    else
      break;
  }
  let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
  if (start) {
    value = value.substring(start.length);
    start = start.replace(/\n+/g, `$&${indent}`);
  }
  const indentSize = indent ? "2" : "1";
  let header = (startWithSpace ? indentSize : "") + chomp;
  if (comment) {
    header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
    if (onComment)
      onComment();
  }
  if (!literal) {
    const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
    let literalFallback = false;
    const foldOptions = getFoldOptions(ctx, true);
    if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) {
      foldOptions.onOverflow = () => {
        literalFallback = true;
      };
    }
    const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
    if (!literalFallback)
      return `>${header}
${indent}${body}`;
  }
  value = value.replace(/\n+/g, `$&${indent}`);
  return `|${header}
${indent}${start}${value}${end}`;
}
function plainString(item, ctx, onComment, onChompKeep) {
  const { type, value } = item;
  const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
  if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
    return quotedString(value, ctx);
  }
  if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
    return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
  }
  if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) {
    return blockString(item, ctx, onComment, onChompKeep);
  }
  if (containsDocumentMarker(value)) {
    if (indent === "") {
      ctx.forceBlockIndent = true;
      return blockString(item, ctx, onComment, onChompKeep);
    } else if (implicitKey && indent === indentStep) {
      return quotedString(value, ctx);
    }
  }
  const str = value.replace(/\n+/g, `$&
${indent}`);
  if (actualString) {
    const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
    const { compat, tags } = ctx.doc.schema;
    if (tags.some(test) || compat?.some(test))
      return quotedString(value, ctx);
  }
  return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
}
function stringifyString(item, ctx, onComment, onChompKeep) {
  const { implicitKey, inFlow } = ctx;
  const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
  let { type } = item;
  if (type !== Scalar.QUOTE_DOUBLE) {
    if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
      type = Scalar.QUOTE_DOUBLE;
  }
  const _stringify = (_type) => {
    switch (_type) {
      case Scalar.BLOCK_FOLDED:
      case Scalar.BLOCK_LITERAL:
        return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
      case Scalar.QUOTE_DOUBLE:
        return doubleQuotedString(ss.value, ctx);
      case Scalar.QUOTE_SINGLE:
        return singleQuotedString(ss.value, ctx);
      case Scalar.PLAIN:
        return plainString(ss, ctx, onComment, onChompKeep);
      default:
        return null;
    }
  };
  let res = _stringify(type);
  if (res === null) {
    const { defaultKeyType, defaultStringType } = ctx.options;
    const t = implicitKey && defaultKeyType || defaultStringType;
    res = _stringify(t);
    if (res === null)
      throw new Error(`Unsupported default string type ${t}`);
  }
  return res;
}

// node_modules/yaml/browser/dist/stringify/stringify.js
function createStringifyContext(doc, options) {
  const opt = Object.assign({
    blockQuote: true,
    commentString: stringifyComment,
    defaultKeyType: null,
    defaultStringType: "PLAIN",
    directives: null,
    doubleQuotedAsJSON: false,
    doubleQuotedMinMultiLineLength: 40,
    falseStr: "false",
    flowCollectionPadding: true,
    indentSeq: true,
    lineWidth: 80,
    minContentWidth: 20,
    nullStr: "null",
    simpleKeys: false,
    singleQuote: null,
    trailingComma: false,
    trueStr: "true",
    verifyAliasOrder: true
  }, doc.schema.toStringOptions, options);
  let inFlow;
  switch (opt.collectionStyle) {
    case "block":
      inFlow = false;
      break;
    case "flow":
      inFlow = true;
      break;
    default:
      inFlow = null;
  }
  return {
    anchors: /* @__PURE__ */ new Set(),
    doc,
    flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
    indent: "",
    indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
    inFlow,
    options: opt
  };
}
function getTagObject(tags, item) {
  if (item.tag) {
    const match = tags.filter((t) => t.tag === item.tag);
    if (match.length > 0)
      return match.find((t) => t.format === item.format) ?? match[0];
  }
  let tagObj = void 0;
  let obj;
  if (isScalar(item)) {
    obj = item.value;
    let match = tags.filter((t) => t.identify?.(obj));
    if (match.length > 1) {
      const testMatch = match.filter((t) => t.test);
      if (testMatch.length > 0)
        match = testMatch;
    }
    tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
  } else {
    obj = item;
    tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
  }
  if (!tagObj) {
    const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
    throw new Error(`Tag not resolved for ${name} value`);
  }
  return tagObj;
}
function stringifyProps(node, tagObj, { anchors, doc }) {
  if (!doc.directives)
    return "";
  const props = [];
  const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
  if (anchor && anchorIsValid(anchor)) {
    anchors.add(anchor);
    props.push(`&${anchor}`);
  }
  const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
  if (tag)
    props.push(doc.directives.tagString(tag));
  return props.join(" ");
}
function stringify(item, ctx, onComment, onChompKeep) {
  if (isPair(item))
    return item.toString(ctx, onComment, onChompKeep);
  if (isAlias(item)) {
    if (ctx.doc.directives)
      return item.toString(ctx);
    if (ctx.resolvedAliases?.has(item)) {
      throw new TypeError(`Cannot stringify circular structure without alias nodes`);
    } else {
      if (ctx.resolvedAliases)
        ctx.resolvedAliases.add(item);
      else
        ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
      item = item.resolve(ctx.doc);
    }
  }
  let tagObj = void 0;
  const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
  tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
  const props = stringifyProps(node, tagObj, ctx);
  if (props.length > 0)
    ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
  const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
  if (!props)
    return str;
  return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
}

// node_modules/yaml/browser/dist/stringify/stringifyPair.js
function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
  const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
  let keyComment = isNode(key) && key.comment || null;
  if (simpleKeys) {
    if (keyComment) {
      throw new Error("With simple keys, key nodes cannot have comments");
    }
    if (isCollection(key) || !isNode(key) && typeof key === "object") {
      const msg = "With simple keys, collection cannot be used as a key value";
      throw new Error(msg);
    }
  }
  let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
  ctx = Object.assign({}, ctx, {
    allNullValues: false,
    implicitKey: !explicitKey && (simpleKeys || !allNullValues),
    indent: indent + indentStep
  });
  let keyCommentDone = false;
  let chompKeep = false;
  let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
  if (!explicitKey && !ctx.inFlow && str.length > 1024) {
    if (simpleKeys)
      throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
    explicitKey = true;
  }
  if (ctx.inFlow) {
    if (allNullValues || value == null) {
      if (keyCommentDone && onComment)
        onComment();
      return str === "" ? "?" : explicitKey ? `? ${str}` : str;
    }
  } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
    str = `? ${str}`;
    if (keyComment && !keyCommentDone) {
      str += lineComment(str, ctx.indent, commentString(keyComment));
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  if (keyCommentDone)
    keyComment = null;
  if (explicitKey) {
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
    str = `? ${str}
${indent}:`;
  } else {
    str = `${str}:`;
    if (keyComment)
      str += lineComment(str, ctx.indent, commentString(keyComment));
  }
  let vsb, vcb, valueComment;
  if (isNode(value)) {
    vsb = !!value.spaceBefore;
    vcb = value.commentBefore;
    valueComment = value.comment;
  } else {
    vsb = false;
    vcb = null;
    valueComment = null;
    if (value && typeof value === "object")
      value = doc.createNode(value);
  }
  ctx.implicitKey = false;
  if (!explicitKey && !keyComment && isScalar(value))
    ctx.indentAtStart = str.length + 1;
  chompKeep = false;
  if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) {
    ctx.indent = ctx.indent.substring(2);
  }
  let valueCommentDone = false;
  const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
  let ws = " ";
  if (keyComment || vsb || vcb) {
    ws = vsb ? "\n" : "";
    if (vcb) {
      const cs = commentString(vcb);
      ws += `
${indentComment(cs, ctx.indent)}`;
    }
    if (valueStr === "" && !ctx.inFlow) {
      if (ws === "\n" && valueComment)
        ws = "\n\n";
    } else {
      ws += `
${ctx.indent}`;
    }
  } else if (!explicitKey && isCollection(value)) {
    const vs0 = valueStr[0];
    const nl0 = valueStr.indexOf("\n");
    const hasNewline = nl0 !== -1;
    const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
    if (hasNewline || !flow) {
      let hasPropsLine = false;
      if (hasNewline && (vs0 === "&" || vs0 === "!")) {
        let sp0 = valueStr.indexOf(" ");
        if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
          sp0 = valueStr.indexOf(" ", sp0 + 1);
        }
        if (sp0 === -1 || nl0 < sp0)
          hasPropsLine = true;
      }
      if (!hasPropsLine)
        ws = `
${ctx.indent}`;
    }
  } else if (valueStr === "" || valueStr[0] === "\n") {
    ws = "";
  }
  str += ws + valueStr;
  if (ctx.inFlow) {
    if (valueCommentDone && onComment)
      onComment();
  } else if (valueComment && !valueCommentDone) {
    str += lineComment(str, ctx.indent, commentString(valueComment));
  } else if (chompKeep && onChompKeep) {
    onChompKeep();
  }
  return str;
}

// node_modules/yaml/browser/dist/log.js
function warn(logLevel, warning) {
  if (logLevel === "debug" || logLevel === "warn") {
    console.warn(warning);
  }
}

// node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
var MERGE_KEY = "<<";
var merge = {
  identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
  default: "key",
  tag: "tag:yaml.org,2002:merge",
  test: /^<<$/,
  resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), {
    addToJSMap: addMergeToJSMap
  }),
  stringify: () => MERGE_KEY
};
var isMergeKey = (ctx, key) => (merge.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
function addMergeToJSMap(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (isSeq(source))
    for (const it of source.items)
      mergeValue(ctx, map2, it);
  else if (Array.isArray(source))
    for (const it of source)
      mergeValue(ctx, map2, it);
  else
    mergeValue(ctx, map2, source);
}
function mergeValue(ctx, map2, value) {
  const source = resolveAliasValue(ctx, value);
  if (!isMap(source))
    throw new Error("Merge sources must be maps or map aliases");
  const srcMap = source.toJSON(null, ctx, Map);
  for (const [key, value2] of srcMap) {
    if (map2 instanceof Map) {
      if (!map2.has(key))
        map2.set(key, value2);
    } else if (map2 instanceof Set) {
      map2.add(key);
    } else if (!Object.prototype.hasOwnProperty.call(map2, key)) {
      Object.defineProperty(map2, key, {
        value: value2,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  }
  return map2;
}
function resolveAliasValue(ctx, value) {
  return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
}

// node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
function addPairToJSMap(ctx, map2, { key, value }) {
  if (isNode(key) && key.addToJSMap)
    key.addToJSMap(ctx, map2, value);
  else if (isMergeKey(ctx, key))
    addMergeToJSMap(ctx, map2, value);
  else {
    const jsKey = toJS(key, "", ctx);
    if (map2 instanceof Map) {
      map2.set(jsKey, toJS(value, jsKey, ctx));
    } else if (map2 instanceof Set) {
      map2.add(jsKey);
    } else {
      const stringKey = stringifyKey(key, jsKey, ctx);
      const jsValue = toJS(value, stringKey, ctx);
      if (stringKey in map2)
        Object.defineProperty(map2, stringKey, {
          value: jsValue,
          writable: true,
          enumerable: true,
          configurable: true
        });
      else
        map2[stringKey] = jsValue;
    }
  }
  return map2;
}
function stringifyKey(key, jsKey, ctx) {
  if (jsKey === null)
    return "";
  if (typeof jsKey !== "object")
    return String(jsKey);
  if (isNode(key) && ctx?.doc) {
    const strCtx = createStringifyContext(ctx.doc, {});
    strCtx.anchors = /* @__PURE__ */ new Set();
    for (const node of ctx.anchors.keys())
      strCtx.anchors.add(node.anchor);
    strCtx.inFlow = true;
    strCtx.inStringifyKey = true;
    const strKey = key.toString(strCtx);
    if (!ctx.mapKeyWarned) {
      let jsonStr = JSON.stringify(strKey);
      if (jsonStr.length > 40)
        jsonStr = jsonStr.substring(0, 36) + '..."';
      warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
      ctx.mapKeyWarned = true;
    }
    return strKey;
  }
  return JSON.stringify(jsKey);
}

// node_modules/yaml/browser/dist/nodes/Pair.js
function createPair(key, value, ctx) {
  const k = createNode(key, void 0, ctx);
  const v = createNode(value, void 0, ctx);
  return new Pair(k, v);
}
var Pair = class _Pair {
  constructor(key, value = null) {
    Object.defineProperty(this, NODE_TYPE, { value: PAIR });
    this.key = key;
    this.value = value;
  }
  clone(schema4) {
    let { key, value } = this;
    if (isNode(key))
      key = key.clone(schema4);
    if (isNode(value))
      value = value.clone(schema4);
    return new _Pair(key, value);
  }
  toJSON(_, ctx) {
    const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    return addPairToJSMap(ctx, pair, this);
  }
  toString(ctx, onComment, onChompKeep) {
    return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyCollection.js
function stringifyCollection(collection, ctx, options) {
  const flow = ctx.inFlow ?? collection.flow;
  const stringify4 = flow ? stringifyFlowCollection : stringifyBlockCollection;
  return stringify4(collection, ctx, options);
}
function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
  const { indent, options: { commentString } } = ctx;
  const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
  let chompKeep = false;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment2 = null;
    if (isNode(item)) {
      if (!chompKeep && item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
      if (item.comment)
        comment2 = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (!chompKeep && ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
      }
    }
    chompKeep = false;
    let str2 = stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
    if (comment2)
      str2 += lineComment(str2, itemIndent, commentString(comment2));
    if (chompKeep && comment2)
      chompKeep = false;
    lines.push(blockItemPrefix + str2);
  }
  let str;
  if (lines.length === 0) {
    str = flowChars.start + flowChars.end;
  } else {
    str = lines[0];
    for (let i = 1; i < lines.length; ++i) {
      const line2 = lines[i];
      str += line2 ? `
${indent}${line2}` : "\n";
    }
  }
  if (comment) {
    str += "\n" + indentComment(commentString(comment), indent);
    if (onComment)
      onComment();
  } else if (chompKeep && onChompKeep)
    onChompKeep();
  return str;
}
function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
  const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
  itemIndent += indentStep;
  const itemCtx = Object.assign({}, ctx, {
    indent: itemIndent,
    inFlow: true,
    type: null
  });
  let reqNewline = false;
  let linesAtValue = 0;
  const lines = [];
  for (let i = 0; i < items.length; ++i) {
    const item = items[i];
    let comment = null;
    if (isNode(item)) {
      if (item.spaceBefore)
        lines.push("");
      addCommentBefore(ctx, lines, item.commentBefore, false);
      if (item.comment)
        comment = item.comment;
    } else if (isPair(item)) {
      const ik = isNode(item.key) ? item.key : null;
      if (ik) {
        if (ik.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, ik.commentBefore, false);
        if (ik.comment)
          reqNewline = true;
      }
      const iv = isNode(item.value) ? item.value : null;
      if (iv) {
        if (iv.comment)
          comment = iv.comment;
        if (iv.commentBefore)
          reqNewline = true;
      } else if (item.value == null && ik?.comment) {
        comment = ik.comment;
      }
    }
    if (comment)
      reqNewline = true;
    let str = stringify(item, itemCtx, () => comment = null);
    reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
    if (i < items.length - 1) {
      str += ",";
    } else if (ctx.options.trailingComma) {
      if (ctx.options.lineWidth > 0) {
        reqNewline || (reqNewline = lines.reduce((sum, line2) => sum + line2.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
      }
      if (reqNewline) {
        str += ",";
      }
    }
    if (comment)
      str += lineComment(str, itemIndent, commentString(comment));
    lines.push(str);
    linesAtValue = lines.length;
  }
  const { start, end } = flowChars;
  if (lines.length === 0) {
    return start + end;
  } else {
    if (!reqNewline) {
      const len = lines.reduce((sum, line2) => sum + line2.length + 2, 2);
      reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
    }
    if (reqNewline) {
      let str = start;
      for (const line2 of lines)
        str += line2 ? `
${indentStep}${indent}${line2}` : "\n";
      return `${str}
${indent}${end}`;
    } else {
      return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
    }
  }
}
function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
  if (comment && chompKeep)
    comment = comment.replace(/^\n+/, "");
  if (comment) {
    const ic = indentComment(commentString(comment), indent);
    lines.push(ic.trimStart());
  }
}

// node_modules/yaml/browser/dist/nodes/YAMLMap.js
function findPair(items, key) {
  const k = isScalar(key) ? key.value : key;
  for (const it of items) {
    if (isPair(it)) {
      if (it.key === key || it.key === k)
        return it;
      if (isScalar(it.key) && it.key.value === k)
        return it;
    }
  }
  return void 0;
}
var YAMLMap = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:map";
  }
  constructor(schema4) {
    super(MAP, schema4);
    this.items = [];
  }
  /**
   * A generic collection parsing method that can be extended
   * to other node classes that inherit from YAMLMap
   */
  static from(schema4, obj, ctx) {
    const { keepUndefined, replacer } = ctx;
    const map2 = new this(schema4);
    const add = (key, value) => {
      if (typeof replacer === "function")
        value = replacer.call(obj, key, value);
      else if (Array.isArray(replacer) && !replacer.includes(key))
        return;
      if (value !== void 0 || keepUndefined)
        map2.items.push(createPair(key, value, ctx));
    };
    if (obj instanceof Map) {
      for (const [key, value] of obj)
        add(key, value);
    } else if (obj && typeof obj === "object") {
      for (const key of Object.keys(obj))
        add(key, obj[key]);
    }
    if (typeof schema4.sortMapEntries === "function") {
      map2.items.sort(schema4.sortMapEntries);
    }
    return map2;
  }
  /**
   * Adds a value to the collection.
   *
   * @param overwrite - If not set `true`, using a key that is already in the
   *   collection will throw. Otherwise, overwrites the previous value.
   */
  add(pair, overwrite) {
    let _pair;
    if (isPair(pair))
      _pair = pair;
    else if (!pair || typeof pair !== "object" || !("key" in pair)) {
      _pair = new Pair(pair, pair?.value);
    } else
      _pair = new Pair(pair.key, pair.value);
    const prev = findPair(this.items, _pair.key);
    const sortEntries = this.schema?.sortMapEntries;
    if (prev) {
      if (!overwrite)
        throw new Error(`Key ${_pair.key} already set`);
      if (isScalar(prev.value) && isScalarValue(_pair.value))
        prev.value.value = _pair.value;
      else
        prev.value = _pair.value;
    } else if (sortEntries) {
      const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
      if (i === -1)
        this.items.push(_pair);
      else
        this.items.splice(i, 0, _pair);
    } else {
      this.items.push(_pair);
    }
  }
  delete(key) {
    const it = findPair(this.items, key);
    if (!it)
      return false;
    const del = this.items.splice(this.items.indexOf(it), 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const it = findPair(this.items, key);
    const node = it?.value;
    return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
  }
  has(key) {
    return !!findPair(this.items, key);
  }
  set(key, value) {
    this.add(new Pair(key, value), true);
  }
  /**
   * @param ctx - Conversion context, originally set in Document#toJS()
   * @param {Class} Type - If set, forces the returned collection type
   * @returns Instance of Type, Map, or Object
   */
  toJSON(_, ctx, Type) {
    const map2 = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const item of this.items)
      addPairToJSMap(ctx, map2, item);
    return map2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    for (const item of this.items) {
      if (!isPair(item))
        throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
    }
    if (!ctx.allNullValues && this.hasAllNullValues(false))
      ctx = Object.assign({}, ctx, { allNullValues: true });
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "",
      flowChars: { start: "{", end: "}" },
      itemIndent: ctx.indent || "",
      onChompKeep,
      onComment
    });
  }
};

// node_modules/yaml/browser/dist/schema/common/map.js
var map = {
  collection: "map",
  default: true,
  nodeClass: YAMLMap,
  tag: "tag:yaml.org,2002:map",
  resolve(map2, onError) {
    if (!isMap(map2))
      onError("Expected a mapping for this tag");
    return map2;
  },
  createNode: (schema4, obj, ctx) => YAMLMap.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/nodes/YAMLSeq.js
var YAMLSeq = class extends Collection {
  static get tagName() {
    return "tag:yaml.org,2002:seq";
  }
  constructor(schema4) {
    super(SEQ, schema4);
    this.items = [];
  }
  add(value) {
    this.items.push(value);
  }
  /**
   * Removes a value from the collection.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   *
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return false;
    const del = this.items.splice(idx, 1);
    return del.length > 0;
  }
  get(key, keepScalar) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      return void 0;
    const it = this.items[idx];
    return !keepScalar && isScalar(it) ? it.value : it;
  }
  /**
   * Checks if the collection includes a value with the key `key`.
   *
   * `key` must contain a representation of an integer for this to succeed.
   * It may be wrapped in a `Scalar`.
   */
  has(key) {
    const idx = asItemIndex(key);
    return typeof idx === "number" && idx < this.items.length;
  }
  /**
   * Sets a value in this collection. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   *
   * If `key` does not contain a representation of an integer, this will throw.
   * It may be wrapped in a `Scalar`.
   */
  set(key, value) {
    const idx = asItemIndex(key);
    if (typeof idx !== "number")
      throw new Error(`Expected a valid index, not ${key}.`);
    const prev = this.items[idx];
    if (isScalar(prev) && isScalarValue(value))
      prev.value = value;
    else
      this.items[idx] = value;
  }
  toJSON(_, ctx) {
    const seq2 = [];
    if (ctx?.onCreate)
      ctx.onCreate(seq2);
    let i = 0;
    for (const item of this.items)
      seq2.push(toJS(item, String(i++), ctx));
    return seq2;
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    return stringifyCollection(this, ctx, {
      blockItemPrefix: "- ",
      flowChars: { start: "[", end: "]" },
      itemIndent: (ctx.indent || "") + "  ",
      onChompKeep,
      onComment
    });
  }
  static from(schema4, obj, ctx) {
    const { replacer } = ctx;
    const seq2 = new this(schema4);
    if (obj && Symbol.iterator in Object(obj)) {
      let i = 0;
      for (let it of obj) {
        if (typeof replacer === "function") {
          const key = obj instanceof Set ? it : String(i++);
          it = replacer.call(obj, key, it);
        }
        seq2.items.push(createNode(it, void 0, ctx));
      }
    }
    return seq2;
  }
};
function asItemIndex(key) {
  let idx = isScalar(key) ? key.value : key;
  if (idx && typeof idx === "string")
    idx = Number(idx);
  return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
}

// node_modules/yaml/browser/dist/schema/common/seq.js
var seq = {
  collection: "seq",
  default: true,
  nodeClass: YAMLSeq,
  tag: "tag:yaml.org,2002:seq",
  resolve(seq2, onError) {
    if (!isSeq(seq2))
      onError("Expected a sequence for this tag");
    return seq2;
  },
  createNode: (schema4, obj, ctx) => YAMLSeq.from(schema4, obj, ctx)
};

// node_modules/yaml/browser/dist/schema/common/string.js
var string = {
  identify: (value) => typeof value === "string",
  default: true,
  tag: "tag:yaml.org,2002:str",
  resolve: (str) => str,
  stringify(item, ctx, onComment, onChompKeep) {
    ctx = Object.assign({ actualString: true }, ctx);
    return stringifyString(item, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/common/null.js
var nullTag = {
  identify: (value) => value == null,
  createNode: () => new Scalar(null),
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^(?:~|[Nn]ull|NULL)?$/,
  resolve: () => new Scalar(null),
  stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
};

// node_modules/yaml/browser/dist/schema/core/bool.js
var boolTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
  resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
  stringify({ source, value }, ctx) {
    if (source && boolTag.test.test(source)) {
      const sv = source[0] === "t" || source[0] === "T";
      if (value === sv)
        return source;
    }
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyNumber.js
function stringifyNumber({ format, minFractionDigits, tag, value }) {
  if (typeof value === "bigint")
    return String(value);
  const num = typeof value === "number" ? value : Number(value);
  if (!isFinite(num))
    return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
  let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
  if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
    let i = n.indexOf(".");
    if (i < 0) {
      i = n.length;
      n += ".";
    }
    let d = minFractionDigits - (n.length - i - 1);
    while (d-- > 0)
      n += "0";
  }
  return n;
}

// node_modules/yaml/browser/dist/schema/core/float.js
var floatNaN = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str));
    const dot = str.indexOf(".");
    if (dot !== -1 && str[str.length - 1] === "0")
      node.minFractionDigits = str.length - dot - 1;
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/core/int.js
var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
function intStringify(node, radix, prefix) {
  const { value } = node;
  if (intIdentify(value) && value >= 0)
    return prefix + value.toString(radix);
  return stringifyNumber(node);
}
var intOct = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^0o[0-7]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
  stringify: (node) => intStringify(node, 8, "0o")
};
var int = {
  identify: intIdentify,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex = {
  identify: (value) => intIdentify(value) && value >= 0,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^0x[0-9a-fA-F]+$/,
  resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
  stringify: (node) => intStringify(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/core/schema.js
var schema = [
  map,
  seq,
  string,
  nullTag,
  boolTag,
  intOct,
  int,
  intHex,
  floatNaN,
  floatExp,
  float
];

// node_modules/yaml/browser/dist/schema/json/schema.js
function intIdentify2(value) {
  return typeof value === "bigint" || Number.isInteger(value);
}
var stringifyJSON = ({ value }) => JSON.stringify(value);
var jsonScalars = [
  {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify: stringifyJSON
  },
  {
    identify: (value) => value == null,
    createNode: () => new Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^null$/,
    resolve: () => null,
    stringify: stringifyJSON
  },
  {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^true$|^false$/,
    resolve: (str) => str === "true",
    stringify: stringifyJSON
  },
  {
    identify: intIdentify2,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^-?(?:0|[1-9][0-9]*)$/,
    resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
    stringify: ({ value }) => intIdentify2(value) ? value.toString() : JSON.stringify(value)
  },
  {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
    resolve: (str) => parseFloat(str),
    stringify: stringifyJSON
  }
];
var jsonError = {
  default: true,
  tag: "",
  test: /^/,
  resolve(str, onError) {
    onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
    return str;
  }
};
var schema2 = [map, seq].concat(jsonScalars, jsonError);

// node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
var binary = {
  identify: (value) => value instanceof Uint8Array,
  // Buffer inherits from Uint8Array
  default: false,
  tag: "tag:yaml.org,2002:binary",
  /**
   * Returns a Buffer in node and an Uint8Array in browsers
   *
   * To use the resulting buffer as an image, you'll want to do something like:
   *
   *   const blob = new Blob([buffer], { type: 'image/jpeg' })
   *   document.querySelector('#photo').src = URL.createObjectURL(blob)
   */
  resolve(src, onError) {
    if (typeof atob === "function") {
      const str = atob(src.replace(/[\n\r]/g, ""));
      const buffer = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i)
        buffer[i] = str.charCodeAt(i);
      return buffer;
    } else {
      onError("This environment does not support reading binary tags; either Buffer or atob is required");
      return src;
    }
  },
  stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
    if (!value)
      return "";
    const buf = value;
    let str;
    if (typeof btoa === "function") {
      let s = "";
      for (let i = 0; i < buf.length; ++i)
        s += String.fromCharCode(buf[i]);
      str = btoa(s);
    } else {
      throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
    }
    type ?? (type = Scalar.BLOCK_LITERAL);
    if (type !== Scalar.QUOTE_DOUBLE) {
      const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
      const n = Math.ceil(str.length / lineWidth);
      const lines = new Array(n);
      for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
        lines[i] = str.substr(o, lineWidth);
      }
      str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
    }
    return stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
function resolvePairs(seq2, onError) {
  if (isSeq(seq2)) {
    for (let i = 0; i < seq2.items.length; ++i) {
      let item = seq2.items[i];
      if (isPair(item))
        continue;
      else if (isMap(item)) {
        if (item.items.length > 1)
          onError("Each pair must have its own sequence indicator");
        const pair = item.items[0] || new Pair(new Scalar(null));
        if (item.commentBefore)
          pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
        if (item.comment) {
          const cn = pair.value ?? pair.key;
          cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
        }
        item = pair;
      }
      seq2.items[i] = isPair(item) ? item : new Pair(item);
    }
  } else
    onError("Expected a sequence for this tag");
  return seq2;
}
function createPairs(schema4, iterable, ctx) {
  const { replacer } = ctx;
  const pairs2 = new YAMLSeq(schema4);
  pairs2.tag = "tag:yaml.org,2002:pairs";
  let i = 0;
  if (iterable && Symbol.iterator in Object(iterable))
    for (let it of iterable) {
      if (typeof replacer === "function")
        it = replacer.call(iterable, String(i++), it);
      let key, value;
      if (Array.isArray(it)) {
        if (it.length === 2) {
          key = it[0];
          value = it[1];
        } else
          throw new TypeError(`Expected [key, value] tuple: ${it}`);
      } else if (it && it instanceof Object) {
        const keys = Object.keys(it);
        if (keys.length === 1) {
          key = keys[0];
          value = it[key];
        } else {
          throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
        }
      } else {
        key = it;
      }
      pairs2.items.push(createPair(key, value, ctx));
    }
  return pairs2;
}
var pairs = {
  collection: "seq",
  default: false,
  tag: "tag:yaml.org,2002:pairs",
  resolve: resolvePairs,
  createNode: createPairs
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
var YAMLOMap = class _YAMLOMap extends YAMLSeq {
  constructor() {
    super();
    this.add = YAMLMap.prototype.add.bind(this);
    this.delete = YAMLMap.prototype.delete.bind(this);
    this.get = YAMLMap.prototype.get.bind(this);
    this.has = YAMLMap.prototype.has.bind(this);
    this.set = YAMLMap.prototype.set.bind(this);
    this.tag = _YAMLOMap.tag;
  }
  /**
   * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
   * but TypeScript won't allow widening the signature of a child method.
   */
  toJSON(_, ctx) {
    if (!ctx)
      return super.toJSON(_);
    const map2 = /* @__PURE__ */ new Map();
    if (ctx?.onCreate)
      ctx.onCreate(map2);
    for (const pair of this.items) {
      let key, value;
      if (isPair(pair)) {
        key = toJS(pair.key, "", ctx);
        value = toJS(pair.value, key, ctx);
      } else {
        key = toJS(pair, "", ctx);
      }
      if (map2.has(key))
        throw new Error("Ordered maps must not include duplicate keys");
      map2.set(key, value);
    }
    return map2;
  }
  static from(schema4, iterable, ctx) {
    const pairs2 = createPairs(schema4, iterable, ctx);
    const omap2 = new this();
    omap2.items = pairs2.items;
    return omap2;
  }
};
YAMLOMap.tag = "tag:yaml.org,2002:omap";
var omap = {
  collection: "seq",
  identify: (value) => value instanceof Map,
  nodeClass: YAMLOMap,
  default: false,
  tag: "tag:yaml.org,2002:omap",
  resolve(seq2, onError) {
    const pairs2 = resolvePairs(seq2, onError);
    const seenKeys = [];
    for (const { key } of pairs2.items) {
      if (isScalar(key)) {
        if (seenKeys.includes(key.value)) {
          onError(`Ordered maps must not include duplicate keys: ${key.value}`);
        } else {
          seenKeys.push(key.value);
        }
      }
    }
    return Object.assign(new YAMLOMap(), pairs2);
  },
  createNode: (schema4, iterable, ctx) => YAMLOMap.from(schema4, iterable, ctx)
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
function boolStringify({ value, source }, ctx) {
  const boolObj = value ? trueTag : falseTag;
  if (source && boolObj.test.test(source))
    return source;
  return value ? ctx.options.trueStr : ctx.options.falseStr;
}
var trueTag = {
  identify: (value) => value === true,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
  resolve: () => new Scalar(true),
  stringify: boolStringify
};
var falseTag = {
  identify: (value) => value === false,
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
  resolve: () => new Scalar(false),
  stringify: boolStringify
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
var floatNaN2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
  resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  stringify: stringifyNumber
};
var floatExp2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "EXP",
  test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
  resolve: (str) => parseFloat(str.replace(/_/g, "")),
  stringify(node) {
    const num = Number(node.value);
    return isFinite(num) ? num.toExponential() : stringifyNumber(node);
  }
};
var float2 = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
  resolve(str) {
    const node = new Scalar(parseFloat(str.replace(/_/g, "")));
    const dot = str.indexOf(".");
    if (dot !== -1) {
      const f = str.substring(dot + 1).replace(/_/g, "");
      if (f[f.length - 1] === "0")
        node.minFractionDigits = f.length;
    }
    return node;
  },
  stringify: stringifyNumber
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
var intIdentify3 = (value) => typeof value === "bigint" || Number.isInteger(value);
function intResolve2(str, offset, radix, { intAsBigInt }) {
  const sign = str[0];
  if (sign === "-" || sign === "+")
    offset += 1;
  str = str.substring(offset).replace(/_/g, "");
  if (intAsBigInt) {
    switch (radix) {
      case 2:
        str = `0b${str}`;
        break;
      case 8:
        str = `0o${str}`;
        break;
      case 16:
        str = `0x${str}`;
        break;
    }
    const n2 = BigInt(str);
    return sign === "-" ? BigInt(-1) * n2 : n2;
  }
  const n = parseInt(str, radix);
  return sign === "-" ? -1 * n : n;
}
function intStringify2(node, radix, prefix) {
  const { value } = node;
  if (intIdentify3(value)) {
    const str = value.toString(radix);
    return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
  }
  return stringifyNumber(node);
}
var intBin = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "BIN",
  test: /^[-+]?0b[0-1_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 2, opt),
  stringify: (node) => intStringify2(node, 2, "0b")
};
var intOct2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "OCT",
  test: /^[-+]?0[0-7_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 1, 8, opt),
  stringify: (node) => intStringify2(node, 8, "0")
};
var int2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: /^[-+]?[0-9][0-9_]*$/,
  resolve: (str, _onError, opt) => intResolve2(str, 0, 10, opt),
  stringify: stringifyNumber
};
var intHex2 = {
  identify: intIdentify3,
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "HEX",
  test: /^[-+]?0x[0-9a-fA-F_]+$/,
  resolve: (str, _onError, opt) => intResolve2(str, 2, 16, opt),
  stringify: (node) => intStringify2(node, 16, "0x")
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
var YAMLSet = class _YAMLSet extends YAMLMap {
  constructor(schema4) {
    super(schema4);
    this.tag = _YAMLSet.tag;
  }
  add(key) {
    let pair;
    if (isPair(key))
      pair = key;
    else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
      pair = new Pair(key.key, null);
    else
      pair = new Pair(key, null);
    const prev = findPair(this.items, pair.key);
    if (!prev)
      this.items.push(pair);
  }
  /**
   * If `keepPair` is `true`, returns the Pair matching `key`.
   * Otherwise, returns the value of that Pair's key.
   */
  get(key, keepPair) {
    const pair = findPair(this.items, key);
    return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
  }
  set(key, value) {
    if (typeof value !== "boolean")
      throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
    const prev = findPair(this.items, key);
    if (prev && !value) {
      this.items.splice(this.items.indexOf(prev), 1);
    } else if (!prev && value) {
      this.items.push(new Pair(key));
    }
  }
  toJSON(_, ctx) {
    return super.toJSON(_, ctx, Set);
  }
  toString(ctx, onComment, onChompKeep) {
    if (!ctx)
      return JSON.stringify(this);
    if (this.hasAllNullValues(true))
      return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
    else
      throw new Error("Set items must all have null values");
  }
  static from(schema4, iterable, ctx) {
    const { replacer } = ctx;
    const set2 = new this(schema4);
    if (iterable && Symbol.iterator in Object(iterable))
      for (let value of iterable) {
        if (typeof replacer === "function")
          value = replacer.call(iterable, value, value);
        set2.items.push(createPair(value, null, ctx));
      }
    return set2;
  }
};
YAMLSet.tag = "tag:yaml.org,2002:set";
var set = {
  collection: "map",
  identify: (value) => value instanceof Set,
  nodeClass: YAMLSet,
  default: false,
  tag: "tag:yaml.org,2002:set",
  createNode: (schema4, iterable, ctx) => YAMLSet.from(schema4, iterable, ctx),
  resolve(map2, onError) {
    if (isMap(map2)) {
      if (map2.hasAllNullValues(true))
        return Object.assign(new YAMLSet(), map2);
      else
        onError("Set items must all have null values");
    } else
      onError("Expected a mapping for this tag");
    return map2;
  }
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
function parseSexagesimal(str, asBigInt) {
  const sign = str[0];
  const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
  const num = (n) => asBigInt ? BigInt(n) : Number(n);
  const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
  return sign === "-" ? num(-1) * res : res;
}
function stringifySexagesimal(node) {
  let { value } = node;
  let num = (n) => n;
  if (typeof value === "bigint")
    num = (n) => BigInt(n);
  else if (isNaN(value) || !isFinite(value))
    return stringifyNumber(node);
  let sign = "";
  if (value < 0) {
    sign = "-";
    value *= num(-1);
  }
  const _60 = num(60);
  const parts = [value % _60];
  if (value < 60) {
    parts.unshift(0);
  } else {
    value = (value - parts[0]) / _60;
    parts.unshift(value % _60);
    if (value >= 60) {
      value = (value - parts[0]) / _60;
      parts.unshift(value);
    }
  }
  return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
}
var intTime = {
  identify: (value) => typeof value === "bigint" || Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
  resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
  stringify: stringifySexagesimal
};
var floatTime = {
  identify: (value) => typeof value === "number",
  default: true,
  tag: "tag:yaml.org,2002:float",
  format: "TIME",
  test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
  resolve: (str) => parseSexagesimal(str, false),
  stringify: stringifySexagesimal
};
var timestamp = {
  identify: (value) => value instanceof Date,
  default: true,
  tag: "tag:yaml.org,2002:timestamp",
  // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
  // may be omitted altogether, resulting in a date format. In such a case, the time part is
  // assumed to be 00:00:00Z (start of day, UTC).
  test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
  resolve(str) {
    const match = str.match(timestamp.test);
    if (!match)
      throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
    const [, year, month, day, hour, minute, second] = match.map(Number);
    const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
    let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
    const tz = match[8];
    if (tz && tz !== "Z") {
      let d = parseSexagesimal(tz, false);
      if (Math.abs(d) < 30)
        d *= 60;
      date -= 6e4 * d;
    }
    return new Date(date);
  },
  stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
};

// node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
var schema3 = [
  map,
  seq,
  string,
  nullTag,
  trueTag,
  falseTag,
  intBin,
  intOct2,
  int2,
  intHex2,
  floatNaN2,
  floatExp2,
  float2,
  binary,
  merge,
  omap,
  pairs,
  set,
  intTime,
  floatTime,
  timestamp
];

// node_modules/yaml/browser/dist/schema/tags.js
var schemas = /* @__PURE__ */ new Map([
  ["core", schema],
  ["failsafe", [map, seq, string]],
  ["json", schema2],
  ["yaml11", schema3],
  ["yaml-1.1", schema3]
]);
var tagsByName = {
  binary,
  bool: boolTag,
  float,
  floatExp,
  floatNaN,
  floatTime,
  int,
  intHex,
  intOct,
  intTime,
  map,
  merge,
  null: nullTag,
  omap,
  pairs,
  seq,
  set,
  timestamp
};
var coreKnownTags = {
  "tag:yaml.org,2002:binary": binary,
  "tag:yaml.org,2002:merge": merge,
  "tag:yaml.org,2002:omap": omap,
  "tag:yaml.org,2002:pairs": pairs,
  "tag:yaml.org,2002:set": set,
  "tag:yaml.org,2002:timestamp": timestamp
};
function getTags(customTags, schemaName, addMergeTag) {
  const schemaTags = schemas.get(schemaName);
  if (schemaTags && !customTags) {
    return addMergeTag && !schemaTags.includes(merge) ? schemaTags.concat(merge) : schemaTags.slice();
  }
  let tags = schemaTags;
  if (!tags) {
    if (Array.isArray(customTags))
      tags = [];
    else {
      const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
    }
  }
  if (Array.isArray(customTags)) {
    for (const tag of customTags)
      tags = tags.concat(tag);
  } else if (typeof customTags === "function") {
    tags = customTags(tags.slice());
  }
  if (addMergeTag)
    tags = tags.concat(merge);
  return tags.reduce((tags2, tag) => {
    const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
    if (!tagObj) {
      const tagName = JSON.stringify(tag);
      const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
      throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
    }
    if (!tags2.includes(tagObj))
      tags2.push(tagObj);
    return tags2;
  }, []);
}

// node_modules/yaml/browser/dist/schema/Schema.js
var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
var Schema = class _Schema {
  constructor({ compat, customTags, merge: merge2, resolveKnownTags, schema: schema4, sortMapEntries, toStringDefaults }) {
    this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
    this.name = typeof schema4 === "string" && schema4 || "core";
    this.knownTags = resolveKnownTags ? coreKnownTags : {};
    this.tags = getTags(customTags, this.name, merge2);
    this.toStringOptions = toStringDefaults ?? null;
    Object.defineProperty(this, MAP, { value: map });
    Object.defineProperty(this, SCALAR, { value: string });
    Object.defineProperty(this, SEQ, { value: seq });
    this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
  }
  clone() {
    const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
    copy.tags = this.tags.slice();
    return copy;
  }
};

// node_modules/yaml/browser/dist/stringify/stringifyDocument.js
function stringifyDocument(doc, options) {
  const lines = [];
  let hasDirectives = options.directives === true;
  if (options.directives !== false && doc.directives) {
    const dir = doc.directives.toString(doc);
    if (dir) {
      lines.push(dir);
      hasDirectives = true;
    } else if (doc.directives.docStart)
      hasDirectives = true;
  }
  if (hasDirectives)
    lines.push("---");
  const ctx = createStringifyContext(doc, options);
  const { commentString } = ctx.options;
  if (doc.commentBefore) {
    if (lines.length !== 1)
      lines.unshift("");
    const cs = commentString(doc.commentBefore);
    lines.unshift(indentComment(cs, ""));
  }
  let chompKeep = false;
  let contentComment = null;
  if (doc.contents) {
    if (isNode(doc.contents)) {
      if (doc.contents.spaceBefore && hasDirectives)
        lines.push("");
      if (doc.contents.commentBefore) {
        const cs = commentString(doc.contents.commentBefore);
        lines.push(indentComment(cs, ""));
      }
      ctx.forceBlockIndent = !!doc.comment;
      contentComment = doc.contents.comment;
    }
    const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
    let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
    if (contentComment)
      body += lineComment(body, "", commentString(contentComment));
    if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
      lines[lines.length - 1] = `--- ${body}`;
    } else
      lines.push(body);
  } else {
    lines.push(stringify(doc.contents, ctx));
  }
  if (doc.directives?.docEnd) {
    if (doc.comment) {
      const cs = commentString(doc.comment);
      if (cs.includes("\n")) {
        lines.push("...");
        lines.push(indentComment(cs, ""));
      } else {
        lines.push(`... ${cs}`);
      }
    } else {
      lines.push("...");
    }
  } else {
    let dc = doc.comment;
    if (dc && chompKeep)
      dc = dc.replace(/^\n+/, "");
    if (dc) {
      if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(indentComment(commentString(dc), ""));
    }
  }
  return lines.join("\n") + "\n";
}

// node_modules/yaml/browser/dist/doc/Document.js
var Document = class _Document {
  constructor(value, replacer, options) {
    this.commentBefore = null;
    this.comment = null;
    this.errors = [];
    this.warnings = [];
    Object.defineProperty(this, NODE_TYPE, { value: DOC });
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const opt = Object.assign({
      intAsBigInt: false,
      keepSourceTokens: false,
      logLevel: "warn",
      prettyErrors: true,
      strict: true,
      stringKeys: false,
      uniqueKeys: true,
      version: "1.2"
    }, options);
    this.options = opt;
    let { version } = opt;
    if (options?._directives) {
      this.directives = options._directives.atDocument();
      if (this.directives.yaml.explicit)
        version = this.directives.yaml.version;
    } else
      this.directives = new Directives({ version });
    this.setSchema(version, options);
    this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
  }
  /**
   * Create a deep copy of this Document and its contents.
   *
   * Custom Node values that inherit from `Object` still refer to their original instances.
   */
  clone() {
    const copy = Object.create(_Document.prototype, {
      [NODE_TYPE]: { value: DOC }
    });
    copy.commentBefore = this.commentBefore;
    copy.comment = this.comment;
    copy.errors = this.errors.slice();
    copy.warnings = this.warnings.slice();
    copy.options = Object.assign({}, this.options);
    if (this.directives)
      copy.directives = this.directives.clone();
    copy.schema = this.schema.clone();
    copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
    if (this.range)
      copy.range = this.range.slice();
    return copy;
  }
  /** Adds a value to the document. */
  add(value) {
    if (assertCollection(this.contents))
      this.contents.add(value);
  }
  /** Adds a value to the document. */
  addIn(path18, value) {
    if (assertCollection(this.contents))
      this.contents.addIn(path18, value);
  }
  /**
   * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
   *
   * If `node` already has an anchor, `name` is ignored.
   * Otherwise, the `node.anchor` value will be set to `name`,
   * or if an anchor with that name is already present in the document,
   * `name` will be used as a prefix for a new unique anchor.
   * If `name` is undefined, the generated anchor will use 'a' as a prefix.
   */
  createAlias(node, name) {
    if (!node.anchor) {
      const prev = anchorNames(this);
      node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
    }
    return new Alias(node.anchor);
  }
  createNode(value, replacer, options) {
    let _replacer = void 0;
    if (typeof replacer === "function") {
      value = replacer.call({ "": value }, "", value);
      _replacer = replacer;
    } else if (Array.isArray(replacer)) {
      const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
      const asStr = replacer.filter(keyToStr).map(String);
      if (asStr.length > 0)
        replacer = replacer.concat(asStr);
      _replacer = replacer;
    } else if (options === void 0 && replacer) {
      options = replacer;
      replacer = void 0;
    }
    const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
    const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(
      this,
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      anchorPrefix || "a"
    );
    const ctx = {
      aliasDuplicateObjects: aliasDuplicateObjects ?? true,
      keepUndefined: keepUndefined ?? false,
      onAnchor,
      onTagObj,
      replacer: _replacer,
      schema: this.schema,
      sourceObjects
    };
    const node = createNode(value, tag, ctx);
    if (flow && isCollection(node))
      node.flow = true;
    setAnchors();
    return node;
  }
  /**
   * Convert a key and a value into a `Pair` using the current schema,
   * recursively wrapping all values as `Scalar` or `Collection` nodes.
   */
  createPair(key, value, options = {}) {
    const k = this.createNode(key, null, options);
    const v = this.createNode(value, null, options);
    return new Pair(k, v);
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  delete(key) {
    return assertCollection(this.contents) ? this.contents.delete(key) : false;
  }
  /**
   * Removes a value from the document.
   * @returns `true` if the item was found and removed.
   */
  deleteIn(path18) {
    if (isEmptyPath(path18)) {
      if (this.contents == null)
        return false;
      this.contents = null;
      return true;
    }
    return assertCollection(this.contents) ? this.contents.deleteIn(path18) : false;
  }
  /**
   * Returns item at `key`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  get(key, keepScalar) {
    return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
  }
  /**
   * Returns item at `path`, or `undefined` if not found. By default unwraps
   * scalar values from their surrounding node; to disable set `keepScalar` to
   * `true` (collections are always returned intact).
   */
  getIn(path18, keepScalar) {
    if (isEmptyPath(path18))
      return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
    return isCollection(this.contents) ? this.contents.getIn(path18, keepScalar) : void 0;
  }
  /**
   * Checks if the document includes a value with the key `key`.
   */
  has(key) {
    return isCollection(this.contents) ? this.contents.has(key) : false;
  }
  /**
   * Checks if the document includes a value at `path`.
   */
  hasIn(path18) {
    if (isEmptyPath(path18))
      return this.contents !== void 0;
    return isCollection(this.contents) ? this.contents.hasIn(path18) : false;
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  set(key, value) {
    if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, [key], value);
    } else if (assertCollection(this.contents)) {
      this.contents.set(key, value);
    }
  }
  /**
   * Sets a value in this document. For `!!set`, `value` needs to be a
   * boolean to add/remove the item from the set.
   */
  setIn(path18, value) {
    if (isEmptyPath(path18)) {
      this.contents = value;
    } else if (this.contents == null) {
      this.contents = collectionFromPath(this.schema, Array.from(path18), value);
    } else if (assertCollection(this.contents)) {
      this.contents.setIn(path18, value);
    }
  }
  /**
   * Change the YAML version and schema used by the document.
   * A `null` version disables support for directives, explicit tags, anchors, and aliases.
   * It also requires the `schema` option to be given as a `Schema` instance value.
   *
   * Overrides all previously set schema options.
   */
  setSchema(version, options = {}) {
    if (typeof version === "number")
      version = String(version);
    let opt;
    switch (version) {
      case "1.1":
        if (this.directives)
          this.directives.yaml.version = "1.1";
        else
          this.directives = new Directives({ version: "1.1" });
        opt = { resolveKnownTags: false, schema: "yaml-1.1" };
        break;
      case "1.2":
      case "next":
        if (this.directives)
          this.directives.yaml.version = version;
        else
          this.directives = new Directives({ version });
        opt = { resolveKnownTags: true, schema: "core" };
        break;
      case null:
        if (this.directives)
          delete this.directives;
        opt = null;
        break;
      default: {
        const sv = JSON.stringify(version);
        throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
      }
    }
    if (options.schema instanceof Object)
      this.schema = options.schema;
    else if (opt)
      this.schema = new Schema(Object.assign(opt, options));
    else
      throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
  }
  // json & jsonArg are only used from toJSON()
  toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
    const ctx = {
      anchors: /* @__PURE__ */ new Map(),
      doc: this,
      keep: !json,
      mapAsMap: mapAsMap === true,
      mapKeyWarned: false,
      maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
    };
    const res = toJS(this.contents, jsonArg ?? "", ctx);
    if (typeof onAnchor === "function")
      for (const { count, res: res2 } of ctx.anchors.values())
        onAnchor(res2, count);
    return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
  }
  /**
   * A JSON representation of the document `contents`.
   *
   * @param jsonArg Used by `JSON.stringify` to indicate the array index or
   *   property name.
   */
  toJSON(jsonArg, onAnchor) {
    return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
  }
  /** A YAML representation of the document. */
  toString(options = {}) {
    if (this.errors.length > 0)
      throw new Error("Document with errors cannot be stringified");
    if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
      const s = JSON.stringify(options.indent);
      throw new Error(`"indent" option must be a positive integer, not ${s}`);
    }
    return stringifyDocument(this, options);
  }
};
function assertCollection(contents) {
  if (isCollection(contents))
    return true;
  throw new Error("Expected a YAML collection as document contents");
}

// node_modules/yaml/browser/dist/errors.js
var YAMLError = class extends Error {
  constructor(name, pos, code2, message) {
    super();
    this.name = name;
    this.code = code2;
    this.message = message;
    this.pos = pos;
  }
};
var YAMLParseError = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLParseError", pos, code2, message);
  }
};
var YAMLWarning = class extends YAMLError {
  constructor(pos, code2, message) {
    super("YAMLWarning", pos, code2, message);
  }
};
var prettifyError = (src, lc) => (error2) => {
  if (error2.pos[0] === -1)
    return;
  error2.linePos = error2.pos.map((pos) => lc.linePos(pos));
  const { line: line2, col } = error2.linePos[0];
  error2.message += ` at line ${line2}, column ${col}`;
  let ci = col - 1;
  let lineStr = src.substring(lc.lineStarts[line2 - 1], lc.lineStarts[line2]).replace(/[\n\r]+$/, "");
  if (ci >= 60 && lineStr.length > 80) {
    const trimStart = Math.min(ci - 39, lineStr.length - 79);
    lineStr = "\u2026" + lineStr.substring(trimStart);
    ci -= trimStart - 1;
  }
  if (lineStr.length > 80)
    lineStr = lineStr.substring(0, 79) + "\u2026";
  if (line2 > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
    let prev = src.substring(lc.lineStarts[line2 - 2], lc.lineStarts[line2 - 1]);
    if (prev.length > 80)
      prev = prev.substring(0, 79) + "\u2026\n";
    lineStr = prev + lineStr;
  }
  if (/[^ ]/.test(lineStr)) {
    let count = 1;
    const end = error2.linePos[1];
    if (end?.line === line2 && end.col > col) {
      count = Math.max(1, Math.min(end.col - col, 80 - ci));
    }
    const pointer = " ".repeat(ci) + "^".repeat(count);
    error2.message += `:

${lineStr}
${pointer}
`;
  }
};

// node_modules/yaml/browser/dist/compose/resolve-props.js
function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
  let spaceBefore = false;
  let atNewline = startOnNewline;
  let hasSpace = startOnNewline;
  let comment = "";
  let commentSep = "";
  let hasNewline = false;
  let reqSpace = false;
  let tab = null;
  let anchor = null;
  let tag = null;
  let newlineAfterProp = null;
  let comma = null;
  let found = null;
  let start = null;
  for (const token of tokens) {
    if (reqSpace) {
      if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
        onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      reqSpace = false;
    }
    if (tab) {
      if (atNewline && token.type !== "comment" && token.type !== "newline") {
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      }
      tab = null;
    }
    switch (token.type) {
      case "space":
        if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
          tab = token;
        }
        hasSpace = true;
        break;
      case "comment": {
        if (!hasSpace)
          onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
        const cb = token.source.substring(1) || " ";
        if (!comment)
          comment = cb;
        else
          comment += commentSep + cb;
        commentSep = "";
        atNewline = false;
        break;
      }
      case "newline":
        if (atNewline) {
          if (comment)
            comment += token.source;
          else if (!found || indicator !== "seq-item-ind")
            spaceBefore = true;
        } else
          commentSep += token.source;
        atNewline = true;
        hasNewline = true;
        if (anchor || tag)
          newlineAfterProp = token;
        hasSpace = true;
        break;
      case "anchor":
        if (anchor)
          onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
        if (token.source.endsWith(":"))
          onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
        anchor = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      case "tag": {
        if (tag)
          onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
        tag = token;
        start ?? (start = token.offset);
        atNewline = false;
        hasSpace = false;
        reqSpace = true;
        break;
      }
      case indicator:
        if (anchor || tag)
          onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
        if (found)
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
        found = token;
        atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
        hasSpace = false;
        break;
      case "comma":
        if (flow) {
          if (comma)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
          comma = token;
          atNewline = false;
          hasSpace = false;
          break;
        }
      // else fallthrough
      default:
        onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
        atNewline = false;
        hasSpace = false;
    }
  }
  const last = tokens[tokens.length - 1];
  const end = last ? last.offset + last.source.length : offset;
  if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
    onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
  }
  if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
    onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
  return {
    comma,
    found,
    spaceBefore,
    comment,
    hasNewline,
    anchor,
    tag,
    newlineAfterProp,
    end,
    start: start ?? end
  };
}

// node_modules/yaml/browser/dist/compose/util-contains-newline.js
function containsNewline(key) {
  if (!key)
    return null;
  switch (key.type) {
    case "alias":
    case "scalar":
    case "double-quoted-scalar":
    case "single-quoted-scalar":
      if (key.source.includes("\n"))
        return true;
      if (key.end) {
        for (const st of key.end)
          if (st.type === "newline")
            return true;
      }
      return false;
    case "flow-collection":
      for (const it of key.items) {
        for (const st of it.start)
          if (st.type === "newline")
            return true;
        if (it.sep) {
          for (const st of it.sep)
            if (st.type === "newline")
              return true;
        }
        if (containsNewline(it.key) || containsNewline(it.value))
          return true;
      }
      return false;
    default:
      return true;
  }
}

// node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
function flowIndentCheck(indent, fc, onError) {
  if (fc?.type === "flow-collection") {
    const end = fc.end[0];
    if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) {
      const msg = "Flow end indicator should be more indented than parent";
      onError(end, "BAD_INDENT", msg, true);
    }
  }
}

// node_modules/yaml/browser/dist/compose/util-map-includes.js
function mapIncludes(ctx, items, search) {
  const { uniqueKeys } = ctx.options;
  if (uniqueKeys === false)
    return false;
  const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
  return items.some((pair) => isEqual(pair.key, search));
}

// node_modules/yaml/browser/dist/compose/resolve-block-map.js
var startColMsg = "All mapping items must start at the same column";
function resolveBlockMap({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bm, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLMap;
  const map2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  let offset = bm.offset;
  let commentEnd = null;
  for (const collItem of bm.items) {
    const { start, key, sep, value } = collItem;
    const keyProps = resolveProps(start, {
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: bm.indent,
      startOnNewline: true
    });
    const implicitKey = !keyProps.found;
    if (implicitKey) {
      if (key) {
        if (key.type === "block-seq")
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
        else if ("indent" in key && key.indent !== bm.indent)
          onError(offset, "BAD_INDENT", startColMsg);
      }
      if (!keyProps.anchor && !keyProps.tag && !sep) {
        commentEnd = keyProps.end;
        if (keyProps.comment) {
          if (map2.comment)
            map2.comment += "\n" + keyProps.comment;
          else
            map2.comment = keyProps.comment;
        }
        continue;
      }
      if (keyProps.newlineAfterProp || containsNewline(key)) {
        onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
      }
    } else if (keyProps.found?.indent !== bm.indent) {
      onError(offset, "BAD_INDENT", startColMsg);
    }
    ctx.atKey = true;
    const keyStart = keyProps.end;
    const keyNode = key ? composeNode2(ctx, key, keyProps, onError) : composeEmptyNode2(ctx, keyStart, start, null, keyProps, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bm.indent, key, onError);
    ctx.atKey = false;
    if (mapIncludes(ctx, map2.items, keyNode))
      onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
    const valueProps = resolveProps(sep ?? [], {
      indicator: "map-value-ind",
      next: value,
      offset: keyNode.range[2],
      onError,
      parentIndent: bm.indent,
      startOnNewline: !key || key.type === "block-scalar"
    });
    offset = valueProps.end;
    if (valueProps.found) {
      if (implicitKey) {
        if (value?.type === "block-map" && !valueProps.hasNewline)
          onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
        if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
          onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : composeEmptyNode2(ctx, offset, sep, null, valueProps, onError);
      if (ctx.schema.compat)
        flowIndentCheck(bm.indent, value, onError);
      offset = valueNode.range[2];
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    } else {
      if (implicitKey)
        onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
      if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      map2.items.push(pair);
    }
  }
  if (commentEnd && commentEnd < offset)
    onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
  map2.range = [bm.offset, offset, commentEnd ?? offset];
  return map2;
}

// node_modules/yaml/browser/dist/compose/resolve-block-seq.js
function resolveBlockSeq({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, bs, onError, tag) {
  const NodeClass = tag?.nodeClass ?? YAMLSeq;
  const seq2 = new NodeClass(ctx.schema);
  if (ctx.atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = bs.offset;
  let commentEnd = null;
  for (const { start, value } of bs.items) {
    const props = resolveProps(start, {
      indicator: "seq-item-ind",
      next: value,
      offset,
      onError,
      parentIndent: bs.indent,
      startOnNewline: true
    });
    if (!props.found) {
      if (props.anchor || props.tag || value) {
        if (value?.type === "block-seq")
          onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
        else
          onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
      } else {
        commentEnd = props.end;
        if (props.comment)
          seq2.comment = props.comment;
        continue;
      }
    }
    const node = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, start, null, props, onError);
    if (ctx.schema.compat)
      flowIndentCheck(bs.indent, value, onError);
    offset = node.range[2];
    seq2.items.push(node);
  }
  seq2.range = [bs.offset, offset, commentEnd ?? offset];
  return seq2;
}

// node_modules/yaml/browser/dist/compose/resolve-end.js
function resolveEnd(end, offset, reqSpace, onError) {
  let comment = "";
  if (end) {
    let hasSpace = false;
    let sep = "";
    for (const token of end) {
      const { source, type } = token;
      switch (type) {
        case "space":
          hasSpace = true;
          break;
        case "comment": {
          if (reqSpace && !hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += sep + cb;
          sep = "";
          break;
        }
        case "newline":
          if (comment)
            sep += source;
          hasSpace = true;
          break;
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
      }
      offset += source.length;
    }
  }
  return { comment, offset };
}

// node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
var blockMsg = "Block collections are not allowed within flow collections";
var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
function resolveFlowCollection({ composeNode: composeNode2, composeEmptyNode: composeEmptyNode2 }, ctx, fc, onError, tag) {
  const isMap2 = fc.start.source === "{";
  const fcName = isMap2 ? "flow map" : "flow sequence";
  const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap : YAMLSeq);
  const coll = new NodeClass(ctx.schema);
  coll.flow = true;
  const atRoot = ctx.atRoot;
  if (atRoot)
    ctx.atRoot = false;
  if (ctx.atKey)
    ctx.atKey = false;
  let offset = fc.offset + fc.start.source.length;
  for (let i = 0; i < fc.items.length; ++i) {
    const collItem = fc.items[i];
    const { start, key, sep, value } = collItem;
    const props = resolveProps(start, {
      flow: fcName,
      indicator: "explicit-key-ind",
      next: key ?? sep?.[0],
      offset,
      onError,
      parentIndent: fc.indent,
      startOnNewline: false
    });
    if (!props.found) {
      if (!props.anchor && !props.tag && !sep && !value) {
        if (i === 0 && props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        else if (i < fc.items.length - 1)
          onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
        if (props.comment) {
          if (coll.comment)
            coll.comment += "\n" + props.comment;
          else
            coll.comment = props.comment;
        }
        offset = props.end;
        continue;
      }
      if (!isMap2 && ctx.options.strict && containsNewline(key))
        onError(
          key,
          // checked by containsNewline()
          "MULTILINE_IMPLICIT_KEY",
          "Implicit keys of flow sequence pairs need to be on a single line"
        );
    }
    if (i === 0) {
      if (props.comma)
        onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
    } else {
      if (!props.comma)
        onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
      if (props.comment) {
        let prevItemComment = "";
        loop: for (const st of start) {
          switch (st.type) {
            case "comma":
            case "space":
              break;
            case "comment":
              prevItemComment = st.source.substring(1);
              break loop;
            default:
              break loop;
          }
        }
        if (prevItemComment) {
          let prev = coll.items[coll.items.length - 1];
          if (isPair(prev))
            prev = prev.value ?? prev.key;
          if (prev.comment)
            prev.comment += "\n" + prevItemComment;
          else
            prev.comment = prevItemComment;
          props.comment = props.comment.substring(prevItemComment.length + 1);
        }
      }
    }
    if (!isMap2 && !sep && !props.found) {
      const valueNode = value ? composeNode2(ctx, value, props, onError) : composeEmptyNode2(ctx, props.end, sep, null, props, onError);
      coll.items.push(valueNode);
      offset = valueNode.range[2];
      if (isBlock(value))
        onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
    } else {
      ctx.atKey = true;
      const keyStart = props.end;
      const keyNode = key ? composeNode2(ctx, key, props, onError) : composeEmptyNode2(ctx, keyStart, start, null, props, onError);
      if (isBlock(key))
        onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
      ctx.atKey = false;
      const valueProps = resolveProps(sep ?? [], {
        flow: fcName,
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (valueProps.found) {
        if (!isMap2 && !props.found && ctx.options.strict) {
          if (sep)
            for (const st of sep) {
              if (st === valueProps.found)
                break;
              if (st.type === "newline") {
                onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                break;
              }
            }
          if (props.start < valueProps.found.offset - 1024)
            onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
        }
      } else if (value) {
        if ("source" in value && value.source?.[0] === ":")
          onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
        else
          onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
      }
      const valueNode = value ? composeNode2(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode2(ctx, valueProps.end, sep, null, valueProps, onError) : null;
      if (valueNode) {
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else if (valueProps.comment) {
        if (keyNode.comment)
          keyNode.comment += "\n" + valueProps.comment;
        else
          keyNode.comment = valueProps.comment;
      }
      const pair = new Pair(keyNode, valueNode);
      if (ctx.options.keepSourceTokens)
        pair.srcToken = collItem;
      if (isMap2) {
        const map2 = coll;
        if (mapIncludes(ctx, map2.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        map2.items.push(pair);
      } else {
        const map2 = new YAMLMap(ctx.schema);
        map2.flow = true;
        map2.items.push(pair);
        const endRange = (valueNode ?? keyNode).range;
        map2.range = [keyNode.range[0], endRange[1], endRange[2]];
        coll.items.push(map2);
      }
      offset = valueNode ? valueNode.range[2] : valueProps.end;
    }
  }
  const expectedEnd = isMap2 ? "}" : "]";
  const [ce, ...ee] = fc.end;
  let cePos = offset;
  if (ce?.source === expectedEnd)
    cePos = ce.offset + ce.source.length;
  else {
    const name = fcName[0].toUpperCase() + fcName.substring(1);
    const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
    onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
    if (ce && ce.source.length !== 1)
      ee.unshift(ce);
  }
  if (ee.length > 0) {
    const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
    if (end.comment) {
      if (coll.comment)
        coll.comment += "\n" + end.comment;
      else
        coll.comment = end.comment;
    }
    coll.range = [fc.offset, cePos, end.offset];
  } else {
    coll.range = [fc.offset, cePos, cePos];
  }
  return coll;
}

// node_modules/yaml/browser/dist/compose/compose-collection.js
function resolveCollection(CN2, ctx, token, onError, tagName, tag) {
  const coll = token.type === "block-map" ? resolveBlockMap(CN2, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN2, ctx, token, onError, tag) : resolveFlowCollection(CN2, ctx, token, onError, tag);
  const Coll = coll.constructor;
  if (tagName === "!" || tagName === Coll.tagName) {
    coll.tag = Coll.tagName;
    return coll;
  }
  if (tagName)
    coll.tag = tagName;
  return coll;
}
function composeCollection(CN2, ctx, token, props, onError) {
  const tagToken = props.tag;
  const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
  if (token.type === "block-seq") {
    const { anchor, newlineAfterProp: nl } = props;
    const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
    if (lastProp && (!nl || nl.offset < lastProp.offset)) {
      const message = "Missing newline after block sequence props";
      onError(lastProp, "MISSING_CHAR", message);
    }
  }
  const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
  if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") {
    return resolveCollection(CN2, ctx, token, onError, tagName);
  }
  let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
  if (!tag) {
    const kt = ctx.schema.knownTags[tagName];
    if (kt?.collection === expType) {
      ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
      tag = kt;
    } else {
      if (kt) {
        onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
      } else {
        onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
      }
      return resolveCollection(CN2, ctx, token, onError, tagName);
    }
  }
  const coll = resolveCollection(CN2, ctx, token, onError, tagName, tag);
  const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
  const node = isNode(res) ? res : new Scalar(res);
  node.range = coll.range;
  node.tag = tagName;
  if (tag?.format)
    node.format = tag.format;
  return node;
}

// node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
function resolveBlockScalar(ctx, scalar2, onError) {
  const start = scalar2.offset;
  const header = parseBlockScalarHeader(scalar2, ctx.options.strict, onError);
  if (!header)
    return { value: "", type: null, comment: "", range: [start, start, start] };
  const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
  const lines = scalar2.source ? splitLines(scalar2.source) : [];
  let chompStart = lines.length;
  for (let i = lines.length - 1; i >= 0; --i) {
    const content = lines[i][1];
    if (content === "" || content === "\r")
      chompStart = i;
    else
      break;
  }
  if (chompStart === 0) {
    const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
    let end2 = start + header.length;
    if (scalar2.source)
      end2 += scalar2.source.length;
    return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
  }
  let trimIndent = scalar2.indent + header.indent;
  let offset = scalar2.offset + header.length;
  let contentStart = 0;
  for (let i = 0; i < chompStart; ++i) {
    const [indent, content] = lines[i];
    if (content === "" || content === "\r") {
      if (header.indent === 0 && indent.length > trimIndent)
        trimIndent = indent.length;
    } else {
      if (indent.length < trimIndent) {
        const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
        onError(offset + indent.length, "MISSING_CHAR", message);
      }
      if (header.indent === 0)
        trimIndent = indent.length;
      contentStart = i;
      if (trimIndent === 0 && !ctx.atRoot) {
        const message = "Block scalar values in collections must be indented";
        onError(offset, "BAD_INDENT", message);
      }
      break;
    }
    offset += indent.length + content.length + 1;
  }
  for (let i = lines.length - 1; i >= chompStart; --i) {
    if (lines[i][0].length > trimIndent)
      chompStart = i + 1;
  }
  let value = "";
  let sep = "";
  let prevMoreIndented = false;
  for (let i = 0; i < contentStart; ++i)
    value += lines[i][0].slice(trimIndent) + "\n";
  for (let i = contentStart; i < chompStart; ++i) {
    let [indent, content] = lines[i];
    offset += indent.length + content.length + 1;
    const crlf = content[content.length - 1] === "\r";
    if (crlf)
      content = content.slice(0, -1);
    if (content && indent.length < trimIndent) {
      const src = header.indent ? "explicit indentation indicator" : "first line";
      const message = `Block scalar lines must not be less indented than their ${src}`;
      onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
      indent = "";
    }
    if (type === Scalar.BLOCK_LITERAL) {
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
    } else if (indent.length > trimIndent || content[0] === "	") {
      if (sep === " ")
        sep = "\n";
      else if (!prevMoreIndented && sep === "\n")
        sep = "\n\n";
      value += sep + indent.slice(trimIndent) + content;
      sep = "\n";
      prevMoreIndented = true;
    } else if (content === "") {
      if (sep === "\n")
        value += "\n";
      else
        sep = "\n";
    } else {
      value += sep + content;
      sep = " ";
      prevMoreIndented = false;
    }
  }
  switch (header.chomp) {
    case "-":
      break;
    case "+":
      for (let i = chompStart; i < lines.length; ++i)
        value += "\n" + lines[i][0].slice(trimIndent);
      if (value[value.length - 1] !== "\n")
        value += "\n";
      break;
    default:
      value += "\n";
  }
  const end = start + header.length + scalar2.source.length;
  return { value, type, comment: header.comment, range: [start, end, end] };
}
function parseBlockScalarHeader({ offset, props }, strict, onError) {
  if (props[0].type !== "block-scalar-header") {
    onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
    return null;
  }
  const { source } = props[0];
  const mode = source[0];
  let indent = 0;
  let chomp = "";
  let error2 = -1;
  for (let i = 1; i < source.length; ++i) {
    const ch = source[i];
    if (!chomp && (ch === "-" || ch === "+"))
      chomp = ch;
    else {
      const n = Number(ch);
      if (!indent && n)
        indent = n;
      else if (error2 === -1)
        error2 = offset + i;
    }
  }
  if (error2 !== -1)
    onError(error2, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
  let hasSpace = false;
  let comment = "";
  let length = source.length;
  for (let i = 1; i < props.length; ++i) {
    const token = props[i];
    switch (token.type) {
      case "space":
        hasSpace = true;
      // fallthrough
      case "newline":
        length += token.source.length;
        break;
      case "comment":
        if (strict && !hasSpace) {
          const message = "Comments must be separated from other tokens by white space characters";
          onError(token, "MISSING_CHAR", message);
        }
        length += token.source.length;
        comment = token.source.substring(1);
        break;
      case "error":
        onError(token, "UNEXPECTED_TOKEN", token.message);
        length += token.source.length;
        break;
      /* istanbul ignore next should not happen */
      default: {
        const message = `Unexpected token in block scalar header: ${token.type}`;
        onError(token, "UNEXPECTED_TOKEN", message);
        const ts = token.source;
        if (ts && typeof ts === "string")
          length += ts.length;
      }
    }
  }
  return { mode, indent, chomp, comment, length };
}
function splitLines(source) {
  const split = source.split(/\n( *)/);
  const first = split[0];
  const m = first.match(/^( *)/);
  const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
  const lines = [line0];
  for (let i = 1; i < split.length; i += 2)
    lines.push([split[i], split[i + 1]]);
  return lines;
}

// node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
function resolveFlowScalar(scalar2, strict, onError) {
  const { offset, type, source, end } = scalar2;
  let _type;
  let value;
  const _onError = (rel, code2, msg) => onError(offset + rel, code2, msg);
  switch (type) {
    case "scalar":
      _type = Scalar.PLAIN;
      value = plainValue(source, _onError);
      break;
    case "single-quoted-scalar":
      _type = Scalar.QUOTE_SINGLE;
      value = singleQuotedValue(source, _onError);
      break;
    case "double-quoted-scalar":
      _type = Scalar.QUOTE_DOUBLE;
      value = doubleQuotedValue(source, _onError);
      break;
    /* istanbul ignore next should not happen */
    default:
      onError(scalar2, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
      return {
        value: "",
        type: null,
        comment: "",
        range: [offset, offset + source.length, offset + source.length]
      };
  }
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, strict, onError);
  return {
    value,
    type: _type,
    comment: re.comment,
    range: [offset, valueEnd, re.offset]
  };
}
function plainValue(source, onError) {
  let badChar = "";
  switch (source[0]) {
    /* istanbul ignore next should not happen */
    case "	":
      badChar = "a tab character";
      break;
    case ",":
      badChar = "flow indicator character ,";
      break;
    case "%":
      badChar = "directive indicator character %";
      break;
    case "|":
    case ">": {
      badChar = `block scalar indicator ${source[0]}`;
      break;
    }
    case "@":
    case "`": {
      badChar = `reserved character ${source[0]}`;
      break;
    }
  }
  if (badChar)
    onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
  return foldLines(source);
}
function singleQuotedValue(source, onError) {
  if (source[source.length - 1] !== "'" || source.length === 1)
    onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
  return foldLines(source.slice(1, -1)).replace(/''/g, "'");
}
function foldLines(source) {
  let first, line2;
  try {
    first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
    line2 = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
  } catch {
    first = /(.*?)[ \t]*\r?\n/sy;
    line2 = /[ \t]*(.*?)[ \t]*\r?\n/sy;
  }
  let match = first.exec(source);
  if (!match)
    return source;
  let res = match[1];
  let sep = " ";
  let pos = first.lastIndex;
  line2.lastIndex = pos;
  while (match = line2.exec(source)) {
    if (match[1] === "") {
      if (sep === "\n")
        res += sep;
      else
        sep = "\n";
    } else {
      res += sep + match[1];
      sep = " ";
    }
    pos = line2.lastIndex;
  }
  const last = /[ \t]*(.*)/sy;
  last.lastIndex = pos;
  match = last.exec(source);
  return res + sep + (match?.[1] ?? "");
}
function doubleQuotedValue(source, onError) {
  let res = "";
  for (let i = 1; i < source.length - 1; ++i) {
    const ch = source[i];
    if (ch === "\r" && source[i + 1] === "\n")
      continue;
    if (ch === "\n") {
      const { fold, offset } = foldNewline(source, i);
      res += fold;
      i = offset;
    } else if (ch === "\\") {
      let next = source[++i];
      const cc = escapeCodes[next];
      if (cc)
        res += cc;
      else if (next === "\n") {
        next = source[i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "\r" && source[i + 1] === "\n") {
        next = source[++i + 1];
        while (next === " " || next === "	")
          next = source[++i + 1];
      } else if (next === "x" || next === "u" || next === "U") {
        const length = next === "x" ? 2 : next === "u" ? 4 : 8;
        res += parseCharCode(source, i + 1, length, onError);
        i += length;
      } else {
        const raw = source.substr(i - 1, 2);
        onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        res += raw;
      }
    } else if (ch === " " || ch === "	") {
      const wsStart = i;
      let next = source[i + 1];
      while (next === " " || next === "	")
        next = source[++i + 1];
      if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
        res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
    } else {
      res += ch;
    }
  }
  if (source[source.length - 1] !== '"' || source.length === 1)
    onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
  return res;
}
function foldNewline(source, offset) {
  let fold = "";
  let ch = source[offset + 1];
  while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
    if (ch === "\r" && source[offset + 2] !== "\n")
      break;
    if (ch === "\n")
      fold += "\n";
    offset += 1;
    ch = source[offset + 1];
  }
  if (!fold)
    fold = " ";
  return { fold, offset };
}
var escapeCodes = {
  "0": "\0",
  // null character
  a: "\x07",
  // bell character
  b: "\b",
  // backspace
  e: "\x1B",
  // escape character
  f: "\f",
  // form feed
  n: "\n",
  // line feed
  r: "\r",
  // carriage return
  t: "	",
  // horizontal tab
  v: "\v",
  // vertical tab
  N: "\x85",
  // Unicode next line
  _: "\xA0",
  // Unicode non-breaking space
  L: "\u2028",
  // Unicode line separator
  P: "\u2029",
  // Unicode paragraph separator
  " ": " ",
  '"': '"',
  "/": "/",
  "\\": "\\",
  "	": "	"
};
function parseCharCode(source, offset, length, onError) {
  const cc = source.substr(offset, length);
  const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
  const code2 = ok ? parseInt(cc, 16) : NaN;
  try {
    return String.fromCodePoint(code2);
  } catch {
    const raw = source.substr(offset - 2, length + 2);
    onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
    return raw;
  }
}

// node_modules/yaml/browser/dist/compose/compose-scalar.js
function composeScalar(ctx, token, tagToken, onError) {
  const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
  const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
  let tag;
  if (ctx.options.stringKeys && ctx.atKey) {
    tag = ctx.schema[SCALAR];
  } else if (tagName)
    tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
  else if (token.type === "scalar")
    tag = findScalarTagByTest(ctx, value, token, onError);
  else
    tag = ctx.schema[SCALAR];
  let scalar2;
  try {
    const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
    scalar2 = isScalar(res) ? res : new Scalar(res);
  } catch (error2) {
    const msg = error2 instanceof Error ? error2.message : String(error2);
    onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
    scalar2 = new Scalar(value);
  }
  scalar2.range = range;
  scalar2.source = value;
  if (type)
    scalar2.type = type;
  if (tagName)
    scalar2.tag = tagName;
  if (tag.format)
    scalar2.format = tag.format;
  if (comment)
    scalar2.comment = comment;
  return scalar2;
}
function findScalarTagByName(schema4, value, tagName, tagToken, onError) {
  if (tagName === "!")
    return schema4[SCALAR];
  const matchWithTest = [];
  for (const tag of schema4.tags) {
    if (!tag.collection && tag.tag === tagName) {
      if (tag.default && tag.test)
        matchWithTest.push(tag);
      else
        return tag;
    }
  }
  for (const tag of matchWithTest)
    if (tag.test?.test(value))
      return tag;
  const kt = schema4.knownTags[tagName];
  if (kt && !kt.collection) {
    schema4.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
    return kt;
  }
  onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
  return schema4[SCALAR];
}
function findScalarTagByTest({ atKey, directives, schema: schema4 }, value, token, onError) {
  const tag = schema4.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema4[SCALAR];
  if (schema4.compat) {
    const compat = schema4.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema4[SCALAR];
    if (tag.tag !== compat.tag) {
      const ts = directives.tagString(tag.tag);
      const cs = directives.tagString(compat.tag);
      const msg = `Value may be parsed as either ${ts} or ${cs}`;
      onError(token, "TAG_RESOLVE_FAILED", msg, true);
    }
  }
  return tag;
}

// node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
function emptyScalarPosition(offset, before, pos) {
  if (before) {
    pos ?? (pos = before.length);
    for (let i = pos - 1; i >= 0; --i) {
      let st = before[i];
      switch (st.type) {
        case "space":
        case "comment":
        case "newline":
          offset -= st.source.length;
          continue;
      }
      st = before[++i];
      while (st?.type === "space") {
        offset += st.source.length;
        st = before[++i];
      }
      break;
    }
  }
  return offset;
}

// node_modules/yaml/browser/dist/compose/compose-node.js
var CN = { composeNode, composeEmptyNode };
function composeNode(ctx, token, props, onError) {
  const atKey = ctx.atKey;
  const { spaceBefore, comment, anchor, tag } = props;
  let node;
  let isSrcToken = true;
  switch (token.type) {
    case "alias":
      node = composeAlias(ctx, token, onError);
      if (anchor || tag)
        onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
      break;
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "block-scalar":
      node = composeScalar(ctx, token, tag, onError);
      if (anchor)
        node.anchor = anchor.source.substring(1);
      break;
    case "block-map":
    case "block-seq":
    case "flow-collection":
      try {
        node = composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
      } catch (error2) {
        const message = error2 instanceof Error ? error2.message : String(error2);
        onError(token, "RESOURCE_EXHAUSTION", message);
      }
      break;
    default: {
      const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
      onError(token, "UNEXPECTED_TOKEN", message);
      isSrcToken = false;
    }
  }
  node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
  if (anchor && node.anchor === "")
    onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
    const msg = "With stringKeys, all keys must be strings";
    onError(tag ?? token, "NON_STRING_KEY", msg);
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    if (token.type === "scalar" && token.source === "")
      node.comment = comment;
    else
      node.commentBefore = comment;
  }
  if (ctx.options.keepSourceTokens && isSrcToken)
    node.srcToken = token;
  return node;
}
function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
  const token = {
    type: "scalar",
    offset: emptyScalarPosition(offset, before, pos),
    indent: -1,
    source: ""
  };
  const node = composeScalar(ctx, token, tag, onError);
  if (anchor) {
    node.anchor = anchor.source.substring(1);
    if (node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
  }
  if (spaceBefore)
    node.spaceBefore = true;
  if (comment) {
    node.comment = comment;
    node.range[2] = end;
  }
  return node;
}
function composeAlias({ options }, { offset, source, end }, onError) {
  const alias = new Alias(source.substring(1));
  if (alias.source === "")
    onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
  if (alias.source.endsWith(":"))
    onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
  const valueEnd = offset + source.length;
  const re = resolveEnd(end, valueEnd, options.strict, onError);
  alias.range = [offset, valueEnd, re.offset];
  if (re.comment)
    alias.comment = re.comment;
  return alias;
}

// node_modules/yaml/browser/dist/compose/compose-doc.js
function composeDoc(options, directives, { offset, start, value, end }, onError) {
  const opts = Object.assign({ _directives: directives }, options);
  const doc = new Document(void 0, opts);
  const ctx = {
    atKey: false,
    atRoot: true,
    directives: doc.directives,
    options: doc.options,
    schema: doc.schema
  };
  const props = resolveProps(start, {
    indicator: "doc-start",
    next: value ?? end?.[0],
    offset,
    onError,
    parentIndent: 0,
    startOnNewline: true
  });
  if (props.found) {
    doc.directives.docStart = true;
    if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
      onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
  }
  doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
  const contentEnd = doc.contents.range[2];
  const re = resolveEnd(end, contentEnd, false, onError);
  if (re.comment)
    doc.comment = re.comment;
  doc.range = [offset, contentEnd, re.offset];
  return doc;
}

// node_modules/yaml/browser/dist/compose/composer.js
function getErrorPos(src) {
  if (typeof src === "number")
    return [src, src + 1];
  if (Array.isArray(src))
    return src.length === 2 ? src : [src[0], src[1]];
  const { offset, source } = src;
  return [offset, offset + (typeof source === "string" ? source.length : 1)];
}
function parsePrelude(prelude) {
  let comment = "";
  let atComment = false;
  let afterEmptyLine = false;
  for (let i = 0; i < prelude.length; ++i) {
    const source = prelude[i];
    switch (source[0]) {
      case "#":
        comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
        atComment = true;
        afterEmptyLine = false;
        break;
      case "%":
        if (prelude[i + 1]?.[0] !== "#")
          i += 1;
        atComment = false;
        break;
      default:
        if (!atComment)
          afterEmptyLine = true;
        atComment = false;
    }
  }
  return { comment, afterEmptyLine };
}
var Composer = class {
  constructor(options = {}) {
    this.doc = null;
    this.atDirectives = false;
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
    this.onError = (source, code2, message, warning) => {
      const pos = getErrorPos(source);
      if (warning)
        this.warnings.push(new YAMLWarning(pos, code2, message));
      else
        this.errors.push(new YAMLParseError(pos, code2, message));
    };
    this.directives = new Directives({ version: options.version || "1.2" });
    this.options = options;
  }
  decorate(doc, afterDoc) {
    const { comment, afterEmptyLine } = parsePrelude(this.prelude);
    if (comment) {
      const dc = doc.contents;
      if (afterDoc) {
        doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
      } else if (afterEmptyLine || doc.directives.docStart || !dc) {
        doc.commentBefore = comment;
      } else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
        let it = dc.items[0];
        if (isPair(it))
          it = it.key;
        const cb = it.commentBefore;
        it.commentBefore = cb ? `${comment}
${cb}` : comment;
      } else {
        const cb = dc.commentBefore;
        dc.commentBefore = cb ? `${comment}
${cb}` : comment;
      }
    }
    if (afterDoc) {
      for (let i = 0; i < this.errors.length; ++i)
        doc.errors.push(this.errors[i]);
      for (let i = 0; i < this.warnings.length; ++i)
        doc.warnings.push(this.warnings[i]);
    } else {
      doc.errors = this.errors;
      doc.warnings = this.warnings;
    }
    this.prelude = [];
    this.errors = [];
    this.warnings = [];
  }
  /**
   * Current stream status information.
   *
   * Mostly useful at the end of input for an empty stream.
   */
  streamInfo() {
    return {
      comment: parsePrelude(this.prelude).comment,
      directives: this.directives,
      errors: this.errors,
      warnings: this.warnings
    };
  }
  /**
   * Compose tokens into documents.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *compose(tokens, forceDoc = false, endOffset = -1) {
    for (const token of tokens)
      yield* this.next(token);
    yield* this.end(forceDoc, endOffset);
  }
  /** Advance the composer by one CST token. */
  *next(token) {
    switch (token.type) {
      case "directive":
        this.directives.add(token.source, (offset, message, warning) => {
          const pos = getErrorPos(token);
          pos[0] += offset;
          this.onError(pos, "BAD_DIRECTIVE", message, warning);
        });
        this.prelude.push(token.source);
        this.atDirectives = true;
        break;
      case "document": {
        const doc = composeDoc(this.options, this.directives, token, this.onError);
        if (this.atDirectives && !doc.directives.docStart)
          this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
        this.decorate(doc, false);
        if (this.doc)
          yield this.doc;
        this.doc = doc;
        this.atDirectives = false;
        break;
      }
      case "byte-order-mark":
      case "space":
        break;
      case "comment":
      case "newline":
        this.prelude.push(token.source);
        break;
      case "error": {
        const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
        const error2 = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
        if (this.atDirectives || !this.doc)
          this.errors.push(error2);
        else
          this.doc.errors.push(error2);
        break;
      }
      case "doc-end": {
        if (!this.doc) {
          const msg = "Unexpected doc-end without preceding document";
          this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
          break;
        }
        this.doc.directives.docEnd = true;
        const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
        this.decorate(this.doc, true);
        if (end.comment) {
          const dc = this.doc.comment;
          this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
        }
        this.doc.range[2] = end.offset;
        break;
      }
      default:
        this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
    }
  }
  /**
   * Call at end of input to yield any remaining document.
   *
   * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
   * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
   */
  *end(forceDoc = false, endOffset = -1) {
    if (this.doc) {
      this.decorate(this.doc, true);
      yield this.doc;
      this.doc = null;
    } else if (forceDoc) {
      const opts = Object.assign({ _directives: this.directives }, this.options);
      const doc = new Document(void 0, opts);
      if (this.atDirectives)
        this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
      doc.range = [0, endOffset, endOffset];
      this.decorate(doc, false);
      yield doc;
    }
  }
};

// node_modules/yaml/browser/dist/parse/cst-visit.js
var BREAK2 = /* @__PURE__ */ Symbol("break visit");
var SKIP2 = /* @__PURE__ */ Symbol("skip children");
var REMOVE2 = /* @__PURE__ */ Symbol("remove item");
function visit2(cst, visitor) {
  if ("type" in cst && cst.type === "document")
    cst = { start: cst.start, value: cst.value };
  _visit(Object.freeze([]), cst, visitor);
}
visit2.BREAK = BREAK2;
visit2.SKIP = SKIP2;
visit2.REMOVE = REMOVE2;
visit2.itemAtPath = (cst, path18) => {
  let item = cst;
  for (const [field, index] of path18) {
    const tok = item?.[field];
    if (tok && "items" in tok) {
      item = tok.items[index];
    } else
      return void 0;
  }
  return item;
};
visit2.parentCollection = (cst, path18) => {
  const parent = visit2.itemAtPath(cst, path18.slice(0, -1));
  const field = path18[path18.length - 1][0];
  const coll = parent?.[field];
  if (coll && "items" in coll)
    return coll;
  throw new Error("Parent collection not found");
};
function _visit(path18, item, visitor) {
  let ctrl = visitor(item, path18);
  if (typeof ctrl === "symbol")
    return ctrl;
  for (const field of ["key", "value"]) {
    const token = item[field];
    if (token && "items" in token) {
      for (let i = 0; i < token.items.length; ++i) {
        const ci = _visit(Object.freeze(path18.concat([[field, i]])), token.items[i], visitor);
        if (typeof ci === "number")
          i = ci - 1;
        else if (ci === BREAK2)
          return BREAK2;
        else if (ci === REMOVE2) {
          token.items.splice(i, 1);
          i -= 1;
        }
      }
      if (typeof ctrl === "function" && field === "key")
        ctrl = ctrl(item, path18);
    }
  }
  return typeof ctrl === "function" ? ctrl(item, path18) : ctrl;
}

// node_modules/yaml/browser/dist/parse/cst.js
var BOM = "\uFEFF";
var DOCUMENT = "";
var FLOW_END = "";
var SCALAR2 = "";
function tokenType(source) {
  switch (source) {
    case BOM:
      return "byte-order-mark";
    case DOCUMENT:
      return "doc-mode";
    case FLOW_END:
      return "flow-error-end";
    case SCALAR2:
      return "scalar";
    case "---":
      return "doc-start";
    case "...":
      return "doc-end";
    case "":
    case "\n":
    case "\r\n":
      return "newline";
    case "-":
      return "seq-item-ind";
    case "?":
      return "explicit-key-ind";
    case ":":
      return "map-value-ind";
    case "{":
      return "flow-map-start";
    case "}":
      return "flow-map-end";
    case "[":
      return "flow-seq-start";
    case "]":
      return "flow-seq-end";
    case ",":
      return "comma";
  }
  switch (source[0]) {
    case " ":
    case "	":
      return "space";
    case "#":
      return "comment";
    case "%":
      return "directive-line";
    case "*":
      return "alias";
    case "&":
      return "anchor";
    case "!":
      return "tag";
    case "'":
      return "single-quoted-scalar";
    case '"':
      return "double-quoted-scalar";
    case "|":
    case ">":
      return "block-scalar-header";
  }
  return null;
}

// node_modules/yaml/browser/dist/parse/lexer.js
function isEmpty(ch) {
  switch (ch) {
    case void 0:
    case " ":
    case "\n":
    case "\r":
    case "	":
      return true;
    default:
      return false;
  }
}
var hexDigits = new Set("0123456789ABCDEFabcdef");
var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
var flowIndicatorChars = new Set(",[]{}");
var invalidAnchorChars = new Set(" ,[]{}\n\r	");
var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
var Lexer = class {
  constructor() {
    this.atEnd = false;
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    this.buffer = "";
    this.flowKey = false;
    this.flowLevel = 0;
    this.indentNext = 0;
    this.indentValue = 0;
    this.lineEndPos = null;
    this.next = null;
    this.pos = 0;
  }
  /**
   * Generate YAML tokens from the `source` string. If `incomplete`,
   * a part of the last line may be left as a buffer for the next call.
   *
   * @returns A generator of lexical tokens
   */
  *lex(source, incomplete = false) {
    if (source) {
      if (typeof source !== "string")
        throw TypeError("source is not a string");
      this.buffer = this.buffer ? this.buffer + source : source;
      this.lineEndPos = null;
    }
    this.atEnd = !incomplete;
    let next = this.next ?? "stream";
    while (next && (incomplete || this.hasChars(1)))
      next = yield* this.parseNext(next);
  }
  atLineEnd() {
    let i = this.pos;
    let ch = this.buffer[i];
    while (ch === " " || ch === "	")
      ch = this.buffer[++i];
    if (!ch || ch === "#" || ch === "\n")
      return true;
    if (ch === "\r")
      return this.buffer[i + 1] === "\n";
    return false;
  }
  charAt(n) {
    return this.buffer[this.pos + n];
  }
  continueScalar(offset) {
    let ch = this.buffer[offset];
    if (this.indentNext > 0) {
      let indent = 0;
      while (ch === " ")
        ch = this.buffer[++indent + offset];
      if (ch === "\r") {
        const next = this.buffer[indent + offset + 1];
        if (next === "\n" || !next && !this.atEnd)
          return offset + indent + 1;
      }
      return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
    }
    if (ch === "-" || ch === ".") {
      const dt = this.buffer.substr(offset, 3);
      if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
        return -1;
    }
    return offset;
  }
  getLine() {
    let end = this.lineEndPos;
    if (typeof end !== "number" || end !== -1 && end < this.pos) {
      end = this.buffer.indexOf("\n", this.pos);
      this.lineEndPos = end;
    }
    if (end === -1)
      return this.atEnd ? this.buffer.substring(this.pos) : null;
    if (this.buffer[end - 1] === "\r")
      end -= 1;
    return this.buffer.substring(this.pos, end);
  }
  hasChars(n) {
    return this.pos + n <= this.buffer.length;
  }
  setNext(state) {
    this.buffer = this.buffer.substring(this.pos);
    this.pos = 0;
    this.lineEndPos = null;
    this.next = state;
    return null;
  }
  peek(n) {
    return this.buffer.substr(this.pos, n);
  }
  *parseNext(next) {
    switch (next) {
      case "stream":
        return yield* this.parseStream();
      case "line-start":
        return yield* this.parseLineStart();
      case "block-start":
        return yield* this.parseBlockStart();
      case "doc":
        return yield* this.parseDocument();
      case "flow":
        return yield* this.parseFlowCollection();
      case "quoted-scalar":
        return yield* this.parseQuotedScalar();
      case "block-scalar":
        return yield* this.parseBlockScalar();
      case "plain-scalar":
        return yield* this.parsePlainScalar();
    }
  }
  *parseStream() {
    let line2 = this.getLine();
    if (line2 === null)
      return this.setNext("stream");
    if (line2[0] === BOM) {
      yield* this.pushCount(1);
      line2 = line2.substring(1);
    }
    if (line2[0] === "%") {
      let dirEnd = line2.length;
      let cs = line2.indexOf("#");
      while (cs !== -1) {
        const ch = line2[cs - 1];
        if (ch === " " || ch === "	") {
          dirEnd = cs - 1;
          break;
        } else {
          cs = line2.indexOf("#", cs + 1);
        }
      }
      while (true) {
        const ch = line2[dirEnd - 1];
        if (ch === " " || ch === "	")
          dirEnd -= 1;
        else
          break;
      }
      const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
      yield* this.pushCount(line2.length - n);
      this.pushNewline();
      return "stream";
    }
    if (this.atLineEnd()) {
      const sp = yield* this.pushSpaces(true);
      yield* this.pushCount(line2.length - sp);
      yield* this.pushNewline();
      return "stream";
    }
    yield DOCUMENT;
    return yield* this.parseLineStart();
  }
  *parseLineStart() {
    const ch = this.charAt(0);
    if (!ch && !this.atEnd)
      return this.setNext("line-start");
    if (ch === "-" || ch === ".") {
      if (!this.atEnd && !this.hasChars(4))
        return this.setNext("line-start");
      const s = this.peek(3);
      if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
        yield* this.pushCount(3);
        this.indentValue = 0;
        this.indentNext = 0;
        return s === "---" ? "doc" : "stream";
      }
    }
    this.indentValue = yield* this.pushSpaces(false);
    if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
      this.indentNext = this.indentValue;
    return yield* this.parseBlockStart();
  }
  *parseBlockStart() {
    const [ch0, ch1] = this.peek(2);
    if (!ch1 && !this.atEnd)
      return this.setNext("block-start");
    if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
      const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
      this.indentNext = this.indentValue + 1;
      this.indentValue += n;
      return "block-start";
    }
    return "doc";
  }
  *parseDocument() {
    yield* this.pushSpaces(true);
    const line2 = this.getLine();
    if (line2 === null)
      return this.setNext("doc");
    let n = yield* this.pushIndicators();
    switch (line2[n]) {
      case "#":
        yield* this.pushCount(line2.length - n);
      // fallthrough
      case void 0:
        yield* this.pushNewline();
        return yield* this.parseLineStart();
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel = 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        return "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "doc";
      case '"':
      case "'":
        return yield* this.parseQuotedScalar();
      case "|":
      case ">":
        n += yield* this.parseBlockScalarHeader();
        n += yield* this.pushSpaces(true);
        yield* this.pushCount(line2.length - n);
        yield* this.pushNewline();
        return yield* this.parseBlockScalar();
      default:
        return yield* this.parsePlainScalar();
    }
  }
  *parseFlowCollection() {
    let nl, sp;
    let indent = -1;
    do {
      nl = yield* this.pushNewline();
      if (nl > 0) {
        sp = yield* this.pushSpaces(false);
        this.indentValue = indent = sp;
      } else {
        sp = 0;
      }
      sp += yield* this.pushSpaces(true);
    } while (nl + sp > 0);
    const line2 = this.getLine();
    if (line2 === null)
      return this.setNext("flow");
    if (indent !== -1 && indent < this.indentNext && line2[0] !== "#" || indent === 0 && (line2.startsWith("---") || line2.startsWith("...")) && isEmpty(line2[3])) {
      const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line2[0] === "]" || line2[0] === "}");
      if (!atFlowEndMarker) {
        this.flowLevel = 0;
        yield FLOW_END;
        return yield* this.parseLineStart();
      }
    }
    let n = 0;
    while (line2[n] === ",") {
      n += yield* this.pushCount(1);
      n += yield* this.pushSpaces(true);
      this.flowKey = false;
    }
    n += yield* this.pushIndicators();
    switch (line2[n]) {
      case void 0:
        return "flow";
      case "#":
        yield* this.pushCount(line2.length - n);
        return "flow";
      case "{":
      case "[":
        yield* this.pushCount(1);
        this.flowKey = false;
        this.flowLevel += 1;
        return "flow";
      case "}":
      case "]":
        yield* this.pushCount(1);
        this.flowKey = true;
        this.flowLevel -= 1;
        return this.flowLevel ? "flow" : "doc";
      case "*":
        yield* this.pushUntil(isNotAnchorChar);
        return "flow";
      case '"':
      case "'":
        this.flowKey = true;
        return yield* this.parseQuotedScalar();
      case ":": {
        const next = this.charAt(1);
        if (this.flowKey || isEmpty(next) || next === ",") {
          this.flowKey = false;
          yield* this.pushCount(1);
          yield* this.pushSpaces(true);
          return "flow";
        }
      }
      // fallthrough
      default:
        this.flowKey = false;
        return yield* this.parsePlainScalar();
    }
  }
  *parseQuotedScalar() {
    const quote = this.charAt(0);
    let end = this.buffer.indexOf(quote, this.pos + 1);
    if (quote === "'") {
      while (end !== -1 && this.buffer[end + 1] === "'")
        end = this.buffer.indexOf("'", end + 2);
    } else {
      while (end !== -1) {
        let n = 0;
        while (this.buffer[end - 1 - n] === "\\")
          n += 1;
        if (n % 2 === 0)
          break;
        end = this.buffer.indexOf('"', end + 1);
      }
    }
    const qb = this.buffer.substring(0, end);
    let nl = qb.indexOf("\n", this.pos);
    if (nl !== -1) {
      while (nl !== -1) {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = qb.indexOf("\n", cs);
      }
      if (nl !== -1) {
        end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
      }
    }
    if (end === -1) {
      if (!this.atEnd)
        return this.setNext("quoted-scalar");
      end = this.buffer.length;
    }
    yield* this.pushToIndex(end + 1, false);
    return this.flowLevel ? "flow" : "doc";
  }
  *parseBlockScalarHeader() {
    this.blockScalarIndent = -1;
    this.blockScalarKeep = false;
    let i = this.pos;
    while (true) {
      const ch = this.buffer[++i];
      if (ch === "+")
        this.blockScalarKeep = true;
      else if (ch > "0" && ch <= "9")
        this.blockScalarIndent = Number(ch) - 1;
      else if (ch !== "-")
        break;
    }
    return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
  }
  *parseBlockScalar() {
    let nl = this.pos - 1;
    let indent = 0;
    let ch;
    loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
      switch (ch) {
        case " ":
          indent += 1;
          break;
        case "\n":
          nl = i2;
          indent = 0;
          break;
        case "\r": {
          const next = this.buffer[i2 + 1];
          if (!next && !this.atEnd)
            return this.setNext("block-scalar");
          if (next === "\n")
            break;
        }
        // fallthrough
        default:
          break loop;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("block-scalar");
    if (indent >= this.indentNext) {
      if (this.blockScalarIndent === -1)
        this.indentNext = indent;
      else {
        this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
      }
      do {
        const cs = this.continueScalar(nl + 1);
        if (cs === -1)
          break;
        nl = this.buffer.indexOf("\n", cs);
      } while (nl !== -1);
      if (nl === -1) {
        if (!this.atEnd)
          return this.setNext("block-scalar");
        nl = this.buffer.length;
      }
    }
    let i = nl + 1;
    ch = this.buffer[i];
    while (ch === " ")
      ch = this.buffer[++i];
    if (ch === "	") {
      while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
        ch = this.buffer[++i];
      nl = i - 1;
    } else if (!this.blockScalarKeep) {
      do {
        let i2 = nl - 1;
        let ch2 = this.buffer[i2];
        if (ch2 === "\r")
          ch2 = this.buffer[--i2];
        const lastChar = i2;
        while (ch2 === " ")
          ch2 = this.buffer[--i2];
        if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
          nl = i2;
        else
          break;
      } while (true);
    }
    yield SCALAR2;
    yield* this.pushToIndex(nl + 1, true);
    return yield* this.parseLineStart();
  }
  *parsePlainScalar() {
    const inFlow = this.flowLevel > 0;
    let end = this.pos - 1;
    let i = this.pos - 1;
    let ch;
    while (ch = this.buffer[++i]) {
      if (ch === ":") {
        const next = this.buffer[i + 1];
        if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
          break;
        end = i;
      } else if (isEmpty(ch)) {
        let next = this.buffer[i + 1];
        if (ch === "\r") {
          if (next === "\n") {
            i += 1;
            ch = "\n";
            next = this.buffer[i + 1];
          } else
            end = i;
        }
        if (next === "#" || inFlow && flowIndicatorChars.has(next))
          break;
        if (ch === "\n") {
          const cs = this.continueScalar(i + 1);
          if (cs === -1)
            break;
          i = Math.max(i, cs - 2);
        }
      } else {
        if (inFlow && flowIndicatorChars.has(ch))
          break;
        end = i;
      }
    }
    if (!ch && !this.atEnd)
      return this.setNext("plain-scalar");
    yield SCALAR2;
    yield* this.pushToIndex(end + 1, true);
    return inFlow ? "flow" : "doc";
  }
  *pushCount(n) {
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos += n;
      return n;
    }
    return 0;
  }
  *pushToIndex(i, allowEmpty) {
    const s = this.buffer.slice(this.pos, i);
    if (s) {
      yield s;
      this.pos += s.length;
      return s.length;
    } else if (allowEmpty)
      yield "";
    return 0;
  }
  *pushIndicators() {
    let n = 0;
    loop: while (true) {
      switch (this.charAt(0)) {
        case "!":
          n += yield* this.pushTag();
          n += yield* this.pushSpaces(true);
          continue loop;
        case "&":
          n += yield* this.pushUntil(isNotAnchorChar);
          n += yield* this.pushSpaces(true);
          continue loop;
        case "-":
        // this is an error
        case "?":
        // this is an error outside flow collections
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            n += yield* this.pushCount(1);
            n += yield* this.pushSpaces(true);
            continue loop;
          }
        }
      }
      break loop;
    }
    return n;
  }
  *pushTag() {
    if (this.charAt(1) === "<") {
      let i = this.pos + 2;
      let ch = this.buffer[i];
      while (!isEmpty(ch) && ch !== ">")
        ch = this.buffer[++i];
      return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
    } else {
      let i = this.pos + 1;
      let ch = this.buffer[i];
      while (ch) {
        if (tagChars.has(ch))
          ch = this.buffer[++i];
        else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
          ch = this.buffer[i += 3];
        } else
          break;
      }
      return yield* this.pushToIndex(i, false);
    }
  }
  *pushNewline() {
    const ch = this.buffer[this.pos];
    if (ch === "\n")
      return yield* this.pushCount(1);
    else if (ch === "\r" && this.charAt(1) === "\n")
      return yield* this.pushCount(2);
    else
      return 0;
  }
  *pushSpaces(allowTabs) {
    let i = this.pos - 1;
    let ch;
    do {
      ch = this.buffer[++i];
    } while (ch === " " || allowTabs && ch === "	");
    const n = i - this.pos;
    if (n > 0) {
      yield this.buffer.substr(this.pos, n);
      this.pos = i;
    }
    return n;
  }
  *pushUntil(test) {
    let i = this.pos;
    let ch = this.buffer[i];
    while (!test(ch))
      ch = this.buffer[++i];
    return yield* this.pushToIndex(i, false);
  }
};

// node_modules/yaml/browser/dist/parse/line-counter.js
var LineCounter = class {
  constructor() {
    this.lineStarts = [];
    this.addNewLine = (offset) => this.lineStarts.push(offset);
    this.linePos = (offset) => {
      let low = 0;
      let high = this.lineStarts.length;
      while (low < high) {
        const mid = low + high >> 1;
        if (this.lineStarts[mid] < offset)
          low = mid + 1;
        else
          high = mid;
      }
      if (this.lineStarts[low] === offset)
        return { line: low + 1, col: 1 };
      if (low === 0)
        return { line: 0, col: offset };
      const start = this.lineStarts[low - 1];
      return { line: low, col: offset - start + 1 };
    };
  }
};

// node_modules/yaml/browser/dist/parse/parser.js
function includesToken(list, type) {
  for (let i = 0; i < list.length; ++i)
    if (list[i].type === type)
      return true;
  return false;
}
function findNonEmptyIndex(list) {
  for (let i = 0; i < list.length; ++i) {
    switch (list[i].type) {
      case "space":
      case "comment":
      case "newline":
        break;
      default:
        return i;
    }
  }
  return -1;
}
function isFlowToken(token) {
  switch (token?.type) {
    case "alias":
    case "scalar":
    case "single-quoted-scalar":
    case "double-quoted-scalar":
    case "flow-collection":
      return true;
    default:
      return false;
  }
}
function getPrevProps(parent) {
  switch (parent.type) {
    case "document":
      return parent.start;
    case "block-map": {
      const it = parent.items[parent.items.length - 1];
      return it.sep ?? it.start;
    }
    case "block-seq":
      return parent.items[parent.items.length - 1].start;
    /* istanbul ignore next should not happen */
    default:
      return [];
  }
}
function getFirstKeyStartProps(prev) {
  if (prev.length === 0)
    return [];
  let i = prev.length;
  loop: while (--i >= 0) {
    switch (prev[i].type) {
      case "doc-start":
      case "explicit-key-ind":
      case "map-value-ind":
      case "seq-item-ind":
      case "newline":
        break loop;
    }
  }
  while (prev[++i]?.type === "space") {
  }
  return prev.splice(i, prev.length);
}
function arrayPushArray(target, source) {
  if (source.length < 1e5)
    Array.prototype.push.apply(target, source);
  else
    for (let i = 0; i < source.length; ++i)
      target.push(source[i]);
}
function fixFlowSeqItems(fc) {
  if (fc.start.type === "flow-seq-start") {
    for (const it of fc.items) {
      if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
        if (it.key)
          it.value = it.key;
        delete it.key;
        if (isFlowToken(it.value)) {
          if (it.value.end)
            arrayPushArray(it.value.end, it.sep);
          else
            it.value.end = it.sep;
        } else
          arrayPushArray(it.start, it.sep);
        delete it.sep;
      }
    }
  }
}
var Parser = class {
  /**
   * @param onNewLine - If defined, called separately with the start position of
   *   each new line (in `parse()`, including the start of input).
   */
  constructor(onNewLine) {
    this.atNewLine = true;
    this.atScalar = false;
    this.indent = 0;
    this.offset = 0;
    this.onKeyLine = false;
    this.stack = [];
    this.source = "";
    this.type = "";
    this.lexer = new Lexer();
    this.onNewLine = onNewLine;
  }
  /**
   * Parse `source` as a YAML stream.
   * If `incomplete`, a part of the last line may be left as a buffer for the next call.
   *
   * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
   *
   * @returns A generator of tokens representing each directive, document, and other structure.
   */
  *parse(source, incomplete = false) {
    if (this.onNewLine && this.offset === 0)
      this.onNewLine(0);
    for (const lexeme of this.lexer.lex(source, incomplete))
      yield* this.next(lexeme);
    if (!incomplete)
      yield* this.end();
  }
  /**
   * Advance the parser by the `source` of one lexical token.
   */
  *next(source) {
    this.source = source;
    if (this.atScalar) {
      this.atScalar = false;
      yield* this.step();
      this.offset += source.length;
      return;
    }
    const type = tokenType(source);
    if (!type) {
      const message = `Not a YAML token: ${source}`;
      yield* this.pop({ type: "error", offset: this.offset, message, source });
      this.offset += source.length;
    } else if (type === "scalar") {
      this.atNewLine = false;
      this.atScalar = true;
      this.type = "scalar";
    } else {
      this.type = type;
      yield* this.step();
      switch (type) {
        case "newline":
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine)
            this.onNewLine(this.offset + source.length);
          break;
        case "space":
          if (this.atNewLine && source[0] === " ")
            this.indent += source.length;
          break;
        case "explicit-key-ind":
        case "map-value-ind":
        case "seq-item-ind":
          if (this.atNewLine)
            this.indent += source.length;
          break;
        case "doc-mode":
        case "flow-error-end":
          return;
        default:
          this.atNewLine = false;
      }
      this.offset += source.length;
    }
  }
  /** Call at end of input to push out any remaining constructions */
  *end() {
    while (this.stack.length > 0)
      yield* this.pop();
  }
  get sourceToken() {
    const st = {
      type: this.type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
    return st;
  }
  *step() {
    const top = this.peek(1);
    if (this.type === "doc-end" && top?.type !== "doc-end") {
      while (this.stack.length > 0)
        yield* this.pop();
      this.stack.push({
        type: "doc-end",
        offset: this.offset,
        source: this.source
      });
      return;
    }
    if (!top)
      return yield* this.stream();
    switch (top.type) {
      case "document":
        return yield* this.document(top);
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return yield* this.scalar(top);
      case "block-scalar":
        return yield* this.blockScalar(top);
      case "block-map":
        return yield* this.blockMap(top);
      case "block-seq":
        return yield* this.blockSequence(top);
      case "flow-collection":
        return yield* this.flowCollection(top);
      case "doc-end":
        return yield* this.documentEnd(top);
    }
    yield* this.pop();
  }
  peek(n) {
    return this.stack[this.stack.length - n];
  }
  *pop(error2) {
    const token = error2 ?? this.stack.pop();
    if (!token) {
      const message = "Tried to pop an empty stack";
      yield { type: "error", offset: this.offset, source: "", message };
    } else if (this.stack.length === 0) {
      yield token;
    } else {
      const top = this.peek(1);
      if (token.type === "block-scalar") {
        token.indent = "indent" in top ? top.indent : 0;
      } else if (token.type === "flow-collection" && top.type === "document") {
        token.indent = 0;
      }
      if (token.type === "flow-collection")
        fixFlowSeqItems(token);
      switch (top.type) {
        case "document":
          top.value = token;
          break;
        case "block-scalar":
          top.props.push(token);
          break;
        case "block-map": {
          const it = top.items[top.items.length - 1];
          if (it.value) {
            top.items.push({ start: [], key: token, sep: [] });
            this.onKeyLine = true;
            return;
          } else if (it.sep) {
            it.value = token;
          } else {
            Object.assign(it, { key: token, sep: [] });
            this.onKeyLine = !it.explicitKey;
            return;
          }
          break;
        }
        case "block-seq": {
          const it = top.items[top.items.length - 1];
          if (it.value)
            top.items.push({ start: [], value: token });
          else
            it.value = token;
          break;
        }
        case "flow-collection": {
          const it = top.items[top.items.length - 1];
          if (!it || it.value)
            top.items.push({ start: [], key: token, sep: [] });
          else if (it.sep)
            it.value = token;
          else
            Object.assign(it, { key: token, sep: [] });
          return;
        }
        /* istanbul ignore next should not happen */
        default:
          yield* this.pop();
          yield* this.pop(token);
      }
      if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
        const last = token.items[token.items.length - 1];
        if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
          if (top.type === "document")
            top.end = last.start;
          else
            top.items.push({ start: last.start });
          token.items.splice(-1, 1);
        }
      }
    }
  }
  *stream() {
    switch (this.type) {
      case "directive-line":
        yield { type: "directive", offset: this.offset, source: this.source };
        return;
      case "byte-order-mark":
      case "space":
      case "comment":
      case "newline":
        yield this.sourceToken;
        return;
      case "doc-mode":
      case "doc-start": {
        const doc = {
          type: "document",
          offset: this.offset,
          start: []
        };
        if (this.type === "doc-start")
          doc.start.push(this.sourceToken);
        this.stack.push(doc);
        return;
      }
    }
    yield {
      type: "error",
      offset: this.offset,
      message: `Unexpected ${this.type} token in YAML stream`,
      source: this.source
    };
  }
  *document(doc) {
    if (doc.value)
      return yield* this.lineEnd(doc);
    switch (this.type) {
      case "doc-start": {
        if (findNonEmptyIndex(doc.start) !== -1) {
          yield* this.pop();
          yield* this.step();
        } else
          doc.start.push(this.sourceToken);
        return;
      }
      case "anchor":
      case "tag":
      case "space":
      case "comment":
      case "newline":
        doc.start.push(this.sourceToken);
        return;
    }
    const bv = this.startBlockValue(doc);
    if (bv)
      this.stack.push(bv);
    else {
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML document`,
        source: this.source
      };
    }
  }
  *scalar(scalar2) {
    if (this.type === "map-value-ind") {
      const prev = getPrevProps(this.peek(2));
      const start = getFirstKeyStartProps(prev);
      let sep;
      if (scalar2.end) {
        sep = scalar2.end;
        sep.push(this.sourceToken);
        delete scalar2.end;
      } else
        sep = [this.sourceToken];
      const map2 = {
        type: "block-map",
        offset: scalar2.offset,
        indent: scalar2.indent,
        items: [{ start, key: scalar2, sep }]
      };
      this.onKeyLine = true;
      this.stack[this.stack.length - 1] = map2;
    } else
      yield* this.lineEnd(scalar2);
  }
  *blockScalar(scalar2) {
    switch (this.type) {
      case "space":
      case "comment":
      case "newline":
        scalar2.props.push(this.sourceToken);
        return;
      case "scalar":
        scalar2.source = this.source;
        this.atNewLine = true;
        this.indent = 0;
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        yield* this.pop();
        break;
      /* istanbul ignore next should not happen */
      default:
        yield* this.pop();
        yield* this.step();
    }
  }
  *blockMap(map2) {
    const it = map2.items[map2.items.length - 1];
    switch (this.type) {
      case "newline":
        this.onKeyLine = false;
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          it.start.push(this.sourceToken);
        }
        return;
      case "space":
      case "comment":
        if (it.value) {
          map2.items.push({ start: [this.sourceToken] });
        } else if (it.sep) {
          it.sep.push(this.sourceToken);
        } else {
          if (this.atIndentedComment(it.start, map2.indent)) {
            const prev = map2.items[map2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              map2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
    }
    if (this.indent >= map2.indent) {
      const atMapIndent = !this.onKeyLine && this.indent === map2.indent;
      const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
      let start = [];
      if (atNextItem && it.sep && !it.value) {
        const nl = [];
        for (let i = 0; i < it.sep.length; ++i) {
          const st = it.sep[i];
          switch (st.type) {
            case "newline":
              nl.push(i);
              break;
            case "space":
              break;
            case "comment":
              if (st.indent > map2.indent)
                nl.length = 0;
              break;
            default:
              nl.length = 0;
          }
        }
        if (nl.length >= 2)
          start = it.sep.splice(nl[1]);
      }
      switch (this.type) {
        case "anchor":
        case "tag":
          if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start });
            this.onKeyLine = true;
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "explicit-key-ind":
          if (!it.sep && !it.explicitKey) {
            it.start.push(this.sourceToken);
            it.explicitKey = true;
          } else if (atNextItem || it.value) {
            start.push(this.sourceToken);
            map2.items.push({ start, explicitKey: true });
          } else {
            this.stack.push({
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken], explicitKey: true }]
            });
          }
          this.onKeyLine = true;
          return;
        case "map-value-ind":
          if (it.explicitKey) {
            if (!it.sep) {
              if (includesToken(it.start, "newline")) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else {
                const start2 = getFirstKeyStartProps(it.start);
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                });
              }
            } else if (it.value) {
              map2.items.push({ start: [], key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start, key: null, sep: [this.sourceToken] }]
              });
            } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
              const start2 = getFirstKeyStartProps(it.start);
              const key = it.key;
              const sep = it.sep;
              sep.push(this.sourceToken);
              delete it.key;
              delete it.sep;
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: start2, key, sep }]
              });
            } else if (start.length > 0) {
              it.sep = it.sep.concat(start, this.sourceToken);
            } else {
              it.sep.push(this.sourceToken);
            }
          } else {
            if (!it.sep) {
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            } else if (it.value || atNextItem) {
              map2.items.push({ start, key: null, sep: [this.sourceToken] });
            } else if (includesToken(it.sep, "map-value-ind")) {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [], key: null, sep: [this.sourceToken] }]
              });
            } else {
              it.sep.push(this.sourceToken);
            }
          }
          this.onKeyLine = true;
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs2 = this.flowScalar(this.type);
          if (atNextItem || it.value) {
            map2.items.push({ start, key: fs2, sep: [] });
            this.onKeyLine = true;
          } else if (it.sep) {
            this.stack.push(fs2);
          } else {
            Object.assign(it, { key: fs2, sep: [] });
            this.onKeyLine = true;
          }
          return;
        }
        default: {
          const bv = this.startBlockValue(map2);
          if (bv) {
            if (bv.type === "block-seq") {
              if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                yield* this.pop({
                  type: "error",
                  offset: this.offset,
                  message: "Unexpected block-seq-ind on same line with key",
                  source: this.source
                });
                return;
              }
            } else if (atMapIndent) {
              map2.items.push({ start });
            }
            this.stack.push(bv);
            return;
          }
        }
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *blockSequence(seq2) {
    const it = seq2.items[seq2.items.length - 1];
    switch (this.type) {
      case "newline":
        if (it.value) {
          const end = "end" in it.value ? it.value.end : void 0;
          const last = Array.isArray(end) ? end[end.length - 1] : void 0;
          if (last?.type === "comment")
            end?.push(this.sourceToken);
          else
            seq2.items.push({ start: [this.sourceToken] });
        } else
          it.start.push(this.sourceToken);
        return;
      case "space":
      case "comment":
        if (it.value)
          seq2.items.push({ start: [this.sourceToken] });
        else {
          if (this.atIndentedComment(it.start, seq2.indent)) {
            const prev = seq2.items[seq2.items.length - 2];
            const end = prev?.value?.end;
            if (Array.isArray(end)) {
              arrayPushArray(end, it.start);
              end.push(this.sourceToken);
              seq2.items.pop();
              return;
            }
          }
          it.start.push(this.sourceToken);
        }
        return;
      case "anchor":
      case "tag":
        if (it.value || this.indent <= seq2.indent)
          break;
        it.start.push(this.sourceToken);
        return;
      case "seq-item-ind":
        if (this.indent !== seq2.indent)
          break;
        if (it.value || includesToken(it.start, "seq-item-ind"))
          seq2.items.push({ start: [this.sourceToken] });
        else
          it.start.push(this.sourceToken);
        return;
    }
    if (this.indent > seq2.indent) {
      const bv = this.startBlockValue(seq2);
      if (bv) {
        this.stack.push(bv);
        return;
      }
    }
    yield* this.pop();
    yield* this.step();
  }
  *flowCollection(fc) {
    const it = fc.items[fc.items.length - 1];
    if (this.type === "flow-error-end") {
      let top;
      do {
        yield* this.pop();
        top = this.peek(1);
      } while (top?.type === "flow-collection");
    } else if (fc.end.length === 0) {
      switch (this.type) {
        case "comma":
        case "explicit-key-ind":
          if (!it || it.sep)
            fc.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
        case "map-value-ind":
          if (!it || it.value)
            fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            Object.assign(it, { key: null, sep: [this.sourceToken] });
          return;
        case "space":
        case "comment":
        case "newline":
        case "anchor":
        case "tag":
          if (!it || it.value)
            fc.items.push({ start: [this.sourceToken] });
          else if (it.sep)
            it.sep.push(this.sourceToken);
          else
            it.start.push(this.sourceToken);
          return;
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar": {
          const fs2 = this.flowScalar(this.type);
          if (!it || it.value)
            fc.items.push({ start: [], key: fs2, sep: [] });
          else if (it.sep)
            this.stack.push(fs2);
          else
            Object.assign(it, { key: fs2, sep: [] });
          return;
        }
        case "flow-map-end":
        case "flow-seq-end":
          fc.end.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(fc);
      if (bv)
        this.stack.push(bv);
      else {
        yield* this.pop();
        yield* this.step();
      }
    } else {
      const parent = this.peek(2);
      if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
        yield* this.pop();
        yield* this.step();
      } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        fixFlowSeqItems(fc);
        const sep = fc.end.splice(1, fc.end.length);
        sep.push(this.sourceToken);
        const map2 = {
          type: "block-map",
          offset: fc.offset,
          indent: fc.indent,
          items: [{ start, key: fc, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map2;
      } else {
        yield* this.lineEnd(fc);
      }
    }
  }
  flowScalar(type) {
    if (this.onNewLine) {
      let nl = this.source.indexOf("\n") + 1;
      while (nl !== 0) {
        this.onNewLine(this.offset + nl);
        nl = this.source.indexOf("\n", nl) + 1;
      }
    }
    return {
      type,
      offset: this.offset,
      indent: this.indent,
      source: this.source
    };
  }
  startBlockValue(parent) {
    switch (this.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
        return this.flowScalar(this.type);
      case "block-scalar-header":
        return {
          type: "block-scalar",
          offset: this.offset,
          indent: this.indent,
          props: [this.sourceToken],
          source: ""
        };
      case "flow-map-start":
      case "flow-seq-start":
        return {
          type: "flow-collection",
          offset: this.offset,
          indent: this.indent,
          start: this.sourceToken,
          items: [],
          end: []
        };
      case "seq-item-ind":
        return {
          type: "block-seq",
          offset: this.offset,
          indent: this.indent,
          items: [{ start: [this.sourceToken] }]
        };
      case "explicit-key-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        start.push(this.sourceToken);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, explicitKey: true }]
        };
      }
      case "map-value-ind": {
        this.onKeyLine = true;
        const prev = getPrevProps(parent);
        const start = getFirstKeyStartProps(prev);
        return {
          type: "block-map",
          offset: this.offset,
          indent: this.indent,
          items: [{ start, key: null, sep: [this.sourceToken] }]
        };
      }
    }
    return null;
  }
  atIndentedComment(start, indent) {
    if (this.type !== "comment")
      return false;
    if (this.indent <= indent)
      return false;
    return start.every((st) => st.type === "newline" || st.type === "space");
  }
  *documentEnd(docEnd) {
    if (this.type !== "doc-mode") {
      if (docEnd.end)
        docEnd.end.push(this.sourceToken);
      else
        docEnd.end = [this.sourceToken];
      if (this.type === "newline")
        yield* this.pop();
    }
  }
  *lineEnd(token) {
    switch (this.type) {
      case "comma":
      case "doc-start":
      case "doc-end":
      case "flow-seq-end":
      case "flow-map-end":
      case "map-value-ind":
        yield* this.pop();
        yield* this.step();
        break;
      case "newline":
        this.onKeyLine = false;
      // fallthrough
      case "space":
      case "comment":
      default:
        if (token.end)
          token.end.push(this.sourceToken);
        else
          token.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
    }
  }
};

// node_modules/yaml/browser/dist/public-api.js
function parseOptions(options) {
  const prettyErrors = options.prettyErrors !== false;
  const lineCounter = options.lineCounter || prettyErrors && new LineCounter() || null;
  return { lineCounter, prettyErrors };
}
function parseDocument(source, options = {}) {
  const { lineCounter, prettyErrors } = parseOptions(options);
  const parser = new Parser(lineCounter?.addNewLine);
  const composer = new Composer(options);
  let doc = null;
  for (const _doc of composer.compose(parser.parse(source), true, source.length)) {
    if (!doc)
      doc = _doc;
    else if (doc.options.logLevel !== "silent") {
      doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
      break;
    }
  }
  if (prettyErrors && lineCounter) {
    doc.errors.forEach(prettifyError(source, lineCounter));
    doc.warnings.forEach(prettifyError(source, lineCounter));
  }
  return doc;
}
function parse(src, reviver, options) {
  let _reviver = void 0;
  if (typeof reviver === "function") {
    _reviver = reviver;
  } else if (options === void 0 && reviver && typeof reviver === "object") {
    options = reviver;
  }
  const doc = parseDocument(src, options);
  if (!doc)
    return null;
  doc.warnings.forEach((warning) => warn(doc.options.logLevel, warning));
  if (doc.errors.length > 0) {
    if (doc.options.logLevel !== "silent")
      throw doc.errors[0];
    else
      doc.errors = [];
  }
  return doc.toJS(Object.assign({ reviver: _reviver }, options));
}
function stringify3(value, replacer, options) {
  let _replacer = null;
  if (typeof replacer === "function" || Array.isArray(replacer)) {
    _replacer = replacer;
  } else if (options === void 0 && replacer) {
    options = replacer;
  }
  if (typeof options === "string")
    options = options.length;
  if (typeof options === "number") {
    const indent = Math.round(options);
    options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
  }
  if (value === void 0) {
    const { keepUndefined } = options ?? replacer ?? {};
    if (!keepUndefined)
      return void 0;
  }
  if (isDocument(value) && !_replacer)
    return value.toString(options);
  return new Document(value, _replacer, options).toString(options);
}

// src/domain/classification.ts
import path4 from "node:path";
var foreignCategories = /* @__PURE__ */ new Set([
  "agent-instructions",
  "persistent-memory",
  "agent-identity",
  "change-journal",
  "workflow",
  "orchestration"
]);
var codeExtensions = /* @__PURE__ */ new Set([
  ".c",
  ".cc",
  ".clj",
  ".cpp",
  ".cs",
  ".css",
  ".dart",
  ".ex",
  ".exs",
  ".fs",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".jl",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".m",
  ".php",
  ".pl",
  ".ps1",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".scala",
  ".sh",
  ".sol",
  ".sql",
  ".svelte",
  ".swift",
  ".ts",
  ".tsx",
  ".vue"
]);
var manifestNames = /* @__PURE__ */ new Set([
  "build.gradle",
  "build.gradle.kts",
  "cargo.toml",
  "cmakelists.txt",
  "composer.json",
  "gemfile",
  "go.mod",
  "makefile",
  "mix.exs",
  "package.json",
  "pom.xml",
  "project.clj",
  "pyproject.toml",
  "requirements.txt",
  "setup.py"
]);
var deploymentNames = /* @__PURE__ */ new Set([
  "app.yaml",
  "compose.yaml",
  "docker-compose.yml",
  "dockerfile",
  "fly.toml",
  "netlify.toml",
  "procfile",
  "serverless.yml",
  "vercel.json"
]);
var documentationExtensions = /* @__PURE__ */ new Set([".adoc", ".md", ".mdx", ".rst"]);
var dataExtensions = /* @__PURE__ */ new Set([".arrow", ".csv", ".db", ".jsonl", ".parquet", ".sqlite", ".tsv"]);
var assetExtensions = /* @__PURE__ */ new Set([
  ".ai",
  ".blend",
  ".eps",
  ".fig",
  ".gif",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".psd",
  ".svg",
  ".wav",
  ".webp"
]);
var rootSeedDocumentNames = /* @__PURE__ */ new Set([
  "changelog.md",
  "contributing.md",
  "license.md",
  "readme.md",
  "security.md",
  "spec.md"
]);
var knownInstructionBasenames = /* @__PURE__ */ new Set([
  ".cursorrules",
  "agents.md",
  "claude.md",
  "copilot-instructions.md",
  "gemini.md",
  "skill.md"
]);
var knownInstructionPrefixes = [
  ".agents/rules/",
  ".claude/",
  ".cursor/rules/",
  ".github/agents/",
  ".github/instructions/",
  ".roo/rules/",
  ".windsurf/rules/"
];
var semanticPatterns = [
  {
    category: "agent-instructions",
    pattern: /\b(before (?:any|each|every) task|agent instructions?|instructions? for (?:an |the )?(?:ai |coding )?agent|must (?:read|follow|register|sync)|you are (?:an |the )?(?:ai |coding )?agent)\b/iu,
    reason: "Contains operational instructions directed at agents."
  },
  {
    category: "persistent-memory",
    pattern: /\b(source of truth|persistent (?:project )?(?:context|memory)|continuity|last[- ]synced|checkpoint|reconciliation|handoff)\b/iu,
    reason: "Defines persistent context, continuity, or reconciliation state."
  },
  {
    category: "agent-identity",
    pattern: /\b(agent[- ]id|agent identity|agent profile|agent registry|agent repository|machine[- ]name)\b/iu,
    reason: "Defines durable agent identity or registration."
  },
  {
    category: "change-journal",
    pattern: /\b(append[- ]only|change ?log|journal event|event log|record (?:each|every|meaningful) change)\b/iu,
    reason: "Defines a persistent project-change history or journal."
  },
  {
    category: "workflow",
    pattern: /\b(working agreement|stage plan|completion protocol|task tracker|project workflow|living plan)\b/iu,
    reason: "Defines a durable workflow, plan, or standing operating rule."
  },
  {
    category: "orchestration",
    pattern: /\b(multi[- ]agent|parallel agents?|concurrent execution blocks?|dependency mapping|agent orchestration|workstreams?)\b/iu,
    reason: "Defines multi-agent orchestration or concurrent work boundaries."
  }
];
function basename(value) {
  const pieces = value.split("/");
  return (pieces.at(-1) ?? value).toLowerCase();
}
function extension(value) {
  return path4.posix.extname(value).toLowerCase();
}
function addSignal(signals, code2, category, candidatePath, reason, strength) {
  if (signals.some((signal) => signal.code === code2 && signal.path === candidatePath)) return;
  signals.push({ code: code2, category, path: candidatePath, reason, strength });
}
function knownForeignPathSignals(input) {
  const signals = [];
  for (const file of input.inventory.files) {
    const normalizedPath2 = file.path.toLowerCase();
    const fileName = basename(file.path);
    if (knownInstructionBasenames.has(fileName) || knownInstructionPrefixes.some((prefix) => normalizedPath2.startsWith(prefix))) {
      addSignal(
        signals,
        "foreign.agent-instructions.known-entry",
        "agent-instructions",
        file.path,
        "Uses a recognized non-PCP agent instruction or skill entry point.",
        "strong"
      );
    }
    if (/^(?:.+\/)?agent-(?:repository|registry)\.md$/u.test(normalizedPath2)) {
      addSignal(
        signals,
        "foreign.agent-identity.registry",
        "agent-identity",
        file.path,
        "Uses a durable non-PCP agent identity registry.",
        "strong"
      );
    }
    if (/^(?:.+\/)?sync-protocol\.md$/u.test(normalizedPath2)) {
      addSignal(
        signals,
        "foreign.persistent-memory.sync-protocol",
        "persistent-memory",
        file.path,
        "Uses a non-PCP synchronization or continuity protocol.",
        "strong"
      );
    }
    if (/^(?:.+\/)?parallel-orchestration\.md$/u.test(normalizedPath2)) {
      addSignal(
        signals,
        "foreign.orchestration.parallel-plan",
        "orchestration",
        file.path,
        "Uses a non-PCP multi-agent orchestration plan.",
        "strong"
      );
    }
  }
  for (const document of input.documents) {
    const normalizedPath2 = document.path.toLowerCase();
    if (/(?:^|\/)(?:ai|agents?|context|memory)\/.*change ?log\.ya?ml$/u.test(normalizedPath2) && /\bagent\s*:/iu.test(document.contents)) {
      addSignal(
        signals,
        "foreign.change-journal.agent-log",
        "change-journal",
        document.path,
        "Contains an agent-attributed non-PCP change journal.",
        "strong"
      );
    }
  }
  return signals;
}
function semanticForeignSignals(documents) {
  const signals = [];
  const agentAnchor = /\b(ai agents?|coding agents?|assistant|agent[- ]id|multi[- ]agent|parallel agents?)\b/iu;
  const contextAnchor = /\b(before (?:any|each|every) task|source of truth|continuity|handoff|checkpoint|last[- ]synced|agent[- ]id|agent registry|journal event|change ?log|working agreement|workstream|must (?:read|follow|register|sync))\b/iu;
  for (const document of documents) {
    const normalizedPath2 = document.path.toLowerCase();
    const isRootReadme = normalizedPath2 === "readme.md";
    if (!agentAnchor.test(document.contents) || !contextAnchor.test(document.contents)) continue;
    const matches = semanticPatterns.filter(({ pattern }) => pattern.test(document.contents));
    if (isRootReadme && (matches.length < 2 || !matches.some((match) => match.category === "agent-instructions"))) {
      continue;
    }
    for (const match of matches) {
      addSignal(
        signals,
        `foreign.${match.category}.semantic`,
        match.category,
        document.path,
        match.reason,
        matches.length >= 3 ? "strong" : "moderate"
      );
    }
  }
  return signals;
}
function representativeSignal(signals, code2, category, paths, reason, strength) {
  const first = [...paths].sort(comparePortablePaths)[0];
  if (first !== void 0) addSignal(signals, code2, category, first, reason, strength);
}
function projectSignals(inventory) {
  const signals = [];
  const sourcePaths = [];
  const testPaths = [];
  const manifestPaths = [];
  const deploymentPaths = [];
  const documentationPaths = [];
  const dataPaths = [];
  const assetPaths = [];
  for (const file of inventory.files) {
    const normalized = file.path.toLowerCase();
    const fileName = basename(normalized);
    const fileExtension = extension(normalized);
    if (manifestNames.has(fileName) || /\.(?:csproj|fsproj|sln)$/u.test(fileName)) {
      manifestPaths.push(file.path);
    }
    if (deploymentNames.has(fileName) || normalized.startsWith(".github/workflows/") || normalized.startsWith("k8s/") || normalized.startsWith("kubernetes/") || normalized.startsWith("terraform/") || fileExtension === ".tf") {
      deploymentPaths.push(file.path);
    }
    if (codeExtensions.has(fileExtension) || fileExtension === ".ipynb") {
      if (/(?:^|\/)(?:__tests__|test|tests)\//u.test(normalized) || /\.(?:spec|test)\.[^.]+$/u.test(normalized)) {
        testPaths.push(file.path);
      } else {
        sourcePaths.push(file.path);
      }
    }
    if (documentationExtensions.has(fileExtension)) {
      const atRoot = !normalized.includes("/");
      if (!atRoot || !rootSeedDocumentNames.has(fileName)) documentationPaths.push(file.path);
    }
    if (dataExtensions.has(fileExtension)) dataPaths.push(file.path);
    if (assetExtensions.has(fileExtension)) assetPaths.push(file.path);
  }
  representativeSignal(
    signals,
    "project.manifest",
    "project-manifest",
    manifestPaths,
    `Found ${manifestPaths.length} project or build manifest${manifestPaths.length === 1 ? "" : "s"}.`,
    "strong"
  );
  representativeSignal(
    signals,
    "project.source-code",
    "source-code",
    sourcePaths,
    `Found ${sourcePaths.length} source-code file${sourcePaths.length === 1 ? "" : "s"}.`,
    "strong"
  );
  representativeSignal(
    signals,
    "project.tests",
    "tests",
    testPaths,
    `Found ${testPaths.length} test file${testPaths.length === 1 ? "" : "s"}.`,
    "moderate"
  );
  representativeSignal(
    signals,
    "project.deployment",
    "deployment",
    deploymentPaths,
    `Found ${deploymentPaths.length} deployment or CI file${deploymentPaths.length === 1 ? "" : "s"}.`,
    "strong"
  );
  const documentationBytes = inventory.files.filter((file) => documentationPaths.includes(file.path)).reduce((total, file) => total + file.size, 0);
  const docsDirectoryCount = documentationPaths.filter(
    (candidate) => candidate.includes("/")
  ).length;
  if (documentationPaths.length >= 3 || docsDirectoryCount >= 2 || documentationPaths.length >= 2 && documentationBytes >= 12e3) {
    representativeSignal(
      signals,
      "project.documentation-set",
      "documentation",
      documentationPaths,
      `Found a substantive documentation set (${documentationPaths.length} files, ${documentationBytes} bytes).`,
      "moderate"
    );
  }
  representativeSignal(
    signals,
    "project.data",
    "data",
    dataPaths,
    `Found ${dataPaths.length} project data file${dataPaths.length === 1 ? "" : "s"}.`,
    "strong"
  );
  representativeSignal(
    signals,
    "project.creative-assets",
    "creative-assets",
    assetPaths,
    `Found ${assetPaths.length} creative or media asset${assetPaths.length === 1 ? "" : "s"}.`,
    "moderate"
  );
  const recognized = /* @__PURE__ */ new Set([
    ...sourcePaths,
    ...testPaths,
    ...manifestPaths,
    ...deploymentPaths,
    ...documentationPaths,
    ...dataPaths,
    ...assetPaths
  ]);
  const unclassified = inventory.files.filter(
    (file) => !recognized.has(file.path) && !rootSeedDocumentNames.has(basename(file.path)) && ![".gitignore", ".gitattributes", ".editorconfig"].includes(basename(file.path))
  );
  const unclassifiedBytes = unclassified.reduce((total, file) => total + file.size, 0);
  if (unclassified.length >= 4 || unclassifiedBytes >= 65536) {
    representativeSignal(
      signals,
      "project.unclassified-assets",
      "data",
      unclassified.map((file) => file.path),
      `Found a substantive set of unclassified project assets (${unclassified.length} files, ${unclassifiedBytes} bytes).`,
      "weak"
    );
  }
  return signals;
}
var scopedForeignRoots = [
  ".agents/rules",
  ".claude",
  ".cursor/rules",
  ".github/agents",
  ".github/instructions",
  ".roo/rules",
  ".windsurf/rules"
];
function candidateRoot(candidatePath) {
  const normalized = candidatePath.toLowerCase();
  if (normalized === ".github/copilot-instructions.md") return candidatePath;
  for (const scopedRoot of scopedForeignRoots) {
    if (normalized !== scopedRoot && !normalized.startsWith(`${scopedRoot}/`)) continue;
    return candidatePath.split("/").slice(0, scopedRoot.split("/").length).join("/");
  }
  const separator = candidatePath.indexOf("/");
  return separator === -1 ? "." : candidatePath.slice(0, separator);
}
function foreignCandidates(signals) {
  const candidates = /* @__PURE__ */ new Map();
  for (const signal of signals) {
    if (!foreignCategories.has(signal.category)) continue;
    const root = candidateRoot(signal.path);
    const candidate = candidates.get(root) ?? { categories: /* @__PURE__ */ new Set(), paths: /* @__PURE__ */ new Set() };
    candidate.categories.add(signal.category);
    candidate.paths.add(signal.path);
    candidates.set(root, candidate);
  }
  return [...candidates.entries()].map(([root, candidate]) => ({
    root,
    categories: [...candidate.categories].sort(comparePortablePaths),
    paths: [...candidate.paths].sort(comparePortablePaths)
  })).sort((left, right) => comparePortablePaths(left.root, right.root));
}
function initialAmbiguities(input) {
  const ambiguities = [];
  const unsafeLinks = input.inventory.symlinks.filter((link) => link.boundary !== "internal");
  if (unsafeLinks.length > 0) {
    ambiguities.push({
      code: "unsafe-symlink-boundary",
      message: "External or broken symlinks were fingerprinted but never followed.",
      paths: unsafeLinks.map((link) => link.path).sort(comparePortablePaths)
    });
  }
  if (input.inventory.nestedRepositories.length > 0) {
    ambiguities.push({
      code: "nested-repositories-excluded",
      message: "Nested repositories were recorded as independent boundaries and not inspected.",
      paths: [...input.inventory.nestedRepositories]
    });
  }
  if (input.managedManifest.status === "invalid") {
    ambiguities.push({
      code: "invalid-pcp-manifest",
      message: input.managedManifest.reason,
      paths: [".pcp/pcp.yaml"]
    });
  }
  return ambiguities;
}
function stateBConfidence(signals) {
  const categories = new Set(signals.map((signal) => signal.category));
  if (categories.has("source-code") && (categories.has("project-manifest") || categories.has("tests") || categories.has("deployment"))) {
    return "high";
  }
  if (categories.has("source-code") || categories.has("deployment") || categories.has("data")) {
    return "high";
  }
  return "medium";
}
function classifyRepository(input) {
  const signals = [
    ...knownForeignPathSignals(input),
    ...semanticForeignSignals(input.documents),
    ...projectSignals(input.inventory)
  ];
  const ambiguities = initialAmbiguities(input);
  if (input.managedManifest.status === "valid") {
    signals.push({
      code: "managed.valid-manifest",
      category: "managed-manifest",
      path: ".pcp/pcp.yaml",
      reason: input.managedManifest.reason,
      strength: "strong"
    });
    const candidates2 = foreignCandidates(signals);
    if (candidates2.length > 0) {
      ambiguities.push({
        code: "managed-foreign-overlap",
        message: "A managed PCP project also exposes possible context adapters or foreign remnants; validation must resolve ownership.",
        paths: candidates2.flatMap((candidate) => candidate.paths).sort(comparePortablePaths)
      });
    }
    return {
      state: "managed",
      confidence: "high",
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: candidates2,
      ambiguities
    };
  }
  if (input.managedManifest.status === "invalid") {
    signals.push({
      code: "foreign.invalid-pcp-manifest",
      category: "agent-instructions",
      path: ".pcp/pcp.yaml",
      reason: "A PCP-like layer exists but its manifest is not a valid managed identity.",
      strength: "strong"
    });
  }
  const foreignSignals = signals.filter((signal) => foreignCategories.has(signal.category));
  const candidates = foreignCandidates(signals);
  if (foreignSignals.length > 0) {
    const categoryCount = new Set(foreignSignals.map((signal) => signal.category)).size;
    if (candidates.length > 1) {
      ambiguities.push({
        code: "foreign-layer-overlap",
        message: "Multiple possible context-layer roots overlap and require semantic coverage during State C adoption.",
        paths: candidates.flatMap((candidate) => candidate.paths).sort(comparePortablePaths)
      });
    }
    return {
      state: "C",
      confidence: foreignSignals.some((signal) => signal.strength === "strong") || categoryCount >= 3 ? "high" : "medium",
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: candidates,
      ambiguities
    };
  }
  const substantiveSignals = signals.filter((signal) => !foreignCategories.has(signal.category));
  if (substantiveSignals.length > 0) {
    if (substantiveSignals.every(
      (signal) => signal.strength === "weak" || signal.category === "documentation"
    )) {
      ambiguities.push({
        code: "a-b-conservative-fallback",
        message: "The project is borderline seed/established; PCP defaults ambiguous A/B targets to State B.",
        paths: substantiveSignals.map((signal) => signal.path).sort(comparePortablePaths)
      });
    }
    return {
      state: "B",
      confidence: stateBConfidence(substantiveSignals),
      signals: signals.sort((left, right) => comparePortablePaths(left.path, right.path)),
      foreignCandidates: [],
      ambiguities
    };
  }
  const seedFiles = input.inventory.files.filter(
    (file) => ![".gitignore", ".gitattributes", ".editorconfig"].includes(basename(file.path))
  );
  return {
    state: "A",
    confidence: seedFiles.length <= 1 ? "high" : "medium",
    signals: [],
    foreignCandidates: [],
    ambiguities
  };
}

// src/application/inspect-repository.ts
var maximumSemanticFileBytes = 1048576;
function isText(buffer) {
  const sampleLength = Math.min(buffer.length, 8192);
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] === 0) return false;
  }
  return true;
}
function meritsSemanticReview(candidatePath, contents) {
  if (candidatePath === ".pcp/pcp.yaml") return true;
  if (/(?:^|\/)(?:\.claude|\.cursor|\.github\/agents|agents?|ai|context|memory)(?:\/|$)/iu.test(
    candidatePath
  )) {
    return true;
  }
  return /\b(agent|assistant|continuity|handoff|checkpoint|workstream|journal|change ?log|working agreement|source of truth)\b/iu.test(
    contents
  );
}
async function loadTextDocuments(root, inventory) {
  const documents = [];
  for (const file of inventory.files) {
    if (file.size > maximumSemanticFileBytes) continue;
    const buffer = await readFile3(path5.join(root, ...file.path.split("/")));
    const observedDigest = createHash4("sha256").update(buffer).digest("hex");
    if (observedDigest !== file.sha256) {
      throw new InspectionError(
        "PCP_SOURCE_CHANGED",
        `Candidate content changed after inventory: ${file.path}`
      );
    }
    if (!isText(buffer)) continue;
    const contents = buffer.toString("utf8");
    if (meritsSemanticReview(file.path, contents)) {
      documents.push({ path: file.path, contents });
    }
  }
  return documents;
}
function manifestAssessment(inventory, documents) {
  const manifest = documents.find((document) => document.path === ".pcp/pcp.yaml");
  if (manifest === void 0) {
    const manifestEntryExists = inventory.files.some((file) => file.path === ".pcp/pcp.yaml") || inventory.symlinks.some((link) => link.path === ".pcp/pcp.yaml");
    if (manifestEntryExists) {
      return {
        status: "invalid",
        reason: "The PCP manifest must be a regular UTF-8 text file no larger than 1 MiB."
      };
    }
    return { status: "absent", reason: "No .pcp/pcp.yaml manifest was found." };
  }
  try {
    const parsed = parse(manifest.contents);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { status: "invalid", reason: "The PCP manifest must be a YAML mapping." };
    }
    const protocol = parsed.protocol;
    if (typeof protocol !== "object" || protocol === null || Array.isArray(protocol)) {
      return { status: "invalid", reason: "The PCP manifest must define a protocol mapping." };
    }
    const identity = protocol;
    if (identity.name !== "persistent-context-protocol" || typeof identity.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(identity.version)) {
      return {
        status: "invalid",
        reason: "The PCP manifest protocol must identify persistent-context-protocol and a semantic version."
      };
    }
    return {
      status: "valid",
      reason: `Found managed PCP protocol version ${identity.version}.`
    };
  } catch (error2) {
    const detail = error2 instanceof Error ? error2.message : String(error2);
    return { status: "invalid", reason: `The PCP manifest is not valid YAML: ${detail}` };
  }
}
async function inspectRepository(candidate = ".") {
  const root = await resolveCandidateRoot(candidate);
  const inventory = await inventoryRepository(root);
  const documents = await loadTextDocuments(root, inventory);
  const classification = classifyRepository({
    inventory,
    documents,
    managedManifest: manifestAssessment(inventory, documents)
  });
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    candidate: ".",
    state: classification.state,
    confidence: classification.confidence,
    signals: classification.signals,
    foreignCandidates: classification.foreignCandidates,
    ambiguities: classification.ambiguities,
    inventory,
    mutated: false
  };
}

// src/application/plan-adoption.ts
import { lstat as lstat5, mkdir as mkdir2, mkdtemp as mkdtemp2, readFile as readFile10, readdir as readdir3, rm as rm2, writeFile as writeFile3 } from "node:fs/promises";
import { tmpdir as tmpdir2 } from "node:os";
import path12 from "node:path";

// src/domain/adapters.ts
var SUPPORTED_ADAPTER_IDS = [
  "codex",
  "antigravity",
  "claude-code-desktop",
  "github-copilot-vscode",
  "cursor"
];
var ADAPTER_BASENAMES = /* @__PURE__ */ new Set([
  ".cursorrules",
  "agents.md",
  "claude.md",
  "copilot-instructions.md",
  "gemini.md",
  "skill.md"
]);
var ADAPTER_NAMESPACES = [
  ".agents/rules",
  ".claude/agents",
  ".claude/commands",
  ".claude/rules",
  ".claude/skills",
  ".cursor/rules",
  ".github/agents",
  ".github/instructions",
  ".roo/rules",
  ".windsurf/rules"
];
function normalizedPath(candidatePath) {
  return candidatePath.replaceAll("\\", "/").replace(/^\.\//u, "").toLowerCase();
}
function isInsideNamespace(candidatePath, namespace) {
  return candidatePath === namespace || candidatePath.startsWith(`${namespace}/`) || candidatePath.includes(`/${namespace}/`);
}
function isForeignAdapterSourcePath(candidatePath) {
  const normalized = normalizedPath(candidatePath);
  const basename2 = normalized.split("/").at(-1) ?? normalized;
  return ADAPTER_BASENAMES.has(basename2) || ADAPTER_NAMESPACES.some((namespace) => isInsideNamespace(normalized, namespace));
}
function supportedAdapterForSourcePath(candidatePath) {
  const normalized = normalizedPath(candidatePath);
  const basename2 = normalized.split("/").at(-1) ?? normalized;
  if (basename2 === "agents.md") return "codex";
  if (basename2 === "claude.md") return "claude-code-desktop";
  if (basename2 === ".cursorrules" || isInsideNamespace(normalized, ".cursor/rules")) {
    return "cursor";
  }
  if (isInsideNamespace(normalized, ".agents/rules")) return "antigravity";
  if (basename2 === "copilot-instructions.md" || isInsideNamespace(normalized, ".github/agents") || isInsideNamespace(normalized, ".github/instructions")) {
    return "github-copilot-vscode";
  }
  return void 0;
}

// src/infrastructure/adoption-assets.ts
import { lstat as lstat3, readdir, readFile as readFile4 } from "node:fs/promises";
import path6 from "node:path";
import { fileURLToPath } from "node:url";
var moduleDirectory = path6.dirname(fileURLToPath(import.meta.url));
function candidateTemplateRoots() {
  return [
    path6.resolve(moduleDirectory, "../../templates/core"),
    path6.resolve(moduleDirectory, "../templates/core"),
    path6.resolve(moduleDirectory, "../assets/templates/core")
  ];
}
async function isCoreTemplateRoot(candidate) {
  try {
    const marker = await lstat3(path6.join(candidate, ".pcp", "pcp.yaml"));
    return marker.isFile() && !marker.isSymbolicLink();
  } catch (error2) {
    if (error2.code === "ENOENT") return false;
    throw error2;
  }
}
async function resolveCoreTemplateRoot() {
  for (const candidate of candidateTemplateRoots()) {
    if (await isCoreTemplateRoot(candidate)) return candidate;
  }
  throw new AdoptionError(
    "PCP_ADOPTION_ASSETS_MISSING",
    "The verified core PCP template assets could not be located beside the engine."
  );
}
async function collectFiles(directory, root, result) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePortablePaths(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path6.join(directory, entry.name);
    const metadata = await lstat3(absolutePath);
    const relativePath = path6.relative(root, absolutePath).split(path6.sep).join("/");
    if (metadata.isSymbolicLink()) {
      throw new AdoptionError(
        "PCP_ADOPTION_ASSET_SYMLINK",
        `The core template contains an unsupported symbolic link: ${relativePath}`
      );
    }
    if (metadata.isDirectory()) {
      await collectFiles(absolutePath, root, result);
    } else if (metadata.isFile()) {
      result.push({ path: relativePath, content: await readFile4(absolutePath) });
    }
  }
}
async function loadCoreTemplateFiles() {
  const root = await resolveCoreTemplateRoot();
  const files = [];
  await collectFiles(root, root, files);
  files.sort((left, right) => comparePortablePaths(left.path, right.path));
  return new Map(files.map((file) => [file.path, file.content]));
}

// src/infrastructure/schema-validator.ts
var import__ = __toESM(require__(), 1);
var import_ajv_formats = __toESM(require_dist(), 1);

// schemas/v1/adapter.schema.json
var adapter_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:adapter",
  title: "PCP generated platform adapter",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "adapter_id",
    "platform",
    "target_path",
    "source_paths",
    "ownership",
    "collision_policy",
    "content_digest"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    adapter_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slug"
    },
    platform: {
      enum: [
        "codex",
        "antigravity",
        "claude-code-desktop",
        "github-copilot-vscode",
        "cursor",
        "custom"
      ]
    },
    target_path: {
      $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
    },
    source_paths: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    },
    ownership: {
      const: "generated"
    },
    collision_policy: {
      enum: ["preview-required", "preserve", "replace-generated"]
    },
    content_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    }
  }
};

// schemas/v1/adoption-input.schema.json
var adoption_input_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:adoption-input",
  title: "PCP semantic adoption input",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "baseline_at",
    "persistence",
    "project",
    "projects",
    "workstreams",
    "vcs_policy",
    "documents",
    "scaffold_files"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    baseline_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    persistence: {
      enum: ["tracked", "local"]
    },
    project: {
      $ref: "urn:pcp:schema:v1:project"
    },
    projects: {
      $ref: "urn:pcp:schema:v1:project-registry"
    },
    workstreams: {
      $ref: "urn:pcp:schema:v1:workstreams"
    },
    vcs_policy: {
      $ref: "urn:pcp:schema:v1:vcs-policy"
    },
    documents: {
      type: "array",
      items: {
        $ref: "#/$defs/document"
      },
      minItems: 8,
      maxItems: 8
    },
    coverage: {
      $ref: "urn:pcp:schema:v1:coverage"
    },
    scaffold_files: {
      type: "array",
      items: {
        $ref: "#/$defs/scaffoldFile"
      },
      uniqueItems: true
    }
  },
  $defs: {
    document: {
      type: "object",
      additionalProperties: false,
      required: ["path", "type", "status", "basis", "evidence_paths", "body"],
      properties: {
        path: {
          enum: [
            "knowledge/10-overview.md",
            "knowledge/20-architecture.md",
            "knowledge/30-source-map.md",
            "knowledge/40-build-and-tooling.md",
            "knowledge/50-domain-and-invariants.md",
            "operations/10-working-agreement.md",
            "operations/20-plan.md",
            "operations/30-decisions.md"
          ]
        },
        type: {
          enum: ["knowledge", "policy", "plan"]
        },
        status: {
          enum: ["static", "living"]
        },
        basis: {
          enum: ["repository", "user", "repository-and-user", "not-applicable"]
        },
        evidence_paths: {
          $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
        },
        body: {
          type: "string",
          minLength: 3
        }
      }
    },
    scaffoldFile: {
      type: "object",
      additionalProperties: false,
      required: ["path", "content"],
      properties: {
        path: {
          allOf: [
            {
              $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
            },
            {
              not: {
                type: "string",
                pattern: "^\\.pcp(?:/|$)"
              }
            }
          ]
        },
        content: {
          type: "string"
        }
      }
    }
  }
};

// schemas/v1/actor-profile.schema.json
var actor_profile_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:actor-profile",
  title: "PCP durable human or agent profile",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "actor_id",
    "actor_type",
    "client",
    "machine_label",
    "first_seen",
    "checkpoint_paths"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    actor_id: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9A-HJKMNP-TV-Z]{10}$",
      maxLength: 192
    },
    actor_type: {
      enum: ["human", "agent"]
    },
    client: {
      enum: [
        "codex",
        "antigravity",
        "claude-code-desktop",
        "github-copilot-vscode",
        "cursor",
        "human",
        "other"
      ]
    },
    machine_label: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slug"
    },
    first_seen: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    checkpoint_paths: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    }
  },
  allOf: [
    {
      if: {
        properties: { actor_type: { const: "human" } },
        required: ["actor_type"]
      },
      then: {
        properties: {
          client: { const: "human" },
          checkpoint_paths: { type: "array", maxItems: 0 }
        }
      }
    },
    {
      if: {
        properties: { actor_type: { const: "agent" } },
        required: ["actor_type"]
      },
      then: {
        properties: {
          client: { not: { const: "human" } }
        }
      }
    }
  ]
};

// schemas/v1/checkpoint.schema.json
var checkpoint_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:checkpoint",
  title: "PCP scoped reconciliation checkpoint",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "checkpoint_id",
    "actor_id",
    "workstream_id",
    "last_event_id",
    "reconciled_at",
    "scopes",
    "paths",
    "dependencies"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    checkpoint_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/ulid"
    },
    actor_id: {
      type: "string",
      minLength: 1,
      maxLength: 192
    },
    workstream_id: {
      anyOf: [{ $ref: "urn:pcp:schema:v1:common#/$defs/slug" }, { type: "null" }]
    },
    last_event_id: {
      anyOf: [{ $ref: "urn:pcp:schema:v1:common#/$defs/ulid" }, { type: "null" }]
    },
    reconciled_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    scopes: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    paths: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    },
    dependencies: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    }
  }
};

// schemas/v1/common.schema.json
var common_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:common",
  title: "PCP common definitions",
  $defs: {
    schemaVersion: {
      type: "integer",
      const: 1
    },
    semver: {
      type: "string",
      pattern: "^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$"
    },
    sha256: {
      type: "string",
      pattern: "^[a-f0-9]{64}$"
    },
    ulid: {
      type: "string",
      pattern: "^[0-7][0-9A-HJKMNP-TV-Z]{25}$"
    },
    slug: {
      type: "string",
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      maxLength: 128
    },
    nonEmptyString: {
      type: "string",
      minLength: 1,
      maxLength: 4096
    },
    relativePath: {
      type: "string",
      minLength: 1,
      maxLength: 1024,
      pattern: "^(?![A-Za-z]:)(?!/)(?!.*\\\\)(?!.*(?:^|/)\\.\\.(?:/|$))(?!.*//).+$"
    },
    relativeGlob: {
      type: "string",
      minLength: 1,
      maxLength: 1024,
      pattern: "^(?![A-Za-z]:)(?!/)(?!.*\\\\)(?!.*(?:^|/)\\.\\.(?:/|$))(?!.*//).+$"
    },
    pathArray: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
      },
      uniqueItems: true
    },
    slugArray: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:common#/$defs/slug"
      },
      uniqueItems: true
    },
    dateTime: {
      type: "string",
      format: "date-time"
    },
    actorReference: {
      type: "object",
      additionalProperties: false,
      required: ["type", "id"],
      properties: {
        type: {
          enum: ["human", "agent", "system"]
        },
        id: {
          $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
        }
      }
    }
  }
};

// schemas/v1/coverage.schema.json
var coverage_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:coverage",
  title: "PCP transient State C coverage matrix",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "coverage_id",
    "source_inventory_digest",
    "records",
    "unresolved_count"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    coverage_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/ulid"
    },
    source_inventory_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    },
    records: {
      type: "array",
      items: {
        $ref: "#/$defs/record"
      },
      uniqueItems: true
    },
    unresolved_count: {
      type: "integer",
      minimum: 0
    }
  },
  $defs: {
    record: {
      type: "object",
      additionalProperties: false,
      required: [
        "source_id",
        "source_path",
        "source_kind",
        "fingerprint",
        "disposition",
        "targets",
        "evidence"
      ],
      properties: {
        source_id: {
          $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
        },
        source_path: {
          $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
        },
        source_kind: {
          enum: ["file", "history-entry", "registry-entry", "fact", "adapter"]
        },
        fingerprint: {
          $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
        },
        disposition: {
          enum: [
            "represented",
            "promoted",
            "superseded",
            "operational-noise",
            "historical-only",
            "sensitive-local",
            "project-owned",
            "unresolved"
          ]
        },
        targets: {
          $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
        },
        evidence: {
          type: "array",
          items: {
            $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
          },
          minItems: 1,
          uniqueItems: true
        }
      },
      allOf: [
        {
          if: {
            properties: {
              disposition: {
                enum: ["represented", "promoted", "superseded"]
              }
            },
            required: ["disposition"]
          },
          then: {
            properties: {
              targets: { type: "array", minItems: 1 }
            }
          }
        },
        {
          if: {
            properties: {
              disposition: {
                const: "project-owned"
              }
            },
            required: ["disposition"]
          },
          then: {
            properties: {
              source_kind: { const: "file" },
              targets: { type: "array", maxItems: 0 }
            }
          }
        }
      ]
    }
  }
};

// schemas/v1/event.schema.json
var event_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:event",
  title: "PCP immutable continuity event",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "event_id",
    "payload_digest",
    "occurred_at",
    "actor",
    "recorded_by",
    "basis",
    "kind",
    "scopes",
    "workstreams",
    "summary",
    "affected_paths"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    event_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/ulid"
    },
    payload_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    },
    occurred_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    actor: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    recorded_by: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    basis: {
      enum: ["self", "reported", "observed", "system"]
    },
    change_key: {
      $ref: "#/$defs/changeKey"
    },
    kind: {
      enum: [
        "code",
        "documentation",
        "configuration",
        "decision",
        "research",
        "operations",
        "release",
        "vcs",
        "workstream"
      ]
    },
    scopes: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    workstreams: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    summary: {
      $ref: "#/$defs/summary"
    },
    rationale: {
      $ref: "#/$defs/rationale"
    },
    affected_paths: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    }
  },
  anyOf: [
    {
      properties: { scopes: { type: "array", minItems: 1 } }
    },
    {
      properties: { workstreams: { type: "array", minItems: 1 } }
    },
    {
      properties: { affected_paths: { type: "array", minItems: 1 } }
    }
  ],
  allOf: [
    {
      if: {
        properties: { basis: { enum: ["reported", "observed"] } },
        required: ["basis"]
      },
      then: {
        properties: { change_key: {} },
        required: ["change_key"]
      }
    }
  ],
  $defs: {
    changeKey: {
      type: "string",
      minLength: 1,
      maxLength: 240,
      pattern: "\\S"
    },
    summary: {
      type: "string",
      minLength: 1,
      maxLength: 240,
      pattern: "\\S"
    },
    rationale: {
      type: "string",
      minLength: 1,
      maxLength: 1e3,
      pattern: "\\S"
    }
  }
};

// schemas/v1/event-input.schema.json
var event_input_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:event-input",
  title: "PCP continuity event recording input",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "actor",
    "recorded_by",
    "basis",
    "kind",
    "scopes",
    "workstreams",
    "summary",
    "affected_paths"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    occurred_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    actor: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    recorded_by: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    basis: {
      enum: ["self", "reported", "observed", "system"]
    },
    change_key: {
      $ref: "urn:pcp:schema:v1:event#/$defs/changeKey"
    },
    kind: {
      enum: [
        "code",
        "documentation",
        "configuration",
        "decision",
        "research",
        "operations",
        "release",
        "vcs",
        "workstream"
      ]
    },
    scopes: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    workstreams: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    summary: {
      $ref: "urn:pcp:schema:v1:event#/$defs/summary"
    },
    rationale: {
      $ref: "urn:pcp:schema:v1:event#/$defs/rationale"
    },
    affected_paths: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    }
  },
  anyOf: [
    {
      properties: { scopes: { type: "array", minItems: 1 } }
    },
    {
      properties: { workstreams: { type: "array", minItems: 1 } }
    },
    {
      properties: { affected_paths: { type: "array", minItems: 1 } }
    }
  ],
  allOf: [
    {
      if: {
        properties: { basis: { enum: ["reported", "observed"] } },
        required: ["basis"]
      },
      then: {
        properties: { change_key: {} },
        required: ["change_key"]
      }
    }
  ]
};

// schemas/v1/frontmatter.schema.json
var frontmatter_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:frontmatter",
  title: "PCP Markdown frontmatter",
  type: "object",
  additionalProperties: false,
  required: ["doc", "type", "status", "version", "last_updated", "ownership"],
  properties: {
    doc: {
      $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
    },
    type: {
      enum: [
        "index",
        "protocol",
        "knowledge",
        "policy",
        "plan",
        "project",
        "reference",
        "generated"
      ]
    },
    status: {
      enum: ["living", "static", "generated"]
    },
    version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/semver"
    },
    last_updated: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    ownership: {
      enum: ["protocol", "project", "generated"]
    },
    sources: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    },
    source_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    }
  },
  allOf: [
    {
      if: {
        properties: { ownership: { const: "generated" } },
        required: ["ownership"]
      },
      then: {
        required: ["sources", "source_digest"],
        properties: {
          status: { const: "generated" },
          sources: {
            $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
          },
          source_digest: {
            $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
          }
        }
      }
    }
  ]
};

// schemas/v1/mutation-plan.schema.json
var mutation_plan_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:mutation-plan",
  title: "PCP normalized mutation plan",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "plan_id",
    "generated_at",
    "classification",
    "candidate_inventory_digest",
    "operations",
    "validations",
    "plan_digest"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    plan_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/ulid"
    },
    generated_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    classification: {
      enum: ["A", "B", "C", "managed"]
    },
    candidate_inventory_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    },
    coverage_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    },
    operations: {
      type: "array",
      items: {
        $ref: "#/$defs/operation"
      },
      uniqueItems: true
    },
    validations: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:common#/$defs/slug"
      },
      minItems: 1,
      uniqueItems: true
    },
    plan_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    }
  },
  allOf: [
    {
      if: {
        properties: {
          classification: { const: "C" }
        },
        required: ["classification"]
      },
      then: {
        properties: {
          coverage_digest: {
            $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
          }
        },
        required: ["coverage_digest"]
      },
      else: {
        properties: {
          coverage_digest: false
        }
      }
    }
  ],
  $defs: {
    operation: {
      type: "object",
      additionalProperties: false,
      required: ["operation_id", "action", "path"],
      properties: {
        operation_id: {
          $ref: "urn:pcp:schema:v1:common#/$defs/ulid"
        },
        action: {
          enum: ["mkdir", "write", "replace", "remove", "move"]
        },
        path: {
          $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
        },
        source_path: {
          $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
        },
        content_digest: {
          $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
        },
        preimage_digest: {
          $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
        }
      },
      allOf: [
        {
          if: {
            properties: { action: { enum: ["write", "replace"] } },
            required: ["action"]
          },
          then: {
            required: ["content_digest"],
            properties: {
              content_digest: {
                $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
              }
            }
          }
        },
        {
          if: {
            properties: { action: { const: "move" } },
            required: ["action"]
          },
          then: {
            required: ["source_path"],
            properties: {
              source_path: {
                $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
              }
            }
          }
        },
        {
          if: {
            properties: { action: { enum: ["replace", "remove", "move"] } },
            required: ["action"]
          },
          then: {
            required: ["preimage_digest"],
            properties: {
              preimage_digest: {
                $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
              }
            }
          }
        }
      ]
    }
  }
};

// schemas/v1/pcp-manifest.schema.json
var pcp_manifest_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:pcp-manifest",
  title: "Persistent Context Protocol manifest",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "protocol",
    "persistence",
    "capabilities",
    "continuity",
    "ownership",
    "adapter_ids",
    "validation",
    "vcs_policy_path"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    protocol: {
      type: "object",
      additionalProperties: false,
      required: ["name", "version"],
      properties: {
        name: {
          const: "persistent-context-protocol"
        },
        version: {
          $ref: "urn:pcp:schema:v1:common#/$defs/semver"
        }
      }
    },
    persistence: {
      enum: ["tracked", "local"]
    },
    capabilities: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    continuity: {
      type: "object",
      additionalProperties: false,
      required: ["active_event_limit", "archive_batch_size", "archive_read_policy"],
      properties: {
        active_event_limit: { const: 64 },
        archive_batch_size: { const: 32 },
        archive_read_policy: { const: "explicit-only" }
      }
    },
    ownership: {
      type: "object",
      additionalProperties: false,
      required: ["protocol", "project", "generated", "runtime"],
      properties: {
        protocol: { $ref: "#/$defs/globArray" },
        project: { $ref: "#/$defs/globArray" },
        generated: { $ref: "#/$defs/globArray" },
        runtime: { $ref: "#/$defs/globArray" }
      }
    },
    adapter_ids: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    },
    validation: {
      type: "object",
      additionalProperties: false,
      required: ["strict", "schema_root", "generated_views_read_only"],
      properties: {
        strict: { type: "boolean" },
        schema_root: {
          $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
        },
        generated_views_read_only: { const: true }
      }
    },
    vcs_policy_path: {
      $ref: "urn:pcp:schema:v1:common#/$defs/relativePath"
    }
  },
  $defs: {
    globArray: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:common#/$defs/relativeGlob"
      },
      minItems: 1,
      uniqueItems: true
    }
  }
};

// schemas/v1/project-registry.schema.json
var project_registry_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:project-registry",
  title: "PCP project registry",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "projects"],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    projects: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:project"
      },
      uniqueItems: true
    }
  }
};

// schemas/v1/project.schema.json
var project_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:project",
  title: "PCP project state",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "project_id",
    "name",
    "purpose",
    "project_type",
    "lifecycle",
    "artifact_roots",
    "context_roots",
    "repositories",
    "tags"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    project_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slug"
    },
    name: {
      $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
    },
    purpose: {
      $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
    },
    project_type: {
      enum: [
        "software",
        "research",
        "data",
        "writing",
        "career",
        "creative",
        "operations",
        "mixed",
        "other"
      ]
    },
    lifecycle: {
      enum: ["seed", "active", "maintenance", "paused", "complete", "archived"]
    },
    artifact_roots: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    },
    context_roots: {
      $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
    },
    repositories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "url", "default_branch", "visibility"],
        properties: {
          provider: {
            enum: ["github", "gitlab", "bitbucket", "other"]
          },
          url: {
            type: "string",
            format: "uri",
            pattern: "^https://"
          },
          default_branch: {
            $ref: "urn:pcp:schema:v1:common#/$defs/slug"
          },
          visibility: {
            enum: ["public", "private", "internal", "unknown"]
          }
        }
      },
      uniqueItems: true
    },
    tags: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
    }
  }
};

// schemas/v1/vcs-policy.schema.json
var vcs_policy_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:vcs-policy",
  title: "PCP version-control authority policy",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "mode",
    "system",
    "provider",
    "repository",
    "responsibilities",
    "workflow"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    mode: {
      enum: ["none", "human-owned", "human-commit", "agent-managed", "custom"]
    },
    system: {
      enum: ["none", "git", "subversion", "other"]
    },
    provider: {
      enum: ["none", "github", "gitlab", "bitbucket", "other"]
    },
    repository: {
      type: "object",
      additionalProperties: false,
      required: ["remote_name", "default_branch"],
      properties: {
        remote_name: {
          $ref: "urn:pcp:schema:v1:common#/$defs/slug"
        },
        default_branch: {
          $ref: "urn:pcp:schema:v1:common#/$defs/slug"
        }
      }
    },
    responsibilities: {
      $ref: "#/$defs/responsibilities"
    },
    workflow: {
      type: "object",
      additionalProperties: false,
      required: [
        "branch_pattern",
        "commit_convention",
        "commit_signing",
        "push_cadence",
        "pull_request_policy",
        "human_merge_required",
        "post_merge"
      ],
      properties: {
        branch_pattern: {
          $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
        },
        commit_convention: {
          enum: ["conventional", "custom", "none"]
        },
        commit_signing: {
          enum: ["required", "recommended", "none"]
        },
        push_cadence: {
          enum: ["milestone", "unit", "manual", "never"]
        },
        pull_request_policy: {
          enum: ["none", "recommended", "required"]
        },
        human_merge_required: {
          type: "boolean"
        },
        post_merge: {
          type: "array",
          items: {
            enum: [
              "verify-pr",
              "verify-checks",
              "accept-human-report",
              "fetch-prune",
              "switch-default",
              "pull-ff-only",
              "verify-clean",
              "delete-local-branch",
              "verify-merged-tree",
              "create-next-branch"
            ]
          },
          uniqueItems: true
        }
      }
    }
  },
  $defs: {
    actor: {
      enum: ["agent", "human", "external", "prohibited"]
    },
    responsibilities: {
      type: "object",
      additionalProperties: false,
      required: [
        "initialize",
        "create_repository",
        "configure_remote",
        "configure_protection",
        "sync_default",
        "create_branch",
        "stage",
        "commit",
        "push",
        "open_pull_request",
        "repair_ci",
        "review_pull_request",
        "merge_pull_request",
        "cleanup_branch",
        "tag",
        "release",
        "force_push",
        "rewrite_history",
        "destructive_recovery",
        "manage_credentials"
      ],
      properties: {
        initialize: { $ref: "#/$defs/actor" },
        create_repository: { $ref: "#/$defs/actor" },
        configure_remote: { $ref: "#/$defs/actor" },
        configure_protection: { $ref: "#/$defs/actor" },
        sync_default: { $ref: "#/$defs/actor" },
        create_branch: { $ref: "#/$defs/actor" },
        stage: { $ref: "#/$defs/actor" },
        commit: { $ref: "#/$defs/actor" },
        push: { $ref: "#/$defs/actor" },
        open_pull_request: { $ref: "#/$defs/actor" },
        repair_ci: { $ref: "#/$defs/actor" },
        review_pull_request: { $ref: "#/$defs/actor" },
        merge_pull_request: { $ref: "#/$defs/actor" },
        cleanup_branch: { $ref: "#/$defs/actor" },
        tag: { $ref: "#/$defs/actor" },
        release: { $ref: "#/$defs/actor" },
        force_push: { $ref: "#/$defs/actor" },
        rewrite_history: { $ref: "#/$defs/actor" },
        destructive_recovery: { $ref: "#/$defs/actor" },
        manage_credentials: { $ref: "#/$defs/actor" }
      }
    }
  },
  allOf: [
    {
      if: {
        properties: { mode: { const: "none" } },
        required: ["mode"]
      },
      then: {
        properties: {
          provider: { const: "none" },
          system: { const: "none" },
          responsibilities: {
            type: "object",
            additionalProperties: { const: "prohibited" }
          },
          workflow: {
            type: "object",
            properties: {
              commit_convention: { const: "none" },
              commit_signing: { const: "none" },
              push_cadence: { const: "never" },
              pull_request_policy: { const: "none" },
              human_merge_required: { const: false },
              post_merge: { type: "array", maxItems: 0 }
            }
          }
        }
      }
    },
    {
      if: {
        properties: { mode: { const: "agent-managed" } },
        required: ["mode"]
      },
      then: {
        properties: {
          provider: { not: { const: "none" } },
          system: { const: "git" },
          responsibilities: {
            type: "object",
            properties: {
              sync_default: { const: "agent" },
              create_branch: { const: "agent" },
              stage: { const: "agent" },
              commit: { const: "agent" },
              push: { const: "agent" },
              open_pull_request: { const: "agent" },
              repair_ci: { const: "agent" },
              review_pull_request: { const: "human" },
              merge_pull_request: { const: "human" },
              cleanup_branch: { const: "agent" },
              force_push: { const: "prohibited" },
              rewrite_history: { const: "prohibited" }
            }
          },
          workflow: {
            type: "object",
            properties: {
              commit_convention: { const: "conventional" },
              commit_signing: { enum: ["required", "recommended"] },
              push_cadence: { const: "milestone" },
              pull_request_policy: { const: "recommended" },
              human_merge_required: { const: true },
              post_merge: {
                type: "array",
                prefixItems: [
                  { const: "verify-pr" },
                  { const: "verify-checks" },
                  { const: "fetch-prune" },
                  { const: "switch-default" },
                  { const: "pull-ff-only" },
                  { const: "verify-clean" },
                  { const: "delete-local-branch" },
                  { const: "verify-merged-tree" },
                  { const: "create-next-branch" }
                ],
                minItems: 9,
                maxItems: 9
              }
            }
          }
        }
      }
    },
    {
      if: {
        properties: { mode: { const: "human-commit" } },
        required: ["mode"]
      },
      then: {
        properties: {
          provider: { not: { const: "none" } },
          system: { const: "git" },
          responsibilities: {
            type: "object",
            properties: {
              sync_default: { const: "agent" },
              create_branch: { const: "agent" },
              stage: { const: "human" },
              commit: { const: "human" },
              push: { const: "agent" },
              open_pull_request: { const: "agent" },
              repair_ci: { const: "agent" },
              review_pull_request: { const: "human" },
              merge_pull_request: { const: "human" },
              cleanup_branch: { const: "agent" },
              force_push: { const: "prohibited" },
              rewrite_history: { const: "prohibited" }
            }
          },
          workflow: {
            type: "object",
            properties: {
              commit_convention: { const: "conventional" },
              commit_signing: { enum: ["required", "recommended"] },
              push_cadence: { const: "milestone" },
              pull_request_policy: { const: "recommended" },
              human_merge_required: { const: true },
              post_merge: {
                type: "array",
                prefixItems: [
                  { const: "accept-human-report" },
                  { const: "fetch-prune" },
                  { const: "switch-default" },
                  { const: "pull-ff-only" },
                  { const: "verify-clean" },
                  { const: "delete-local-branch" },
                  { const: "create-next-branch" }
                ],
                minItems: 7,
                maxItems: 7
              }
            }
          }
        }
      }
    },
    {
      if: {
        properties: { mode: { const: "human-owned" } },
        required: ["mode"]
      },
      then: {
        properties: {
          responsibilities: {
            type: "object",
            additionalProperties: { enum: ["human", "prohibited"] }
          }
        }
      }
    }
  ]
};

// schemas/v1/workstreams.schema.json
var workstreams_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:workstreams",
  title: "PCP workstream registry",
  type: "object",
  additionalProperties: false,
  required: ["schema_version", "workstreams"],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    workstreams: {
      type: "array",
      items: {
        $ref: "#/$defs/workstream"
      },
      uniqueItems: true
    }
  },
  $defs: {
    workstream: {
      type: "object",
      additionalProperties: false,
      required: [
        "workstream_id",
        "name",
        "kind",
        "status",
        "paths",
        "areas",
        "dependencies",
        "completion"
      ],
      properties: {
        workstream_id: {
          $ref: "urn:pcp:schema:v1:common#/$defs/slug"
        },
        name: {
          $ref: "urn:pcp:schema:v1:common#/$defs/nonEmptyString"
        },
        kind: {
          enum: ["sequential", "concurrent", "ceb"]
        },
        status: {
          enum: ["planned", "active", "blocked", "complete", "cancelled"]
        },
        paths: {
          $ref: "urn:pcp:schema:v1:common#/$defs/pathArray"
        },
        areas: {
          $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
        },
        dependencies: {
          $ref: "urn:pcp:schema:v1:common#/$defs/slugArray"
        },
        completion: {
          type: "object",
          additionalProperties: false,
          required: ["criteria", "evidence"],
          properties: {
            criteria: {
              type: "array",
              items: {
                $ref: "#/$defs/criterion"
              },
              minItems: 1,
              uniqueItems: true
            },
            evidence: {
              type: "array",
              items: {
                $ref: "#/$defs/completionEvidence"
              },
              uniqueItems: true
            },
            announcement: {
              $ref: "#/$defs/announcement"
            }
          }
        }
      }
    },
    criterion: {
      type: "string",
      minLength: 1,
      maxLength: 1e3,
      pattern: "\\S"
    },
    completionEvidence: {
      type: "object",
      additionalProperties: false,
      required: ["criterion", "proof"],
      properties: {
        criterion: {
          $ref: "#/$defs/criterion"
        },
        proof: {
          type: "string",
          minLength: 1,
          maxLength: 4096,
          pattern: "\\S"
        }
      }
    },
    announcement: {
      type: "string",
      minLength: 1,
      maxLength: 1e3,
      pattern: "\\S"
    }
  }
};

// schemas/v1/workstream-operation-input.schema.json
var workstream_operation_input_schema_default = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:pcp:schema:v1:workstream-operation-input",
  title: "PCP workstream mutation input",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version",
    "operation",
    "expected_registry_digest",
    "actor",
    "recorded_by",
    "basis",
    "summary"
  ],
  properties: {
    schema_version: {
      $ref: "urn:pcp:schema:v1:common#/$defs/schemaVersion"
    },
    operation: {
      enum: ["create", "update", "complete"]
    },
    expected_registry_digest: {
      $ref: "urn:pcp:schema:v1:common#/$defs/sha256"
    },
    occurred_at: {
      $ref: "urn:pcp:schema:v1:common#/$defs/dateTime"
    },
    actor: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    recorded_by: {
      $ref: "urn:pcp:schema:v1:common#/$defs/actorReference"
    },
    basis: {
      enum: ["self", "reported", "observed", "system"]
    },
    change_key: {
      $ref: "urn:pcp:schema:v1:event#/$defs/changeKey"
    },
    summary: {
      $ref: "urn:pcp:schema:v1:event#/$defs/summary"
    },
    rationale: {
      $ref: "urn:pcp:schema:v1:event#/$defs/rationale"
    },
    workstream: {
      $ref: "urn:pcp:schema:v1:workstreams#/$defs/workstream"
    },
    workstream_id: {
      $ref: "urn:pcp:schema:v1:common#/$defs/slug"
    },
    evidence: {
      type: "array",
      items: {
        $ref: "urn:pcp:schema:v1:workstreams#/$defs/completionEvidence"
      },
      minItems: 1,
      uniqueItems: true
    },
    announcement: {
      $ref: "urn:pcp:schema:v1:workstreams#/$defs/announcement"
    }
  },
  oneOf: [
    {
      properties: {
        operation: { const: "create" },
        workstream: {},
        workstream_id: false,
        evidence: false,
        announcement: false
      },
      required: ["workstream"]
    },
    {
      properties: {
        operation: { const: "update" },
        workstream: {},
        workstream_id: false,
        evidence: false,
        announcement: false
      },
      required: ["workstream"]
    },
    {
      properties: {
        operation: { const: "complete" },
        workstream: false,
        workstream_id: {},
        evidence: {},
        announcement: {}
      },
      required: ["workstream_id", "evidence", "announcement"]
    }
  ],
  allOf: [
    {
      if: {
        properties: { basis: { enum: ["reported", "observed"] } },
        required: ["basis"]
      },
      then: {
        properties: { change_key: {} },
        required: ["change_key"]
      }
    }
  ]
};

// src/domain/schema-catalog.ts
var SCHEMA_CATALOG = {
  adapter: adapter_schema_default,
  "adoption-input": adoption_input_schema_default,
  "actor-profile": actor_profile_schema_default,
  checkpoint: checkpoint_schema_default,
  coverage: coverage_schema_default,
  event: event_schema_default,
  "event-input": event_input_schema_default,
  frontmatter: frontmatter_schema_default,
  "mutation-plan": mutation_plan_schema_default,
  "pcp-manifest": pcp_manifest_schema_default,
  "project-registry": project_registry_schema_default,
  project: project_schema_default,
  "vcs-policy": vcs_policy_schema_default,
  "workstream-operation-input": workstream_operation_input_schema_default,
  workstreams: workstreams_schema_default
};
var SUPPORTING_SCHEMAS = [common_schema_default];
var SCHEMA_NAMES = Object.keys(SCHEMA_CATALOG).sort();

// src/infrastructure/schema-validator.ts
function schemaId(schema4) {
  const id = schema4.$id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Every PCP schema must define a non-empty $id.");
  }
  return id;
}
function compareDiagnostics(left, right) {
  const leftKey = `${left.path}\0${left.keyword}\0${left.message}`;
  const rightKey = `${right.path}\0${right.keyword}\0${right.message}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
function diagnostic(error2) {
  return {
    path: error2.instancePath === "" ? "/" : error2.instancePath,
    keyword: error2.keyword,
    message: error2.message ?? "Schema validation failed.",
    params: error2.params
  };
}
var SchemaRegistry = class {
  #validators = /* @__PURE__ */ new Map();
  constructor() {
    const ajv = new import__.Ajv2020({
      allErrors: true,
      strict: true,
      validateFormats: true,
      coerceTypes: false,
      removeAdditional: false,
      useDefaults: false
    });
    const addFormats = import_ajv_formats.default;
    addFormats(ajv);
    for (const schema4 of SUPPORTING_SCHEMAS) {
      ajv.addSchema(schema4, schemaId(schema4));
    }
    for (const name of SCHEMA_NAMES) {
      const schema4 = SCHEMA_CATALOG[name];
      ajv.addSchema(schema4, schemaId(schema4));
    }
    for (const name of SCHEMA_NAMES) {
      const validator = ajv.getSchema(schemaId(SCHEMA_CATALOG[name]));
      if (validator === void 0) {
        throw new Error(`PCP schema did not compile: ${name}`);
      }
      this.#validators.set(name, validator);
    }
  }
  validate(name, value) {
    const validator = this.#validators.get(name);
    if (validator === void 0) {
      throw new Error(`Unknown PCP schema: ${name}`);
    }
    const valid = validator(value);
    const diagnostics = (validator.errors ?? []).map(diagnostic).sort(compareDiagnostics);
    return { valid, diagnostics };
  }
};
var defaultRegistry;
function validateSchema(name, value) {
  defaultRegistry ??= new SchemaRegistry();
  return defaultRegistry.validate(name, value);
}

// src/application/foreign-coverage.ts
import { readFile as readFile5 } from "node:fs/promises";
import path7 from "node:path";

// src/domain/coverage.ts
var COVERAGE_SCHEMA_VERSION = 1;
var PENDING_COVERAGE_EVIDENCE = "Pending semantic disposition.";

// src/application/foreign-coverage.ts
var MAXIMUM_STRUCTURED_SOURCE_BYTES = 4 * 1048576;
var FOREIGN_CATEGORIES = /* @__PURE__ */ new Set([
  "agent-instructions",
  "persistent-memory",
  "agent-identity",
  "change-journal",
  "workflow",
  "orchestration"
]);
var ENCRYPTED_EXTENSION = /\.(?:age|asc|enc|gpg|p12|pfx|pgp)$/iu;
var ENCRYPTED_CONTENT = /-----BEGIN (?:PGP MESSAGE|ENCRYPTED PRIVATE KEY)-----|age-encryption\.org\/v1/iu;
var HISTORY_BASENAME = /^(?:change[-_ ]?log|events?|history|journal)(?:\.[a-z0-9_-]+)?\.(?:json|md|ya?ml)$/iu;
var REGISTRY_BASENAME = /^(?:agent|actor)[-_ ]?(?:profiles?|registry|repository)\.(?:json|md|ya?ml)$/iu;
function isInsideForeignRoot(candidatePath, root) {
  return candidatePath === root || candidatePath.startsWith(`${root}/`);
}
function structuredSourceKind(candidatePath) {
  const basename2 = candidatePath.split("/").at(-1) ?? candidatePath;
  if (HISTORY_BASENAME.test(basename2)) return "history-entry";
  if (REGISTRY_BASENAME.test(basename2)) return "registry-entry";
  return void 0;
}
function collectionKeys(kind) {
  return kind === "history-entry" ? ["entries", "changes", "events", "history", "journal"] : ["actors", "agents", "profiles", "registry", "entries"];
}
function structuredCollection(value, kind) {
  if (Array.isArray(value)) return [...value];
  if (typeof value !== "object" || value === null) return void 0;
  const record = value;
  for (const key of collectionKeys(kind)) {
    const collection = record[key];
    if (Array.isArray(collection)) return [...collection];
  }
  return void 0;
}
function markdownTableEntries(contents) {
  const lines = normalizeText(contents).split("\n");
  for (let index = 1; index < lines.length; index += 1) {
    const header = lines[index - 1];
    const separator = lines[index];
    if (header === void 0 || separator === void 0 || !header.includes("|")) continue;
    const separatorCells = separator.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
    if (separatorCells.length === 0 || !separatorCells.every((cell) => /^:?-{3,}:?$/u.test(cell))) {
      continue;
    }
    const entries = [];
    for (let rowIndex = index + 1; rowIndex < lines.length; rowIndex += 1) {
      const row = lines[rowIndex]?.trim();
      if (row === void 0 || row === "" || !row.includes("|")) break;
      entries.push(
        row.replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim()).join(" | ")
      );
    }
    return entries;
  }
  return [];
}
function markdownHeadingEntries(contents) {
  const normalized = normalizeText(contents);
  const headings = [...normalized.matchAll(/^##\s+.+$/gmu)];
  return headings.map((heading, index) => {
    const start = heading.index ?? 0;
    const end = headings[index + 1]?.index ?? normalized.length;
    return normalized.slice(start, end).trim();
  });
}
function parseStructuredEntries(candidatePath, contents, kind) {
  if (path7.posix.extname(candidatePath).toLowerCase() === ".md") {
    const entries2 = kind === "registry-entry" ? markdownTableEntries(contents) : markdownHeadingEntries(contents);
    if (entries2.length > 0) return { entries: entries2 };
    return {
      entries: [],
      issue: {
        code: "foreign-structured-source-unrecognized",
        path: candidatePath,
        message: "The structured foreign Markdown source has no recognized table or entry headings.",
        blocking: true
      }
    };
  }
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    return {
      entries: [],
      issue: {
        code: "foreign-structured-source-malformed",
        path: candidatePath,
        message: `The structured foreign source cannot be parsed uniquely: ${document.errors.map((error2) => error2.message).join("; ")}`,
        blocking: true
      }
    };
  }
  const entries = structuredCollection(document.toJS({ mapAsMap: false }), kind);
  if (entries !== void 0) return { entries };
  return {
    entries: [],
    issue: {
      code: "foreign-structured-source-unrecognized",
      path: candidatePath,
      message: "The structured foreign source has no recognized entry collection.",
      blocking: true
    }
  };
}
function entrySources(sourcePath, kind, entries) {
  const occurrences = /* @__PURE__ */ new Map();
  return entries.map((entry) => {
    const fingerprint = sha256(canonicalJson(entry));
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return {
      source_id: `${kind}:${sourcePath}#${fingerprint.slice(0, 20)}:${occurrence}`,
      source_path: sourcePath,
      source_kind: kind,
      fingerprint
    };
  });
}
function selectedForeignFiles(inspection) {
  const directPaths = new Set(
    inspection.signals.filter((signal) => FOREIGN_CATEGORIES.has(signal.category)).map((signal) => signal.path)
  );
  for (const candidate of inspection.foreignCandidates) {
    for (const candidatePath of candidate.paths) directPaths.add(candidatePath);
  }
  const roots = inspection.foreignCandidates.map((candidate) => candidate.root).filter((root) => root !== ".");
  return inspection.inventory.files.filter(
    (file) => directPaths.has(file.path) || roots.some((root) => isInsideForeignRoot(file.path, root))
  );
}
function boundaryIssues(inspection) {
  const roots = inspection.foreignCandidates.map((candidate) => candidate.root).filter((root) => root !== ".");
  const issues = [];
  for (const link of inspection.inventory.symlinks) {
    if (!roots.some((root) => isInsideForeignRoot(link.path, root))) continue;
    issues.push({
      code: "foreign-source-symlink",
      path: link.path,
      message: `Foreign context contains a ${link.boundary} symbolic-link boundary that was not followed.`,
      blocking: true
    });
  }
  for (const exclusion of inspection.inventory.exclusions) {
    if (!roots.some((root) => isInsideForeignRoot(exclusion.path, root))) continue;
    issues.push({
      code: "foreign-source-excluded",
      path: exclusion.path,
      message: `Foreign context crosses an excluded ${exclusion.reason} boundary and cannot be proven complete.`,
      blocking: true
    });
  }
  return issues;
}
function issueKey(issue3) {
  return `${issue3.code}\0${issue3.path}`;
}
function compareSources(left, right) {
  return comparePortablePaths(left.source_path, right.source_path) || comparePortablePaths(left.source_kind, right.source_kind) || comparePortablePaths(left.source_id, right.source_id);
}
function createCoverageTemplate(inventoryDigest2, sources) {
  const records = sources.map((source) => ({
    ...source,
    disposition: "unresolved",
    targets: [],
    evidence: [PENDING_COVERAGE_EVIDENCE]
  }));
  return {
    schema_version: COVERAGE_SCHEMA_VERSION,
    coverage_id: deterministicUlid(canonicalJson([inventoryDigest2, sources])),
    source_inventory_digest: inventoryDigest2,
    records,
    unresolved_count: records.length
  };
}
async function discoverForeignCoverage(root, inspection) {
  if (inspection.state !== "C") {
    throw new AdoptionError(
      "PCP_STATE_C_REQUIRED",
      `Foreign coverage discovery requires a State C candidate, not ${inspection.state}.`
    );
  }
  const sources = [];
  const issues = boundaryIssues(inspection);
  for (const file of selectedForeignFiles(inspection)) {
    sources.push({
      source_id: `${isForeignAdapterSourcePath(file.path) ? "adapter" : "file"}:${file.path}`,
      source_path: file.path,
      source_kind: isForeignAdapterSourcePath(file.path) ? "adapter" : "file",
      fingerprint: file.sha256
    });
    if (file.size > MAXIMUM_STRUCTURED_SOURCE_BYTES) {
      issues.push({
        code: "foreign-source-too-large",
        path: file.path,
        message: "Foreign context exceeds the 4 MiB semantic-review limit.",
        blocking: true
      });
      continue;
    }
    let bytes;
    try {
      bytes = await readFile5(path7.join(root, ...file.path.split("/")));
    } catch (error2) {
      const detail = error2 instanceof Error ? error2.message : String(error2);
      issues.push({
        code: "foreign-source-unreadable",
        path: file.path,
        message: `Foreign context cannot be read: ${detail}`,
        blocking: true
      });
      continue;
    }
    if (sha256(bytes) !== file.sha256) {
      throw new AdoptionError(
        "PCP_SOURCE_CHANGED",
        `Foreign context changed after inventory: ${file.path}`
      );
    }
    if (ENCRYPTED_EXTENSION.test(file.path) || ENCRYPTED_CONTENT.test(bytes.toString("utf8"))) {
      issues.push({
        code: "foreign-source-encrypted",
        path: file.path,
        message: "Encrypted foreign context cannot receive a semantic disposition automatically.",
        blocking: true
      });
      continue;
    }
    if (bytes.subarray(0, Math.min(bytes.length, 8192)).includes(0)) {
      issues.push({
        code: "foreign-source-not-text",
        path: file.path,
        message: "Binary foreign context cannot receive a semantic disposition automatically.",
        blocking: true
      });
      continue;
    }
    let contents;
    try {
      contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      issues.push({
        code: "foreign-source-invalid-utf8",
        path: file.path,
        message: "Foreign context is not valid UTF-8 text.",
        blocking: true
      });
      continue;
    }
    const entryKind = structuredSourceKind(file.path);
    if (entryKind === void 0) continue;
    const parsed = parseStructuredEntries(file.path, contents, entryKind);
    if (parsed.issue !== void 0) issues.push(parsed.issue);
    sources.push(...entrySources(file.path, entryKind, parsed.entries));
  }
  sources.sort(compareSources);
  const uniqueIssues = [...new Map(issues.map((issue3) => [issueKey(issue3), issue3])).values()].sort(
    (left, right) => comparePortablePaths(left.path, right.path) || comparePortablePaths(left.code, right.code)
  );
  return {
    source_inventory_digest: inspection.inventory.digest,
    sources,
    issues: uniqueIssues,
    template: createCoverageTemplate(inspection.inventory.digest, sources)
  };
}
function validateForeignCoverage(catalog, value) {
  const schema4 = new SchemaRegistry().validate("coverage", value);
  if (!schema4.valid) {
    return {
      valid: false,
      diagnostics: schema4.diagnostics.map((diagnostic2) => ({
        code: "coverage-schema-invalid",
        path: diagnostic2.path,
        message: diagnostic2.message
      }))
    };
  }
  const coverage = value;
  const diagnostics = catalog.issues.map((issue3) => ({
    code: issue3.code,
    path: issue3.path,
    message: issue3.message
  }));
  if (coverage.coverage_id !== catalog.template.coverage_id) {
    diagnostics.push({
      code: "coverage-id-mismatch",
      path: "/coverage_id",
      message: "Coverage ID does not match the matrix emitted for this candidate."
    });
  }
  if (coverage.source_inventory_digest !== catalog.source_inventory_digest) {
    diagnostics.push({
      code: "coverage-inventory-mismatch",
      path: "/source_inventory_digest",
      message: "Coverage was prepared against a different candidate inventory."
    });
  }
  const recordsById = /* @__PURE__ */ new Map();
  for (const [index, record] of coverage.records.entries()) {
    if (recordsById.has(record.source_id)) {
      diagnostics.push({
        code: "coverage-source-id-duplicate",
        path: `/records/${index}/source_id`,
        message: `Coverage source ID appears more than once: ${record.source_id}`
      });
    } else {
      recordsById.set(record.source_id, record);
    }
  }
  const expectedById = new Map(catalog.sources.map((source) => [source.source_id, source]));
  for (const source of catalog.sources) {
    const record = recordsById.get(source.source_id);
    if (record === void 0) {
      diagnostics.push({
        code: "coverage-source-missing",
        path: "/records",
        message: `Discovered foreign source has no coverage record: ${source.source_id}`
      });
      continue;
    }
    if (record.source_path !== source.source_path || record.source_kind !== source.source_kind || record.fingerprint !== source.fingerprint) {
      diagnostics.push({
        code: "coverage-source-mismatch",
        path: `/records/${coverage.records.indexOf(record)}`,
        message: `Coverage metadata does not match the discovered source: ${source.source_id}`
      });
    }
  }
  for (const [index, record] of coverage.records.entries()) {
    if (!expectedById.has(record.source_id) && record.source_kind !== "fact") {
      diagnostics.push({
        code: "coverage-source-unexpected",
        path: `/records/${index}`,
        message: `Only explicit fileless facts may extend the discovered source set: ${record.source_id}`
      });
    }
    if (record.disposition === "unresolved") {
      diagnostics.push({
        code: "coverage-source-unresolved",
        path: `/records/${index}/disposition`,
        message: `Foreign source remains unresolved: ${record.source_id}`
      });
    } else if (record.evidence.includes(PENDING_COVERAGE_EVIDENCE)) {
      diagnostics.push({
        code: "coverage-evidence-pending",
        path: `/records/${index}/evidence`,
        message: `Resolved coverage requires concrete evidence: ${record.source_id}`
      });
    }
  }
  const actualUnresolved = coverage.records.filter(
    (record) => record.disposition === "unresolved"
  ).length;
  if (coverage.unresolved_count !== actualUnresolved) {
    diagnostics.push({
      code: "coverage-unresolved-count-mismatch",
      path: "/unresolved_count",
      message: `Declared unresolved_count ${coverage.unresolved_count} does not match ${actualUnresolved} unresolved records.`
    });
  }
  return { valid: diagnostics.length === 0, diagnostics };
}

// src/application/render-platform-adapters.ts
var GENERATED_MARKER = "<!-- PCP: GENERATED; DO NOT EDIT -->";
var CANONICAL_ENTRY = ".pcp/00-index.md";
var targetByAdapter = {
  codex: "AGENTS.md",
  antigravity: ".agents/rules/pcp.md",
  "claude-code-desktop": "CLAUDE.md",
  "github-copilot-vscode": ".github/copilot-instructions.md",
  cursor: ".cursor/rules/pcp.mdc"
};
function sharedBody() {
  return [
    GENERATED_MARKER,
    "",
    "# Persistent Context Protocol",
    "",
    "Canonical project context lives in `.pcp/`; this file is only a platform adapter.",
    "",
    `1. Start at \`${CANONICAL_ENTRY}\`.`,
    "2. Follow its first-task or returning-task path.",
    "3. Read only the state, knowledge, operations, project, and continuity records relevant to the active scope.",
    "4. Update canonical PCP sources when project context changes; do not create independent authority in this adapter.",
    ""
  ];
}
function adapterText(adapterId) {
  const body = sharedBody();
  if (adapterId === "claude-code-desktop") {
    body.splice(6, 1, `1. Read @${CANONICAL_ENTRY} before work.`);
  }
  if (adapterId === "cursor") {
    return [
      "---",
      "description: Route project work through the canonical PCP context",
      "globs:",
      "alwaysApply: true",
      "---",
      "",
      ...body
    ].join("\n");
  }
  return body.join("\n");
}
function renderPlatformAdapters() {
  return SUPPORTED_ADAPTER_IDS.map((adapterId) => {
    const content = Buffer.from(adapterText(adapterId), "utf8");
    return {
      manifest: {
        schema_version: 1,
        adapter_id: adapterId,
        platform: adapterId,
        target_path: targetByAdapter[adapterId],
        source_paths: [CANONICAL_ENTRY],
        ownership: "generated",
        collision_policy: "preview-required",
        content_digest: sha256(content)
      },
      content
    };
  });
}

// src/application/render-canonical-views.ts
import { readFile as readFile7, writeFile as writeFile2 } from "node:fs/promises";
import path9 from "node:path";

// src/domain/canonical-validation.ts
function compareCanonicalDiagnostics(left, right) {
  const leftKey = `${left.path}\0${left.severity}\0${left.code}\0${left.message}`;
  const rightKey = `${right.path}\0${right.severity}\0${right.code}\0${right.message}`;
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}

// src/infrastructure/canonical-source-digest.ts
import { createHash as createHash5 } from "node:crypto";
import { readFile as readFile6 } from "node:fs/promises";
import path8 from "node:path";
function normalizeSource(contents) {
  return contents.replace(/\r\n?/g, "\n");
}
function resolveContained(root, relativePath) {
  const resolvedRoot = path8.resolve(root);
  const resolved = path8.resolve(resolvedRoot, relativePath);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path8.sep}`)) {
    throw new Error(`Canonical source escapes the .pcp root: ${relativePath}`);
  }
  return resolved;
}
function canonicalSourceDigestFromContents(sources) {
  const hash = createHash5("sha256");
  for (const source of [...sources].sort((left, right) => left.path.localeCompare(right.path))) {
    const contents = normalizeSource(source.contents);
    hash.update(source.path);
    hash.update("\0");
    hash.update(String(Buffer.byteLength(contents)));
    hash.update("\0");
    hash.update(contents);
    hash.update("\0");
  }
  return hash.digest("hex");
}
async function canonicalSourceDigest(root, sources) {
  const contents = await Promise.all(
    sources.map(async (source) => ({
      path: source,
      contents: await readFile6(resolveContained(root, source), "utf8")
    }))
  );
  return canonicalSourceDigestFromContents(contents);
}

// src/application/render-canonical-views.ts
var VIEW_PATH = "views/10-status.generated.md";
var PROJECT_VIEW_PATH = `.pcp/${VIEW_PATH}`;
var GENERATED_MARKER2 = "<!-- PCP: GENERATED; DO NOT EDIT -->";
var RENDERER_TEMPLATE_UPDATED_AT = "2026-07-14T07:20:00Z";
var SOURCES = [
  ["state/project.yaml", "project"],
  ["state/projects.yaml", "project-registry"],
  ["state/workstreams.yaml", "workstreams"],
  ["state/vcs-policy.yaml", "vcs-policy"]
];
function objectValue(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Schema-valid canonical source must be an object.");
  }
  return value;
}
function objectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(objectValue);
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function scalar(value) {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
}
function prose(value) {
  return scalar(value).replace(/\s+/g, " ").trim().replace(/\\/g, "\\\\");
}
function tableCell(value) {
  const result = prose(value).replace(/\|/g, "\\|");
  return result.length === 0 ? "\u2014" : result;
}
function code(value) {
  return `\`${scalar(value).replace(/`/g, "\\`")}\``;
}
function codeList(value) {
  const values = stringArray(value);
  return values.length === 0 ? "None." : values.map(code).join(", ");
}
function issue(codeValue, pathValue, message) {
  return { severity: "error", code: codeValue, path: pathValue, message };
}
async function loadSource(layerRoot, relativePath, schema4, registry, diagnostics) {
  let contents;
  try {
    contents = await readFile7(path9.join(layerRoot, relativePath), "utf8");
  } catch (error2) {
    diagnostics.push(
      issue(
        "render.source-read",
        `.pcp/${relativePath}`,
        error2 instanceof Error ? error2.message : "Unable to read canonical render source."
      )
    );
    return void 0;
  }
  const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    for (const error2 of document.errors) {
      diagnostics.push(issue("render.source-yaml", `.pcp/${relativePath}`, error2.message));
    }
    return void 0;
  }
  let value;
  try {
    value = document.toJS({ maxAliasCount: 50 });
  } catch (error2) {
    diagnostics.push(
      issue(
        "render.source-yaml",
        `.pcp/${relativePath}`,
        error2 instanceof Error ? error2.message : "Unable to safely decode render source."
      )
    );
    return void 0;
  }
  const result = registry.validate(schema4, value);
  if (!result.valid) {
    for (const diagnostic2 of result.diagnostics) {
      diagnostics.push(
        issue(
          `render.source-${diagnostic2.keyword}`,
          `.pcp/${relativePath}#${diagnostic2.path === "/" ? "" : diagnostic2.path}`,
          diagnostic2.message
        )
      );
    }
    return void 0;
  }
  return { contents, value: objectValue(value) };
}
function renderProjects(projects) {
  if (projects.length === 0) return ["No managed subprojects are registered."];
  return [
    "| ID | Name | Type | Lifecycle | Artifact roots |",
    "| --- | --- | --- | --- | --- |",
    ...projects.map(
      (project) => `| ${code(project.project_id)} | ${tableCell(project.name)} | ${code(project.project_type)} | ${code(project.lifecycle)} | ${codeList(project.artifact_roots)} |`
    )
  ];
}
function renderWorkstreams(workstreams) {
  if (workstreams.length === 0) return ["No workstreams are registered."];
  return [
    "| ID | Name | Kind | Status | Dependencies | Evidence |",
    "| --- | --- | --- | --- | --- | --- |",
    ...workstreams.map((workstream) => {
      const completion = objectValue(workstream.completion);
      return `| ${code(workstream.workstream_id)} | ${tableCell(workstream.name)} | ${code(workstream.kind)} | ${code(workstream.status)} | ${codeList(workstream.dependencies)} | ${objectArray(completion.evidence).length} item(s) |`;
    })
  ];
}
function renderCanonicalStatusView(sources, sourceDigest) {
  const project = objectValue(sources.get("state/project.yaml"));
  const projectRegistry = objectValue(sources.get("state/projects.yaml"));
  const workstreamRegistry = objectValue(sources.get("state/workstreams.yaml"));
  const vcsPolicy = objectValue(sources.get("state/vcs-policy.yaml"));
  const repository = objectValue(vcsPolicy.repository);
  const workflow = objectValue(vcsPolicy.workflow);
  const lines = [
    "---",
    `doc: ${VIEW_PATH}`,
    "type: generated",
    "status: generated",
    "version: 1.0.0",
    `last_updated: ${RENDERER_TEMPLATE_UPDATED_AT}`,
    "ownership: generated",
    "sources:",
    ...SOURCES.map(([source]) => `  - ${source}`),
    `source_digest: ${sourceDigest}`,
    "---",
    "",
    GENERATED_MARKER2,
    "",
    "# Project status",
    "",
    "Generated from canonical YAML. Edit the source records, then render again.",
    "",
    "## Project",
    "",
    `- ID: ${code(project.project_id)}`,
    `- Name: ${prose(project.name)}`,
    `- Purpose: ${prose(project.purpose)}`,
    `- Type: ${code(project.project_type)}`,
    `- Lifecycle: ${code(project.lifecycle)}`,
    `- Artifact roots: ${codeList(project.artifact_roots)}`,
    `- Context roots: ${codeList(project.context_roots)}`,
    "",
    "## Managed projects",
    "",
    ...renderProjects(objectArray(projectRegistry.projects)),
    "",
    "## Workstreams",
    "",
    ...renderWorkstreams(objectArray(workstreamRegistry.workstreams)),
    "",
    "## Version control",
    "",
    `- Mode: ${code(vcsPolicy.mode)}`,
    `- System: ${code(vcsPolicy.system)}`,
    `- Provider: ${code(vcsPolicy.provider)}`,
    `- Default branch: ${code(repository.default_branch)}`,
    `- Commit signing: ${code(workflow.commit_signing)}`,
    `- Push cadence: ${code(workflow.push_cadence)}`,
    `- Pull request policy: ${code(workflow.pull_request_policy)}`,
    `- Human merge required: ${code(workflow.human_merge_required)}`,
    ""
  ];
  return lines.join("\n");
}
async function renderCanonicalViews(projectRoot, options = {}) {
  const layerRoot = path9.join(path9.resolve(projectRoot), ".pcp");
  const diagnostics = [];
  const registry = new SchemaRegistry();
  const loadedSources = /* @__PURE__ */ new Map();
  for (const [relativePath, schema4] of SOURCES) {
    const source = await loadSource(layerRoot, relativePath, schema4, registry, diagnostics);
    if (source !== void 0) loadedSources.set(relativePath, source);
  }
  if (diagnostics.length > 0) {
    diagnostics.sort(compareCanonicalDiagnostics);
    return {
      valid: false,
      mode: options.check === true ? "check" : "write",
      changed_paths: [],
      diagnostics
    };
  }
  const digest2 = canonicalSourceDigestFromContents(
    [...loadedSources].map(([sourcePath, source]) => ({
      path: sourcePath,
      contents: source.contents
    }))
  );
  let currentSourceDigest;
  try {
    currentSourceDigest = await canonicalSourceDigest(
      layerRoot,
      SOURCES.map(([source]) => source)
    );
  } catch (error2) {
    diagnostics.push(
      issue(
        "render.source-digest",
        ".pcp/state",
        error2 instanceof Error ? error2.message : "Unable to fingerprint render sources."
      )
    );
    return {
      valid: false,
      mode: options.check === true ? "check" : "write",
      changed_paths: [],
      diagnostics
    };
  }
  if (currentSourceDigest !== digest2) {
    return {
      valid: false,
      mode: options.check === true ? "check" : "write",
      changed_paths: [],
      diagnostics: [
        issue(
          "render.source-drift",
          ".pcp/state",
          "Canonical render sources changed while the render snapshot was being built."
        )
      ]
    };
  }
  const sources = new Map(
    [...loadedSources].map(([sourcePath, source]) => [sourcePath, source.value])
  );
  const desired = renderCanonicalStatusView(sources, digest2);
  const absoluteViewPath = path9.join(layerRoot, VIEW_PATH);
  let current;
  try {
    current = await readFile7(absoluteViewPath, "utf8");
  } catch (error2) {
    if (error2.code !== "ENOENT") {
      diagnostics.push(
        issue(
          "render.view-read",
          PROJECT_VIEW_PATH,
          error2 instanceof Error ? error2.message : "Unable to read generated view."
        )
      );
    }
  }
  if (diagnostics.length > 0) {
    diagnostics.sort(compareCanonicalDiagnostics);
    return {
      valid: false,
      mode: options.check === true ? "check" : "write",
      changed_paths: [],
      diagnostics
    };
  }
  if (current === desired) {
    return {
      valid: true,
      mode: options.check === true ? "check" : "write",
      changed_paths: [],
      diagnostics: []
    };
  }
  if (options.check === true) {
    return {
      valid: false,
      mode: "check",
      changed_paths: [PROJECT_VIEW_PATH],
      diagnostics: [
        issue("render.stale", PROJECT_VIEW_PATH, "Generated status view is missing or stale.")
      ]
    };
  }
  try {
    await writeFile2(absoluteViewPath, desired, "utf8");
  } catch (error2) {
    return {
      valid: false,
      mode: "write",
      changed_paths: [],
      diagnostics: [
        issue(
          "render.view-write",
          PROJECT_VIEW_PATH,
          error2 instanceof Error ? error2.message : "Unable to write generated view."
        )
      ]
    };
  }
  return {
    valid: true,
    mode: "write",
    changed_paths: [PROJECT_VIEW_PATH],
    diagnostics: []
  };
}

// src/application/validate-canonical-layer.ts
import { readdir as readdir2, readFile as readFile9, stat as stat2 } from "node:fs/promises";
import path11 from "node:path";

// src/domain/recording.ts
import { createHash as createHash6 } from "node:crypto";
function eventPayloadDigest(payload) {
  return createHash6("sha256").update(canonicalJson(payload)).digest("hex");
}
var RecordingError = class extends Error {
  constructor(code2, message, mutated = false, recovery_retained = false) {
    super(message);
    this.code = code2;
    this.mutated = mutated;
    this.recovery_retained = recovery_retained;
    this.name = "RecordingError";
  }
  code;
  mutated;
  recovery_retained;
};
function nextEventId(existingIds, now = Date.now()) {
  const newest = [...existingIds].sort((left, right) => left.localeCompare(right)).at(-1);
  const timestamp2 = newest === void 0 ? now : Math.max(now, decodeTime(newest) + 1);
  return ulid(timestamp2);
}

// src/domain/canonical-semantics.ts
function objectValue2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function objectArray2(value) {
  return Array.isArray(value) ? value.map(objectValue2).filter((item) => item !== void 0) : [];
}
function stringArray2(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function error(code2, path18, message) {
  return { severity: "error", code: code2, path: path18, message };
}
function validateProjectIdentity(records) {
  const diagnostics = [];
  const seen = /* @__PURE__ */ new Map();
  const rootProject = objectValue2(records.project?.value);
  const rootId = stringValue(rootProject?.project_id);
  if (rootId !== void 0 && records.project !== void 0) seen.set(rootId, records.project.path);
  const registry = objectValue2(records.project_registry?.value);
  for (const project of objectArray2(registry?.projects)) {
    const projectId = stringValue(project.project_id);
    if (projectId === void 0 || records.project_registry === void 0) continue;
    const previous = seen.get(projectId);
    if (previous !== void 0) {
      diagnostics.push(
        error(
          "identity.duplicate-project",
          records.project_registry.path,
          `Project ID ${projectId} duplicates ${previous}.`
        )
      );
    } else {
      seen.set(projectId, records.project_registry.path);
    }
  }
  return diagnostics;
}
function validateWorkstreams(records) {
  if (records.workstreams === void 0) return [];
  const diagnostics = [];
  const root = objectValue2(records.workstreams.value);
  const workstreams = objectArray2(root?.workstreams);
  const byId = /* @__PURE__ */ new Map();
  for (const workstream of workstreams) {
    const id = stringValue(workstream.workstream_id);
    if (id === void 0) continue;
    if (byId.has(id)) {
      diagnostics.push(
        error(
          "identity.duplicate-workstream",
          records.workstreams.path,
          `Workstream ID ${id} is not unique.`
        )
      );
    } else {
      byId.set(id, workstream);
    }
  }
  for (const [id, workstream] of byId) {
    for (const dependency of stringArray2(workstream.dependencies)) {
      if (dependency === id) {
        diagnostics.push(
          error(
            "workstream.self-dependency",
            records.workstreams.path,
            `Workstream ${id} depends on itself.`
          )
        );
      } else if (!byId.has(dependency)) {
        diagnostics.push(
          error(
            "workstream.missing-dependency",
            records.workstreams.path,
            `Workstream ${id} depends on unknown workstream ${dependency}.`
          )
        );
      }
    }
    const completion = objectValue2(workstream.completion);
    const criteria = stringArray2(completion?.criteria);
    const evidence = objectArray2(completion?.evidence);
    const evidenceCounts = /* @__PURE__ */ new Map();
    for (const item of evidence) {
      const criterion = stringValue(item.criterion);
      if (criterion === void 0) continue;
      evidenceCounts.set(criterion, (evidenceCounts.get(criterion) ?? 0) + 1);
      if (!criteria.includes(criterion)) {
        diagnostics.push(
          error(
            "workstream.evidence-unknown-criterion",
            records.workstreams.path,
            `Workstream ${id} has evidence for an unknown criterion: ${criterion}`
          )
        );
      }
    }
    for (const [criterion, count] of evidenceCounts) {
      if (count > 1) {
        diagnostics.push(
          error(
            "workstream.duplicate-criterion-evidence",
            records.workstreams.path,
            `Workstream ${id} has multiple evidence records for criterion: ${criterion}`
          )
        );
      }
    }
    if (workstream.status === "complete") {
      if (evidence.length === 0) {
        diagnostics.push(
          error(
            "workstream.completion-without-evidence",
            records.workstreams.path,
            `Complete workstream ${id} has no completion evidence.`
          )
        );
      }
      for (const criterion of criteria) {
        if (!evidenceCounts.has(criterion)) {
          diagnostics.push(
            error(
              "workstream.criterion-without-evidence",
              records.workstreams.path,
              `Complete workstream ${id} has no evidence for criterion: ${criterion}`
            )
          );
        }
      }
      for (const dependency of stringArray2(workstream.dependencies)) {
        const dependencyState = byId.get(dependency);
        if (dependencyState !== void 0 && dependencyState.status !== "complete") {
          diagnostics.push(
            error(
              "workstream.incomplete-dependency",
              records.workstreams.path,
              `Complete workstream ${id} depends on incomplete workstream ${dependency}.`
            )
          );
        }
      }
      const announcement = stringValue(completion?.announcement);
      if (announcement === void 0 || announcement.trim().length === 0) {
        diagnostics.push(
          error(
            "workstream.completion-without-announcement",
            records.workstreams.path,
            `Complete workstream ${id} has no completion announcement.`
          )
        );
      }
    } else if (completion?.announcement !== void 0) {
      diagnostics.push(
        error(
          "workstream.announcement-before-completion",
          records.workstreams.path,
          `Workstream ${id} cannot announce completion while its status is ${String(workstream.status)}.`
        )
      );
    }
  }
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  function visit3(id, trail) {
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      const cycle = [...trail.slice(Math.max(start, 0)), id];
      diagnostics.push(
        error(
          "workstream.dependency-cycle",
          records.workstreams?.path ?? "state/workstreams.yaml",
          `Workstream dependency cycle: ${cycle.join(" -> ")}.`
        )
      );
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const workstream = byId.get(id);
    for (const dependency of stringArray2(workstream?.dependencies)) {
      if (byId.has(dependency)) visit3(dependency, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit3(id, []);
  return diagnostics;
}
function validateActors(records) {
  const diagnostics = [];
  const seen = /* @__PURE__ */ new Map();
  for (const record of records.actors) {
    const profile = objectValue2(record.value);
    const id = stringValue(profile?.actor_id);
    if (id === void 0) continue;
    const expectedName = `${id}.yaml`;
    if (!record.path.endsWith(`/${expectedName}`)) {
      diagnostics.push(
        error(
          "identity.actor-filename-mismatch",
          record.path,
          `Actor profile filename must be ${expectedName}.`
        )
      );
    }
    const actorType = stringValue(profile?.actor_type);
    const client = stringValue(profile?.client);
    const machineLabel = stringValue(profile?.machine_label);
    const actorLabel = actorType === "human" ? "human" : client;
    if (actorLabel !== void 0 && machineLabel !== void 0 && !id.startsWith(`${actorLabel}-${machineLabel}-`)) {
      diagnostics.push(
        error(
          "identity.actor-id-components",
          record.path,
          `Actor ID must start with ${actorLabel}-${machineLabel}-.`
        )
      );
    }
    const previous = seen.get(id);
    if (previous !== void 0) {
      diagnostics.push(
        error("identity.duplicate-actor", record.path, `Actor ID ${id} duplicates ${previous}.`)
      );
    } else {
      seen.set(id, record.path);
    }
  }
  return diagnostics;
}
function validateEvents(records) {
  const diagnostics = [];
  const seen = /* @__PURE__ */ new Map();
  const changeKeys = /* @__PURE__ */ new Map();
  const activeEvents = [];
  const archivedEvents = [];
  const actorTypes = new Map(
    records.actors.map((record) => {
      const profile = objectValue2(record.value);
      return [stringValue(profile?.actor_id), stringValue(profile?.actor_type)];
    }).filter(
      (entry) => entry[0] !== void 0 && entry[1] !== void 0
    )
  );
  const workstreamRoot = objectValue2(records.workstreams?.value);
  const workstreamIds = new Set(
    objectArray2(workstreamRoot?.workstreams).map((workstream) => stringValue(workstream.workstream_id)).filter((id) => id !== void 0)
  );
  for (const record of records.events) {
    const event = objectValue2(record.value);
    const id = stringValue(event?.event_id);
    if (id === void 0) continue;
    const expectedName = `${id}.yaml`;
    if (!record.path.endsWith(`/${expectedName}`)) {
      diagnostics.push(
        error("event.filename-mismatch", record.path, `Event filename must be ${expectedName}.`)
      );
    }
    const previous = seen.get(id);
    if (previous !== void 0) {
      diagnostics.push(
        error("event.duplicate", record.path, `Event ID ${id} duplicates ${previous}.`)
      );
    } else {
      seen.set(id, record.path);
    }
    const payloadDigest = stringValue(event?.payload_digest);
    if (payloadDigest !== void 0 && event !== void 0) {
      const payload = { ...event };
      delete payload.payload_digest;
      if (eventPayloadDigest(payload) !== payloadDigest) {
        diagnostics.push(
          error(
            "event.payload-digest-mismatch",
            record.path,
            `Event ${id} payload no longer matches its recorded digest.`
          )
        );
      }
    }
    const changeKey = stringValue(event?.change_key);
    if (changeKey !== void 0) {
      const previousChange = changeKeys.get(changeKey);
      if (previousChange !== void 0) {
        diagnostics.push(
          error(
            "event.duplicate-change-key",
            record.path,
            `Change key ${changeKey} duplicates ${previousChange}.`
          )
        );
      } else {
        changeKeys.set(changeKey, record.path);
      }
    }
    (record.path.startsWith("continuity/archive/") ? archivedEvents : activeEvents).push({
      id,
      path: record.path
    });
    const actor = objectValue2(event?.actor);
    const recorder = objectValue2(event?.recorded_by);
    const actorType = stringValue(actor?.type);
    const actorId = stringValue(actor?.id);
    const recorderType = stringValue(recorder?.type);
    const recorderId = stringValue(recorder?.id);
    const basis = stringValue(event?.basis);
    for (const [role, referenceType, referenceId] of [
      ["actor", actorType, actorId],
      ["recorder", recorderType, recorderId]
    ]) {
      if ((referenceType === "human" || referenceType === "agent") && referenceId !== void 0) {
        const profileType = actorTypes.get(referenceId);
        if (profileType === void 0) {
          diagnostics.push(
            error(
              `event.unknown-${role}`,
              record.path,
              `Event ${role} references unknown ${referenceType} ${referenceId}.`
            )
          );
        } else if (profileType !== referenceType) {
          diagnostics.push(
            error(
              `event.${role}-type-mismatch`,
              record.path,
              `Event ${role} type ${referenceType} does not match profile type ${profileType}.`
            )
          );
        }
      }
    }
    const sameIdentity2 = actorType === recorderType && actorId === recorderId;
    if (basis === "self" && !sameIdentity2) {
      diagnostics.push(
        error(
          "event.self-recorder-mismatch",
          record.path,
          "A self-recorded event must name the same actor and recorder."
        )
      );
    }
    if ((basis === "reported" || basis === "observed") && sameIdentity2) {
      diagnostics.push(
        error(
          "event.external-basis-self-recorded",
          record.path,
          `A ${basis} event must be recorded by a different actor.`
        )
      );
    }
    if (basis === "system" && (actorType !== "system" || recorderType !== "system")) {
      diagnostics.push(
        error(
          "event.system-basis-mismatch",
          record.path,
          "A system-basis event must name system as both actor and recorder."
        )
      );
    }
    if (basis !== "system" && (actorType === "system" || recorderType === "system")) {
      diagnostics.push(
        error(
          "event.system-reference-basis",
          record.path,
          "A system actor or recorder requires a system-basis event."
        )
      );
    }
    for (const workstreamId of stringArray2(event?.workstreams)) {
      if (!workstreamIds.has(workstreamId)) {
        diagnostics.push(
          error(
            "event.unknown-workstream",
            record.path,
            `Event references unknown workstream ${workstreamId}.`
          )
        );
      }
    }
  }
  const oldestActive = activeEvents.sort((left, right) => left.id.localeCompare(right.id))[0];
  const newestArchive = archivedEvents.sort((left, right) => left.id.localeCompare(right.id)).at(-1);
  if (oldestActive !== void 0 && newestArchive !== void 0 && newestArchive.id.localeCompare(oldestActive.id) >= 0) {
    diagnostics.push(
      error(
        "event.archive-order",
        newestArchive.path,
        `Archived event ${newestArchive.id} must be older than the active-event floor ${oldestActive.id}.`
      )
    );
  }
  return diagnostics;
}
function validateCheckpoints(records) {
  const diagnostics = [];
  const checkpointIdentities = /* @__PURE__ */ new Map();
  const actorTypes = new Map(
    records.actors.map((record) => {
      const profile = objectValue2(record.value);
      return [stringValue(profile?.actor_id), stringValue(profile?.actor_type)];
    }).filter(
      (entry) => entry[0] !== void 0 && entry[1] !== void 0
    )
  );
  const eventIds = new Set(
    records.events.map((record) => stringValue(objectValue2(record.value)?.event_id)).filter((id) => id !== void 0)
  );
  const workstreamRoot = objectValue2(records.workstreams?.value);
  const workstreamIds = new Set(
    objectArray2(workstreamRoot?.workstreams).map((workstream) => stringValue(workstream.workstream_id)).filter((id) => id !== void 0)
  );
  for (const record of records.checkpoints) {
    const checkpoint = objectValue2(record.value);
    const checkpointId = stringValue(checkpoint?.checkpoint_id);
    if (checkpointId !== void 0 && !record.path.endsWith(`/${checkpointId}.yaml`)) {
      diagnostics.push(
        error(
          "checkpoint.filename-mismatch",
          record.path,
          `Checkpoint filename must be ${checkpointId}.yaml.`
        )
      );
    }
    const actorId = stringValue(checkpoint?.actor_id);
    if (actorId !== void 0) {
      const actorType = actorTypes.get(actorId);
      if (actorType === void 0) {
        diagnostics.push(
          error(
            "checkpoint.unknown-actor",
            record.path,
            `Checkpoint references unknown actor ${actorId}.`
          )
        );
      } else if (actorType !== "agent") {
        diagnostics.push(
          error(
            "checkpoint.human-actor",
            record.path,
            `Checkpoint actor ${actorId} must be an agent.`
          )
        );
      }
    }
    const workstreamId = stringValue(checkpoint?.workstream_id);
    if (workstreamId !== void 0 && !workstreamIds.has(workstreamId)) {
      diagnostics.push(
        error(
          "checkpoint.unknown-workstream",
          record.path,
          `Checkpoint references unknown workstream ${workstreamId}.`
        )
      );
    }
    for (const dependency of stringArray2(checkpoint?.dependencies)) {
      if (!workstreamIds.has(dependency)) {
        diagnostics.push(
          error(
            "checkpoint.unknown-dependency",
            record.path,
            `Checkpoint references unknown dependency workstream ${dependency}.`
          )
        );
      }
    }
    const eventId = stringValue(checkpoint?.last_event_id);
    if (eventId !== void 0 && !eventIds.has(eventId)) {
      diagnostics.push(
        error(
          "checkpoint.unknown-event",
          record.path,
          `Checkpoint references unknown event ${eventId}.`
        )
      );
    }
    if (actorId !== void 0) {
      const identity = JSON.stringify({
        actor_id: actorId,
        workstream_id: workstreamId ?? null,
        scopes: stringArray2(checkpoint?.scopes).sort(),
        paths: stringArray2(checkpoint?.paths).sort(),
        dependencies: stringArray2(checkpoint?.dependencies).sort()
      });
      const previous = checkpointIdentities.get(identity);
      if (previous !== void 0) {
        diagnostics.push(
          error(
            "checkpoint.duplicate-scope",
            record.path,
            `Checkpoint duplicates the actor and scope identity in ${previous}.`
          )
        );
      } else {
        checkpointIdentities.set(identity, record.path);
      }
    }
  }
  return diagnostics;
}
function validateVcsPolicy(records) {
  if (records.vcs_policy === void 0) return [];
  const policy = objectValue2(records.vcs_policy.value);
  const responsibilities = objectValue2(policy?.responsibilities);
  if (responsibilities?.manage_credentials === "agent") {
    return [
      error(
        "vcs.agent-credential-management",
        records.vcs_policy.path,
        "Agents cannot be assigned credential management; use a human, external system, or prohibited."
      )
    ];
  }
  return [];
}
function validateCanonicalSemantics(records) {
  return [
    ...validateProjectIdentity(records),
    ...validateWorkstreams(records),
    ...validateActors(records),
    ...validateEvents(records),
    ...validateCheckpoints(records),
    ...validateVcsPolicy(records)
  ];
}

// src/infrastructure/canonical-markdown.ts
function lineNumber(contents, offset) {
  return contents.slice(0, offset).split(/\r?\n/).length;
}
function parseCanonicalMarkdown(contents) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(contents);
  if (match?.[1] === void 0) {
    throw new Error("Canonical Markdown must start with a YAML frontmatter block.");
  }
  const links = [];
  const expression = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const link of contents.matchAll(expression)) {
    const target = link[1]?.trim();
    if (target !== void 0 && target.length > 0) {
      links.push({ target, line: lineNumber(contents, link.index) });
    }
  }
  return {
    frontmatter: parse(match[1]),
    body: contents.slice(match[0].length),
    links
  };
}

// src/infrastructure/canonical-ownership.ts
var OWNERSHIP_CLASSES = ["protocol", "project", "generated", "runtime"];
function escapeRegularExpression(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}
function globToRegularExpression(glob) {
  let expression = "^";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === "*") {
      if (glob[index + 1] === "*") {
        expression += ".*";
        index += 1;
      } else {
        expression += "[^/]*";
      }
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += escapeRegularExpression(character);
    }
  }
  return new RegExp(`${expression}$`);
}
function matchingOwnershipClasses(relativePath, patterns) {
  return OWNERSHIP_CLASSES.filter(
    (ownership) => patterns[ownership].some((pattern) => globToRegularExpression(pattern).test(relativePath))
  );
}

// src/application/validate-platform-adapters.ts
import { lstat as lstat4, readFile as readFile8 } from "node:fs/promises";
import path10 from "node:path";
function isInside2(root, candidate) {
  const relative = path10.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path10.sep}`) && relative !== ".." && !path10.isAbsolute(relative);
}
function absoluteTarget(root, portablePath2) {
  const normalized = path10.posix.normalize(portablePath2);
  if (portablePath2 === "." || normalized !== portablePath2 || portablePath2.startsWith("/") || portablePath2.includes("\\")) {
    return void 0;
  }
  const target = path10.resolve(root, ...portablePath2.split("/"));
  return isInside2(root, target) && target !== path10.resolve(root) ? target : void 0;
}
function compareDiagnostics2(left, right) {
  return comparePortablePaths(left.path, right.path) || comparePortablePaths(left.code, right.code);
}
async function validateRegularFile(root, portablePath2, code2, diagnostics) {
  const target = absoluteTarget(root, portablePath2);
  if (target === void 0) {
    diagnostics.push({ code: `${code2}.path`, path: portablePath2, message: "Path escapes root." });
    return void 0;
  }
  try {
    const metadata = await lstat4(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      diagnostics.push({
        code: `${code2}.type`,
        path: portablePath2,
        message: "Expected a regular file with no symbolic-link boundary."
      });
      return void 0;
    }
    return await readFile8(target);
  } catch (error2) {
    diagnostics.push({
      code: `${code2}.read`,
      path: portablePath2,
      message: error2 instanceof Error ? error2.message : String(error2)
    });
    return void 0;
  }
}
async function validatePlatformAdapters(root, adapters) {
  const diagnostics = [];
  const registry = new SchemaRegistry();
  const ids = /* @__PURE__ */ new Set();
  const targets = /* @__PURE__ */ new Set();
  if (canonicalJson(adapters.map((adapter) => adapter.adapter_id)) !== canonicalJson(SUPPORTED_ADAPTER_IDS)) {
    diagnostics.push({
      code: "adapter.set",
      path: ".pcp/pcp.yaml",
      message: "Adapter manifests do not match the complete ordered platform contract."
    });
  }
  for (const adapter of adapters) {
    const schema4 = registry.validate("adapter", adapter);
    diagnostics.push(
      ...schema4.diagnostics.map((item) => ({
        code: `adapter.schema.${item.keyword}`,
        path: `${adapter.adapter_id}${item.path}`,
        message: item.message
      }))
    );
    if (ids.has(adapter.adapter_id)) {
      diagnostics.push({
        code: "adapter.id-duplicate",
        path: adapter.adapter_id,
        message: "Adapter ID appears more than once."
      });
    }
    if (targets.has(adapter.target_path)) {
      diagnostics.push({
        code: "adapter.target-duplicate",
        path: adapter.target_path,
        message: "Adapter target appears more than once."
      });
    }
    ids.add(adapter.adapter_id);
    targets.add(adapter.target_path);
    const bytes = await validateRegularFile(
      root,
      adapter.target_path,
      "adapter.target",
      diagnostics
    );
    if (bytes !== void 0 && sha256(bytes) !== adapter.content_digest) {
      diagnostics.push({
        code: "adapter.digest",
        path: adapter.target_path,
        message: "Adapter content does not match its generated digest."
      });
    }
    for (const source of adapter.source_paths) {
      await validateRegularFile(root, source, "adapter.source", diagnostics);
    }
  }
  const manifestBytes = await validateRegularFile(
    root,
    ".pcp/pcp.yaml",
    "adapter.manifest",
    diagnostics
  );
  if (manifestBytes !== void 0) {
    const document = parseDocument(manifestBytes.toString("utf8"), {
      prettyErrors: false,
      strict: true,
      uniqueKeys: true
    });
    if (document.errors.length > 0) {
      diagnostics.push({
        code: "adapter.manifest.parse",
        path: ".pcp/pcp.yaml",
        message: document.errors.map((error2) => error2.message).join("; ")
      });
    } else {
      let value;
      try {
        value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
      } catch (error2) {
        diagnostics.push({
          code: "adapter.manifest.decode",
          path: ".pcp/pcp.yaml",
          message: error2 instanceof Error ? error2.message : String(error2)
        });
      }
      if (value !== void 0) {
        const adapterIds = typeof value === "object" && value !== null && !Array.isArray(value) ? value.adapter_ids : void 0;
        const expected = adapters.map((adapter) => adapter.adapter_id);
        if (canonicalJson(adapterIds) !== canonicalJson(expected)) {
          diagnostics.push({
            code: "adapter.manifest.ids",
            path: ".pcp/pcp.yaml",
            message: "Manifest adapter_ids do not match the generated adapter set."
          });
        }
      }
    }
  }
  diagnostics.sort(compareDiagnostics2);
  return {
    valid: diagnostics.length === 0,
    checked_adapters: adapters.length,
    diagnostics
  };
}

// src/application/validate-canonical-layer.ts
var GENERATED_MARKER3 = "<!-- PCP: GENERATED; DO NOT EDIT -->";
var REQUIRED_CANONICAL_PATHS = [
  ".gitignore",
  "00-index.md",
  "continuity/00-index.md",
  "continuity/actors/00-index.md",
  "continuity/archive/00-index.md",
  "continuity/checkpoints/00-index.md",
  "continuity/events/00-index.md",
  "knowledge/00-index.md",
  "operations/00-index.md",
  "pcp.yaml",
  "projects/00-index.md",
  "protocol/00-index.md",
  "references/00-index.md",
  "schemas/00-index.md",
  "state/00-index.md",
  "state/project.yaml",
  "state/projects.yaml",
  "state/vcs-policy.yaml",
  "state/workstreams.yaml",
  "templates/00-index.md",
  "tools/00-index.md",
  "views/00-index.md"
];
var TEXT_FILE_PATTERN = /(?:\.md|\.ya?ml|\.json|\.mjs|\.js|\.ts|\.txt|\.gitignore)$/i;
var WINDOWS_ABSOLUTE_PATH = /\b[A-Za-z]:[\\/][^\s`"'<>]+/;
var FILE_URI = /^file:\/\//i;
var SECRET_PATTERNS = [
  ["secret.private-key", /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/],
  ["secret.aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["secret.github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["secret.openai-key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  [
    "secret.assignment",
    /\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{12,}/i
  ]
];
function objectValue3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function stringArray3(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : void 0;
}
function relativeFrom(root, target) {
  return path11.relative(root, target).split(path11.sep).join("/");
}
function isInside3(root, target) {
  const resolvedRoot = path11.resolve(root);
  const resolvedTarget = path11.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path11.sep}`);
}
function issue2(code2, relativePath, message) {
  return { severity: "error", code: code2, path: relativePath, message };
}
async function collectFiles2(directory, layerRoot, diagnostics) {
  const files = [];
  let entries;
  try {
    entries = await readdir2(directory, { withFileTypes: true });
  } catch (error2) {
    diagnostics.push(
      issue2(
        "filesystem.read-failed",
        relativeFrom(layerRoot, directory) || ".",
        error2 instanceof Error ? error2.message : "Unable to read canonical directory."
      )
    );
    return files;
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path11.join(directory, entry.name);
    const relativePath = relativeFrom(layerRoot, absolutePath);
    if (entry.isSymbolicLink()) {
      diagnostics.push(
        issue2("path.symlink", relativePath, "Symlinks are not allowed inside the canonical layer.")
      );
    } else if (entry.isDirectory()) {
      files.push(...await collectFiles2(absolutePath, layerRoot, diagnostics));
    } else if (entry.isFile()) {
      files.push({ absolute_path: absolutePath, relative_path: relativePath });
    }
  }
  return files;
}
function schemaForPath(relativePath) {
  if (relativePath === "pcp.yaml") return "pcp-manifest";
  if (relativePath === "state/project.yaml") return "project";
  if (relativePath === "state/projects.yaml") return "project-registry";
  if (relativePath === "state/workstreams.yaml") return "workstreams";
  if (relativePath === "state/vcs-policy.yaml") return "vcs-policy";
  if (/^continuity\/actors\/[^/]+\.yaml$/.test(relativePath)) return "actor-profile";
  if (/^continuity\/(?:events|archive)\/[^/]+\.yaml$/.test(relativePath)) {
    return "event";
  }
  if (/^continuity\/checkpoints\/[^/]+\.yaml$/.test(relativePath)) return "checkpoint";
  return void 0;
}
function addSemanticRecord(records, record) {
  if (record.path === "state/project.yaml") records.project = record;
  if (record.path === "state/projects.yaml") records.project_registry = record;
  if (record.path === "state/workstreams.yaml") records.workstreams = record;
  if (record.path === "state/vcs-policy.yaml") records.vcs_policy = record;
  if (record.schema === "actor-profile") records.actors.push(record);
  if (record.schema === "event") records.events.push(record);
  if (record.schema === "checkpoint") records.checkpoints.push(record);
}
function ownershipPatterns(manifest) {
  const ownership = objectValue3(objectValue3(manifest)?.ownership);
  if (ownership === void 0) return void 0;
  const protocol = stringArray3(ownership.protocol);
  const project = stringArray3(ownership.project);
  const generated = stringArray3(ownership.generated);
  const runtime = stringArray3(ownership.runtime);
  return protocol !== void 0 && project !== void 0 && generated !== void 0 && runtime !== void 0 ? { protocol, project, generated, runtime } : void 0;
}
function pathNumber(fileName) {
  const match = /^(\d+)-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.generated)?\.md$/.exec(fileName);
  return match?.[1] === void 0 ? void 0 : Number(match[1]);
}
function normalizedLinkTarget(target) {
  const withoutAngles = target.startsWith("<") && target.endsWith(">") ? target.slice(1, -1) : target;
  return withoutAngles.split("#", 1)[0]?.split("?", 1)[0] ?? "";
}
async function validateMarkdownLinks(projectRoot, layerRoot, records, diagnostics) {
  const graph = /* @__PURE__ */ new Map();
  const canonicalMarkdown = new Set(records.map((record) => path11.resolve(record.absolute_path)));
  for (const record of records) {
    const edges = /* @__PURE__ */ new Set();
    graph.set(path11.resolve(record.absolute_path), edges);
    for (const link of record.parsed.links) {
      const diagnosticPath = `${record.relative_path}:${link.line}`;
      const rawTarget = link.target;
      if (rawTarget.startsWith("#")) continue;
      if (FILE_URI.test(rawTarget)) {
        diagnostics.push(issue2("link.file-uri", diagnosticPath, "file:// links are not portable."));
        continue;
      }
      if (WINDOWS_ABSOLUTE_PATH.test(rawTarget) || rawTarget.startsWith("/")) {
        diagnostics.push(
          issue2("link.absolute", diagnosticPath, `Link must be repository-relative: ${rawTarget}`)
        );
        continue;
      }
      if (rawTarget.includes("\\")) {
        diagnostics.push(
          issue2("link.backslash", diagnosticPath, `Link must use forward slashes: ${rawTarget}`)
        );
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(rawTarget)) {
        if (!/^(?:https?|mailto):/i.test(rawTarget)) {
          diagnostics.push(
            issue2(
              "link.unsupported-scheme",
              diagnosticPath,
              `Unsupported link scheme: ${rawTarget}`
            )
          );
        }
        continue;
      }
      let relativeTarget;
      try {
        relativeTarget = decodeURIComponent(normalizedLinkTarget(rawTarget));
      } catch {
        diagnostics.push(
          issue2("link.encoding", diagnosticPath, `Invalid URL encoding: ${rawTarget}`)
        );
        continue;
      }
      if (relativeTarget.length === 0) continue;
      const target = path11.resolve(path11.dirname(record.absolute_path), relativeTarget);
      if (!isInside3(projectRoot, target)) {
        diagnostics.push(
          issue2(
            "link.outside-project",
            diagnosticPath,
            `Link escapes the project root: ${rawTarget}`
          )
        );
        continue;
      }
      try {
        await stat2(target);
      } catch {
        diagnostics.push(
          issue2("link.missing", diagnosticPath, `Link target does not exist: ${rawTarget}`)
        );
        continue;
      }
      if (isInside3(layerRoot, target) && canonicalMarkdown.has(target)) edges.add(target);
    }
  }
  return graph;
}
function validateMarkdownStructure(layerRoot, records, graph, diagnostics) {
  const byDirectory = /* @__PURE__ */ new Map();
  for (const record of records) {
    const directory = path11.dirname(record.absolute_path);
    const siblings = byDirectory.get(directory) ?? [];
    siblings.push(record);
    byDirectory.set(directory, siblings);
    const number = pathNumber(path11.basename(record.absolute_path));
    if (number === void 0) {
      diagnostics.push(
        issue2(
          "markdown.numbering",
          record.relative_path,
          "Canonical Markdown filenames must use a numeric kebab-case prefix."
        )
      );
    } else if (number % 10 !== 0) {
      diagnostics.push(
        issue2(
          "markdown.increment",
          record.relative_path,
          "Canonical Markdown numbers must use increments of ten."
        )
      );
    }
  }
  for (const [directory, siblings] of byDirectory) {
    const index = siblings.find((record) => path11.basename(record.absolute_path) === "00-index.md");
    if (index === void 0) {
      diagnostics.push(
        issue2(
          "index.missing",
          relativeFrom(layerRoot, directory) || ".",
          "Every canonical Markdown folder must contain 00-index.md."
        )
      );
      continue;
    }
    const seenNumbers = /* @__PURE__ */ new Map();
    for (const sibling of siblings) {
      const number = pathNumber(path11.basename(sibling.absolute_path));
      if (number === void 0) continue;
      const previous = seenNumbers.get(number);
      if (previous !== void 0) {
        diagnostics.push(
          issue2(
            "markdown.duplicate-number",
            sibling.relative_path,
            `Reading-order number ${number} duplicates ${previous}.`
          )
        );
      } else {
        seenNumbers.set(number, sibling.relative_path);
      }
    }
    const indexTargets = graph.get(path11.resolve(index.absolute_path)) ?? /* @__PURE__ */ new Set();
    for (const sibling of siblings) {
      if (sibling === index) continue;
      if (!indexTargets.has(path11.resolve(sibling.absolute_path))) {
        diagnostics.push(
          issue2(
            "index.unlisted-document",
            index.relative_path,
            `Folder index does not link ${path11.basename(sibling.absolute_path)}.`
          )
        );
      }
    }
  }
  const rootIndex = path11.resolve(layerRoot, "00-index.md");
  const reached = /* @__PURE__ */ new Set();
  const queue = [rootIndex];
  while (queue.length > 0) {
    const current = queue.shift();
    if (reached.has(current)) continue;
    reached.add(current);
    queue.push(...graph.get(current) ?? []);
  }
  for (const record of records) {
    if (!reached.has(path11.resolve(record.absolute_path))) {
      diagnostics.push(
        issue2(
          "markdown.orphan",
          record.relative_path,
          "Canonical Markdown is not reachable from .pcp/00-index.md."
        )
      );
    }
  }
}
function validatePortableYamlStrings(value, relativePath, diagnostics, pointer = "") {
  if (typeof value === "string") {
    if (WINDOWS_ABSOLUTE_PATH.test(value) || /^\/(?:Users|home|etc|var|tmp)\//.test(value)) {
      diagnostics.push(
        issue2(
          "path.absolute",
          `${relativePath}#${pointer || "/"}`,
          "Canonical YAML contains an absolute path."
        )
      );
    }
    if (FILE_URI.test(value)) {
      diagnostics.push(
        issue2(
          "path.file-uri",
          `${relativePath}#${pointer || "/"}`,
          "Canonical YAML contains a file:// URI."
        )
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      validatePortableYamlStrings(item, relativePath, diagnostics, `${pointer}/${index}`);
    });
    return;
  }
  const object = objectValue3(value);
  if (object !== void 0) {
    for (const [key, item] of Object.entries(object)) {
      validatePortableYamlStrings(item, relativePath, diagnostics, `${pointer}/${key}`);
    }
  }
}
function validateTextSafety(relativePath, contents, diagnostics) {
  if (WINDOWS_ABSOLUTE_PATH.test(contents)) {
    diagnostics.push(
      issue2(
        "path.absolute-text",
        relativePath,
        "Canonical content contains a machine-specific drive path."
      )
    );
  }
  for (const [code2, pattern] of SECRET_PATTERNS) {
    if (pattern.test(contents)) {
      diagnostics.push(
        issue2(code2, relativePath, "Canonical content appears to contain secret material.")
      );
    }
  }
}
async function validateOwnership(layerRoot, files, markdown, patterns, diagnostics) {
  for (const file of files) {
    const matches = matchingOwnershipClasses(file.relative_path, patterns);
    if (matches.length === 0) {
      diagnostics.push(
        issue2(
          "ownership.unowned",
          file.relative_path,
          "File does not match any manifest ownership class."
        )
      );
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(
        issue2(
          "ownership.collision",
          file.relative_path,
          `File matches multiple ownership classes: ${matches.join(", ")}.`
        )
      );
      continue;
    }
    const record = markdown.get(file.relative_path);
    if (record === void 0) continue;
    const declared = record.metadata?.ownership;
    if (declared !== matches[0]) {
      diagnostics.push(
        issue2(
          "ownership.frontmatter-mismatch",
          file.relative_path,
          `Frontmatter ownership ${String(declared)} does not match manifest ownership ${matches[0]}.`
        )
      );
    }
    if (matches[0] === "generated") {
      if (!record.contents.includes(GENERATED_MARKER3)) {
        diagnostics.push(
          issue2(
            "generated.editable",
            file.relative_path,
            `Generated Markdown must contain ${GENERATED_MARKER3}.`
          )
        );
      }
      const sources = stringArray3(record.metadata?.sources);
      const expectedDigest = record.metadata?.source_digest;
      if (sources !== void 0 && typeof expectedDigest === "string") {
        try {
          const actualDigest = await canonicalSourceDigest(layerRoot, sources);
          if (actualDigest !== expectedDigest) {
            diagnostics.push(
              issue2(
                "generated.stale",
                file.relative_path,
                `Generated source digest is stale; expected ${actualDigest}.`
              )
            );
          }
        } catch (error2) {
          diagnostics.push(
            issue2(
              "generated.source",
              file.relative_path,
              error2 instanceof Error ? error2.message : "Unable to read a generated-view source."
            )
          );
        }
      }
    } else if (record.metadata?.sources !== void 0 || record.metadata?.source_digest !== void 0) {
      diagnostics.push(
        issue2(
          "generated.metadata-on-source",
          file.relative_path,
          "Only generated Markdown may declare sources or a source digest."
        )
      );
    }
  }
}
function assignLoadedYaml(loaded, relativePath, schema4, value) {
  loaded.set(relativePath, { path: relativePath, schema: schema4, value });
}
async function validateCanonicalLayer(projectRoot, options = {}) {
  const resolvedProjectRoot = path11.resolve(projectRoot);
  const layerRoot = path11.join(resolvedProjectRoot, ".pcp");
  const diagnostics = [];
  try {
    if (!(await stat2(layerRoot)).isDirectory()) {
      diagnostics.push(issue2("layer.missing", ".pcp", ".pcp exists but is not a directory."));
    }
  } catch {
    diagnostics.push(issue2("layer.missing", ".pcp", "Project does not contain a .pcp directory."));
    return { valid: false, checked_files: 0, diagnostics };
  }
  const files = await collectFiles2(layerRoot, layerRoot, diagnostics);
  const presentPaths = new Set(files.map((file) => file.relative_path));
  for (const requiredPath of REQUIRED_CANONICAL_PATHS) {
    if (!presentPaths.has(requiredPath)) {
      diagnostics.push(
        issue2("layer.required-path", requiredPath, "Required canonical core file is missing.")
      );
    }
  }
  const schemaRegistry = new SchemaRegistry();
  const loadedYaml = /* @__PURE__ */ new Map();
  const semanticRecords = {
    actors: [],
    events: [],
    checkpoints: []
  };
  for (const file of files.filter((item) => /\.ya?ml$/i.test(item.relative_path))) {
    const schema4 = schemaForPath(file.relative_path);
    if (schema4 === void 0) {
      diagnostics.push(
        issue2(
          "yaml.unknown-contract",
          file.relative_path,
          "Canonical YAML path does not map to a release schema."
        )
      );
      continue;
    }
    if (options.archive_content === "filenames-only" && /^continuity\/archive\/[^/]+\.yaml$/.test(file.relative_path)) {
      const eventId = path11.basename(file.relative_path, ".yaml");
      if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u.test(eventId)) {
        diagnostics.push(
          issue2(
            "event.archive-filename",
            file.relative_path,
            "Archived event filename must be a ULID."
          )
        );
      } else {
        assignLoadedYaml(loadedYaml, file.relative_path, schema4, { event_id: eventId });
        addSemanticRecord(semanticRecords, loadedYaml.get(file.relative_path));
      }
      continue;
    }
    const contents = await readFile9(file.absolute_path, "utf8");
    const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
    if (document.errors.length > 0) {
      for (const error2 of document.errors) {
        diagnostics.push(issue2("yaml.parse", file.relative_path, error2.message));
      }
      continue;
    }
    let value;
    try {
      value = document.toJS({ maxAliasCount: 50 });
    } catch (error2) {
      diagnostics.push(
        issue2(
          "yaml.alias-limit",
          file.relative_path,
          error2 instanceof Error ? error2.message : "Unable to safely decode YAML aliases."
        )
      );
      continue;
    }
    validatePortableYamlStrings(value, file.relative_path, diagnostics);
    const result = schemaRegistry.validate(schema4, value);
    if (!result.valid) {
      for (const schemaDiagnostic of result.diagnostics) {
        diagnostics.push(
          issue2(
            `schema.${schemaDiagnostic.keyword}`,
            `${file.relative_path}#${schemaDiagnostic.path === "/" ? "" : schemaDiagnostic.path}`,
            schemaDiagnostic.message
          )
        );
      }
      continue;
    }
    assignLoadedYaml(loadedYaml, file.relative_path, schema4, value);
    addSemanticRecord(semanticRecords, loadedYaml.get(file.relative_path));
  }
  const markdownRecords = [];
  for (const file of files.filter(
    (item) => item.relative_path.endsWith(".md") && !item.relative_path.startsWith("runtime/")
  )) {
    const contents = await readFile9(file.absolute_path, "utf8");
    try {
      const parsed = parseCanonicalMarkdown(contents);
      const result = schemaRegistry.validate("frontmatter", parsed.frontmatter);
      const metadata = result.valid ? objectValue3(parsed.frontmatter) : void 0;
      if (!result.valid) {
        for (const schemaDiagnostic of result.diagnostics) {
          diagnostics.push(
            issue2(
              `frontmatter.${schemaDiagnostic.keyword}`,
              `${file.relative_path}#${schemaDiagnostic.path === "/" ? "" : schemaDiagnostic.path}`,
              schemaDiagnostic.message
            )
          );
        }
      } else if (metadata?.doc !== file.relative_path) {
        diagnostics.push(
          issue2(
            "frontmatter.path-mismatch",
            file.relative_path,
            `Frontmatter doc must equal ${file.relative_path}.`
          )
        );
      }
      markdownRecords.push({ ...file, contents, parsed, metadata });
    } catch (error2) {
      diagnostics.push(
        issue2(
          "frontmatter.parse",
          file.relative_path,
          error2 instanceof Error ? error2.message : "Unable to parse Markdown frontmatter."
        )
      );
    }
  }
  const graph = await validateMarkdownLinks(
    resolvedProjectRoot,
    layerRoot,
    markdownRecords,
    diagnostics
  );
  validateMarkdownStructure(layerRoot, markdownRecords, graph, diagnostics);
  const manifest = loadedYaml.get("pcp.yaml")?.value;
  const adapterIds = stringArray3(objectValue3(manifest)?.adapter_ids);
  if (adapterIds !== void 0 && adapterIds.length > 0) {
    const expectedAdapters = renderPlatformAdapters().map((adapter) => adapter.manifest);
    const adapterValidation = await validatePlatformAdapters(resolvedProjectRoot, expectedAdapters);
    diagnostics.push(
      ...adapterValidation.diagnostics.map(
        (diagnostic2) => issue2(diagnostic2.code, diagnostic2.path, diagnostic2.message)
      )
    );
  }
  const patterns = ownershipPatterns(manifest);
  if (patterns !== void 0) {
    await validateOwnership(
      layerRoot,
      files,
      new Map(markdownRecords.map((record) => [record.relative_path, record])),
      patterns,
      diagnostics
    );
  }
  for (const file of files.filter(
    (item) => TEXT_FILE_PATTERN.test(item.relative_path) && !item.relative_path.startsWith("runtime/") && !(options.archive_content === "filenames-only" && item.relative_path.startsWith("continuity/archive/"))
  )) {
    validateTextSafety(file.relative_path, await readFile9(file.absolute_path, "utf8"), diagnostics);
  }
  diagnostics.push(...validateCanonicalSemantics(semanticRecords));
  const continuity = objectValue3(objectValue3(manifest)?.continuity);
  const activeEventLimit = continuity?.active_event_limit;
  if (typeof activeEventLimit === "number") {
    const activeEventCount = files.filter(
      (file) => /^continuity\/events\/[^/]+\.yaml$/.test(file.relative_path)
    ).length;
    if (activeEventCount > activeEventLimit) {
      diagnostics.push(
        issue2(
          "continuity.active-event-limit",
          "continuity/events",
          `Active events ${activeEventCount} exceed the configured limit ${activeEventLimit}; archive the oldest batch.`
        )
      );
    }
  }
  if (options.clean_genesis === true) {
    if (files.some((file) => /^continuity\/actors\/[^/]+\.yaml$/.test(file.relative_path))) {
      diagnostics.push(
        issue2(
          "genesis.actor-profile",
          "continuity/actors",
          "Clean genesis must contain zero actor profiles."
        )
      );
    }
    if (files.some((file) => /^continuity\/(?:events|archive)\/[^/]+\.yaml$/.test(file.relative_path))) {
      diagnostics.push(
        issue2(
          "genesis.event",
          "continuity",
          "Clean genesis must contain zero active or archived events."
        )
      );
    }
  }
  diagnostics.sort(compareCanonicalDiagnostics);
  return {
    valid: !diagnostics.some((diagnostic2) => diagnostic2.severity === "error"),
    checked_files: files.length,
    diagnostics
  };
}

// src/application/plan-adoption.ts
var MAXIMUM_ADOPTION_INPUT_BYTES = 4 * 1048576;
var PLACEHOLDER_PATTERN = /replace this baseline|pending project|grounded project purpose/iu;
var WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
var WINDOWS_FORBIDDEN_CHARACTER = /[<>:"|?*]/u;
var SCAFFOLD_SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\b(?:password|passwd|api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{12,}/iu
];
var expectedDocuments = /* @__PURE__ */ new Map([
  ["knowledge/10-overview.md", { type: "knowledge", status: "static" }],
  ["knowledge/20-architecture.md", { type: "knowledge", status: "static" }],
  ["knowledge/30-source-map.md", { type: "knowledge", status: "static" }],
  ["knowledge/40-build-and-tooling.md", { type: "knowledge", status: "static" }],
  ["knowledge/50-domain-and-invariants.md", { type: "knowledge", status: "static" }],
  ["operations/10-working-agreement.md", { type: "policy", status: "living" }],
  ["operations/20-plan.md", { type: "plan", status: "living" }],
  ["operations/30-decisions.md", { type: "policy", status: "living" }]
]);
function isInside4(root, candidate) {
  const relative = path12.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path12.sep}`) && relative !== ".." && !path12.isAbsolute(relative);
}
function portableBasename(root) {
  const normalized = path12.basename(root).normalize("NFKD").toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 63);
  return slug || "project";
}
function baselineFor(root, inspection) {
  const groups = /* @__PURE__ */ new Map();
  for (const signal of inspection.signals) {
    const paths = groups.get(signal.category) ?? /* @__PURE__ */ new Set();
    paths.add(signal.path);
    groups.set(signal.category, paths);
  }
  groups.set("inventory", new Set(inspection.inventory.files.map((file) => file.path)));
  return {
    suggested_project_id: portableBasename(root),
    seed_sources: inspection.state === "A" ? inspection.inventory.files.map((file) => file.path) : [],
    evidence_groups: [...groups.entries()].map(([category, paths]) => ({ category, paths: [...paths].sort(comparePortablePaths) })).sort((left, right) => comparePortablePaths(left.category, right.category)),
    nested_repositories: [...inspection.inventory.nestedRepositories],
    required_documents: REQUIRED_ADOPTION_DOCUMENTS,
    preserves_existing_paths: true
  };
}
function questionsFor(inspection) {
  if (inspection.state === "managed") return [];
  if (inspection.state === "C") {
    return [
      {
        id: "state-c-coverage",
        prompt: "Complete every disposition in the emitted foreign-source coverage matrix.",
        reason: "State C translation and destructive removal require semantic dispositions.",
        required: true,
        response_shape: "object"
      }
    ];
  }
  if (inspection.state === "B") {
    return [
      {
        id: "grounded-baseline",
        prompt: "Synthesize the eight canonical project documents from cited repository evidence.",
        reason: "The deterministic engine inventories evidence but must not invent project meaning.",
        required: true,
        response_shape: "object"
      },
      {
        id: "vcs-profile",
        prompt: "Select recommended human-commit, none, human-owned, agent-managed, or a complete custom VCS policy.",
        reason: "PCP recommends transparent human commits but cannot infer or enforce version-control authority.",
        required: true,
        response_shape: "enum",
        options: ["human-commit", "none", "human-owned", "agent-managed", "custom"]
      }
    ];
  }
  const questions = [
    {
      id: "project-identity",
      prompt: "Provide the project name, concrete purpose, project type, and lifecycle state.",
      reason: "A seed title or empty directory does not establish indispensable project meaning.",
      required: true,
      response_shape: "object"
    },
    {
      id: "software-stack",
      prompt: "If this is software, provide the language, runtime, package manager, license, and deployment choice that actually apply.",
      reason: "PCP must not invent a software stack or license from a title.",
      required: true,
      response_shape: "object",
      when: "project.project_type == software"
    },
    {
      id: "vcs-profile",
      prompt: "Select recommended human-commit, none, human-owned, agent-managed, or a complete custom VCS policy.",
      reason: "PCP recommends transparent human commits but cannot infer or enforce version-control authority.",
      required: true,
      response_shape: "enum",
      options: ["human-commit", "none", "human-owned", "agent-managed", "custom"]
    }
  ];
  if (inspection.inventory.files.length === 0) {
    questions.push({
      id: "initial-scaffold",
      prompt: "Provide the minimal project-type-appropriate files to create beside .pcp/.",
      reason: "An empty seed needs an explicit scaffold, and PCP does not assume every project is software.",
      required: true,
      response_shape: "file-set"
    });
  }
  return questions;
}
async function previewWithoutPlan(root, inspection) {
  const preview = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: "adopt",
    candidate: ".",
    classification: inspection.state,
    confidence: inspection.confidence,
    applicable: false,
    questions: questionsFor(inspection),
    baseline: baselineFor(root, inspection),
    mutated: false
  };
  if (inspection.state === "C") {
    const catalog = await discoverForeignCoverage(root, inspection);
    preview.coverage = catalog.template;
    preview.coverage_issues = catalog.issues;
    preview.coverage_status = catalog.issues.length === 0 ? "requires-disposition" : "blocked";
  }
  return preview;
}
function schemaFailure(diagnostics) {
  const details = diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
  return new AdoptionError("PCP_ADOPTION_INPUT_INVALID", `Invalid adoption input: ${details}`);
}
async function loadAdoptionInput(inputPath, candidateRoot2) {
  const resolvedInput = path12.resolve(inputPath);
  if (isInside4(candidateRoot2, resolvedInput)) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_INSIDE_CANDIDATE",
      "Store the transient adoption input outside the candidate project so it cannot become project state."
    );
  }
  const metadata = await lstat5(resolvedInput).catch((error2) => {
    const detail = error2 instanceof Error ? error2.message : String(error2);
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_UNREADABLE",
      `Cannot read adoption input: ${detail}`
    );
  });
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAXIMUM_ADOPTION_INPUT_BYTES) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_UNSAFE",
      "The adoption input must be a regular non-symlink file no larger than 4 MiB."
    );
  }
  const document = parseDocument(await readFile10(resolvedInput, "utf8"), {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_INVALID",
      `Invalid adoption input YAML: ${document.errors.map((error2) => error2.message).join("; ")}`
    );
  }
  const value = document.toJS({ mapAsMap: false });
  const validation = new SchemaRegistry().validate("adoption-input", value);
  if (!validation.valid) throw schemaFailure(validation.diagnostics);
  return value;
}
function validateDocumentSet(input, inspection) {
  const paths = input.documents.map((document) => document.path);
  if (new Set(paths).size !== REQUIRED_ADOPTION_DOCUMENTS.length) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_INVALID",
      "Each required canonical adoption document must appear exactly once."
    );
  }
  for (const requiredPath of REQUIRED_ADOPTION_DOCUMENTS) {
    if (!paths.includes(requiredPath)) {
      throw new AdoptionError(
        "PCP_ADOPTION_INPUT_INVALID",
        `Missing required adoption document: ${requiredPath}`
      );
    }
  }
  const availableEvidence = /* @__PURE__ */ new Set([
    ...inspection.inventory.directories,
    ...inspection.inventory.files.map((file) => file.path),
    ...inspection.inventory.nestedRepositories
  ]);
  for (const document of input.documents) {
    const expected = expectedDocuments.get(document.path);
    if (expected === void 0 || expected.type !== document.type || expected.status !== document.status) {
      throw new AdoptionError(
        "PCP_ADOPTION_INPUT_INVALID",
        `Document metadata does not match its canonical role: ${document.path}`
      );
    }
    const body = normalizeText(document.body).trim();
    if (!body.startsWith("# ") || body.startsWith("---") || PLACEHOLDER_PATTERN.test(body)) {
      throw new AdoptionError(
        "PCP_ADOPTION_INPUT_INVALID",
        `Document must contain grounded Markdown without template placeholders: ${document.path}`
      );
    }
    if ((document.basis === "repository" || document.basis === "repository-and-user") && document.evidence_paths.length === 0) {
      throw new AdoptionError(
        "PCP_ADOPTION_INPUT_INVALID",
        `Repository-grounded document has no evidence path: ${document.path}`
      );
    }
    if ((inspection.state === "B" || inspection.state === "C") && document.type === "knowledge" && document.basis !== "repository" && document.basis !== "repository-and-user") {
      throw new AdoptionError(
        "PCP_ADOPTION_INPUT_INVALID",
        `Established-project knowledge must cite current repository evidence: ${document.path}`
      );
    }
    for (const evidencePath of document.evidence_paths) {
      if (!availableEvidence.has(evidencePath)) {
        throw new AdoptionError(
          "PCP_ADOPTION_EVIDENCE_MISSING",
          `Cited evidence is not in the inspected candidate: ${evidencePath}`
        );
      }
    }
  }
}
function portableCollisionKey(value) {
  return value.normalize("NFKC").toLowerCase();
}
function assertPortableMutationPath(value) {
  for (const segment of value.split("/")) {
    if (segment.length === 0 || segment.endsWith(".") || segment.endsWith(" ") || WINDOWS_RESERVED_NAME.test(segment) || WINDOWS_FORBIDDEN_CHARACTER.test(segment) || [...segment].some((character) => (character.codePointAt(0) ?? 0) <= 31)) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_NONPORTABLE",
        `Planned path is not portable across supported platforms: ${value}`
      );
    }
  }
}
function validateProjectInput(input, inspection) {
  if (!input.project.context_roots.includes(".pcp")) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_INVALID",
      "Project context_roots must include .pcp."
    );
  }
  if (inspection.state !== "C" && input.coverage !== void 0) {
    throw new AdoptionError(
      "PCP_STATE_C_COVERAGE_FORBIDDEN",
      "Foreign-context coverage belongs only to State C adoption input."
    );
  }
  if ((inspection.state === "B" || inspection.state === "C") && input.scaffold_files.length > 0) {
    throw new AdoptionError(
      inspection.state === "B" ? "PCP_STATE_B_SCAFFOLD_FORBIDDEN" : "PCP_STATE_C_SCAFFOLD_FORBIDDEN",
      `${inspection.state === "B" ? "State B adoption" : "State C translation"} preserves ordinary project topology and cannot add scaffold files.`
    );
  }
  if (inspection.state === "A" && inspection.inventory.files.length === 0 && input.scaffold_files.length === 0) {
    throw new AdoptionError(
      "PCP_STATE_A_SCAFFOLD_REQUIRED",
      "An empty State A candidate requires an explicit project-type-appropriate scaffold."
    );
  }
  const scaffoldPaths = input.scaffold_files.map((file) => file.path);
  if (new Set(scaffoldPaths).size !== scaffoldPaths.length) {
    throw new AdoptionError("PCP_ADOPTION_INPUT_INVALID", "Scaffold paths must be unique.");
  }
  for (const scaffold of input.scaffold_files) {
    const normalized = path12.posix.normalize(scaffold.path);
    if (scaffold.path === "." || normalized !== scaffold.path || scaffold.path.endsWith("/") || scaffold.path.startsWith(".pcp/")) {
      throw new AdoptionError("PCP_ADOPTION_PATH_UNSAFE", `Unsafe scaffold path: ${scaffold.path}`);
    }
    assertPortableMutationPath(scaffold.path);
    if (SCAFFOLD_SECRET_PATTERNS.some((pattern) => pattern.test(scaffold.content))) {
      throw new AdoptionError(
        "PCP_ADOPTION_SCAFFOLD_SECRET",
        `Refusing to scaffold secret-like content: ${scaffold.path}`
      );
    }
  }
}
function renderDocument(document, baselineAt) {
  const frontmatter = stringify3(
    {
      doc: document.path,
      type: document.type,
      status: document.status,
      version: "1.0.0",
      last_updated: baselineAt,
      ownership: "project"
    },
    { lineWidth: 0 }
  ).trimEnd();
  const body = normalizeText(document.body).trim();
  return Buffer.from(`---
${frontmatter}
---

${body}
`, "utf8");
}
async function writeStageFiles(root, files) {
  for (const [relativePath, content] of files) {
    const target = path12.join(root, ...relativePath.split("/"));
    await mkdir2(path12.dirname(target), { recursive: true });
    await writeFile3(target, content, { flag: "wx" });
  }
}
async function collectStageFiles(directory, stageRoot, result) {
  const entries = await readdir3(directory, { withFileTypes: true });
  entries.sort((left, right) => comparePortablePaths(left.name, right.name));
  for (const entry of entries) {
    const target = path12.join(directory, entry.name);
    const metadata = await lstat5(target);
    const relativePath = toPortablePath(path12.relative(stageRoot, target));
    if (metadata.isSymbolicLink()) {
      throw new AdoptionError(
        "PCP_ADOPTION_STAGE_INVALID",
        `Staged symlink is forbidden: ${relativePath}`
      );
    }
    if (metadata.isDirectory()) {
      await collectStageFiles(target, stageRoot, result);
    } else if (metadata.isFile()) {
      result.set(relativePath, await readFile10(target));
    }
  }
}
function yamlBuffer(value) {
  return Buffer.from(stringify3(value, { lineWidth: 0, sortMapEntries: true }), "utf8");
}
async function stageCanonicalLayer(input, adapters = []) {
  const stageRoot = await mkdtemp2(path12.join(tmpdir2(), "pcp-adoption-preview-"));
  try {
    const template = new Map(await loadCoreTemplateFiles());
    const manifestPath = ".pcp/pcp.yaml";
    const manifestBytes = template.get(manifestPath);
    if (manifestBytes === void 0) {
      throw new AdoptionError("PCP_ADOPTION_ASSETS_MISSING", "The core manifest asset is missing.");
    }
    const manifest = parse(manifestBytes.toString("utf8"));
    manifest.persistence = input.persistence;
    manifest.adapter_ids = adapters.map((adapter) => adapter.manifest.adapter_id);
    template.set(manifestPath, yamlBuffer(manifest));
    template.set(".pcp/state/project.yaml", yamlBuffer(input.project));
    template.set(".pcp/state/projects.yaml", yamlBuffer(input.projects));
    template.set(".pcp/state/workstreams.yaml", yamlBuffer(input.workstreams));
    template.set(".pcp/state/vcs-policy.yaml", yamlBuffer(input.vcs_policy));
    for (const document of input.documents) {
      template.set(`.pcp/${document.path}`, renderDocument(document, input.baseline_at));
    }
    for (const adapter of adapters) {
      if (template.has(adapter.manifest.target_path)) {
        throw new AdoptionError(
          "PCP_ADAPTER_RENDER_INVALID",
          `Generated adapter target collides with canonical staged content: ${adapter.manifest.target_path}`
        );
      }
      template.set(adapter.manifest.target_path, adapter.content);
    }
    await writeStageFiles(stageRoot, template);
    const rendering = await renderCanonicalViews(stageRoot);
    if (!rendering.valid) {
      throw new AdoptionError(
        "PCP_ADOPTION_STAGE_INVALID",
        `Unable to render staged canonical views: ${rendering.diagnostics.map((item) => item.message).join("; ")}`
      );
    }
    const validation = await validateCanonicalLayer(stageRoot, { clean_genesis: true });
    if (!validation.valid) {
      throw new AdoptionError(
        "PCP_ADOPTION_STAGE_INVALID",
        `Staged canonical layer is invalid: ${validation.diagnostics.slice(0, 8).map((item) => `${item.path}: ${item.message}`).join("; ")}`
      );
    }
    const result = /* @__PURE__ */ new Map();
    await collectStageFiles(stageRoot, stageRoot, result);
    return result;
  } finally {
    await rm2(stageRoot, { recursive: true, force: true });
  }
}
function parentDirectories(relativePath) {
  const result = [];
  let parent = path12.posix.dirname(relativePath);
  while (parent !== ".") {
    result.push(parent);
    parent = path12.posix.dirname(parent);
  }
  return result;
}
function pathDepth(value) {
  return value.split("/").length;
}
async function assertContentTargetsSafe(root, content, inspection, persistence, replaceablePaths = /* @__PURE__ */ new Set()) {
  const files = new Set(inspection.inventory.files.map((file) => file.path));
  const directories = new Set(inspection.inventory.directories);
  const symlinks = inspection.inventory.symlinks.map((link) => link.path);
  const existingPathKeys = /* @__PURE__ */ new Map();
  for (const existing of [...files, ...directories, ...symlinks]) {
    const key = portableCollisionKey(existing);
    const equivalents = existingPathKeys.get(key) ?? [];
    equivalents.push(existing);
    existingPathKeys.set(key, equivalents);
  }
  const desiredPaths = /* @__PURE__ */ new Set();
  for (const target of content.keys()) {
    desiredPaths.add(target);
    for (const parent of parentDirectories(target)) desiredPaths.add(parent);
  }
  const desiredPathKeys = /* @__PURE__ */ new Map();
  for (const desired of desiredPaths) {
    assertPortableMutationPath(desired);
    const desiredKey = portableCollisionKey(desired);
    const equivalentDesired = desiredPathKeys.get(desiredKey);
    if (equivalentDesired !== void 0 && equivalentDesired !== desired) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_COLLISION",
        `Planned paths collide under portable normalization: ${equivalentDesired}, ${desired}`
      );
    }
    desiredPathKeys.set(desiredKey, desired);
    const existingEquivalents = existingPathKeys.get(desiredKey) ?? [];
    const conflictingExisting = existingEquivalents.find((existing) => existing !== desired);
    if (conflictingExisting !== void 0) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_COLLISION",
        `Planned path collides with existing path ${conflictingExisting}: ${desired}`
      );
    }
  }
  for (const target of content.keys()) {
    if (files.has(target) && !replaceablePaths.has(target) || directories.has(target) || symlinks.includes(target)) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_COLLISION",
        `Planned target already exists and is not an approved file replacement: ${target}`
      );
    }
    const staticExclusion = mutationPathExclusion(target);
    if (staticExclusion !== void 0) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_BOUNDARY",
        `Planned target enters a ${staticExclusion} path: ${target}`
      );
    }
    if (await isMutationPathIgnored(root, target) && !(persistence === "local" && target.startsWith(".pcp/"))) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_BOUNDARY",
        `Planned target is ignored by candidate policy: ${target}`
      );
    }
    for (const exclusion of inspection.inventory.exclusions) {
      if (target === exclusion.path || target.startsWith(`${exclusion.path}/`)) {
        throw new AdoptionError(
          "PCP_ADOPTION_PATH_BOUNDARY",
          `Planned target enters an excluded ${exclusion.reason} boundary: ${target}`
        );
      }
    }
    for (const link of symlinks) {
      if (target.startsWith(`${link}/`)) {
        throw new AdoptionError(
          "PCP_ADOPTION_PATH_BOUNDARY",
          `Planned target crosses a symbolic-link boundary: ${target}`
        );
      }
    }
    for (const nested of inspection.inventory.nestedRepositories) {
      if (target === nested || target.startsWith(`${nested}/`)) {
        throw new AdoptionError(
          "PCP_ADOPTION_NESTED_REPOSITORY",
          `Planned target crosses a nested repository boundary: ${target}`
        );
      }
    }
    for (const parent of parentDirectories(target)) {
      if (files.has(parent) && !replaceablePaths.has(parent) || symlinks.includes(parent)) {
        throw new AdoptionError(
          "PCP_ADOPTION_PATH_COLLISION",
          `Planned target has a non-directory ancestor: ${target}`
        );
      }
    }
  }
}
function normalizedCoverageDigest(coverage) {
  const normalized = {
    ...coverage,
    records: coverage.records.map((record) => ({
      ...record,
      targets: [...record.targets].sort(comparePortablePaths),
      evidence: [...record.evidence].sort(comparePortablePaths)
    })).sort((left, right) => comparePortablePaths(left.source_id, right.source_id))
  };
  return sha256(canonicalJson(normalized));
}
function stateCRemovalPaths(input) {
  if (input.coverage === void 0) return /* @__PURE__ */ new Set();
  return new Set(
    input.coverage.records.filter(
      (record) => (record.source_kind === "file" || record.source_kind === "adapter") && record.disposition !== "project-owned"
    ).map((record) => record.source_path)
  );
}
function buildStateCOperations(content, inspection, removalPaths) {
  const filesByPath = new Map(inspection.inventory.files.map((file) => [file.path, file]));
  const existingDirectories = new Set(inspection.inventory.directories);
  const contentPaths = [...content.keys()];
  const preWriteRemovalPaths = [...removalPaths].filter(
    (removalPath) => !content.has(removalPath) && contentPaths.some((target) => target.startsWith(`${removalPath}/`))
  ).sort(comparePortablePaths);
  const preWriteRemovals = preWriteRemovalPaths.map((removalPath) => {
    const source = filesByPath.get(removalPath);
    if (source === void 0) {
      throw new AdoptionError(
        "PCP_STATE_C_COVERAGE_INVALID",
        `Reviewed foreign file is missing from the current inventory: ${removalPath}`
      );
    }
    return {
      action: "remove",
      path: removalPath,
      preimage_digest: source.sha256
    };
  });
  const requiredDirectories = /* @__PURE__ */ new Set();
  for (const target of contentPaths) {
    for (const directory of parentDirectories(target)) {
      if (!existingDirectories.has(directory)) requiredDirectories.add(directory);
    }
  }
  const directoryOperations = [...requiredDirectories].sort((left, right) => pathDepth(left) - pathDepth(right) || comparePortablePaths(left, right)).map((directory) => ({ action: "mkdir", path: directory }));
  const contentOperations = [...content.entries()].sort(([left], [right]) => comparePortablePaths(left, right)).map(([target, bytes]) => {
    const existing = filesByPath.get(target);
    return existing === void 0 ? { action: "write", path: target, content_digest: sha256(bytes) } : {
      action: "replace",
      path: target,
      content_digest: sha256(bytes),
      preimage_digest: existing.sha256
    };
  });
  const earlyRemovalSet = new Set(preWriteRemovalPaths);
  const postWriteRemovals = [...removalPaths].filter((removalPath) => !content.has(removalPath) && !earlyRemovalSet.has(removalPath)).sort(comparePortablePaths).map((removalPath) => {
    const source = filesByPath.get(removalPath);
    if (source === void 0) {
      throw new AdoptionError(
        "PCP_STATE_C_COVERAGE_INVALID",
        `Reviewed foreign file is missing from the current inventory: ${removalPath}`
      );
    }
    return {
      action: "remove",
      path: removalPath,
      preimage_digest: source.sha256
    };
  });
  return [...preWriteRemovals, ...directoryOperations, ...contentOperations, ...postWriteRemovals];
}
function stateCCoverageFailure(diagnostics) {
  const details = diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.code} ${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
  return new AdoptionError(
    "PCP_STATE_C_COVERAGE_INVALID",
    `State C coverage is not ready: ${details}`
  );
}
function assertSupportedStateCAdapters(input) {
  if (input.coverage === void 0) return;
  const unsupported = input.coverage.records.filter(
    (record) => record.source_kind === "adapter" && supportedAdapterForSourcePath(record.source_path) === void 0
  ).map((record) => record.source_path).sort(comparePortablePaths);
  if (unsupported.length === 0) return;
  const examples = unsupported.slice(0, 8).join(", ");
  throw new AdoptionError(
    "PCP_STATE_C_ADAPTER_UNSUPPORTED",
    `State C contains adapter surfaces without a verified PCP replacement: ${examples}. Preserve the candidate and add an explicit adapter implementation before translation.`
  );
}
function assertGeneratedPlatformAdapters(adapters) {
  const registry = new SchemaRegistry();
  const ids = /* @__PURE__ */ new Set();
  const targets = /* @__PURE__ */ new Set();
  for (const adapter of adapters) {
    const validation = registry.validate("adapter", adapter.manifest);
    if (!validation.valid) {
      throw new AdoptionError(
        "PCP_ADAPTER_RENDER_INVALID",
        `Generated adapter ${adapter.manifest.adapter_id} is invalid: ${validation.diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ")}`
      );
    }
    if (adapter.manifest.content_digest !== sha256(adapter.content)) {
      throw new AdoptionError(
        "PCP_ADAPTER_RENDER_INVALID",
        `Generated adapter digest is stale: ${adapter.manifest.adapter_id}`
      );
    }
    if (ids.has(adapter.manifest.adapter_id) || targets.has(adapter.manifest.target_path)) {
      throw new AdoptionError(
        "PCP_ADAPTER_RENDER_INVALID",
        `Generated adapter ID or target appears more than once: ${adapter.manifest.adapter_id}`
      );
    }
    ids.add(adapter.manifest.adapter_id);
    targets.add(adapter.manifest.target_path);
  }
}
function validateStateCCoverageTargets(input, content) {
  if (input.coverage === void 0) return;
  const diagnostics = [];
  for (const [recordIndex, record] of input.coverage.records.entries()) {
    for (const [targetIndex, target] of record.targets.entries()) {
      if (!target.startsWith(".pcp/") || !content.has(target)) {
        diagnostics.push({
          code: "coverage-target-missing",
          path: `/coverage/records/${recordIndex}/targets/${targetIndex}`,
          message: `Coverage target is not a staged canonical file: ${target}`
        });
      }
    }
  }
  if (diagnostics.length > 0) throw stateCCoverageFailure(diagnostics);
}
async function buildStateCTranslationPlan(root, inspection, input) {
  if (inspection.state !== "C") {
    throw new AdoptionError(
      "PCP_ADOPTION_STATE_UNSUPPORTED",
      `State C coverage review requires a State C candidate, not ${inspection.state}.`
    );
  }
  if (input.coverage === void 0) {
    throw new AdoptionError(
      "PCP_STATE_C_COVERAGE_REQUIRED",
      "State C adoption input must include the completed coverage matrix emitted for this candidate."
    );
  }
  validateDocumentSet(input, inspection);
  validateProjectInput(input, inspection);
  if (input.persistence === "local" && !await isMutationDirectoryIgnored(root, ".pcp")) {
    throw new AdoptionError(
      "PCP_LOCAL_PERSISTENCE_NOT_IGNORED",
      "Local persistence requires candidate ignore policy to cover the complete .pcp/ layer before adoption."
    );
  }
  const catalog = await discoverForeignCoverage(root, inspection);
  const validation = validateForeignCoverage(catalog, input.coverage);
  if (!validation.valid) throw stateCCoverageFailure(validation.diagnostics);
  assertSupportedStateCAdapters(input);
  const adapters = renderPlatformAdapters();
  assertGeneratedPlatformAdapters(adapters);
  const content = await stageCanonicalLayer(input, adapters);
  validateStateCCoverageTargets(input, content);
  const removalPaths = stateCRemovalPaths(input);
  await assertContentTargetsSafe(root, content, inspection, input.persistence, removalPaths);
  const plan = createMutationPlan({
    classification: "C",
    coverageDigest: normalizedCoverageDigest(input.coverage),
    inventory: inspection.inventory,
    generatedAt: input.baseline_at,
    operations: buildStateCOperations(content, inspection, removalPaths),
    validations: [
      "candidate-inventory",
      "canonical-layer",
      "clean-genesis",
      "coverage",
      "desired-hashes",
      "foreign-removals",
      "path-boundaries",
      "platform-adapters",
      "preimages",
      "rollback",
      "semantic-input"
    ]
  });
  const planValidation = new SchemaRegistry().validate("mutation-plan", plan);
  if (!planValidation.valid) throw schemaFailure(planValidation.diagnostics);
  const preview = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: "adopt",
    candidate: ".",
    classification: "C",
    confidence: inspection.confidence,
    applicable: true,
    questions: [],
    baseline: baselineFor(root, inspection),
    coverage: input.coverage,
    coverage_issues: [],
    coverage_status: "complete",
    adapters: adapters.map((adapter) => adapter.manifest),
    plan,
    mutated: false
  };
  return { inspection, input, preview, content_by_path: content };
}
async function buildPlanMaterial(root, inspection, input) {
  if (inspection.state !== "A" && inspection.state !== "B") {
    throw new AdoptionError(
      "PCP_ADOPTION_STATE_UNSUPPORTED",
      `M3 adoption applies only to State A or State B candidates, not ${inspection.state}.`
    );
  }
  validateDocumentSet(input, inspection);
  validateProjectInput(input, inspection);
  if (input.persistence === "local" && !await isMutationDirectoryIgnored(root, ".pcp")) {
    throw new AdoptionError(
      "PCP_LOCAL_PERSISTENCE_NOT_IGNORED",
      "Local persistence requires candidate ignore policy to cover the complete .pcp/ layer before adoption."
    );
  }
  const adapters = renderPlatformAdapters();
  assertGeneratedPlatformAdapters(adapters);
  const content = new Map(await stageCanonicalLayer(input, adapters));
  for (const scaffold of input.scaffold_files) {
    if (content.has(scaffold.path)) {
      throw new AdoptionError(
        "PCP_ADOPTION_PATH_BOUNDARY",
        `State A scaffold path is reserved by the canonical PCP installation: ${scaffold.path}`
      );
    }
    content.set(scaffold.path, Buffer.from(normalizeText(scaffold.content), "utf8"));
  }
  await assertContentTargetsSafe(root, content, inspection, input.persistence);
  const existingDirectories = new Set(inspection.inventory.directories);
  const requiredDirectories = /* @__PURE__ */ new Set();
  for (const target of content.keys()) {
    for (const directory of parentDirectories(target)) {
      if (!existingDirectories.has(directory)) requiredDirectories.add(directory);
    }
  }
  const directoryOperations = [...requiredDirectories].sort((left, right) => pathDepth(left) - pathDepth(right) || comparePortablePaths(left, right)).map((directory) => ({ action: "mkdir", path: directory }));
  const writeOperations = [...content.entries()].sort(([left], [right]) => comparePortablePaths(left, right)).map(([target, bytes]) => ({
    action: "write",
    path: target,
    content_digest: sha256(bytes)
  }));
  const plan = createMutationPlan({
    classification: inspection.state,
    inventory: inspection.inventory,
    generatedAt: input.baseline_at,
    operations: [...directoryOperations, ...writeOperations],
    validations: [
      "candidate-inventory",
      "canonical-layer",
      "clean-genesis",
      "desired-hashes",
      "path-boundaries",
      "platform-adapters",
      "rollback",
      "semantic-input"
    ]
  });
  const planValidation = new SchemaRegistry().validate("mutation-plan", plan);
  if (!planValidation.valid) throw schemaFailure(planValidation.diagnostics);
  const preview = {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: "adopt",
    candidate: ".",
    classification: inspection.state,
    confidence: inspection.confidence,
    applicable: true,
    questions: [],
    baseline: baselineFor(root, inspection),
    adapters: adapters.map((adapter) => adapter.manifest),
    plan,
    mutated: false
  };
  return { inspection, input, preview, content_by_path: content };
}
async function planAdoption(candidate = ".", inputPath) {
  const root = await resolveCandidateRoot(candidate);
  const inspection = await inspectRepository(root);
  if (inputPath === void 0 || inspection.state === "managed") {
    return previewWithoutPlan(root, inspection);
  }
  const input = await loadAdoptionInput(inputPath, root);
  if (inspection.state === "C") return buildStateCTranslationPlan(root, inspection, input);
  return buildPlanMaterial(root, inspection, input);
}
function isPlanMaterial(value) {
  return "content_by_path" in value;
}

// src/application/adopt-project.ts
function digestMatches(expected, supplied) {
  if (!/^[a-f0-9]{64}$/u.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}
function comparableInventory(inventory) {
  return {
    directories: inventory.directories,
    files: inventory.files,
    symlinks: inventory.symlinks,
    nested_repositories: inventory.nestedRepositories
  };
}
async function verifyAdoptionSourceStability(root, original, plan, contentByPath, persistence) {
  const allowedActions = plan.classification === "C" ? /* @__PURE__ */ new Set(["mkdir", "write", "replace", "remove"]) : /* @__PURE__ */ new Set(["mkdir", "write"]);
  if (plan.operations.some((operation) => !allowedActions.has(operation.action))) {
    throw new AdoptionError(
      "PCP_ADOPTION_PLAN_UNSAFE",
      plan.classification === "C" ? "State C adoption may contain only directory creation, file creation, approved replacement, and approved removal operations." : "State A/B adoption may contain only new-directory and new-file operations.",
      true
    );
  }
  const expectedDirectories = new Set(original.directories);
  const expectedFiles = new Map(
    original.files.map((file) => [file.path, { ...file }])
  );
  const hiddenByLocalPersistence = (candidatePath) => persistence === "local" && (candidatePath === ".pcp" || candidatePath.startsWith(".pcp/"));
  for (const operation of plan.operations) {
    if (hiddenByLocalPersistence(operation.path)) continue;
    switch (operation.action) {
      case "mkdir":
        expectedDirectories.add(operation.path);
        break;
      case "write":
      case "replace": {
        const content = contentByPath.get(operation.path);
        if (content === void 0 || operation.content_digest === void 0) {
          throw new AdoptionError(
            "PCP_ADOPTION_PLAN_CONTENT_MISMATCH",
            `The approved operation is missing expected content: ${operation.path}`,
            true
          );
        }
        expectedFiles.set(operation.path, {
          path: operation.path,
          size: content.length,
          sha256: operation.content_digest
        });
        break;
      }
      case "remove":
        expectedFiles.delete(operation.path);
        break;
      case "move":
        throw new AdoptionError(
          "PCP_ADOPTION_PLAN_UNSAFE",
          "Move operations are not enabled for adoption source-stability checks.",
          true
        );
    }
  }
  const expected = {
    directories: [...expectedDirectories].sort(comparePortablePaths),
    files: [...expectedFiles.values()].sort(
      (left, right) => comparePortablePaths(left.path, right.path)
    ),
    symlinks: original.symlinks,
    nested_repositories: original.nestedRepositories
  };
  const current = await inventoryRepository(root);
  if (canonicalJson(comparableInventory(current)) !== canonicalJson(expected)) {
    throw new AdoptionError(
      "PCP_SOURCE_CHANGED",
      "Candidate-owned source changed while the adoption transaction was running.",
      true
    );
  }
}
async function adoptProject(candidate = ".", options = {}) {
  if (options.apply !== void 0 && options.input === void 0) {
    throw new AdoptionError(
      "PCP_ADOPTION_INPUT_REQUIRED",
      "Applying adoption requires the same external semantic input used to create the preview."
    );
  }
  const planned = await planAdoption(candidate, options.input);
  if (!isPlanMaterial(planned)) {
    if (options.apply !== void 0) {
      throw new AdoptionError(
        "PCP_ADOPTION_NOT_APPLICABLE",
        `The ${planned.classification} candidate is not ready for an applicable adoption plan.`
      );
    }
    return planned;
  }
  if (options.apply === void 0) return planned.preview;
  if (!digestMatches(planned.preview.plan.plan_digest, options.apply)) {
    throw new AdoptionError(
      "PCP_PLAN_DIGEST_MISMATCH",
      "The approved digest does not match the fully recomputed current adoption plan."
    );
  }
  const root = await resolveCandidateRoot(candidate);
  let checkedFiles = 0;
  const transaction = await executeFilesystemTransaction(
    root,
    planned.preview.plan,
    planned.content_by_path,
    {
      ...options.fail_after_operation === void 0 ? {} : { fail_after_operation: options.fail_after_operation },
      verify_source_stability: async () => verifyAdoptionSourceStability(
        root,
        planned.inspection.inventory,
        planned.preview.plan,
        planned.content_by_path,
        planned.input.persistence
      ),
      validate_live: async () => {
        const validation = await validateCanonicalLayer(root, { clean_genesis: true });
        if (!validation.valid) {
          throw new AdoptionError(
            "PCP_ADOPTION_LIVE_INVALID",
            `Applied canonical layer failed validation: ${validation.diagnostics.slice(0, 8).map((item) => `${item.path}: ${item.message}`).join("; ")}`,
            true
          );
        }
        checkedFiles = validation.checked_files;
        const adapters = planned.preview.adapters ?? [];
        if (adapters.length === 0) {
          throw new AdoptionError(
            "PCP_ADOPTION_LIVE_INVALID",
            `State ${planned.preview.classification} apply did not retain its generated platform-adapter contract.`,
            true
          );
        }
        const adapterValidation = await validatePlatformAdapters(root, adapters);
        if (!adapterValidation.valid) {
          throw new AdoptionError(
            "PCP_ADOPTION_LIVE_INVALID",
            `Applied platform adapters failed validation: ${adapterValidation.diagnostics.slice(0, 8).map((item) => `${item.path}: ${item.message}`).join("; ")}`,
            true
          );
        }
        if (planned.input.persistence === "tracked") {
          const finalInspection = await inspectRepository(root);
          if (finalInspection.state !== "managed") {
            throw new AdoptionError(
              "PCP_ADOPTION_LIVE_INVALID",
              `Applied tracked project classified as ${finalInspection.state}, not managed.`,
              true
            );
          }
        }
      }
    }
  );
  return {
    schema_version: ADOPTION_SCHEMA_VERSION,
    command: "adopt",
    candidate: ".",
    classification: planned.preview.classification,
    plan_digest: planned.preview.plan.plan_digest,
    applied_operations: transaction.applied_operations,
    validation: { valid: true, checked_files: checkedFiles },
    clean_genesis: { actor_profiles: 0, active_events: 0, archived_events: 0 },
    recovery_cleaned: transaction.recovery_cleaned,
    mutated: true
  };
}

// src/application/manage-workstreams.ts
import { createHash as createHash9, randomUUID as randomUUID3 } from "node:crypto";
import {
  chmod as chmod2,
  lstat as lstat7,
  mkdtemp as mkdtemp4,
  open as open4,
  readFile as readFile13,
  realpath as realpath3,
  rename as rename3,
  rm as rm4,
  stat as stat4,
  unlink as unlink4,
  utimes as utimes2
} from "node:fs/promises";
import { tmpdir as tmpdir5 } from "node:os";
import path15 from "node:path";

// src/application/record-event.ts
import { createHash as createHash8, randomUUID as randomUUID2 } from "node:crypto";
import {
  lstat as lstat6,
  mkdtemp as mkdtemp3,
  open as open3,
  readFile as readFile12,
  readdir as readdir4,
  realpath as realpath2,
  rename as rename2,
  rm as rm3,
  unlink as unlink3,
  writeFile as writeFile4
} from "node:fs/promises";
import { tmpdir as tmpdir4 } from "node:os";
import path14 from "node:path";

// src/infrastructure/continuity-lock.ts
import { createHash as createHash7, randomUUID } from "node:crypto";
import { mkdir as mkdir3, open as open2, readFile as readFile11, stat as stat3, unlink as unlink2 } from "node:fs/promises";
import { tmpdir as tmpdir3 } from "node:os";
import path13 from "node:path";
import { setTimeout as delay } from "node:timers/promises";
var LOCK_WAIT_MS = 3e4;
var STALE_LOCK_MS = 5 * 6e4;
var ContinuityLockError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ContinuityLockError";
  }
};
function lockDigest(root) {
  const resolved = path13.resolve(root);
  const portableRoot = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return createHash7("sha256").update(portableRoot).digest("hex");
}
async function removeStaleLock(lockPath) {
  try {
    const metadata = await stat3(lockPath);
    if (Date.now() - metadata.mtimeMs <= STALE_LOCK_MS) return false;
    const contents = await readFile11(lockPath, "utf8");
    let ownerPid;
    try {
      const value = JSON.parse(contents);
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const pid = value.pid;
        if (typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0) ownerPid = pid;
      }
    } catch {
    }
    if (ownerPid !== void 0) {
      try {
        process.kill(ownerPid, 0);
        return false;
      } catch (error2) {
        if (error2.code !== "ESRCH") return false;
      }
    }
    await unlink2(lockPath);
    return true;
  } catch (error2) {
    if (error2.code === "ENOENT") return true;
    throw error2;
  }
}
async function withContinuityLock(projectRoot, operation) {
  const lockRoot = path13.join(tmpdir3(), "pcp-continuity-locks");
  await mkdir3(lockRoot, { recursive: true });
  const lockPath = path13.join(lockRoot, `${lockDigest(projectRoot)}.lock`);
  const token = randomUUID();
  const lockContents = `${JSON.stringify({ token, pid: process.pid, created_at: (/* @__PURE__ */ new Date()).toISOString() })}
`;
  const deadline = Date.now() + LOCK_WAIT_MS;
  let handle;
  while (handle === void 0) {
    try {
      handle = await open2(lockPath, "wx");
    } catch (error2) {
      const code2 = error2.code;
      if (process.platform === "win32" && code2 === "EPERM") {
        if (Date.now() >= deadline) {
          throw new ContinuityLockError("Another continuity operation is still running.");
        }
        await delay(20);
        continue;
      }
      if (code2 !== "EEXIST") throw error2;
      if (await removeStaleLock(lockPath)) continue;
      if (Date.now() >= deadline) {
        throw new ContinuityLockError("Another continuity operation is still running.");
      }
      await delay(20);
    }
  }
  try {
    await handle.writeFile(lockContents);
    await handle.sync();
    return await operation();
  } finally {
    await handle.close();
    const current = await readFile11(lockPath, "utf8").catch((error2) => {
      if (error2.code === "ENOENT") return void 0;
      throw error2;
    });
    if (current === lockContents) {
      await unlink2(lockPath).catch((error2) => {
        if (error2.code !== "ENOENT") throw error2;
      });
    }
  }
}

// src/application/record-event.ts
var ACTIVE_EVENT_DIRECTORY = ".pcp/continuity/events";
var ARCHIVE_EVENT_DIRECTORY = ".pcp/continuity/archive";
var ACTOR_DIRECTORY = ".pcp/continuity/actors";
var WORKSTREAM_PATH = ".pcp/state/workstreams.yaml";
var ACTIVE_EVENT_LIMIT = 64;
var ARCHIVE_BATCH_SIZE = 32;
var MAXIMUM_EVENT_INPUT_BYTES = 64 * 1024;
function isInside5(root, candidate) {
  const relative = path14.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path14.sep}`) && relative !== ".." && !path14.isAbsolute(relative);
}
function digest(value) {
  return createHash8("sha256").update(value).digest("hex");
}
function rootDigest(root) {
  const resolved = path14.resolve(root);
  return digest(process.platform === "win32" ? resolved.toLowerCase() : resolved);
}
function validationSummary(report) {
  return report.diagnostics.slice(0, 4).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
}
async function assertValidOperationalLayer(root) {
  const report = await validateCanonicalLayer(root, { archive_content: "filenames-only" });
  if (report.valid) return;
  const detail = validationSummary(report);
  throw new RecordingError(
    "PCP_RECORD_INVALID_LAYER",
    `Event recording requires a valid installed PCP layer${detail.length === 0 ? "." : `: ${detail}`}`
  );
}
function inputFailure(message) {
  return new RecordingError("PCP_RECORD_INPUT_INVALID", message);
}
async function loadEventInput(inputPath, projectRoot) {
  const resolvedInput = path14.resolve(inputPath);
  if (isInside5(projectRoot, resolvedInput)) {
    throw new RecordingError(
      "PCP_RECORD_INPUT_INSIDE_PROJECT",
      "Store transient event input outside the managed project so it cannot become duplicate project state."
    );
  }
  let metadata;
  try {
    metadata = await lstat6(resolvedInput);
  } catch (error2) {
    throw new RecordingError(
      "PCP_RECORD_INPUT_UNREADABLE",
      `Cannot read event input: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAXIMUM_EVENT_INPUT_BYTES) {
    throw new RecordingError(
      "PCP_RECORD_INPUT_UNSAFE",
      "Event input must be a regular non-symlink file no larger than 64 KiB."
    );
  }
  try {
    const [physicalInput, physicalProjectRoot] = await Promise.all([
      realpath2(resolvedInput),
      realpath2(projectRoot)
    ]);
    if (isInside5(physicalProjectRoot, physicalInput)) {
      throw new RecordingError(
        "PCP_RECORD_INPUT_INSIDE_PROJECT",
        "Store transient event input outside the managed project so it cannot become duplicate project state."
      );
    }
  } catch (error2) {
    if (error2 instanceof RecordingError) throw error2;
    throw new RecordingError(
      "PCP_RECORD_INPUT_UNREADABLE",
      `Cannot resolve event input safely: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const contents = await readFile12(resolvedInput, "utf8").catch((error2) => {
    throw new RecordingError(
      "PCP_RECORD_INPUT_UNREADABLE",
      `Cannot read event input: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  });
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw inputFailure(
      `Event input is not valid YAML: ${document.errors.map((error2) => error2.message).join("; ")}`
    );
  }
  let value;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  } catch (error2) {
    throw inputFailure(
      `Event input cannot be decoded safely: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const validation = validateSchema("event-input", value);
  if (!validation.valid) {
    const detail = validation.diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
    throw inputFailure(`Event input fails its release schema: ${detail}`);
  }
  return value;
}
async function listYamlNames(directory) {
  const entries = await readdir4(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".yaml")).map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
}
async function loadActiveEvents(root) {
  const directory = path14.join(root, ...ACTIVE_EVENT_DIRECTORY.split("/"));
  const names = await listYamlNames(directory);
  const events = [];
  for (const name of names) {
    const absolutePath = path14.join(directory, name);
    const contents = await readFile12(absolutePath);
    events.push({
      event_id: name.slice(0, -".yaml".length),
      absolute_path: absolutePath,
      contents,
      digest: digest(contents),
      event: parse(contents.toString("utf8"))
    });
  }
  return events;
}
async function loadArchiveIds(root) {
  const directory = path14.join(root, ...ARCHIVE_EVENT_DIRECTORY.split("/"));
  return (await listYamlNames(directory)).map((name) => name.slice(0, -".yaml".length));
}
async function loadSemanticRecords(root) {
  const actorRoot = path14.join(root, ...ACTOR_DIRECTORY.split("/"));
  const actorNames = await listYamlNames(actorRoot);
  const actors = await Promise.all(
    actorNames.map(async (name) => ({
      path: `continuity/actors/${name}`,
      value: parse(await readFile12(path14.join(actorRoot, name), "utf8"))
    }))
  );
  return {
    actors,
    workstreams: {
      path: "state/workstreams.yaml",
      value: parse(await readFile12(path14.join(root, ...WORKSTREAM_PATH.split("/")), "utf8"))
    }
  };
}
function normalizeEventInput(input, eventId) {
  const payload = {
    schema_version: 1,
    event_id: eventId,
    occurred_at: input.occurred_at ?? (/* @__PURE__ */ new Date()).toISOString(),
    actor: input.actor,
    recorded_by: input.recorded_by,
    basis: input.basis,
    ...input.change_key === void 0 ? {} : { change_key: input.change_key.trim() },
    kind: input.kind,
    scopes: [...input.scopes].sort((left, right) => left.localeCompare(right)),
    workstreams: [...input.workstreams].sort((left, right) => left.localeCompare(right)),
    summary: input.summary.trim(),
    ...input.rationale === void 0 ? {} : { rationale: input.rationale.trim() },
    affected_paths: [...input.affected_paths].sort((left, right) => left.localeCompare(right))
  };
  return { ...payload, payload_digest: eventPayloadDigest(payload) };
}
function assertEventSemantics(event, records) {
  const diagnostics = validateCanonicalSemantics({
    workstreams: records.workstreams,
    actors: records.actors,
    events: [{ path: `continuity/events/${event.event_id}.yaml`, value: event }],
    checkpoints: []
  });
  if (diagnostics.length === 0) return;
  const detail = diagnostics.slice(0, 6).map((diagnostic2) => `${diagnostic2.code}: ${diagnostic2.message}`).join("; ");
  throw new RecordingError(
    "PCP_RECORD_ATTRIBUTION_INVALID",
    `Event attribution or workstream references are invalid: ${detail}`
  );
}
async function appendWal2(walPath, sequence, action, eventId, status) {
  const handle = await open3(walPath, "a");
  try {
    await handle.writeFile(`${JSON.stringify({ sequence, action, event_id: eventId, status })}
`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function writeDurableFile(file, contents) {
  const handle = await open3(file, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
function injectedFailure(sequence, options) {
  if (options.fail_after_operation === sequence) {
    throw new RecordingError(
      "PCP_FAULT_INJECTED",
      `Injected event-recording failure after operation ${sequence}.`,
      true
    );
  }
}
async function verifyRollback(root, expectedActive, expectedArchiveIds) {
  const failures = [];
  try {
    const active = await loadActiveEvents(root);
    const actual = active.map((event) => `${event.event_id}:${event.digest}`);
    const expected = expectedActive.map((event) => `${event.event_id}:${event.digest}`);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push("active event identities or contents differ from the preimage");
    }
  } catch (error2) {
    failures.push(error2 instanceof Error ? error2.message : String(error2));
  }
  try {
    const archiveIds = await loadArchiveIds(root);
    if (JSON.stringify(archiveIds) !== JSON.stringify(expectedArchiveIds)) {
      failures.push("archive event identities differ from the preimage");
    }
  } catch (error2) {
    failures.push(error2 instanceof Error ? error2.message : String(error2));
  }
  return failures;
}
async function executeEventTransaction(root, event, activeEvents, archiveIds, options) {
  const rotation = activeEvents.length === ACTIVE_EVENT_LIMIT ? activeEvents.slice(0, ARCHIVE_BATCH_SIZE) : [];
  const archiveIdSet = new Set(archiveIds);
  const archiveCollision = rotation.find((event2) => archiveIdSet.has(event2.event_id));
  if (archiveCollision !== void 0) {
    throw new RecordingError(
      "PCP_RECORD_ARCHIVE_COLLISION",
      `Cannot rotate ${archiveCollision.event_id} because that identity already exists in the archive.`
    );
  }
  const eventRoot = path14.join(root, ...ACTIVE_EVENT_DIRECTORY.split("/"));
  const archiveRoot = path14.join(root, ...ARCHIVE_EVENT_DIRECTORY.split("/"));
  const eventPath = path14.join(eventRoot, `${event.event_id}.yaml`);
  const temporaryEventPath = path14.join(eventRoot, `.${event.event_id}.${randomUUID2()}.tmp`);
  const moved = [];
  let eventInstalled = false;
  let operation = 0;
  let recoveryRoot;
  let walPath;
  try {
    recoveryRoot = await mkdtemp3(
      path14.join(tmpdir4(), `pcp-event-transaction-${rootDigest(root).slice(0, 12)}-`)
    );
    walPath = path14.join(recoveryRoot, "operations.jsonl");
    await writeFile4(walPath, "", { flag: "wx" });
    await writeDurableFile(temporaryEventPath, stringify3(event));
    for (const source of rotation) {
      operation += 1;
      await appendWal2(walPath, operation, "archive", source.event_id, "prepared");
      await rename2(source.absolute_path, path14.join(archiveRoot, `${source.event_id}.yaml`));
      moved.push(source);
      await appendWal2(walPath, operation, "archive", source.event_id, "applied");
      injectedFailure(operation, options);
    }
    operation += 1;
    await appendWal2(walPath, operation, "record", event.event_id, "prepared");
    await rename2(temporaryEventPath, eventPath);
    eventInstalled = true;
    await appendWal2(walPath, operation, "record", event.event_id, "applied");
    injectedFailure(operation, options);
    const live = await validateCanonicalLayer(root, { archive_content: "filenames-only" });
    if (!live.valid) {
      throw new RecordingError(
        "PCP_RECORD_LIVE_INVALID",
        `Recorded continuity state is invalid: ${validationSummary(live)}`,
        true
      );
    }
    operation += 1;
    injectedFailure(operation, options);
    await rm3(recoveryRoot, { recursive: true, force: false });
    return {
      schema_version: 1,
      command: "record",
      status: "recorded",
      event_id: event.event_id,
      event_path: `${ACTIVE_EVENT_DIRECTORY}/${event.event_id}.yaml`,
      payload_digest: event.payload_digest,
      occurred_at: event.occurred_at,
      summary: event.summary,
      active_events: activeEvents.length - rotation.length + 1,
      archived_events_moved: rotation.length,
      event_created: true,
      mutated: true
    };
  } catch (error2) {
    const rollbackFailures = [];
    if (eventInstalled) {
      try {
        await unlink3(eventPath);
        if (walPath !== void 0) {
          await appendWal2(
            walPath,
            rotation.length + 1,
            "record",
            event.event_id,
            "rolled-back"
          ).catch(() => void 0);
        }
      } catch (rollbackError) {
        if (rollbackError.code !== "ENOENT") {
          rollbackFailures.push(
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          );
        }
      }
    }
    await unlink3(temporaryEventPath).catch((rollbackError) => {
      if (rollbackError.code !== "ENOENT") {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    });
    for (const source of [...moved].reverse()) {
      try {
        await rename2(path14.join(archiveRoot, `${source.event_id}.yaml`), source.absolute_path);
        if (walPath !== void 0) {
          await appendWal2(
            walPath,
            rotation.indexOf(source) + 1,
            "archive",
            source.event_id,
            "rolled-back"
          ).catch(() => void 0);
        }
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    rollbackFailures.push(...await verifyRollback(root, activeEvents, archiveIds));
    if (rollbackFailures.length > 0) {
      throw new RecordingError(
        "PCP_RECORD_ROLLBACK_FAILED",
        `Event recording failed (${error2 instanceof Error ? error2.message : String(error2)}) and exact rollback could not be verified: ${rollbackFailures.join("; ")}`,
        true,
        true
      );
    }
    if (recoveryRoot !== void 0) {
      try {
        await rm3(recoveryRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        throw new RecordingError(
          "PCP_RECORD_RECOVERY_CLEANUP_FAILED",
          `Event recording failed and project state was restored, but recovery data could not be removed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          false,
          true
        );
      }
    }
    if (error2 instanceof RecordingError) {
      throw new RecordingError(error2.code, error2.message, false, false);
    }
    throw new RecordingError(
      "PCP_RECORD_TRANSACTION_FAILED",
      error2 instanceof Error ? error2.message : String(error2)
    );
  }
}
async function recordEventUnderLock(root, input, options) {
  await assertValidOperationalLayer(root);
  const [activeEvents, archiveIds, semanticRecords] = await Promise.all([
    loadActiveEvents(root),
    loadArchiveIds(root),
    loadSemanticRecords(root)
  ]);
  if (activeEvents.length > ACTIVE_EVENT_LIMIT) {
    throw new RecordingError(
      "PCP_RECORD_ACTIVE_LIMIT_EXCEEDED",
      `Active continuity history already exceeds ${ACTIVE_EVENT_LIMIT}; repair it before recording.`
    );
  }
  if (input.change_key !== void 0) {
    const normalizedKey = input.change_key.trim();
    const duplicate = activeEvents.find((item) => item.event.change_key === normalizedKey);
    if (duplicate !== void 0) {
      throw new RecordingError(
        "PCP_RECORD_DUPLICATE_CHANGE",
        `Active event ${duplicate.event_id} already records change key ${normalizedKey}.`
      );
    }
  }
  const event = normalizeEventInput(
    input,
    nextEventId([...activeEvents.map((item) => item.event_id), ...archiveIds])
  );
  const schema4 = validateSchema("event", event);
  if (!schema4.valid) {
    throw new RecordingError(
      "PCP_RECORD_EVENT_INVALID",
      "The normalized event failed its canonical release schema."
    );
  }
  assertEventSemantics(event, semanticRecords);
  return executeEventTransaction(root, event, activeEvents, archiveIds, options);
}
async function recordEvent(projectRoot, inputPath, options = {}) {
  const root = path14.resolve(projectRoot);
  try {
    const input = await loadEventInput(inputPath, root);
    return await withContinuityLock(root, () => recordEventUnderLock(root, input, options));
  } catch (error2) {
    if (error2 instanceof ContinuityLockError) {
      throw new RecordingError(
        "PCP_RECORD_LOCKED",
        "Another actor registration or continuity operation is still running for this project."
      );
    }
    if (error2 instanceof RecordingError) throw error2;
    throw new RecordingError(
      "PCP_RECORD_FAILED",
      error2 instanceof Error ? error2.message : String(error2)
    );
  }
}

// src/domain/workstreams.ts
var WorkstreamError = class extends Error {
  constructor(code2, message, mutated = false, recovery_retained = false) {
    super(message);
    this.code = code2;
    this.mutated = mutated;
    this.recovery_retained = recovery_retained;
    this.name = "WorkstreamError";
  }
  code;
  mutated;
  recovery_retained;
};
function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
function normalizeEvidence(evidence) {
  return evidence.map((item) => ({ criterion: item.criterion.trim(), proof: item.proof.trim() })).sort(
    (left, right) => left.criterion.localeCompare(right.criterion) || left.proof.localeCompare(right.proof)
  );
}
function normalizeWorkstream(workstream) {
  return {
    workstream_id: workstream.workstream_id,
    name: workstream.name.trim(),
    kind: workstream.kind,
    status: workstream.status,
    paths: sorted(workstream.paths),
    areas: sorted(workstream.areas),
    dependencies: sorted(workstream.dependencies),
    completion: {
      criteria: sorted(workstream.completion.criteria.map((criterion) => criterion.trim())),
      evidence: normalizeEvidence(workstream.completion.evidence),
      ...workstream.completion.announcement === void 0 ? {} : { announcement: workstream.completion.announcement.trim() }
    }
  };
}
function replaceWorkstream(registry, workstream) {
  return {
    schema_version: 1,
    workstreams: [
      ...registry.workstreams.filter((item) => item.workstream_id !== workstream.workstream_id),
      workstream
    ].sort((left, right) => left.workstream_id.localeCompare(right.workstream_id))
  };
}
function existingWorkstream(registry, workstreamId) {
  const existing = registry.workstreams.find((item) => item.workstream_id === workstreamId);
  if (existing === void 0) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_NOT_FOUND",
      `Workstream ${workstreamId} does not exist.`
    );
  }
  return existing;
}
function assertUpdateTransition(previous, next) {
  if (previous.kind !== next.kind) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_KIND_IMMUTABLE",
      `Workstream ${previous.workstream_id} cannot change kind from ${previous.kind} to ${next.kind}.`
    );
  }
  if (previous.status === "complete" || previous.status === "cancelled") {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_TERMINAL",
      `Workstream ${previous.workstream_id} is ${previous.status} and cannot be updated.`
    );
  }
  if (next.status === "complete") {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_COMPLETE_REQUIRED",
      `Use the complete operation to finish workstream ${previous.workstream_id}.`
    );
  }
  const allowed = {
    planned: ["planned", "active", "blocked", "cancelled"],
    active: ["active", "blocked", "cancelled"],
    blocked: ["blocked", "active", "cancelled"],
    complete: [],
    cancelled: []
  };
  if (!allowed[previous.status].includes(next.status)) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_TRANSITION_INVALID",
      `Workstream ${previous.workstream_id} cannot move from ${previous.status} to ${next.status}.`
    );
  }
}
function prepareCreate(registry, input) {
  const workstream = normalizeWorkstream(input.workstream);
  if (registry.workstreams.some((item) => item.workstream_id === workstream.workstream_id)) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_EXISTS",
      `Workstream ${workstream.workstream_id} already exists.`
    );
  }
  if (workstream.status === "complete" || workstream.status === "cancelled") {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_CREATE_STATUS_INVALID",
      "A new workstream must start as planned, active, or blocked."
    );
  }
  return { registry: replaceWorkstream(registry, workstream), workstream };
}
function prepareUpdate(registry, input) {
  const workstream = normalizeWorkstream(input.workstream);
  const previous = existingWorkstream(registry, workstream.workstream_id);
  assertUpdateTransition(previous, workstream);
  if (canonicalJson(previous) === canonicalJson(workstream)) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_NO_CHANGE",
      `Workstream ${workstream.workstream_id} already has the requested state.`
    );
  }
  return { registry: replaceWorkstream(registry, workstream), workstream };
}
function prepareCompletion(registry, input) {
  const previous = existingWorkstream(registry, input.workstream_id);
  if (previous.status !== "active" && previous.status !== "blocked") {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_NOT_COMPLETABLE",
      `Workstream ${previous.workstream_id} is ${previous.status}; only active or blocked work can be completed.`
    );
  }
  const evidence = normalizeEvidence(input.evidence);
  const criterionCounts = /* @__PURE__ */ new Map();
  for (const item of evidence) {
    criterionCounts.set(item.criterion, (criterionCounts.get(item.criterion) ?? 0) + 1);
  }
  const criteria = previous.completion.criteria.map((criterion) => criterion.trim());
  const unknown = evidence.find((item) => !criteria.includes(item.criterion));
  if (unknown !== void 0) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_EVIDENCE_UNKNOWN",
      `Completion evidence does not match a criterion: ${unknown.criterion}`
    );
  }
  const duplicate = [...criterionCounts].find(([, count]) => count !== 1);
  if (duplicate !== void 0) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_EVIDENCE_DUPLICATE",
      `Completion criterion has more than one proof: ${duplicate[0]}`
    );
  }
  const missing = criteria.find((criterion) => !criterionCounts.has(criterion));
  if (missing !== void 0 || evidence.length !== criteria.length) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_EVIDENCE_INCOMPLETE",
      `Completion requires exactly one proof for every criterion${missing === void 0 ? "." : `; missing: ${missing}`}`
    );
  }
  for (const dependencyId of previous.dependencies) {
    const dependency = existingWorkstream(registry, dependencyId);
    if (dependency.status !== "complete") {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_DEPENDENCY_INCOMPLETE",
        `Workstream ${previous.workstream_id} cannot complete before ${dependencyId}.`
      );
    }
  }
  const workstream = normalizeWorkstream({
    ...previous,
    status: "complete",
    completion: {
      criteria: previous.completion.criteria,
      evidence,
      announcement: input.announcement.trim()
    }
  });
  return { registry: replaceWorkstream(registry, workstream), workstream };
}
function prepareWorkstreamMutation(registry, input) {
  if (input.operation === "create") return prepareCreate(registry, input);
  if (input.operation === "update") return prepareUpdate(registry, input);
  return prepareCompletion(registry, input);
}

// src/application/manage-workstreams.ts
var WORKSTREAM_PATH2 = ".pcp/state/workstreams.yaml";
var STATUS_VIEW_PATH = ".pcp/views/10-status.generated.md";
var STATUS_SOURCES = [
  "state/project.yaml",
  "state/projects.yaml",
  "state/workstreams.yaml",
  "state/vcs-policy.yaml"
];
var MAXIMUM_INPUT_BYTES = 64 * 1024;
function sha2562(value) {
  return createHash9("sha256").update(value).digest("hex");
}
function rootDigest2(root) {
  const resolved = path15.resolve(root);
  return sha2562(process.platform === "win32" ? resolved.toLowerCase() : resolved);
}
function isInside6(root, candidate) {
  const relative = path15.relative(root, candidate);
  return relative === "" || !relative.startsWith(`..${path15.sep}`) && relative !== ".." && !path15.isAbsolute(relative);
}
function layerSummary(report) {
  return report.diagnostics.slice(0, 4).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
}
async function assertValidOperationalLayer2(root) {
  const report = await validateCanonicalLayer(root, { archive_content: "filenames-only" });
  if (report.valid) return;
  const detail = layerSummary(report);
  throw new WorkstreamError(
    "PCP_WORKSTREAM_INVALID_LAYER",
    `Workstream operations require a valid installed PCP layer${detail.length === 0 ? "." : `: ${detail}`}`
  );
}
function inputFailure2(message) {
  return new WorkstreamError("PCP_WORKSTREAM_INPUT_INVALID", message);
}
async function loadWorkstreamInput(inputPath, projectRoot, expectedOperation) {
  const resolvedInput = path15.resolve(inputPath);
  if (isInside6(projectRoot, resolvedInput)) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_INPUT_INSIDE_PROJECT",
      "Store transient workstream input outside the managed project so it cannot become duplicate project state."
    );
  }
  let metadata;
  try {
    metadata = await lstat7(resolvedInput);
  } catch (error2) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_INPUT_UNREADABLE",
      `Cannot read workstream input: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAXIMUM_INPUT_BYTES) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_INPUT_UNSAFE",
      "Workstream input must be a regular non-symlink file no larger than 64 KiB."
    );
  }
  try {
    const [physicalInput, physicalProjectRoot] = await Promise.all([
      realpath3(resolvedInput),
      realpath3(projectRoot)
    ]);
    if (isInside6(physicalProjectRoot, physicalInput)) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_INPUT_INSIDE_PROJECT",
        "Store transient workstream input outside the managed project so it cannot become duplicate project state."
      );
    }
  } catch (error2) {
    if (error2 instanceof WorkstreamError) throw error2;
    throw new WorkstreamError(
      "PCP_WORKSTREAM_INPUT_UNREADABLE",
      `Cannot resolve workstream input safely: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const contents = await readFile13(resolvedInput, "utf8").catch((error2) => {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_INPUT_UNREADABLE",
      `Cannot read workstream input: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  });
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw inputFailure2(
      `Workstream input is not valid YAML: ${document.errors.map((error2) => error2.message).join("; ")}`
    );
  }
  let value;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  } catch (error2) {
    throw inputFailure2(
      `Workstream input cannot be decoded safely: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const validation = validateSchema("workstream-operation-input", value);
  if (!validation.valid) {
    const detail = validation.diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
    throw inputFailure2(`Workstream input fails its release schema: ${detail}`);
  }
  const input = value;
  if (input.operation !== expectedOperation) {
    throw inputFailure2(
      `The ${expectedOperation} command requires operation: ${expectedOperation}, not ${input.operation}.`
    );
  }
  return input;
}
function parseRegistry(bytes) {
  const document = parseDocument(bytes.toString("utf8"), {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_REGISTRY_INVALID",
      "The canonical workstream registry is not valid YAML."
    );
  }
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  const schema4 = validateSchema("workstreams", value);
  if (!schema4.valid) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_REGISTRY_INVALID",
      "The canonical workstream registry fails its release schema."
    );
  }
  return value;
}
function parseSource(contents, relativePath) {
  const document = parseDocument(contents, {
    prettyErrors: false,
    strict: true,
    uniqueKeys: true
  });
  if (document.errors.length > 0) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_RENDER_SOURCE_INVALID",
      `Cannot render the status view because ${relativePath} is not valid YAML.`
    );
  }
  const value = document.toJS({ mapAsMap: false, maxAliasCount: 50 });
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_RENDER_SOURCE_INVALID",
      `Cannot render the status view because ${relativePath} is not an object.`
    );
  }
  return value;
}
async function desiredStatusView(root, workstreamContents, registry) {
  const layerRoot = path15.join(root, ".pcp");
  const contents = await Promise.all(
    STATUS_SOURCES.map(async (relativePath) => ({
      path: relativePath,
      contents: relativePath === "state/workstreams.yaml" ? workstreamContents : await readFile13(path15.join(layerRoot, ...relativePath.split("/")), "utf8")
    }))
  );
  const values = /* @__PURE__ */ new Map();
  for (const source of contents) {
    values.set(
      source.path,
      source.path === "state/workstreams.yaml" ? registry : parseSource(source.contents, source.path)
    );
  }
  const sourceDigest = canonicalSourceDigestFromContents(contents);
  return Buffer.from(renderCanonicalStatusView(values, sourceDigest), "utf8");
}
async function loadRegistry(root) {
  const absolutePath = path15.join(root, ...WORKSTREAM_PATH2.split("/"));
  const metadata = await lstat7(absolutePath).catch((error2) => {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_REGISTRY_UNREADABLE",
      `Cannot read the canonical workstream registry: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  });
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new WorkstreamError(
      "PCP_WORKSTREAM_REGISTRY_UNSAFE",
      "The canonical workstream registry must be a regular non-symlink file."
    );
  }
  const bytes = await readFile13(absolutePath);
  return {
    absolute_path: absolutePath,
    bytes,
    digest: sha2562(bytes),
    registry: parseRegistry(bytes)
  };
}
function assertRegistrySemantics(registry) {
  const diagnostics = validateCanonicalSemantics({
    workstreams: { path: "state/workstreams.yaml", value: registry },
    actors: [],
    events: [],
    checkpoints: []
  });
  if (diagnostics.length === 0) return;
  const detail = diagnostics.slice(0, 8).map((diagnostic2) => `${diagnostic2.code}: ${diagnostic2.message}`).join("; ");
  throw new WorkstreamError(
    "PCP_WORKSTREAM_STATE_INVALID",
    `The requested workstream state is inconsistent: ${detail}`
  );
}
async function writeDurableExclusive(file, bytes) {
  const handle = await open4(file, "wx");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function exists(file) {
  try {
    await lstat7(file);
    return true;
  } catch (error2) {
    if (error2.code === "ENOENT") return false;
    throw error2;
  }
}
async function replaceWithTemporary(target, temporary) {
  try {
    await rename3(temporary, target);
  } catch (error2) {
    const code2 = error2.code;
    if (code2 !== "EEXIST" && code2 !== "EPERM") throw error2;
    const held = `${temporary}.previous`;
    await rename3(target, held);
    try {
      await rename3(temporary, target);
      await unlink4(held);
    } catch (replacementError) {
      if (await exists(target)) await unlink4(target);
      await rename3(held, target);
      throw replacementError;
    }
  }
}
async function installBytes(target, bytes) {
  const temporary = path15.join(
    path15.dirname(target),
    `.${path15.basename(target)}.${randomUUID3()}.tmp`
  );
  try {
    await writeDurableExclusive(temporary, bytes);
    await replaceWithTemporary(target, temporary);
  } finally {
    if (await exists(temporary)) await unlink4(temporary);
  }
}
async function restoreRegistry(target, bytes, metadata) {
  await installBytes(target, bytes);
  await chmod2(target, metadata.mode);
  await utimes2(target, metadata.atime, metadata.mtime);
}
function eventInput(input, workstreamId) {
  return {
    schema_version: 1,
    ...input.occurred_at === void 0 ? {} : { occurred_at: input.occurred_at },
    actor: input.actor,
    recorded_by: input.recorded_by,
    basis: input.basis,
    ...input.change_key === void 0 ? {} : { change_key: input.change_key },
    kind: "workstream",
    scopes: ["workstream-registry"],
    workstreams: [workstreamId],
    summary: input.summary,
    ...input.rationale === void 0 ? {} : { rationale: input.rationale },
    affected_paths: [WORKSTREAM_PATH2, STATUS_VIEW_PATH]
  };
}
function injectedFailure2(operation, options) {
  if (options.fail_after_operation === operation) {
    throw new WorkstreamError(
      "PCP_FAULT_INJECTED",
      `Injected workstream failure after operation ${operation}.`,
      true
    );
  }
}
async function executeMutation(root, loaded, input, nextRegistry, workstreamId, options) {
  const nextBytes = Buffer.from(stringify3(nextRegistry), "utf8");
  const nextDigest = sha2562(nextBytes);
  const statusViewPath = path15.join(root, ...STATUS_VIEW_PATH.split("/"));
  const [metadata, viewMetadata, viewBytes, nextViewBytes] = await Promise.all([
    stat4(loaded.absolute_path),
    stat4(statusViewPath),
    readFile13(statusViewPath),
    desiredStatusView(root, nextBytes.toString("utf8"), nextRegistry)
  ]);
  const registryMetadata = {
    mode: metadata.mode,
    atime: metadata.atime,
    mtime: metadata.mtime
  };
  const statusViewMetadata = {
    mode: viewMetadata.mode,
    atime: viewMetadata.atime,
    mtime: viewMetadata.mtime
  };
  let recoveryRoot;
  let registryInstalled = false;
  let statusViewInstalled = false;
  try {
    recoveryRoot = await mkdtemp4(
      path15.join(tmpdir5(), `pcp-workstream-transaction-${rootDigest2(root).slice(0, 12)}-`)
    );
    await writeDurableExclusive(path15.join(recoveryRoot, "workstreams.preimage"), loaded.bytes);
    await writeDurableExclusive(path15.join(recoveryRoot, "status-view.preimage"), viewBytes);
    await writeDurableExclusive(
      path15.join(recoveryRoot, "transaction.json"),
      Buffer.from(
        `${JSON.stringify({
          schema_version: 1,
          target: WORKSTREAM_PATH2,
          digest_before: loaded.digest,
          digest_after: nextDigest,
          generated_view: STATUS_VIEW_PATH,
          generated_view_digest_before: sha2562(viewBytes),
          generated_view_digest_after: sha2562(nextViewBytes)
        })}
`,
        "utf8"
      )
    );
    await installBytes(loaded.absolute_path, nextBytes);
    registryInstalled = true;
    injectedFailure2(1, options);
    await installBytes(statusViewPath, nextViewBytes);
    statusViewInstalled = true;
    injectedFailure2(2, options);
    const nestedFailure = options.fail_after_operation === void 0 || options.fail_after_operation <= 2 ? void 0 : options.fail_after_operation - 2;
    const recorded = await recordEventUnderLock(root, eventInput(input, workstreamId), {
      ...nestedFailure === void 0 ? {} : { fail_after_operation: nestedFailure }
    });
    let recoveryRetained = false;
    try {
      await rm4(recoveryRoot, { recursive: true, force: false });
    } catch {
      recoveryRetained = true;
    }
    return {
      schema_version: 1,
      command: "workstream",
      operation: input.operation,
      status: input.operation === "create" ? "created" : input.operation === "update" ? "updated" : "completed",
      workstream_id: workstreamId,
      registry_path: WORKSTREAM_PATH2,
      registry_digest_before: loaded.digest,
      registry_digest_after: nextDigest,
      event_id: recorded.event_id,
      event_path: recorded.event_path,
      event_payload_digest: recorded.payload_digest,
      announcement: input.operation === "complete" ? input.announcement.trim() : null,
      event_created: true,
      mutated: true,
      recovery_retained: recoveryRetained
    };
  } catch (error2) {
    const rollbackFailures = [];
    if (statusViewInstalled) {
      try {
        await restoreRegistry(statusViewPath, viewBytes, statusViewMetadata);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    if (registryInstalled) {
      try {
        await restoreRegistry(loaded.absolute_path, loaded.bytes, registryMetadata);
      } catch (rollbackError) {
        rollbackFailures.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    try {
      const restored = await readFile13(loaded.absolute_path);
      if (!restored.equals(loaded.bytes)) {
        rollbackFailures.push("workstream registry bytes differ from the preimage");
      }
    } catch (rollbackError) {
      rollbackFailures.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      );
    }
    try {
      const restoredView = await readFile13(statusViewPath);
      if (!restoredView.equals(viewBytes)) {
        rollbackFailures.push("generated status view bytes differ from the preimage");
      }
    } catch (rollbackError) {
      rollbackFailures.push(
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
      );
    }
    if (rollbackFailures.length === 0) {
      const report = await validateCanonicalLayer(root, { archive_content: "filenames-only" });
      if (!report.valid)
        rollbackFailures.push(`restored layer is invalid: ${layerSummary(report)}`);
    }
    if (rollbackFailures.length > 0) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_ROLLBACK_FAILED",
        `Workstream mutation failed (${error2 instanceof Error ? error2.message : String(error2)}) and exact rollback could not be verified: ${rollbackFailures.join("; ")}`,
        true,
        true
      );
    }
    let recoveryRetained = error2 instanceof RecordingError && error2.recovery_retained;
    if (recoveryRoot !== void 0) {
      try {
        await rm4(recoveryRoot, { recursive: true, force: true });
      } catch {
        recoveryRetained = true;
      }
    }
    const code2 = error2 instanceof WorkstreamError || error2 instanceof RecordingError ? error2.code : "PCP_WORKSTREAM_TRANSACTION_FAILED";
    throw new WorkstreamError(
      code2,
      error2 instanceof Error ? error2.message : String(error2),
      false,
      recoveryRetained
    );
  }
}
async function underLock(root, operation) {
  try {
    return await withContinuityLock(root, operation);
  } catch (error2) {
    if (error2 instanceof ContinuityLockError) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_LOCKED",
        "Another actor registration or continuity operation is still running for this project."
      );
    }
    throw error2;
  }
}
async function validateWorkstreamRegistry(projectRoot, workstreamId) {
  const root = path15.resolve(projectRoot);
  return underLock(root, async () => {
    await assertValidOperationalLayer2(root);
    const loaded = await loadRegistry(root);
    const workstream = workstreamId === void 0 ? null : loaded.registry.workstreams.find((item) => item.workstream_id === workstreamId) ?? void 0;
    if (workstream === void 0) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_NOT_FOUND",
        `Workstream ${workstreamId ?? ""} does not exist.`
      );
    }
    return {
      schema_version: 1,
      command: "workstream",
      operation: "validate",
      status: "valid",
      registry_path: WORKSTREAM_PATH2,
      registry_digest: loaded.digest,
      workstream_count: loaded.registry.workstreams.length,
      workstream,
      diagnostics: [],
      event_created: false,
      mutated: false
    };
  });
}
async function mutateWorkstream(projectRoot, operation, inputPath, options = {}) {
  const root = path15.resolve(projectRoot);
  const input = await loadWorkstreamInput(inputPath, root, operation);
  return underLock(root, async () => {
    await assertValidOperationalLayer2(root);
    const loaded = await loadRegistry(root);
    if (input.expected_registry_digest !== loaded.digest) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_REGISTRY_CHANGED",
        "The workstream registry changed after this operation was prepared; validate and rebuild the input."
      );
    }
    const prepared = prepareWorkstreamMutation(loaded.registry, input);
    const schema4 = validateSchema("workstreams", prepared.registry);
    if (!schema4.valid) {
      throw new WorkstreamError(
        "PCP_WORKSTREAM_STATE_INVALID",
        "The requested workstream state fails its release schema."
      );
    }
    assertRegistrySemantics(prepared.registry);
    return executeMutation(
      root,
      loaded,
      input,
      prepared.registry,
      prepared.workstream.workstream_id,
      options
    );
  });
}

// src/application/register-actor.ts
import { mkdir as mkdir4, open as open5, readFile as readFile14, readdir as readdir5, rm as rm5, unlink as unlink5 } from "node:fs/promises";
import path16 from "node:path";

// src/domain/registration.ts
var ACTOR_TYPES = ["agent", "human"];
var ACTOR_CLIENTS = [
  "codex",
  "antigravity",
  "claude-code-desktop",
  "github-copilot-vscode",
  "cursor",
  "human",
  "other"
];
var RegistrationError = class extends Error {
  constructor(code2, message, mutated = false) {
    super(message);
    this.code = code2;
    this.mutated = mutated;
    this.name = "RegistrationError";
  }
  code;
  mutated;
};
var SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
var ACTOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9A-HJKMNP-TV-Z]{10}$/u;
var nextExecutionId = monotonicFactory();
function isActorType(value) {
  return ACTOR_TYPES.some((candidate) => candidate === value);
}
function isActorClient(value) {
  return ACTOR_CLIENTS.some((candidate) => candidate === value);
}
function normalizeMachineLabel(hostname2) {
  const label = hostname2.normalize("NFKD").toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-+|-+$/gu, "").slice(0, 128).replaceAll(/-+$/gu, "");
  if (label.length === 0) {
    throw new RegistrationError(
      "PCP_REGISTRATION_MACHINE_LABEL_INVALID",
      "The machine name cannot be converted to a PCP machine label; pass --machine-label."
    );
  }
  return label;
}
function normalizeActorIdentity(input) {
  const actorType = input.actor_type ?? "agent";
  if (!isActorType(actorType)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_ACTOR_TYPE_INVALID",
      `Actor type must be one of: ${ACTOR_TYPES.join(", ")}.`
    );
  }
  const client = input.client ?? (actorType === "human" ? "human" : void 0);
  if (client === void 0) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CLIENT_REQUIRED",
      `Agent registration requires --client (${ACTOR_CLIENTS.filter((item) => item !== "human").join(", ")}).`
    );
  }
  if (!isActorClient(client)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CLIENT_INVALID",
      `Client must be one of: ${ACTOR_CLIENTS.join(", ")}.`
    );
  }
  if (actorType === "human" && client !== "human") {
    throw new RegistrationError(
      "PCP_REGISTRATION_CLIENT_MISMATCH",
      "Human registration must use the human client."
    );
  }
  if (actorType === "agent" && client === "human") {
    throw new RegistrationError(
      "PCP_REGISTRATION_CLIENT_MISMATCH",
      "Agent registration cannot use the human client."
    );
  }
  if (!SLUG_PATTERN.test(input.machine_label) || input.machine_label.length > 128) {
    throw new RegistrationError(
      "PCP_REGISTRATION_MACHINE_LABEL_INVALID",
      "Machine label must be a lowercase kebab-case slug with at most 128 characters."
    );
  }
  if (input.actor_id !== void 0 && !ACTOR_ID_PATTERN.test(input.actor_id)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_ACTOR_ID_INVALID",
      "Actor ID must end in a 10-character uppercase Crockford suffix."
    );
  }
  return {
    actor_type: actorType,
    client,
    machine_label: input.machine_label,
    ...input.actor_id === void 0 ? {} : { actor_id: input.actor_id }
  };
}
function createActorId(identity) {
  const actorLabel = identity.actor_type === "human" ? "human" : identity.client;
  return `${actorLabel}-${identity.machine_label}-${ulid().slice(-10)}`;
}
function createExecutionId() {
  return nextExecutionId();
}
function actorIdentityMatches(profile, identity) {
  return profile.actor_type === identity.actor_type && profile.client === identity.client && profile.machine_label === identity.machine_label;
}

// src/application/register-actor.ts
var ACTOR_DIRECTORY2 = ".pcp/continuity/actors";
var CACHE_DIRECTORY = ".pcp/runtime/actors";
function portablePath(value) {
  return value.split(path16.sep).join("/");
}
function profileRelativePath(actorId) {
  return `${ACTOR_DIRECTORY2}/${actorId}.yaml`;
}
function cacheRelativePath(identity) {
  return `${CACHE_DIRECTORY}/${identity.actor_type}-${identity.client}-${identity.machine_label}.json`;
}
function validationSummary2(report) {
  return report.diagnostics.slice(0, 3).map((diagnostic2) => `${diagnostic2.path}: ${diagnostic2.message}`).join("; ");
}
async function assertValidCanonicalLayer(projectRoot) {
  const report = await validateCanonicalLayer(projectRoot, { archive_content: "filenames-only" });
  if (report.valid) return;
  const detail = validationSummary2(report);
  throw new RegistrationError(
    "PCP_REGISTRATION_INVALID_LAYER",
    `Actor registration requires a valid installed PCP layer${detail.length === 0 ? "." : `: ${detail}`}`
  );
}
async function readOptionalText(file) {
  try {
    return await readFile14(file, "utf8");
  } catch (error2) {
    if (error2.code === "ENOENT") return void 0;
    throw error2;
  }
}
function actorProfile(value, relativePath) {
  const result = validateSchema("actor-profile", value);
  if (!result.valid) {
    throw new RegistrationError(
      "PCP_REGISTRATION_INVALID_LAYER",
      `Actor profile failed its release schema: ${relativePath}.`
    );
  }
  return value;
}
async function loadActorProfiles(projectRoot) {
  const actorRoot = path16.join(projectRoot, ...ACTOR_DIRECTORY2.split("/"));
  const entries = await readdir5(actorRoot, { withFileTypes: true });
  const profiles = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".yaml")) continue;
    const relativePath = `${ACTOR_DIRECTORY2}/${entry.name}`;
    const contents = await readFile14(path16.join(actorRoot, entry.name), "utf8");
    let value;
    try {
      value = parse(contents);
    } catch {
      throw new RegistrationError(
        "PCP_REGISTRATION_INVALID_LAYER",
        `Actor profile is not valid YAML: ${relativePath}.`
      );
    }
    profiles.push(actorProfile(value, relativePath));
  }
  return profiles;
}
function parseIdentityCache(contents, identity) {
  let value;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_INVALID",
      "The local actor identity cache is not valid JSON."
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_INVALID",
      "The local actor identity cache must be an object."
    );
  }
  const record = value;
  const expectedKeys = ["actor_id", "actor_type", "client", "machine_label", "schema_version"];
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_INVALID",
      "The local actor identity cache has an unexpected shape."
    );
  }
  let normalized;
  try {
    normalized = normalizeActorIdentity({
      actor_type: typeof record.actor_type === "string" ? record.actor_type : "",
      client: typeof record.client === "string" ? record.client : "",
      machine_label: typeof record.machine_label === "string" ? record.machine_label : "",
      actor_id: typeof record.actor_id === "string" ? record.actor_id : ""
    });
  } catch {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_INVALID",
      "The local actor identity cache contains invalid identity fields."
    );
  }
  if (record.schema_version !== 1 || !sameIdentity(normalized, identity)) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_MISMATCH",
      "The local actor identity cache does not match the requested client and machine."
    );
  }
  if (normalized.actor_id === void 0) {
    throw new RegistrationError(
      "PCP_REGISTRATION_CACHE_INVALID",
      "The local actor identity cache has no actor ID."
    );
  }
  return {
    schema_version: 1,
    actor_id: normalized.actor_id,
    actor_type: normalized.actor_type,
    client: normalized.client,
    machine_label: normalized.machine_label
  };
}
function sameIdentity(left, right) {
  return left.actor_type === right.actor_type && left.client === right.client && left.machine_label === right.machine_label;
}
async function createExclusiveFile(file, contents, onCreate) {
  const handle = await open5(file, "wx");
  try {
    onCreate();
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function rollbackUnlink(file, failures) {
  await unlink5(file).catch((error2) => {
    if (error2.code !== "ENOENT") failures.push(error2);
  });
}
async function rollbackCreatedPaths(input) {
  const failures = [];
  if (input.cache_path !== void 0) {
    await rollbackUnlink(input.cache_path, failures);
  }
  if (input.profile_path !== void 0) {
    await rollbackUnlink(input.profile_path, failures);
  }
  if (input.runtime_root !== void 0) {
    await rm5(input.runtime_root, { recursive: true, force: true }).catch(
      (error2) => failures.push(error2)
    );
  }
  return failures.length === 0;
}
function cacheValue(profile) {
  return {
    schema_version: 1,
    actor_id: profile.actor_id,
    actor_type: profile.actor_type,
    client: profile.client,
    machine_label: profile.machine_label
  };
}
async function withActorRegistrationLock(root, operation) {
  try {
    return await withContinuityLock(root, operation);
  } catch (error2) {
    if (error2 instanceof ContinuityLockError) {
      throw new RegistrationError(
        "PCP_REGISTRATION_LOCKED",
        "Another actor registration or continuity operation is still running for this project."
      );
    }
    throw error2;
  }
}
async function registerActor(projectRoot, input) {
  const root = path16.resolve(projectRoot);
  const identity = normalizeActorIdentity(input);
  const executionId = createExecutionId();
  return withActorRegistrationLock(root, async () => {
    let createdProfilePath;
    let createdCachePath;
    let createdRuntimeRoot;
    try {
      await assertValidCanonicalLayer(root);
      const profiles = await loadActorProfiles(root);
      const profilesById = new Map(profiles.map((profile) => [profile.actor_id, profile]));
      const cachePath = path16.join(root, ...cacheRelativePath(identity).split("/"));
      const cachedContents = await readOptionalText(cachePath);
      let selected;
      if (cachedContents !== void 0) {
        const cached = parseIdentityCache(cachedContents, identity);
        if (identity.actor_id !== void 0 && identity.actor_id !== cached.actor_id) {
          throw new RegistrationError(
            "PCP_REGISTRATION_CACHE_MISMATCH",
            "The requested actor ID disagrees with the cached project identity."
          );
        }
        selected = profilesById.get(cached.actor_id);
        if (selected === void 0) {
          throw new RegistrationError(
            "PCP_REGISTRATION_STALE_CACHE",
            "The cached actor profile is missing; restore or explicitly repair identity state."
          );
        }
        if (!actorIdentityMatches(selected, identity)) {
          throw new RegistrationError(
            "PCP_REGISTRATION_CACHE_MISMATCH",
            "The cached actor profile no longer matches its client and machine identity."
          );
        }
      } else if (identity.actor_id !== void 0) {
        selected = profilesById.get(identity.actor_id);
        if (selected === void 0) {
          throw new RegistrationError(
            "PCP_REGISTRATION_ACTOR_NOT_FOUND",
            "The requested actor profile does not exist in this project."
          );
        }
        if (!actorIdentityMatches(selected, identity)) {
          throw new RegistrationError(
            "PCP_REGISTRATION_ACTOR_MISMATCH",
            "The requested actor profile belongs to a different client or machine."
          );
        }
      } else {
        const matches = profiles.filter((profile) => actorIdentityMatches(profile, identity));
        if (matches.length > 1) {
          throw new RegistrationError(
            "PCP_REGISTRATION_AMBIGUOUS",
            "Multiple actor profiles match this client and machine; rerun with --actor-id."
          );
        }
        selected = matches[0];
      }
      let profileCreated = false;
      if (selected === void 0) {
        selected = {
          schema_version: 1,
          actor_id: createActorId(identity),
          actor_type: identity.actor_type,
          client: identity.client,
          machine_label: identity.machine_label,
          first_seen: (/* @__PURE__ */ new Date()).toISOString(),
          checkpoint_paths: []
        };
        const schemaResult = validateSchema("actor-profile", selected);
        if (!schemaResult.valid) {
          throw new RegistrationError(
            "PCP_REGISTRATION_PROFILE_INVALID",
            "The generated actor profile did not satisfy the release schema."
          );
        }
        const newProfilePath = path16.join(
          root,
          ...profileRelativePath(selected.actor_id).split("/")
        );
        await createExclusiveFile(newProfilePath, stringify3(selected), () => {
          createdProfilePath = newProfilePath;
        });
        profileCreated = true;
        await assertValidCanonicalLayer(root);
      }
      let cacheCreated = false;
      if (cachedContents === void 0) {
        const cacheDirectory = path16.dirname(cachePath);
        createdRuntimeRoot = await mkdir4(cacheDirectory, { recursive: true });
        await createExclusiveFile(
          cachePath,
          `${JSON.stringify(cacheValue(selected), null, 2)}
`,
          () => {
            createdCachePath = cachePath;
          }
        );
        cacheCreated = true;
      }
      await assertValidCanonicalLayer(root);
      return {
        schema_version: 1,
        command: "register",
        status: profileCreated ? "created" : "recovered",
        actor_id: selected.actor_id,
        actor_type: selected.actor_type,
        client: selected.client,
        machine_label: selected.machine_label,
        profile_path: portablePath(profileRelativePath(selected.actor_id)),
        execution_id: executionId,
        profile_created: profileCreated,
        cache_created: cacheCreated,
        event_created: false,
        mutated: profileCreated || cacheCreated
      };
    } catch (error2) {
      const rolledBack = await rollbackCreatedPaths({
        ...createdCachePath === void 0 ? {} : { cache_path: createdCachePath },
        ...createdProfilePath === void 0 ? {} : { profile_path: createdProfilePath },
        ...createdRuntimeRoot === void 0 ? {} : { runtime_root: createdRuntimeRoot }
      });
      if (!rolledBack) {
        throw new RegistrationError(
          "PCP_REGISTRATION_ROLLBACK_FAILED",
          "Actor registration failed and its new files could not be fully removed.",
          true
        );
      }
      if (error2 instanceof RegistrationError) {
        throw new RegistrationError(error2.code, error2.message, false);
      }
      throw new RegistrationError(
        "PCP_REGISTRATION_FAILED",
        error2 instanceof Error ? error2.message : String(error2),
        false
      );
    }
  });
}

// src/application/report-status.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { lstat as lstat8, mkdir as mkdir5, open as open6, readFile as readFile15, readdir as readdir6, rename as rename4, unlink as unlink6 } from "node:fs/promises";
import path17 from "node:path";

// src/domain/reconciliation.ts
var ReconciliationError = class extends Error {
  constructor(code2, message, mutated = false) {
    super(message);
    this.code = code2;
    this.mutated = mutated;
    this.name = "ReconciliationError";
  }
  code;
  mutated;
};
var SLUG_PATTERN2 = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
var SHARED_SCOPE_REASONS = /* @__PURE__ */ new Map([
  ["protocol", "shared-protocol"],
  ["policy", "shared-policy"],
  ["shared-policy", "shared-policy"],
  ["operations", "shared-policy"],
  ["project-registry", "project-registry"],
  ["workstream-registry", "workstream-registry"],
  ["registry", "shared-project-state"],
  ["project-state", "shared-project-state"],
  ["shared", "shared-project-state"]
]);
var REASON_ORDER = [
  "global",
  "active-workstream",
  "dependency-workstream",
  "scope",
  "path-overlap",
  "shared-protocol",
  "shared-policy",
  "project-registry",
  "workstream-registry",
  "shared-project-state"
];
function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function assertSlug(value, field) {
  if (!SLUG_PATTERN2.test(value) || value.length > 128) {
    throw new ReconciliationError(
      "PCP_STATUS_SCOPE_INVALID",
      `${field} must be a lowercase kebab-case slug with at most 128 characters.`
    );
  }
}
function assertPortablePath(value) {
  const segments = value.split("/");
  if (value.length === 0 || value.length > 1024 || value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.includes("//") || segments.includes("..") || value !== "." && (segments.includes(".") || value.endsWith("/"))) {
    throw new ReconciliationError(
      "PCP_STATUS_PATH_INVALID",
      `Status paths must be portable project-relative paths: ${value || "<empty>"}.`
    );
  }
}
function normalizedSlugs(values, field) {
  for (const value of values ?? []) assertSlug(value, field);
  return sortedUnique(values ?? []);
}
function normalizedPaths(values) {
  for (const value of values ?? []) assertPortablePath(value);
  return sortedUnique(values ?? []);
}
function resolveReconciliationSelection(workstreams, input) {
  const requestedWorkstream = input.workstream_id;
  if (requestedWorkstream !== void 0) assertSlug(requestedWorkstream, "Workstream ID");
  const byId = new Map(workstreams.map((workstream) => [workstream.workstream_id, workstream]));
  const selectedIds = /* @__PURE__ */ new Set();
  const dependencies = /* @__PURE__ */ new Set();
  if (requestedWorkstream !== void 0) {
    if (!byId.has(requestedWorkstream)) {
      throw new ReconciliationError(
        "PCP_STATUS_WORKSTREAM_NOT_FOUND",
        `Workstream ${requestedWorkstream} does not exist.`
      );
    }
    const visit3 = (workstreamId) => {
      if (selectedIds.has(workstreamId)) return;
      selectedIds.add(workstreamId);
      const workstream = byId.get(workstreamId);
      if (workstream === void 0) {
        throw new ReconciliationError(
          "PCP_STATUS_INVALID_LAYER",
          `Workstream ${workstreamId} has an unknown dependency.`
        );
      }
      for (const dependency of workstream.dependencies) {
        dependencies.add(dependency);
        visit3(dependency);
      }
    };
    visit3(requestedWorkstream);
    dependencies.delete(requestedWorkstream);
  }
  const selectedWorkstreams = [...selectedIds].map((id) => byId.get(id)).filter((workstream) => workstream !== void 0);
  const scopes = normalizedSlugs(
    [...input.scopes ?? [], ...selectedWorkstreams.flatMap((item) => item.areas)],
    "Scope"
  );
  const paths = normalizedPaths([
    ...input.paths ?? [],
    ...selectedWorkstreams.flatMap((item) => item.paths)
  ]);
  return {
    workstream_id: requestedWorkstream ?? null,
    workstreams: sortedUnique(selectedIds),
    dependencies: sortedUnique(dependencies),
    scopes,
    paths,
    global: requestedWorkstream === void 0 && scopes.length === 0 && paths.length === 0
  };
}
function withoutLayerPrefix(value) {
  return value.startsWith(".pcp/") ? value.slice(".pcp/".length) : value;
}
function wildcardRoot(value) {
  const wildcard = value.search(/[*?[]/u);
  const root = wildcard === -1 ? value : value.slice(0, wildcard);
  return root.replace(/\/+$/u, "") || ".";
}
function pathsOverlap(left, right) {
  const leftRoot = wildcardRoot(left);
  const rightRoot = wildcardRoot(right);
  return leftRoot === "." || rightRoot === "." || leftRoot === rightRoot || leftRoot.startsWith(`${rightRoot}/`) || rightRoot.startsWith(`${leftRoot}/`);
}
function sharedPathReason(value) {
  const relative = withoutLayerPrefix(value);
  if (relative === "pcp.yaml" || relative === "protocol" || relative.startsWith("protocol/")) {
    return "shared-protocol";
  }
  if (relative === "state/vcs-policy.yaml" || relative === "operations" || relative.startsWith("operations/")) {
    return "shared-policy";
  }
  if (relative === "state/projects.yaml") return "project-registry";
  if (relative === "state/workstreams.yaml") return "workstream-registry";
  if (relative === "state/project.yaml") return "shared-project-state";
  return void 0;
}
function classifyEventRelevance(event, selection) {
  const reasons = /* @__PURE__ */ new Set();
  if (selection.global) reasons.add("global");
  for (const workstream of event.workstreams) {
    if (workstream === selection.workstream_id) reasons.add("active-workstream");
    if (selection.dependencies.includes(workstream)) reasons.add("dependency-workstream");
  }
  if (event.scopes.some((scope) => selection.scopes.includes(scope))) reasons.add("scope");
  if (event.affected_paths.some(
    (affectedPath) => selection.paths.some((selectedPath) => pathsOverlap(affectedPath, selectedPath))
  )) {
    reasons.add("path-overlap");
  }
  for (const scope of event.scopes) {
    const reason = SHARED_SCOPE_REASONS.get(scope);
    if (reason !== void 0) reasons.add(reason);
  }
  for (const affectedPath of event.affected_paths) {
    const reason = sharedPathReason(affectedPath);
    if (reason !== void 0) reasons.add(reason);
  }
  const ordered = REASON_ORDER.filter((reason) => reasons.has(reason));
  return { relevant: ordered.length > 0, reasons: ordered };
}
function checkpointIdentity(checkpoint) {
  return JSON.stringify({
    actor_id: checkpoint.actor_id,
    workstream_id: checkpoint.workstream_id,
    scopes: sortedUnique(checkpoint.scopes),
    paths: sortedUnique(checkpoint.paths),
    dependencies: sortedUnique(checkpoint.dependencies)
  });
}
function baselineContextPaths(selection) {
  return sortedUnique([
    ".pcp/pcp.yaml",
    ".pcp/protocol/00-index.md",
    ".pcp/knowledge/00-index.md",
    ".pcp/operations/00-index.md",
    ".pcp/state/project.yaml",
    ".pcp/state/projects.yaml",
    ".pcp/state/workstreams.yaml",
    ".pcp/state/vcs-policy.yaml",
    ...selection.paths
  ]);
}
function reconciliationDigest(value) {
  return sha256(JSON.stringify(value));
}

// src/application/report-status.ts
var ACTOR_DIRECTORY3 = "continuity/actors";
var ACTIVE_EVENT_DIRECTORY2 = "continuity/events";
var ARCHIVE_EVENT_DIRECTORY2 = "continuity/archive";
var CHECKPOINT_DIRECTORY = "continuity/checkpoints";
var ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u;
function statusError(code2, message) {
  return new ReconciliationError(code2, message);
}
function layerPath(relativePath) {
  return `.pcp/${relativePath}`;
}
async function assertNoSymlinkFromLayer(layerRoot, target) {
  let current = target;
  while (true) {
    const metadata = await lstat8(current);
    if (metadata.isSymbolicLink()) throw new Error("path has a symbolic-link boundary");
    if (current === layerRoot) return;
    current = path17.dirname(current);
  }
}
function parseYaml(contents, relativePath) {
  const document = parseDocument(contents, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `${layerPath(relativePath)} is not valid YAML: ${document.errors[0]?.message ?? "parse failure"}`
    );
  }
  try {
    return document.toJS({ maxAliasCount: 50 });
  } catch (error2) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `${layerPath(relativePath)} cannot be decoded safely: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
}
async function readSchemaFile(layerRoot, relativePath, schema4) {
  const absolutePath = path17.join(layerRoot, ...relativePath.split("/"));
  let contents;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absolutePath);
    const metadata = await lstat8(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("path is not a regular file");
    }
    contents = await readFile15(absolutePath, "utf8");
  } catch (error2) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `Cannot read required PCP state ${layerPath(relativePath)}: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const value = parseYaml(contents, relativePath);
  const result = validateSchema(schema4, value);
  if (!result.valid) {
    const detail = result.diagnostics.slice(0, 3).map((diagnostic2) => `${diagnostic2.path} ${diagnostic2.message}`).join("; ");
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `${layerPath(relativePath)} fails the ${schema4} schema: ${detail}`
    );
  }
  return { path: relativePath, value, contents };
}
async function readSchemaDirectory(layerRoot, relativeDirectory, schema4) {
  const absoluteDirectory = path17.join(layerRoot, ...relativeDirectory.split("/"));
  let entries;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absoluteDirectory);
    const metadata = await lstat8(absoluteDirectory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error("path is not a regular directory");
    }
    entries = await readdir6(absoluteDirectory, { withFileTypes: true });
  } catch (error2) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `Cannot read required PCP directory ${layerPath(relativeDirectory)}: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const records = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      throw statusError(
        "PCP_STATUS_INVALID_LAYER",
        `Symlinks are not allowed in ${layerPath(relativeDirectory)}.`
      );
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".yml")) {
      throw statusError(
        "PCP_STATUS_INVALID_LAYER",
        `${layerPath(`${relativeDirectory}/${entry.name}`)} must use the canonical .yaml suffix.`
      );
    }
    if (!entry.name.endsWith(".yaml")) continue;
    records.push(await readSchemaFile(layerRoot, `${relativeDirectory}/${entry.name}`, schema4));
  }
  return records;
}
async function listArchiveEventIds(layerRoot) {
  const absoluteDirectory = path17.join(layerRoot, ...ARCHIVE_EVENT_DIRECTORY2.split("/"));
  let entries;
  try {
    await assertNoSymlinkFromLayer(layerRoot, absoluteDirectory);
    const metadata = await lstat8(absoluteDirectory);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error("path is not a regular directory");
    }
    entries = await readdir6(absoluteDirectory, { withFileTypes: true });
  } catch (error2) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `Cannot inspect ${layerPath(ARCHIVE_EVENT_DIRECTORY2)}: ${error2 instanceof Error ? error2.message : String(error2)}`
    );
  }
  const ids = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) {
      throw statusError(
        "PCP_STATUS_INVALID_LAYER",
        `Symlinks are not allowed in ${layerPath(ARCHIVE_EVENT_DIRECTORY2)}.`
      );
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".yml")) {
      throw statusError(
        "PCP_STATUS_INVALID_LAYER",
        `${layerPath(`${ARCHIVE_EVENT_DIRECTORY2}/${entry.name}`)} must use the canonical .yaml suffix.`
      );
    }
    if (!entry.name.endsWith(".yaml")) continue;
    const eventId = entry.name.slice(0, -".yaml".length);
    if (!ULID_PATTERN.test(eventId)) {
      throw statusError(
        "PCP_STATUS_INVALID_LAYER",
        `Archived event filename must be a ULID: ${layerPath(`${ARCHIVE_EVENT_DIRECTORY2}/${entry.name}`)}.`
      );
    }
    ids.push(eventId);
  }
  return ids;
}
function semanticFailure(records) {
  const diagnostics = validateCanonicalSemantics(records);
  if (diagnostics.length === 0) return;
  if (diagnostics.some((diagnostic2) => diagnostic2.code === "checkpoint.duplicate-scope")) {
    throw statusError(
      "PCP_STATUS_CHECKPOINT_AMBIGUOUS",
      "Multiple checkpoints claim the same actor and scoped reconciliation identity."
    );
  }
  const detail = diagnostics.slice(0, 3).map((diagnostic2) => `${layerPath(diagnostic2.path)}: ${diagnostic2.message}`).join("; ");
  throw statusError("PCP_STATUS_INVALID_LAYER", `PCP continuity state is inconsistent: ${detail}`);
}
async function loadOperationalContinuityState(root) {
  const layerRoot = path17.join(root, ".pcp");
  const [
    manifest,
    project,
    projectRegistry,
    workstreamRegistry,
    vcsPolicy,
    actors,
    activeEvents,
    checkpoints,
    archiveEventIds
  ] = await Promise.all([
    readSchemaFile(layerRoot, "pcp.yaml", "pcp-manifest"),
    readSchemaFile(layerRoot, "state/project.yaml", "project"),
    readSchemaFile(layerRoot, "state/projects.yaml", "project-registry"),
    readSchemaFile(layerRoot, "state/workstreams.yaml", "workstreams"),
    readSchemaFile(layerRoot, "state/vcs-policy.yaml", "vcs-policy"),
    readSchemaDirectory(layerRoot, ACTOR_DIRECTORY3, "actor-profile"),
    readSchemaDirectory(layerRoot, ACTIVE_EVENT_DIRECTORY2, "event"),
    readSchemaDirectory(layerRoot, CHECKPOINT_DIRECTORY, "checkpoint"),
    listArchiveEventIds(layerRoot)
  ]);
  const archiveStubs = archiveEventIds.map((eventId) => ({
    path: `${ARCHIVE_EVENT_DIRECTORY2}/${eventId}.yaml`,
    value: { event_id: eventId }
  }));
  semanticFailure({
    project,
    project_registry: projectRegistry,
    workstreams: workstreamRegistry,
    vcs_policy: vcsPolicy,
    actors,
    events: [...activeEvents, ...archiveStubs],
    checkpoints
  });
  if (activeEvents.length > manifest.value.continuity.active_event_limit) {
    throw statusError(
      "PCP_STATUS_INVALID_LAYER",
      `Active event count ${activeEvents.length} exceeds the configured limit ${manifest.value.continuity.active_event_limit}.`
    );
  }
  return {
    manifest: manifest.value,
    actors,
    workstreams: workstreamRegistry.value.workstreams,
    active_events: activeEvents.sort(
      (left, right) => left.value.event_id.localeCompare(right.value.event_id)
    ),
    archive_event_ids: archiveEventIds.sort((left, right) => left.localeCompare(right)),
    checkpoints
  };
}
function change(event, relevanceReasons) {
  return {
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    kind: event.kind,
    summary: event.summary,
    scopes: [...event.scopes].sort(),
    workstreams: [...event.workstreams].sort(),
    affected_paths: [...event.affected_paths].sort(),
    relevance_reasons: relevanceReasons
  };
}
function uniquePaths(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function findCheckpoint(state, actorId, selection) {
  const identity = checkpointIdentity({
    actor_id: actorId,
    workstream_id: selection.workstream_id,
    scopes: selection.scopes,
    paths: selection.paths,
    dependencies: selection.dependencies
  });
  const matches = state.checkpoints.filter(
    (checkpoint) => checkpointIdentity(checkpoint.value) === identity
  );
  if (matches.length > 1) {
    throw statusError(
      "PCP_STATUS_CHECKPOINT_AMBIGUOUS",
      "Multiple checkpoints claim the same actor and scoped reconciliation identity."
    );
  }
  return matches[0];
}
function initialCheckpointState(checkpoint, activeFloor, hasArchivedEvents, newerEventCount) {
  if (checkpoint === void 0) return "missing";
  if (activeFloor !== null && (checkpoint.value.last_event_id === null && hasArchivedEvents || checkpoint.value.last_event_id !== null && checkpoint.value.last_event_id < activeFloor)) {
    return "behind-active-floor";
  }
  return newerEventCount > 0 ? "changes-pending" : "current";
}
function previewStatus(state, input) {
  const actorMatches = state.actors.filter((record) => record.value.actor_id === input.actor_id);
  if (actorMatches.length === 0) {
    throw statusError(
      "PCP_STATUS_ACTOR_NOT_FOUND",
      `Actor ${input.actor_id || "<empty>"} is not registered in this project.`
    );
  }
  const actor = actorMatches[0];
  if (actor.value.actor_type !== "agent") {
    throw statusError(
      "PCP_STATUS_AGENT_REQUIRED",
      "Scoped checkpoints are available to agents only."
    );
  }
  const selection = resolveReconciliationSelection(state.workstreams, {
    ...input.workstream_id === void 0 ? {} : { workstream_id: input.workstream_id },
    ...input.scopes === void 0 ? {} : { scopes: input.scopes },
    ...input.paths === void 0 ? {} : { paths: input.paths }
  });
  const checkpoint = findCheckpoint(state, input.actor_id, selection);
  const activeFloor = state.active_events[0]?.value.event_id ?? null;
  const newestActive = state.active_events.at(-1)?.value.event_id ?? null;
  const checkpointLast = checkpoint?.value.last_event_id ?? null;
  const beforeFloor = checkpoint !== void 0 && activeFloor !== null && (checkpointLast === null && state.archive_event_ids.length > 0 || checkpointLast !== null && checkpointLast < activeFloor);
  const newerEvents = state.active_events.map((record) => record.value).filter(
    (event) => checkpoint === void 0 || beforeFloor || checkpointLast === null || event.event_id > checkpointLast
  );
  const checkpointState = initialCheckpointState(
    checkpoint,
    activeFloor,
    state.archive_event_ids.length > 0,
    newerEvents.length
  );
  const baselineRequired = checkpointState === "missing" || checkpointState === "behind-active-floor";
  const baselineReason = checkpointState === "missing" ? "first-scope-baseline" : checkpointState === "behind-active-floor" ? "checkpoint-before-active-floor" : null;
  const relevantChanges = [];
  const outOfScopeChanges = [];
  for (const event of newerEvents) {
    const classification = classifyEventRelevance(event, selection);
    const item = change(event, classification.reasons);
    (classification.relevant ? relevantChanges : outOfScopeChanges).push(item);
  }
  const baselinePaths = baselineRequired ? baselineContextPaths(selection) : [];
  const requiredContextPaths = uniquePaths([
    ...baselinePaths,
    ...relevantChanges.flatMap((item) => item.affected_paths)
  ]);
  const acknowledgementRequired = baselineRequired || newerEvents.length > 0;
  const digestPayload = {
    schema_version: 1,
    actor_id: input.actor_id,
    selection,
    checkpoint: checkpoint === void 0 ? null : {
      checkpoint_id: checkpoint.value.checkpoint_id,
      last_event_id: checkpoint.value.last_event_id,
      reconciled_at: checkpoint.value.reconciled_at
    },
    checkpoint_state: checkpointState,
    active_floor_event_id: activeFloor,
    newest_active_event_id: newestActive,
    baseline: {
      required: baselineRequired,
      reason: baselineReason,
      context_paths: baselinePaths
    },
    relevant_changes: relevantChanges,
    out_of_scope_changes: outOfScopeChanges
  };
  return {
    result: {
      schema_version: 1,
      command: "status",
      mode: "preview",
      actor_id: input.actor_id,
      selection,
      checkpoint: {
        state: checkpointState,
        previous_state: null,
        checkpoint_id: checkpoint?.value.checkpoint_id ?? null,
        checkpoint_path: checkpoint === void 0 ? null : layerPath(checkpoint.path),
        last_event_id: checkpointLast,
        active_floor_event_id: activeFloor,
        newest_active_event_id: newestActive
      },
      baseline: {
        required: baselineRequired,
        reason: baselineReason,
        context_paths: baselinePaths
      },
      relevant_changes: relevantChanges,
      out_of_scope_changes: outOfScopeChanges,
      required_context_paths: requiredContextPaths,
      status_digest: reconciliationDigest(digestPayload),
      acknowledgement: { required: acknowledgementRequired, accepted: false },
      event_created: false,
      mutated: false
    },
    ...checkpoint === void 0 ? {} : { checkpoint },
    target_last_event_id: newestActive
  };
}
async function fileContentsOrUndefined(file) {
  try {
    return await readFile15(file, "utf8");
  } catch (error2) {
    if (error2.code === "ENOENT") return void 0;
    throw error2;
  }
}
async function writeDurableFile2(file, contents) {
  const handle = await open6(file, "wx");
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function writeCheckpoint(root, checkpoint, existing) {
  const result = validateSchema("checkpoint", checkpoint);
  if (!result.valid) {
    throw statusError(
      "PCP_STATUS_CHECKPOINT_INVALID",
      "The generated reconciliation checkpoint failed its release schema."
    );
  }
  const relativePath = `${CHECKPOINT_DIRECTORY}/${checkpoint.checkpoint_id}.yaml`;
  const directory = path17.join(root, ".pcp", ...CHECKPOINT_DIRECTORY.split("/"));
  const target = path17.join(root, ".pcp", ...relativePath.split("/"));
  await mkdir5(directory, { recursive: true });
  if (existing !== void 0) {
    const current = await fileContentsOrUndefined(target);
    if (current !== existing.contents) {
      throw statusError(
        "PCP_STATUS_SOURCE_CHANGED",
        "The scoped checkpoint changed after status was recomputed."
      );
    }
  } else if (await fileContentsOrUndefined(target) !== void 0) {
    throw statusError(
      "PCP_STATUS_SOURCE_CHANGED",
      "A checkpoint with the generated identity appeared before acknowledgement."
    );
  }
  const contents = stringify3(checkpoint);
  const temporary = path17.join(directory, `.${checkpoint.checkpoint_id}.${randomUUID4()}.tmp`);
  const previous = `${temporary}.previous`;
  await writeDurableFile2(temporary, contents);
  let previousHeld = false;
  let replacementInstalled = false;
  try {
    if (existing === void 0) {
      await rename4(temporary, target);
      return layerPath(relativePath);
    }
    try {
      await rename4(temporary, target);
      return layerPath(relativePath);
    } catch (error2) {
      const code2 = error2.code;
      if (code2 !== "EEXIST" && code2 !== "EPERM") throw error2;
    }
    await rename4(target, previous);
    previousHeld = true;
    await rename4(temporary, target);
    replacementInstalled = true;
    if (previousHeld) {
      await unlink6(previous);
      previousHeld = false;
    }
    return layerPath(relativePath);
  } catch (error2) {
    const rollbackFailures = [];
    if (replacementInstalled) {
      await unlink6(target).catch((rollbackError) => rollbackFailures.push(rollbackError));
    }
    if (previousHeld) {
      await rename4(previous, target).catch(
        (rollbackError) => rollbackFailures.push(rollbackError)
      );
    }
    if (rollbackFailures.length > 0) {
      throw new ReconciliationError(
        "PCP_STATUS_ROLLBACK_FAILED",
        `Checkpoint acknowledgement failed (${error2 instanceof Error ? error2.message : String(error2)}) and its prior state could not be restored.`,
        true
      );
    }
    throw error2;
  } finally {
    await unlink6(temporary).catch((error2) => {
      if (error2.code !== "ENOENT") throw error2;
    });
  }
}
async function reportStatusLocked(root, input) {
  const state = await loadOperationalContinuityState(root);
  const preview = previewStatus(state, input);
  if (input.acknowledge === void 0) return preview.result;
  if (input.acknowledge !== preview.result.status_digest) {
    throw statusError(
      "PCP_STATUS_DIGEST_MISMATCH",
      "Status changed or the acknowledgement digest is incorrect; review a fresh preview."
    );
  }
  if (!preview.result.acknowledgement.required) {
    return {
      ...preview.result,
      mode: "acknowledge",
      checkpoint: {
        ...preview.result.checkpoint,
        previous_state: preview.result.checkpoint.state
      },
      acknowledgement: { required: false, accepted: true }
    };
  }
  const checkpoint = {
    schema_version: 1,
    checkpoint_id: preview.checkpoint?.value.checkpoint_id ?? ulid(),
    actor_id: input.actor_id,
    workstream_id: preview.result.selection.workstream_id,
    last_event_id: preview.target_last_event_id,
    reconciled_at: (/* @__PURE__ */ new Date()).toISOString(),
    scopes: preview.result.selection.scopes,
    paths: preview.result.selection.paths,
    dependencies: preview.result.selection.dependencies
  };
  const checkpointPath = await writeCheckpoint(root, checkpoint, preview.checkpoint);
  return {
    ...preview.result,
    mode: "acknowledge",
    checkpoint: {
      ...preview.result.checkpoint,
      state: "current",
      previous_state: preview.result.checkpoint.state,
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_path: checkpointPath,
      last_event_id: checkpoint.last_event_id
    },
    acknowledgement: { required: true, accepted: true },
    mutated: true
  };
}
async function reportStatus(projectRoot, input) {
  const root = path17.resolve(projectRoot);
  try {
    return await withContinuityLock(root, () => reportStatusLocked(root, input));
  } catch (error2) {
    if (error2 instanceof ContinuityLockError) {
      throw statusError(
        "PCP_STATUS_LOCKED",
        "Another actor registration or continuity operation is still running for this project."
      );
    }
    if (error2 instanceof ReconciliationError) throw error2;
    throw statusError("PCP_STATUS_FAILED", error2 instanceof Error ? error2.message : String(error2));
  }
}

// src/domain/release.ts
var PCP_NAME = "Persistent Context Protocol";
var PCP_VERSION = "0.1.0";
var PCP_RELEASE_STAGE = "workstream-operations";
var PCP_COMMANDS = [
  "inspect",
  "adopt",
  "register",
  "status",
  "record",
  "validate",
  "render",
  "workstream",
  "upgrade",
  "repair"
];

// src/presentation/format-adoption.ts
function line(value = "") {
  return `${value}
`;
}
function formatAdoption(result) {
  let output = line("PCP adoption");
  output += line(`State: ${result.classification}`);
  if (result.mutated) {
    output += line(`Plan digest: ${result.plan_digest}`);
    output += line(`Applied operations: ${result.applied_operations}`);
    output += line(`Validated canonical files: ${result.validation.checked_files}`);
    output += line("Clean genesis: 0 actor profiles, 0 active events, 0 archived events");
    output += line("Recovery material: cleaned");
    output += line("Mutation: applied");
    return output;
  }
  output += line(`Confidence: ${result.confidence}`);
  output += line(`Applicable: ${result.applicable ? "yes" : "no"}`);
  output += line(`Suggested project id: ${result.baseline.suggested_project_id}`);
  if (result.baseline.evidence_groups.length > 0) {
    output += line("Evidence inputs:");
    for (const group of result.baseline.evidence_groups) {
      output += line(`- ${group.category}: ${group.paths.join(", ") || "(none)"}`);
    }
  }
  if (result.questions.length > 0) {
    output += line("Required inputs:");
    for (const question of result.questions) {
      output += line(`- ${question.id}: ${question.prompt}`);
      if (question.when !== void 0) output += line(`  when: ${question.when}`);
    }
  }
  if (result.coverage !== void 0) {
    output += line(`Foreign coverage records: ${result.coverage.records.length}`);
    output += line(`Unresolved coverage records: ${result.coverage.unresolved_count}`);
  }
  if (result.coverage_status !== void 0) {
    output += line(`Coverage review: ${result.coverage_status}`);
  }
  if (result.adapters !== void 0) {
    output += line("Generated platform adapters:");
    for (const adapter of result.adapters) {
      output += line(`- ${adapter.adapter_id}: ${adapter.target_path}`);
    }
  }
  if (result.coverage_issues !== void 0 && result.coverage_issues.length > 0) {
    output += line("Blocking foreign-source issues:");
    for (const issue3 of result.coverage_issues) {
      output += line(`- ${issue3.code} ${issue3.path}: ${issue3.message}`);
    }
  }
  if (result.plan !== void 0) {
    output += line(`Plan digest: ${result.plan.plan_digest}`);
    if (result.plan.coverage_digest !== void 0) {
      output += line(`Coverage digest: ${result.plan.coverage_digest}`);
    }
    output += line("Operations:");
    for (const operation of result.plan.operations) {
      const digest2 = operation.content_digest === void 0 ? "" : ` sha256:${operation.content_digest}`;
      const source = operation.source_path === void 0 ? "" : ` from:${operation.source_path}`;
      output += line(
        `- ${operation.operation_id} ${operation.action} ${operation.path}${source}${digest2}`
      );
    }
    output += line(`Validations: ${result.plan.validations.join(", ")}`);
  }
  output += line("Mutation: none");
  return output;
}

// src/presentation/format-canonical.ts
function diagnosticLines(diagnostics) {
  return diagnostics.map(
    (diagnostic2) => `- ${diagnostic2.severity.toUpperCase()} ${diagnostic2.code} ${diagnostic2.path}: ${diagnostic2.message}`
  );
}
function formatCanonicalValidation(report) {
  const lines = [
    `PCP validation: ${report.valid ? "valid" : "invalid"}`,
    `Checked files: ${report.checked_files}`
  ];
  if (report.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...diagnosticLines(report.diagnostics));
  }
  return `${lines.join("\n")}
`;
}
function formatCanonicalRender(report) {
  const lines = [
    `PCP render ${report.mode}: ${report.valid ? "current" : "failed"}`,
    `Changed paths: ${report.changed_paths.length}`,
    ...report.changed_paths.map((changedPath) => `- ${changedPath}`)
  ];
  if (report.diagnostics.length > 0) {
    lines.push("Diagnostics:", ...diagnosticLines(report.diagnostics));
  }
  return `${lines.join("\n")}
`;
}

// src/presentation/format-inspection.ts
function formatInspection(result) {
  const lines = [
    "PCP repository inspection",
    `State: ${result.state}`,
    `Confidence: ${result.confidence}`,
    `Inventory: ${result.inventory.counts.files} files, ${result.inventory.counts.directories} directories, ${result.inventory.counts.symlinks} symlinks`,
    `Digest: ${result.inventory.digest}`
  ];
  if (result.signals.length === 0) {
    lines.push("Signals: none (seed or empty project)");
  } else {
    lines.push("Signals:");
    for (const signal of result.signals) {
      lines.push(`- [${signal.category}] ${signal.path}: ${signal.reason}`);
    }
  }
  if (result.foreignCandidates.length > 0) {
    lines.push("Foreign context candidates:");
    for (const candidate of result.foreignCandidates) {
      lines.push(`- ${candidate.root}: ${candidate.categories.join(", ")}`);
    }
  }
  if (result.inventory.exclusions.length > 0) {
    lines.push("Exclusions:");
    for (const exclusion of result.inventory.exclusions) {
      lines.push(`- [${exclusion.reason}] ${exclusion.path}`);
    }
  }
  if (result.ambiguities.length > 0) {
    lines.push("Review before adoption:");
    for (const ambiguity of result.ambiguities) {
      lines.push(`- ${ambiguity.code}: ${ambiguity.message}`);
    }
  }
  lines.push("Mutation: none");
  return `${lines.join("\n")}
`;
}

// src/presentation/format-recording.ts
function formatRecording(result) {
  return [
    `Recorded event ${result.event_id}.`,
    `Summary: ${result.summary}`,
    `Path: ${result.event_path}`,
    `Payload digest: ${result.payload_digest}`,
    `Active events: ${result.active_events}`,
    `Archived in this operation: ${result.archived_events_moved}`,
    ""
  ].join("\n");
}

// src/presentation/format-registration.ts
function formatRegistration(result) {
  const verb = result.status === "created" ? "Created" : "Recovered";
  return [
    `${verb} actor ${result.actor_id}.`,
    `Execution: ${result.execution_id}`,
    `Profile: ${result.profile_path}`,
    "Continuity event: none",
    ""
  ].join("\n");
}

// src/presentation/format-status.ts
function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
function formatStatus(result) {
  const lines = [
    `PCP status for ${result.actor_id}`,
    `Checkpoint: ${result.checkpoint.state}`,
    `Relevant: ${countLabel(result.relevant_changes.length, "change")}`,
    `Out of scope: ${countLabel(result.out_of_scope_changes.length, "change")}`
  ];
  if (result.baseline.required) {
    lines.push(`Baseline required: ${result.baseline.context_paths.join(", ")}`);
  } else if (result.required_context_paths.length > 0) {
    lines.push(`Read current state: ${result.required_context_paths.join(", ")}`);
  }
  if (result.mode === "acknowledge") {
    lines.push(
      result.mutated ? `Acknowledged ${result.status_digest}; checkpoint advanced.` : `Acknowledged ${result.status_digest}; checkpoint was already current.`
    );
  } else if (result.acknowledgement.required) {
    lines.push(`After absorbing this context, acknowledge digest ${result.status_digest}.`);
  } else {
    lines.push("No acknowledgement is needed.");
  }
  return `${lines.join("\n")}
`;
}

// src/presentation/format-workstream.ts
function formatWorkstream(result) {
  if (result.operation === "validate") {
    return [
      `Validated ${result.workstream_count} workstream${result.workstream_count === 1 ? "" : "s"}.`,
      `Registry digest: ${result.registry_digest}`,
      ...result.workstream === null ? [] : [
        `Selected: ${result.workstream.workstream_id} (${result.workstream.status}, ${result.workstream.kind})`
      ],
      ""
    ].join("\n");
  }
  return [
    `${result.status[0]?.toUpperCase()}${result.status.slice(1)} workstream ${result.workstream_id}.`,
    `Event: ${result.event_id}`,
    `Registry digest: ${result.registry_digest_after}`,
    ...result.announcement === null ? [] : [`Announcement: ${result.announcement}`],
    ...result.recovery_retained ? ["Warning: recovery material was retained."] : [],
    ""
  ].join("\n");
}

// src/cli/main.ts
var commandDescriptions = {
  inspect: "Inspect and classify a candidate project without mutation",
  adopt: "Preview or apply adoption into the canonical .pcp layer",
  register: "Create or recover a stable project actor identity",
  status: "Report project state and scoped reconciliation changes",
  record: "Append one meaningful immutable continuity event",
  validate: "Validate an installed PCP layer and its projections",
  render: "Render generated canonical views",
  workstream: "Create, update, validate, or complete a workstream",
  upgrade: "Preview or apply an ownership-aware PCP upgrade",
  repair: "Preview or apply a mechanically safe PCP repair"
};
function reportUnavailable(commandName) {
  const message = {
    code: "PCP_OPERATION_UNAVAILABLE",
    command: commandName,
    releaseStage: PCP_RELEASE_STAGE,
    message: `${commandName} has not reached a verified release milestone.`,
    mutated: false
  };
  process.stderr.write(`${JSON.stringify(message)}
`);
  process.exitCode = 2;
}
function reportInspectionError(error2) {
  const code2 = error2 instanceof InspectionError ? error2.code : "PCP_INSPECTION_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  process.stderr.write(`${JSON.stringify({ code: code2, message, mutated: false })}
`);
  process.exitCode = 2;
}
function reportAdoptionError(error2) {
  const code2 = error2 instanceof AdoptionError ? error2.code : "PCP_ADOPTION_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  const mutated = error2 instanceof AdoptionError ? error2.mutated : false;
  const recoveryRetained = error2 instanceof AdoptionError && error2.recoveryRoot !== void 0;
  process.stderr.write(
    `${JSON.stringify({ code: code2, message, mutated, recovery_retained: recoveryRetained })}
`
  );
  process.exitCode = 2;
}
function reportRegistrationError(error2) {
  const code2 = error2 instanceof RegistrationError ? error2.code : "PCP_REGISTRATION_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  const mutated = error2 instanceof RegistrationError ? error2.mutated : false;
  process.stderr.write(`${JSON.stringify({ code: code2, message, mutated })}
`);
  process.exitCode = 2;
}
function reportStatusError(error2) {
  const code2 = error2 instanceof ReconciliationError ? error2.code : "PCP_STATUS_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  const mutated = error2 instanceof ReconciliationError ? error2.mutated : false;
  process.stderr.write(`${JSON.stringify({ code: code2, message, mutated })}
`);
  process.exitCode = 2;
}
function reportRecordingError(error2) {
  const code2 = error2 instanceof RecordingError ? error2.code : "PCP_RECORD_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  const mutated = error2 instanceof RecordingError ? error2.mutated : false;
  const recoveryRetained = error2 instanceof RecordingError ? error2.recovery_retained : false;
  process.stderr.write(
    `${JSON.stringify({ code: code2, message, mutated, recovery_retained: recoveryRetained })}
`
  );
  process.exitCode = 2;
}
function reportWorkstreamError(error2) {
  const code2 = error2 instanceof WorkstreamError ? error2.code : "PCP_WORKSTREAM_FAILED";
  const message = error2 instanceof Error ? error2.message : String(error2);
  const mutated = error2 instanceof WorkstreamError ? error2.mutated : false;
  const recoveryRetained = error2 instanceof WorkstreamError ? error2.recovery_retained : false;
  process.stderr.write(
    `${JSON.stringify({ code: code2, message, mutated, recovery_retained: recoveryRetained })}
`
  );
  process.exitCode = 2;
}
function addInspectCommand(program2) {
  return program2.command("inspect").description(commandDescriptions.inspect).argument("[directory]", "candidate project root").option("--candidate <directory>", "candidate project root").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await inspectRepository(options.candidate ?? directory ?? ".");
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatInspection(result)
      );
    } catch (error2) {
      reportInspectionError(error2);
    }
  });
}
function addAdoptCommand(program2) {
  return program2.command("adopt").description(commandDescriptions.adopt).argument("[directory]", "candidate project root").option("--candidate <directory>", "candidate project root").option("--input <adoption.yaml>", "external semantic adoption input").option("--apply <digest>", "apply only the matching fully recomputed preview digest").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await adoptProject(options.candidate ?? directory ?? ".", {
        ...options.input === void 0 ? {} : { input: options.input },
        ...options.apply === void 0 ? {} : { apply: options.apply }
      });
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatAdoption(result)
      );
    } catch (error2) {
      reportAdoptionError(error2);
    }
  });
}
function addRegisterCommand(program2) {
  return program2.command("register").description(commandDescriptions.register).argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").option("--actor-type <agent|human>", "durable actor type", "agent").option("--client <client>", "agent client; omit only for a human").option("--machine-label <slug>", "stable lowercase machine label").option("--actor-id <id>", "recover one known profile when matches are ambiguous").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await registerActor(options.candidate ?? directory ?? ".", {
        machine_label: options.machineLabel ?? normalizeMachineLabel(hostname()),
        ...options.actorType === void 0 ? {} : { actor_type: options.actorType },
        ...options.client === void 0 ? {} : { client: options.client },
        ...options.actorId === void 0 ? {} : { actor_id: options.actorId }
      });
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatRegistration(result)
      );
    } catch (error2) {
      reportRegistrationError(error2);
    }
  });
}
function addStatusCommand(program2) {
  return program2.command("status").description(commandDescriptions.status).argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").requiredOption("--actor-id <id>", "registered agent actor ID").option("--workstream <id>", "active workstream ID").option("--scope <scope...>", "additional semantic scopes").option("--path <path...>", "additional project-relative paths").option("--acknowledge <digest>", "advance only the matching recomputed status digest").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await reportStatus(options.candidate ?? directory ?? ".", {
        actor_id: options.actorId,
        ...options.workstream === void 0 ? {} : { workstream_id: options.workstream },
        ...options.scope === void 0 ? {} : { scopes: options.scope },
        ...options.path === void 0 ? {} : { paths: options.path },
        ...options.acknowledge === void 0 ? {} : { acknowledge: options.acknowledge }
      });
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatStatus(result)
      );
    } catch (error2) {
      reportStatusError(error2);
    }
  });
}
function addRecordCommand(program2) {
  return program2.command("record").description(commandDescriptions.record).argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").requiredOption("--input <event.yaml>", "external continuity event input").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await recordEvent(options.candidate ?? directory ?? ".", options.input);
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatRecording(result)
      );
    } catch (error2) {
      reportRecordingError(error2);
    }
  });
}
function addValidateCommand(program2) {
  return program2.command("validate").description(commandDescriptions.validate).argument("[directory]", "managed project root", ".").option("--clean-genesis", "require zero actor profiles and zero active or archived events").option("--archive-index-only", "validate archive filenames without reading archived content").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const report = await validateCanonicalLayer(directory, {
        clean_genesis: options.cleanGenesis === true,
        archive_content: options.archiveIndexOnly === true ? "filenames-only" : "full"
      });
      const output = { ...report, command: "validate", mutated: false };
      process.stdout.write(
        options.json === true ? `${JSON.stringify(output, null, 2)}
` : formatCanonicalValidation(report)
      );
      if (!report.valid) process.exitCode = 1;
    } catch (error2) {
      reportOperationError("PCP_VALIDATION_FAILED", error2, false);
    }
  });
}
function addRenderCommand(program2) {
  return program2.command("render").description(commandDescriptions.render).argument("[directory]", "managed project root", ".").option("--check", "check generated output without writing").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const report = await renderCanonicalViews(directory, { check: options.check === true });
      const mutated = report.mode === "write" && report.changed_paths.length > 0;
      const output = { ...report, command: "render", mutated };
      process.stdout.write(
        options.json === true ? `${JSON.stringify(output, null, 2)}
` : formatCanonicalRender(report)
      );
      if (!report.valid) process.exitCode = 1;
    } catch (error2) {
      reportOperationError("PCP_RENDER_FAILED", error2, options.check !== true);
    }
  });
}
function addWorkstreamCommand(program2) {
  const command = program2.command("workstream").description(commandDescriptions.workstream);
  command.action(() => {
    command.outputHelp();
  });
  command.command("create").description("Create one digest-bound canonical workstream").argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").requiredOption("--input <workstream.yaml>", "external workstream operation input").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await mutateWorkstream(
        options.candidate ?? directory ?? ".",
        "create",
        options.input
      );
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatWorkstream(result)
      );
    } catch (error2) {
      reportWorkstreamError(error2);
    }
  });
  command.command("update").description("Replace one nonterminal workstream using the current registry digest").argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").requiredOption("--input <workstream.yaml>", "external workstream operation input").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await mutateWorkstream(
        options.candidate ?? directory ?? ".",
        "update",
        options.input
      );
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatWorkstream(result)
      );
    } catch (error2) {
      reportWorkstreamError(error2);
    }
  });
  command.command("validate").description("Validate canonical workstreams and return the exact registry digest").argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").option("--workstream <id>", "select one workstream").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await validateWorkstreamRegistry(
        options.candidate ?? directory ?? ".",
        options.workstream
      );
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatWorkstream(result)
      );
    } catch (error2) {
      reportWorkstreamError(error2);
    }
  });
  command.command("complete").description("Complete one active or blocked workstream with criterion-bound evidence").argument("[directory]", "managed project root").option("--candidate <directory>", "managed project root").requiredOption("--input <workstream.yaml>", "external workstream operation input").option("--json", "emit stable structured JSON").action(async (directory, options) => {
    try {
      const result = await mutateWorkstream(
        options.candidate ?? directory ?? ".",
        "complete",
        options.input
      );
      process.stdout.write(
        options.json === true ? `${JSON.stringify(result, null, 2)}
` : formatWorkstream(result)
      );
    } catch (error2) {
      reportWorkstreamError(error2);
    }
  });
  return command;
}
function reportOperationError(code2, error2, mutationPossible) {
  const message = error2 instanceof Error ? error2.message : String(error2);
  process.stderr.write(`${JSON.stringify({ code: code2, message, mutated: false, mutationPossible })}
`);
  process.exitCode = 2;
}
function addUnavailableCommand(program2, commandName) {
  const command = program2.command(commandName).description(commandDescriptions[commandName]);
  switch (commandName) {
    case "upgrade":
    case "repair":
      command.option("--apply <digest>", "apply only the matching preview digest");
      break;
    default:
      break;
  }
  command.action(() => {
    reportUnavailable(commandName);
  });
  return command;
}
function createProgram() {
  const program2 = new Command();
  program2.name("pcp").description(`${PCP_NAME} project-local engine`).version(PCP_VERSION).showHelpAfterError();
  for (const commandName of PCP_COMMANDS) {
    if (commandName === "inspect") {
      addInspectCommand(program2);
    } else if (commandName === "adopt") {
      addAdoptCommand(program2);
    } else if (commandName === "register") {
      addRegisterCommand(program2);
    } else if (commandName === "status") {
      addStatusCommand(program2);
    } else if (commandName === "record") {
      addRecordCommand(program2);
    } else if (commandName === "validate") {
      addValidateCommand(program2);
    } else if (commandName === "render") {
      addRenderCommand(program2);
    } else if (commandName === "workstream") {
      addWorkstreamCommand(program2);
    } else {
      addUnavailableCommand(program2, commandName);
    }
  }
  return program2;
}
async function runCli(argv = process.argv) {
  const program2 = createProgram();
  if (argv.length <= 2) {
    program2.outputHelp();
    return;
  }
  await program2.parseAsync([...argv]);
}
var entryPath = process.argv[1];
if (entryPath !== void 0 && import.meta.url === pathToFileURL(entryPath).href) {
  await runCli();
}
export {
  createProgram,
  runCli
};
//# sourceMappingURL=pcp.mjs.map
