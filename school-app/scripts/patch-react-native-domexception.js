const fs = require('fs');
const path = require('path');

const setupDomTarget = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'src',
  'private',
  'setup',
  'setUpDOM.js',
);

const eventTarget = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'src',
  'private',
  'webapis',
  'dom',
  'events',
  'Event.js',
);

const marker = 'function createDOMExceptionPolyfill()';
const domExceptionBlock = `function createDOMExceptionPolyfill() {
  class DOMExceptionPolyfill extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
      this.code = ERROR_NAME_TO_ERROR_CODE_MAP[name] ?? 0;
    }
  }

  for (const code in ERROR_CODES) {
    Object.defineProperty(DOMExceptionPolyfill, code, {
      enumerable: true,
      value: ERROR_CODES[code],
    });

    Object.defineProperty(DOMExceptionPolyfill.prototype, code, {
      enumerable: true,
      value: ERROR_CODES[code],
    });
  }

  return DOMExceptionPolyfill;
}

const ERROR_NAME_TO_ERROR_CODE_MAP = {
  IndexSizeError: 1,
  HierarchyRequestError: 3,
  WrongDocumentError: 4,
  InvalidCharacterError: 5,
  NoModificationAllowedError: 7,
  NotFoundError: 8,
  NotSupportedError: 9,
  InUseAttributeError: 10,
  InvalidStateError: 11,
  SyntaxError: 12,
  InvalidModificationError: 13,
  NamespaceError: 14,
  InvalidAccessError: 15,
  TypeMismatchError: 17,
  SecurityError: 18,
  NetworkError: 19,
  AbortError: 20,
  URLMismatchError: 21,
  QuotaExceededError: 22,
  TimeoutError: 23,
  InvalidNodeTypeError: 24,
  DataCloneError: 25,
};

const ERROR_CODES = {
  INDEX_SIZE_ERR: 1,
  DOMSTRING_SIZE_ERR: 2,
  HIERARCHY_REQUEST_ERR: 3,
  WRONG_DOCUMENT_ERR: 4,
  INVALID_CHARACTER_ERR: 5,
  NO_DATA_ALLOWED_ERR: 6,
  NO_MODIFICATION_ALLOWED_ERR: 7,
  NOT_FOUND_ERR: 8,
  NOT_SUPPORTED_ERR: 9,
  INUSE_ATTRIBUTE_ERR: 10,
  INVALID_STATE_ERR: 11,
  SYNTAX_ERR: 12,
  INVALID_MODIFICATION_ERR: 13,
  NAMESPACE_ERR: 14,
  INVALID_ACCESS_ERR: 15,
  VALIDATION_ERR: 16,
  TYPE_MISMATCH_ERR: 17,
  SECURITY_ERR: 18,
  NETWORK_ERR: 19,
  ABORT_ERR: 20,
  URL_MISMATCH_ERR: 21,
  QUOTA_EXCEEDED_ERR: 22,
  TIMEOUT_ERR: 23,
  INVALID_NODE_TYPE_ERR: 24,
  DATA_CLONE_ERR: 25,
};

`;

if (fs.existsSync(setupDomTarget)) {
  let source = fs.readFileSync(setupDomTarget, 'utf8');

  source = source.replace(
    /  polyfillGlobal\(\r?\n    'DOMException',\r?\n    \(\) => require\('\.\.\/webapis\/errors\/DOMException'\)\.default,\r?\n  \);\r?\n\r?\n/g,
    '',
  );

  if (!source.includes(marker)) {
    source = source.replace(
      'let initialized = false;\n\n',
      `let initialized = false;\n\n${domExceptionBlock}`,
    );
  }

  if (!source.includes("'DOMException'")) {
    source = source.replace(
      "  polyfillGlobal(\n    'DOMRect',",
      "  polyfillGlobal(\n    'DOMException',\n    () => createDOMExceptionPolyfill(),\n  );\n\n  polyfillGlobal(\n    'DOMRect',",
    );
  }

  fs.writeFileSync(setupDomTarget, source);
}

if (fs.existsSync(eventTarget)) {
  let source = fs.readFileSync(eventTarget, 'utf8');
  source = source.replace(
    /Object\.defineProperty\((Event(?:\.prototype)?), '([^']+)', \{\r?\n  enumerable: true,\r?\n  value: ([0-9]+),\r?\n\}\);/g,
    "Object.defineProperty($1, '$2', {\n  configurable: true,\n  enumerable: true,\n  writable: true,\n  value: $3,\n});",
  );

  fs.writeFileSync(eventTarget, source);
}
