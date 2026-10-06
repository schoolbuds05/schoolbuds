const root = typeof globalThis !== 'undefined' ? globalThis : global;

if (typeof root.DOMException === 'undefined') {
  class DOMExceptionPolyfill extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }

    get code() {
      return 0;
    }
  }

  Object.defineProperty(root, 'DOMException', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: DOMExceptionPolyfill,
  });
}

if (typeof global !== 'undefined' && typeof global.DOMException === 'undefined') {
  global.DOMException = root.DOMException;
}
