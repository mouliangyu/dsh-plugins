// src/index.ts
import { randomUUID } from "node:crypto";

// ../../work/deepseek-harness/vendor/cosmokit/src/misc.ts
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) {
    if (forced || source[key] !== void 0) result[key] = source[key];
  }
  return result;
}

// ../../work/deepseek-harness/vendor/cosmokit/src/types.ts
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
((Binary2) => {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) {
      return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    } else {
      return source;
    }
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(source).toString("base64");
    }
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) {
      buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    }
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) {
      descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    }
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }) ?? Object.keys({ ...a, ...b }).every((key) => deepEqual(a[key], b[key], strict));
}

// ../../work/deepseek-harness/vendor/cosmokit/src/time.ts
var Time;
((Time2) => {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) {
      date2 = Date.now() + parsed;
    } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    }
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) {
      return Math.round(ms / Time2.day) + "d";
    } else if (abs >= Time2.hour - Time2.minute / 2) {
      return Math.round(ms / Time2.hour) + "h";
    } else if (abs >= Time2.minute - Time2.second / 2) {
      return Math.round(ms / Time2.minute) + "m";
    } else if (abs >= Time2.second) {
      return Math.round(ms / Time2.second) + "s";
    }
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../work/deepseek-harness/vendor/schemastery/src/index.ts
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) {
      if (typeof segment === "string") {
        prefix += "." + segment;
      } else if (typeof segment === "number") {
        prefix += "[" + segment + "]";
      } else if (typeof segment === "symbol") {
        prefix += `[Symbol(${segment.toString()})]`;
      }
    }
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  name = "ValidationError";
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, {
  value: true
});
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") {
    try {
      schema.callback = new Function("return " + schema.callback)();
    } catch {
    }
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", {
  get() {
    return {
      version: 1,
      vendor: "schemastery",
      validate: (value) => {
        try {
          return { value: Schema.resolve(value, this, {})[0] };
        } catch (error) {
          if (ValidationError.is(error)) {
            return { issues: [{ message: error.message, path: error.options.path }] };
          }
          throw error;
        }
      }
    };
  }
});
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = { uid: this.uid, refs: globalThis.__schemastery_refs__ };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) {
      result[locale] = value.$description || value.$desc;
    } else if (typeof value === "string") {
      result[locale] = value;
    }
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) {
    schema.dict = mapValues(schema.dict, (inner, key) => {
      return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
    });
  }
  if (schema.list) {
    schema.list = schema.list.map((inner, index) => {
      return inner.i18n(mapValues(messages, (data = {}) => {
        if (Array.isArray(getInner(data))) return getInner(data)[index];
        if (Array.isArray(data)) return data[index];
        return extractKeys(data);
      }));
    });
  }
  if (schema.inner) {
    schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
      if (getInner(data)) return getInner(data);
      return extractKeys(data);
    }));
  }
  if (schema.sKey) {
    schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  }
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = { ...schema.meta, [key]: value };
  return schema;
};
for (const key of ["required", "disabled", "collapse", "hidden", "loose"]) {
  Object.assign(Schema.prototype, {
    [key](value = true) {
      const schema = Schema(this);
      schema.meta = { ...schema.meta, [key]: value };
      return schema;
    }
  });
}
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({ text: "deprecated", type: "danger" });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({ text: "experimental", type: "warning" });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = { ...schema.meta, pattern: pattern2 };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const schema = this.type === "object" ? this.dict[key] : this.inner;
      const item = schema?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) {
      Object.assign(result, item.simplify(value));
    }
    return result;
  } else if (this.type === "union") {
    for (const schema of this.list) {
      try {
        Schema.resolve(value, schema, {});
        return schema.simplify(value);
      } catch {
      }
    }
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = { ...schema.meta, role, extra: extra2 };
  return schema;
};
for (const key of ["default", "link", "comment", "description", "max", "min", "step"]) {
  Object.assign(Schema.prototype, {
    [key](value) {
      const schema = Schema(this);
      schema.meta = { ...schema.meta, [key]: value };
      return schema;
    }
  });
}
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) {
    return Schema.any();
  } else if (["string", "number", "boolean"].includes(typeof source)) {
    return Schema.const(source).required();
  } else if (source[kSchema]) {
    return source;
  } else if (typeof source === "function") {
    switch (source) {
      case String:
        return Schema.string().required();
      case Number:
        return Schema.number().required();
      case Boolean:
        return Schema.boolean().required();
      case Function:
        return Schema.function().required();
      default:
        return Schema.is(source).required();
    }
  } else {
    throw new TypeError(`cannot infer schema from ${source}`);
  }
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = { ...schema.meta, ...schema.inner.meta };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({ type: "lazy", builder, inner: { toJSON: toJSON2 } });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([
    Schema.is(Date),
    Schema.transform(Schema.string().role("datetime"), (value, options) => {
      const date2 = new Date(value);
      if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
      return date2;
    }, true)
  ]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([
    Schema.is(RegExp),
    Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
      try {
        return new RegExp(value, flag);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)
  ]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = { ...schema.meta, ...schema.inner.meta };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) {
    return (data - min) % step === 0;
  }
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) {
    throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  }
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) {
      if (data & bits[key]) {
        keys.push(key);
      }
    }
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else {
    throw new ValidationError(`expected number or array but got ${data}`, options);
  }
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) {
      throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    }
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) {
      result[key] = value;
    }
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) {
    try {
      return Schema.resolve(data, inner, options, strict);
    } catch (error) {
      messages.push(error);
    }
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) {
      result = value;
    } else if (typeof result !== typeof value) {
      throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    } else if (typeof value === "object") {
      merge(result ??= {}, value);
    } else if (result !== value) {
      throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    }
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) {
    return [callback(result)];
  } else {
    return [callback(result), callback(adapted)];
  }
});
var formatters = {};
function defineMethod(name2, keys, format) {
  formatters[name2] = format;
  Object.assign(Schema, {
    [name2](...args) {
      const schema = new Schema({ type: name2 });
      keys.forEach((key, index) => {
        switch (key) {
          case "sKey":
            schema.sKey = args[index] ?? Schema.string();
            break;
          case "inner":
            schema.inner = Schema.from(args[index]);
            break;
          case "list":
            schema.list = args[index].map(Schema.from);
            break;
          case "dict":
            schema.dict = mapValues(args[index], Schema.from);
            break;
          case "bits": {
            schema.bits = {};
            for (const key2 in args[index]) {
              if (typeof args[index][key2] !== "number") continue;
              schema.bits[key2] = args[index][key2];
            }
            break;
          }
          case "callback": {
            const callback = schema.callback = args[index];
            callback["toJSON"] ||= () => callback.toString();
            break;
          }
          case "constructor": {
            const constructor = schema.constructor = args[index];
            if (typeof constructor === "function") {
              ;
              constructor["toJSON"] ||= () => constructor["name"];
            }
            break;
          }
          default:
            schema[key] = args[index];
        }
      });
      if (name2 === "object" || name2 === "dict") {
        schema.meta.default = {};
      } else if (name2 === "array" || name2 === "tuple") {
        schema.meta.default = [];
      } else if (name2 === "bitset") {
        schema.meta.default = 0;
      }
      return schema;
    }
  });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") {
    return constructor.name;
  } else {
    return constructor;
  }
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", ["inner", "callback", "preserve"], ({ inner }, isInner) => inner.toString(isInner));
var src_default = Schema;

// src/index.ts
var name = "session_control";
var inject = [
  "agents",
  "sessionPersistence",
  "sessionQuery",
  "settings",
  "tools",
  "webServer",
  "workspaceRegistry"
];
var Config = src_default.object({
  allowGlobalAccess: src_default.boolean().default(true),
  allowArchive: src_default.boolean().default(false),
  maxManagedSessions: src_default.number().step(1).min(1).default(12)
});
var TEXT_OUTPUT = {
  schema: { type: "string" },
  render: (_args, value) => [
    { type: "text", text: value }
  ]
};
var SESSION_VISIBILITY = "Global access is deployment-configurable. Created sessions remain visible in the normal Web sidebar.";
var SETTINGS_NAMESPACE = "session-control";
var SETTINGS_ROUTE = "/api/session-control/settings";
var RuntimeSettings = src_default.object({
  allowGlobalAccess: src_default.boolean().default(true)
});
function defineSessionTool(options) {
  const required = Object.entries(options.parameters).filter(([, value]) => value.required).map(([key]) => key);
  return {
    name: options.name,
    description: options.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(options.parameters).map(([key, value]) => [
          key,
          {
            type: value.type,
            ...value.description === void 0 ? {} : { description: value.description }
          }
        ])
      ),
      ...required.length === 0 ? {} : { required }
    },
    output: options.output,
    ...options.isConcurrencySafe === void 0 ? {} : {
      isConcurrencySafe: (args) => options.isConcurrencySafe(args)
    },
    execute: (args, exec) => options.execute(args, exec)
  };
}
function sessionId(value) {
  return value;
}
function workspaceId(value) {
  return value;
}
function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
function createCoordinatorMessage(content, senderSessionId) {
  return deepFreeze({
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text: content }],
    source: {
      kind: "coordinator",
      form: "relay",
      senderSessionId
    }
  });
}
function apply(ctx, config = {}) {
  const resolved = resolveConfig(config);
  const handles = /* @__PURE__ */ new Map();
  const settings = ctx.settings.register(SETTINGS_NAMESPACE, RuntimeSettings, {
    base: { allowGlobalAccess: resolved.allowGlobalAccess }
  });
  const globalAccessEnabled = () => settings.get().allowGlobalAccess;
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: SETTINGS_ROUTE,
      handler: (req, res) => handleSettingsRequest(req, res, settings)
    }),
    "session_control.settingsRoute"
  );
  ctx.effect(
    () => () => Promise.all([...handles.values()].map((handle) => handle.dispose())),
    "session_control.dispose"
  );
  ctx.tools.register(
    defineSessionTool({
      name: "session_create",
      description: `Create and start a related session in the caller's current workspace. ${SESSION_VISIBILITY}`,
      parameters: {
        task: {
          type: "string",
          required: true,
          description: "Standalone task for the new session."
        },
        workspace_id: {
          type: "string",
          description: "Optional workspace id from workspace_list. Defaults to the caller's workspace."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args, exec) {
        const parent = requireAgent(exec);
        const workspace = await resolveCreationWorkspace(
          ctx,
          parent,
          args.workspace_id,
          globalAccessEnabled()
        );
        if (handles.size >= resolved.maxManagedSessions) {
          throw new Error(
            `session_control: managed-session limit (${resolved.maxManagedSessions}) reached`
          );
        }
        const task = nonBlank("task", args.task);
        const childSessionId = sessionId(randomUUID());
        const handle = await ctx.agents.create({
          sessionId: childSessionId,
          meta: {
            version: 0,
            id: childSessionId,
            createdAt: Date.now(),
            cwd: workspace.path,
            parentSession: parent.id
          },
          agentOptions: parent.options
        });
        handles.set(childSessionId, handle);
        await workspace.attachSession(childSessionId);
        handle.agent.followup(
          createCoordinatorMessage(task, parent.id)
        );
        return `Created and started session ${String(childSessionId)}.`;
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "session_list",
      description: "List accessible persisted sessions across workspaces, including location and live status.",
      parameters: {},
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(_args, exec) {
        const caller = requireAgent(exec);
        const entries = globalAccessEnabled() ? await globalSessionEntries(ctx) : await workspaceSessionEntries(ctx, caller);
        if (entries.length === 0) return "(no sessions)";
        return formatSessionEntries(ctx, entries);
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "workspace_list",
      description: "List accessible DSH workspaces with stable ids, paths, status, and session counts.",
      parameters: {},
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(_args, exec) {
        const caller = requireAgent(exec);
        const workspaces = globalAccessEnabled() ? ctx.workspaceRegistry.list() : [await requireCallerWorkspace(ctx, caller)];
        if (workspaces.length === 0) return "(no workspaces)";
        const statuses = await Promise.all(
          workspaces.map((workspace) => workspace.status())
        );
        return workspaces.map(
          (workspace, index) => `${String(workspace.id)} [${statuses[index]}] [${workspace.sessionIds.length} sessions] - ${workspace.title} - ${workspace.path}`
        ).join("\n");
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "workspace_create",
      description: "Register an existing directory as a DSH workspace. Requires global access and never creates the directory itself.",
      parameters: {
        path: {
          type: "string",
          required: true,
          description: "Existing directory path to register."
        },
        title: {
          type: "string",
          description: "Optional display title. Defaults to the directory name."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args) {
        requireGlobalAccess(globalAccessEnabled());
        const workspace = await ctx.workspaceRegistry.create(
          nonBlank("path", args.path),
          args.title === void 0 ? void 0 : nonBlank("title", args.title)
        );
        return `Registered workspace ${String(workspace.id)} - ${workspace.title} - ${workspace.path}`;
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "workspace_rename",
      description: "Rename an accessible DSH workspace without moving its directory.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list."
        },
        title: {
          type: "string",
          required: true,
          description: "New display title."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args, exec) {
        const workspace = await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          workspaceId(args.workspace_id),
          globalAccessEnabled()
        );
        const title = nonBlank("title", args.title);
        await workspace.setTitle(title);
        return `Renamed workspace ${String(workspace.id)} to ${title}.`;
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "workspace_remove",
      description: "Remove an accessible workspace registration. The directory and all session logs are retained.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args, exec) {
        const target = workspaceId(args.workspace_id);
        await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          target,
          globalAccessEnabled()
        );
        const removed = await ctx.workspaceRegistry.delete(target);
        return removed ? `Removed workspace registration ${String(target)}. Directory and session logs were retained.` : `Workspace ${String(target)} was already absent.`;
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "workspace_sessions",
      description: "List sessions belonging to an accessible workspace.",
      parameters: {
        workspace_id: {
          type: "string",
          required: true,
          description: "Workspace id returned by workspace_list."
        }
      },
      output: TEXT_OUTPUT,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const workspace = await requireManagedWorkspace(
          ctx,
          requireAgent(exec),
          workspaceId(args.workspace_id),
          globalAccessEnabled()
        );
        if (workspace.sessionIds.length === 0) return "(no sessions)";
        return formatSessionEntries(
          ctx,
          workspace.sessionIds.map((id) => ({
            id,
            location: `workspace:${workspace.title}`
          }))
        );
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "session_send",
      description: `Queue a new task or follow-up in an accessible session. ${SESSION_VISIBILITY}`,
      parameters: {
        session_id: {
          type: "string",
          required: true,
          description: "Session id returned by session_list or session_create."
        },
        message: {
          type: "string",
          required: true,
          description: "Follow-up work for the target session."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args, exec) {
        const parent = requireAgent(exec);
        const target = await requireManagedSession(
          ctx,
          parent,
          sessionId(args.session_id),
          globalAccessEnabled()
        );
        const handle = await ensureResident(ctx, handles, target, parent);
        handle.agent.followup(
          createCoordinatorMessage(
            nonBlank("message", args.message),
            parent.id
          )
        );
        return `Queued a follow-up for session ${String(target)}.`;
      }
    })
  );
  ctx.tools.register(
    defineSessionTool({
      name: "session_stop",
      description: `Stop the current turn of an accessible live session while preserving its queued messages. ${SESSION_VISIBILITY}`,
      parameters: {
        session_id: {
          type: "string",
          required: true,
          description: "Live session id returned by session_list."
        }
      },
      output: TEXT_OUTPUT,
      async execute(args, exec) {
        const parent = requireAgent(exec);
        const target = await requireManagedSession(
          ctx,
          parent,
          sessionId(args.session_id),
          globalAccessEnabled()
        );
        if (target === parent.id)
          throw new Error("session_control: a session cannot stop itself");
        const agent = ctx.agents.get(target);
        if (agent === void 0 || agent.status !== "running")
          return `Session ${String(target)} is not running.`;
        agent.cancel({ kind: "user" }, { keepInbox: true });
        return `Stop requested for session ${String(target)}.`;
      }
    })
  );
  if (resolved.allowArchive) {
    ctx.tools.register(
      defineSessionTool({
        name: "session_archive",
        description: `Archive an accessible completed session. Use only after the user explicitly asks to archive it. ${SESSION_VISIBILITY}`,
        parameters: {
          session_id: {
            type: "string",
            required: true,
            description: "Completed session id returned by session_list."
          }
        },
        output: TEXT_OUTPUT,
        async execute(args, exec) {
          const parent = requireAgent(exec);
          const target = await requireManagedSession(
            ctx,
            parent,
            sessionId(args.session_id),
            globalAccessEnabled()
          );
          if (target === parent.id)
            throw new Error("session_control: a session cannot archive itself");
          const agent = ctx.agents.get(target);
          if (agent?.status === "running")
            throw new Error(
              "session_control: stop the target before archiving it"
            );
          await ctx.workspaceRegistry.archiveSession(target);
          return `Archived session ${String(target)}.`;
        }
      })
    );
  }
}
function resolveConfig(config) {
  const maxManagedSessions = config.maxManagedSessions ?? 12;
  if (!Number.isSafeInteger(maxManagedSessions) || maxManagedSessions < 1) {
    throw new TypeError(
      "session_control: maxManagedSessions must be a positive safe integer"
    );
  }
  return {
    allowGlobalAccess: config.allowGlobalAccess ?? true,
    allowArchive: config.allowArchive ?? false,
    maxManagedSessions
  };
}
async function formatSessionEntries(ctx, entries) {
  const titles = await ctx.sessionQuery.readTitleSnapshots(
    entries.map((entry) => entry.id)
  );
  const locations = new Map(entries.map((entry) => [entry.id, entry.location]));
  return titles.map((result) => {
    const id = result.sessionId;
    const live = ctx.agents.get(id);
    const title = result.status === "fulfilled" ? result.value.title?.title ?? "untitled" : "unavailable title";
    return `${String(id)} [${live?.status ?? "ready"}] [${locations.get(id) ?? "unassigned"}] - ${title}`;
  }).join("\n");
}
async function globalSessionEntries(ctx) {
  const headers = await ctx.sessionPersistence.list();
  const locations = /* @__PURE__ */ new Map();
  for (const workspace of ctx.workspaceRegistry.list()) {
    for (const id of workspace.sessionIds) {
      locations.set(id, `workspace:${workspace.title}`);
    }
  }
  return [...headers].sort((left, right) => right.createdAt - left.createdAt).map((header) => ({
    id: header.id,
    location: locations.get(header.id) ?? "unassigned"
  }));
}
async function workspaceSessionEntries(ctx, agent) {
  const workspace = await requireCallerWorkspace(ctx, agent);
  return workspace.sessionIds.map((id) => ({
    id,
    location: `workspace:${workspace.title}`
  }));
}
function requireGlobalAccess(allowGlobalAccess) {
  if (!allowGlobalAccess) {
    throw new Error(
      "session_control: this operation requires global access; enable it in Settings > Plugins"
    );
  }
}
async function requireManagedWorkspace(ctx, agent, target, allowGlobalAccess) {
  const workspace = ctx.workspaceRegistry.get(target);
  if (workspace === void 0) {
    throw new Error(`session_control: unknown workspace ${String(target)}`);
  }
  if (allowGlobalAccess) return workspace;
  const callerWorkspace = await requireCallerWorkspace(ctx, agent);
  if (workspace.id !== callerWorkspace.id) {
    throw new Error(
      `session_control: workspace ${String(target)} is outside the caller workspace`
    );
  }
  return workspace;
}
async function resolveCreationWorkspace(ctx, agent, requestedId, allowGlobalAccess) {
  if (requestedId === void 0) return requireCallerWorkspace(ctx, agent);
  return requireManagedWorkspace(
    ctx,
    agent,
    workspaceId(nonBlank("workspace_id", requestedId)),
    allowGlobalAccess
  );
}
function sendJson(res, status, value) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(value));
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16384) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? {} : JSON.parse(text);
}
async function handleSettingsRequest(req, res, settings) {
  if (req.method === "GET") {
    sendJson(res, 200, settings.get());
    return;
  }
  if (req.method !== "PUT") {
    res.setHeader("allow", "GET, PUT");
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite !== void 0 && fetchSite !== "same-origin") {
    sendJson(res, 403, { error: "cross-origin settings writes are forbidden" });
    return;
  }
  try {
    const body = await readJsonBody(req);
    if (body === null || typeof body !== "object" || Array.isArray(body) || typeof body.allowGlobalAccess !== "boolean") {
      sendJson(res, 400, { error: "allowGlobalAccess must be boolean" });
      return;
    }
    await settings.update({
      allowGlobalAccess: body.allowGlobalAccess
    });
    sendJson(res, 200, settings.get());
  } catch (error) {
    sendJson(res, 400, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
function requireAgent(exec) {
  if (exec.agent === void 0)
    throw new Error(
      "session_control: these tools require an agent-bound caller"
    );
  return exec.agent;
}
function nonBlank(name2, value) {
  const normalized = value.trim();
  if (normalized.length === 0)
    throw new Error(`session_control: ${name2} must not be blank`);
  return normalized;
}
async function requireCallerWorkspace(ctx, agent) {
  const cwd = agent.session.header.cwd;
  if (cwd === void 0)
    throw new Error("session_control: caller has no workspace directory");
  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd);
  if (workspace === void 0)
    throw new Error(`session_control: no registered workspace owns ${cwd}`);
  return workspace;
}
async function requireWorkspaceSession(ctx, agent, target) {
  const workspace = await requireCallerWorkspace(ctx, agent);
  if (!workspace.sessionIds.includes(target)) {
    throw new Error(
      `session_control: session ${String(target)} is outside the caller workspace`
    );
  }
  return target;
}
async function requireManagedSession(ctx, agent, target, allowGlobalAccess) {
  if (!allowGlobalAccess) return requireWorkspaceSession(ctx, agent, target);
  if (ctx.agents.get(target) !== void 0) return target;
  const headers = await ctx.sessionPersistence.list();
  if (!headers.some((header) => header.id === target)) {
    throw new Error(`session_control: unknown session ${String(target)}`);
  }
  return target;
}
async function ensureResident(ctx, handles, sessionId2, caller) {
  const owned = handles.get(sessionId2);
  if (owned !== void 0) return owned;
  const existing = ctx.agents.get(sessionId2);
  if (existing !== void 0)
    return { agent: existing, dispose: async () => {
    } };
  const resumed = await ctx.agents.resume({
    resumeSessionId: sessionId2,
    agentOptions: caller.options
  });
  handles.set(sessionId2, resumed);
  return resumed;
}
export {
  Config,
  apply,
  inject,
  name
};
