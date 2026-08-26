window.__ModuleLoader__.load({
	id: "dsh-composer-history",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.8.2/node_modules/@deepseek-ai/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		/** Binary source detection and base64/hex conversion helpers. */
		var Binary;
		(function(Binary) {
			Binary.is = isArrayBufferLike;
			Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
		function deepEqual(a, b, strict) {
			if (a === b) return true;
			if (!strict && isNullable(a) && isNullable(b)) return true;
			if (typeof a !== typeof b) return false;
			if (typeof a !== "object") return false;
			if (!a || !b) return false;
			function check(test, then) {
				return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
			}
			return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
				if (a.byteLength !== b.byteLength) return false;
				const viewA = new Uint8Array(a);
				const viewB = new Uint8Array(b);
				for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
				return true;
			}) ?? Object.keys({
				...a,
				...b
			}).every((key) => deepEqual(a[key], b[key], strict));
		}
		/** Time constants plus parsing and formatting helpers. */
		var Time;
		(function(Time) {
			Time.millisecond = 1;
			Time.second = 1e3;
			Time.minute = Time.second * 60;
			Time.hour = Time.minute * 60;
			Time.day = Time.hour * 24;
			Time.week = Time.day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
			}
			Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * Time.day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * Time.minute);
			}
			Time.fromDateNumber = fromDateNumber;
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
				return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
			}
			Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
				else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
				else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
				else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
				return ms + "ms";
			}
			Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+schemastery@3.18.1/node_modules/@deepseek-ai/schemastery/lib/index.mjs
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
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
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
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
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		const resolvers = {};
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
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
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
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
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
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
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
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
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
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
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
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
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
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
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
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
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region src/client/config.ts
		/**
		* Plugin Config: the Schemastery schema every tunable lives in. The schema
		* is exported from both halves — the host Loader validates any cordis.yml
		* `config:` block against it at load time (invalid values fail the entry
		* loudly), the host half also registers it as the settings-namespace schema
		* (so the resolved composition `base` + user layer reaches the browser), and
		* the browser half resolves it again in apply() so defaults apply even
		* without either. Key-spec GRAMMAR (chord syntax) is validated at parse time
		* by keys.ts, not by the schema — a malformed chord fails the browser fiber
		* loudly at load.
		*/
		/** Defaults are the plugin behavior baseline; every key is changeable from cordis.yml and the settings document. */
		const Config = Schema.object({
			recallWithDraft: Schema.union([Schema.const("save"), Schema.const("gate")]).default("save"),
			restoreOnEscape: Schema.boolean().default(true),
			edgeMode: Schema.union([Schema.const("logical"), Schema.const("visual")]).default("logical"),
			enableCtrlAlias: Schema.boolean().default(true),
			restoreCaret: Schema.boolean().default(true),
			upKey: Schema.string().default("ArrowUp"),
			downKey: Schema.string().default("ArrowDown"),
			escapeKey: Schema.string().default("Escape"),
			maxHistory: Schema.number().step(1).min(0).default(500),
			includeKinds: Schema.array(Schema.string()).default(["user"]),
			historyScope: Schema.union([Schema.const("session"), Schema.const("workspace")]).default("session"),
			persistHistory: Schema.boolean().default(true),
			maxPersisted: Schema.number().step(1).min(0).default(200),
			enableSearch: Schema.boolean().default(true),
			searchKeys: Schema.array(Schema.string()).default(["Ctrl+R"]),
			searchCaseSensitive: Schema.boolean().default(false),
			includeCompactionSummaries: Schema.boolean().default(true),
			showCompactionNotice: Schema.boolean().default(true),
			compactCommandText: Schema.string().default("/compact"),
			enableSnippets: Schema.boolean().default(true),
			maxSnippets: Schema.number().step(1).min(0).default(200),
			enableTemplates: Schema.boolean().default(true),
			enableInsights: Schema.boolean().default(true),
			insightMinUses: Schema.number().step(1).min(1).default(2),
			enableCompactionHighlight: Schema.boolean().default(true)
		});
		/**
		* Resolve a config input through the schema: partial input gets the
		* defaults, invalid values throw at load time. The boundary cast is
		* deliberate — the schema's declared source type is the fully-populated
		* object, while runtime accepts partial input and fills the rest.
		* @param input - raw config (cordis.yml block, settings section, or absent in the browser).
		* @returns the validated, fully-defaulted options.
		*/
		function resolveConfig(input) {
			return Config(input);
		}
		//#endregion
		//#region src/client/recall.ts
		const DEFAULT_EXTRACT = {
			kinds: ["user"],
			max: 0
		};
		/** Node kind of the harness's sliding-context checkpoint markers. */
		const COMPACTION_KIND = "compaction";
		/**
		* Effective kinds for recall/search: the configured kinds plus the
		* compaction kind when compaction summaries are admitted. Returns the
		* configured list untouched when it already contains the compaction kind
		* (no duplicates) or when summaries are disabled.
		* @param includeKinds - configured node kinds.
		* @param includeCompactionSummaries - whether `[compacted]` summary entries join the history.
		* @returns the kinds one extraction should admit.
		*/
		function effectiveKinds(includeKinds, includeCompactionSummaries) {
			if (!includeCompactionSummaries || includeKinds.includes("compaction")) return includeKinds;
			return [...includeKinds, COMPACTION_KIND];
		}
		/**
		* Extract the recall history from a session's nodes in time order (newest
		* last): admitted node kinds only, text blocks joined per node, blank
		* entries dropped, adjacent duplicates merged, bounded to `max` newest
		* entries. One entry per submitted message.
		* @param nodes - projected conversation nodes in seq order.
		* @param options - partial extraction tunables; defaults read user nodes
		*   unbounded (the historical behavior).
		* @returns non-blank entries, oldest first.
		*/
		function extractHistory(nodes, options = {}) {
			const kinds = options.kinds ?? DEFAULT_EXTRACT.kinds;
			const max = options.max ?? DEFAULT_EXTRACT.max;
			const entries = [];
			let head = 0;
			for (const node of nodes) {
				if (!kinds.includes(node.kind)) continue;
				const text = node.texts.join("\n");
				if (text.trim() === "") continue;
				if (entries[entries.length - 1] === text) continue;
				entries.push(text);
				if (max > 0 && entries.length - head > max) head++;
			}
			return head === 0 ? entries : entries.slice(head);
		}
		/**
		* Compose the recall order from supplemental entries (persisted history,
		* other sessions) followed by the current session's entries. Supplemental
		* texts already present in the current session are dropped (the newest
		* occurrence wins), kept supplementals are adjacent-deduplicated, and the
		* current-session list is appended untouched — its internal dedupe already
		* happened at extraction.
		* @param supplemental - extra entries in oldest-first order.
		* @param current - current-session entries in oldest-first order.
		* @returns the merged history, newest last.
		*/
		function composeHistory(supplemental, current) {
			if (supplemental.length === 0) return [...current];
			const currentSet = new Set(current);
			const kept = [];
			for (const text of supplemental) {
				if (currentSet.has(text)) continue;
				if (kept[kept.length - 1] === text) continue;
				kept.push(text);
			}
			return [...kept, ...current];
		}
		const WORD_CHAR = /[\p{L}\p{N}_]/u;
		const WHITESPACE = /\s/u;
		/**
		* Whether a live trigger token ('/' or '@' at a word boundary) sits at the
		* caret — the menu-open fallback when the inputTriggers service is missing.
		* Mirrors the slash pipeline's boundary rules: a trigger opens at
		* start-of-draft, after whitespace, or after punctuation; '/' additionally
		* stays dead directly after '/' and after a scheme separator (`https:/…`).
		* @param draft - composer draft text.
		* @param caret - caret offset into `draft`.
		*/
		function hasActiveTriggerToken(draft, caret) {
			for (let i = caret - 1; i >= 0; i--) {
				const ch = draft.charAt(i);
				if (WHITESPACE.test(ch)) return false;
				if (ch !== "/" && ch !== "@") continue;
				if (i > 0) {
					const prev = draft.charAt(i - 1);
					if (WORD_CHAR.test(prev)) continue;
					if (ch === "/") {
						if (prev === "/") continue;
						if (prev === ":" && i >= 2 && !WHITESPACE.test(draft.charAt(i - 2))) continue;
					}
				}
				return true;
			}
			return false;
		}
		/** Logical ↑ edge: the caret sits on the first line (or the draft has one line). */
		function upAtLogicalEdge(draft, caret) {
			const firstNewline = draft.indexOf("\n");
			return firstNewline === -1 || caret <= firstNewline;
		}
		/** Logical ↓ edge: the caret sits on the last line. */
		function downAtLogicalEdge(draft, caret) {
			return caret > draft.lastIndexOf("\n");
		}
		/**
		* Keyboard/composition/selection gate shared by every key. Modifier sets
		* allowed: none, or Ctrl alone on the arrows when enableCtrlAlias is on.
		* @param frame - the key press facts.
		* @param options - tunables.
		*/
		function keysAllowed(frame, options) {
			if (frame.isComposing || frame.hasSelection) return false;
			if (frame.altKey || frame.metaKey || frame.shiftKey) return false;
			if (frame.key === "escape") return !frame.ctrlKey;
			return !frame.ctrlKey || options.enableCtrlAlias;
		}
		/** Interception gate: keyboard facts plus the input phase and the picker state. */
		function interceptionGate(frame, options) {
			if (frame.phase !== "plain") return false;
			if (frame.menuOpen) return false;
			return keysAllowed(frame, options);
		}
		/**
		* The draft-recall machine. All mutation stays inside; every method is a
		* pure function of its arguments plus the internal state.
		*/
		var DraftRecall = class {
			options;
			state = { kind: "idle" };
			/** @param options - resolved tunables (the plugin Config output). */
			constructor(options) {
				this.options = options;
			}
			/** Current state (tests and diagnostics). */
			stateOf() {
				return this.state;
			}
			/** Leave browsing without touching the draft (session switch, teardown). */
			reset() {
				this.state = { kind: "idle" };
			}
			/**
			* User edit guard: when browsing and the draft diverged from the browsed
			* entry, the edit becomes the new draft and browsing ends. Called on every
			* composer input event with the live DOM value (which already carries the
			* edit at capture time).
			* @param draft - the composer's current value.
			*/
			noteDraftChange(draft) {
				const state = this.state;
				if (state.kind !== "browsing") return;
				if (draft !== state.history[state.index]) this.state = { kind: "idle" };
			}
			/**
			* ↑: in IDLE the first recall stashes {draft, caret} and fills the newest
			* entry (gated by recallWithDraft); while browsing an eligible ↑ walks one
			* entry older, stopping at index 0 with a hold.
			* @param frame - key facts plus the fresh history extraction.
			* @returns the effect to apply.
			*/
			up(frame) {
				if (!interceptionGate(frame, this.options) || !frame.upEdge) return { kind: "pass" };
				const history = frame.history;
				const state = this.state;
				if (state.kind === "idle") {
					if (history.length === 0) return { kind: "pass" };
					if (this.options.recallWithDraft === "gate" && frame.draft !== "") return { kind: "pass" };
					const index = history.length - 1;
					const text = history[index];
					if (text === void 0) return { kind: "pass" };
					this.state = {
						kind: "browsing",
						index,
						savedDraft: frame.draft,
						savedCaret: frame.caret,
						history
					};
					return {
						kind: "fill",
						text
					};
				}
				if (history.length === 0) {
					this.state = { kind: "idle" };
					return { kind: "pass" };
				}
				const index = Math.min(state.index, history.length - 1);
				if (index <= 0) {
					this.state = {
						...state,
						index,
						history
					};
					return { kind: "hold" };
				}
				const next = index - 1;
				const text = history[next];
				if (text === void 0) return { kind: "pass" };
				this.state = {
					...state,
					index: next,
					history
				};
				return {
					kind: "fill",
					text
				};
			}
			/**
			* ↓: IDLE always passes (plain caret movement). While browsing an eligible
			* ↓ walks one entry newer; at the newest entry it restores the stashed
			* draft (and caret, when restoreCaret) and returns to IDLE.
			* @param frame - key facts plus the fresh history extraction.
			* @returns the effect to apply.
			*/
			down(frame) {
				if (!interceptionGate(frame, this.options)) return { kind: "pass" };
				const state = this.state;
				if (state.kind === "idle") return { kind: "pass" };
				const history = frame.history;
				if (history.length === 0) {
					this.state = { kind: "idle" };
					return { kind: "pass" };
				}
				if (!frame.downEdge) return { kind: "pass" };
				const index = Math.min(state.index, history.length - 1);
				if (index < history.length - 1) {
					const next = index + 1;
					const text = history[next];
					if (text === void 0) return { kind: "pass" };
					this.state = {
						...state,
						index: next,
						history
					};
					return {
						kind: "fill",
						text
					};
				}
				this.state = { kind: "idle" };
				return this.options.restoreCaret ? {
					kind: "restore",
					text: state.savedDraft,
					caret: state.savedCaret
				} : {
					kind: "restore",
					text: state.savedDraft
				};
			}
			/**
			* Esc: while browsing and restoreOnEscape is on, restore the stashed draft
			* (and caret) and return to IDLE, consuming the key. Every other Esc —
			* including while the menu or a popup owns it — passes untouched.
			* @param frame - key facts.
			* @returns the effect to apply.
			*/
			escape(frame) {
				if (!this.options.restoreOnEscape) return { kind: "pass" };
				if (!interceptionGate(frame, this.options)) return { kind: "pass" };
				const state = this.state;
				if (state.kind === "idle") return { kind: "pass" };
				this.state = { kind: "idle" };
				return this.options.restoreCaret ? {
					kind: "restore",
					text: state.savedDraft,
					caret: state.savedCaret
				} : {
					kind: "restore",
					text: state.savedDraft
				};
			}
		};
		//#endregion
		//#region src/client/visual-edge.ts
		/**
		* The visual line index the caret belongs to. A caret sitting after a line
		* break (at the start of the next span) belongs to that next line; a caret
		* at or beyond the final span's end belongs to the last line.
		* @param spans - measured spans covering the draft, sorted, non-empty in practice.
		* @param caret - caret offset into the draft.
		* @returns 0-based line index; 0 when spans are empty.
		*/
		function caretVisualLine(spans, caret) {
			if (spans.length === 0) return 0;
			const last = spans[spans.length - 1];
			if (last === void 0 || caret >= last.end) return spans.length - 1;
			for (let i = 0; i < spans.length; i++) {
				const span = spans[i];
				if (span !== void 0 && caret >= span.start && caret < span.end) return i;
			}
			return 0;
		}
		/**
		* ↑ takeover boundary: the caret is on the first visual line.
		* @param spans - measured spans for the draft.
		* @param caret - caret offset.
		*/
		function upAtFirstVisualLine(spans, caret) {
			return caretVisualLine(spans, caret) <= 0;
		}
		/**
		* ↓ takeover boundary: the caret is on the last visual line.
		* @param spans - measured spans for the draft.
		* @param caret - caret offset.
		*/
		function downAtLastVisualLine(spans, caret) {
			return caretVisualLine(spans, caret) >= spans.length - 1;
		}
		//#endregion
		//#region src/client/keys.ts
		const MODIFIERS = /* @__PURE__ */ new Map([
			["ctrl", "ctrl"],
			["control", "ctrl"],
			["alt", "alt"],
			["option", "alt"],
			["meta", "meta"],
			["cmd", "meta"],
			["win", "meta"],
			["shift", "shift"]
		]);
		/**
		* Parse one chord spec like 'Ctrl+R' or 'Ctrl+Shift+Up'.
		* @param spec - config string.
		* @returns the parsed chord.
		* @throws when the spec is empty, names an unknown modifier, repeats a
		*   modifier, or has no trailing key name.
		*/
		function parseChord(spec) {
			const parts = spec.split("+");
			let key = "";
			let ctrl = false;
			let alt = false;
			let meta = false;
			let shift = false;
			for (const raw of parts) {
				const token = raw.trim();
				if (token === "") throw new Error(`invalid key spec ${JSON.stringify(spec)}: empty part`);
				const modifier = MODIFIERS.get(token.toLowerCase());
				if (modifier !== void 0) {
					if (modifier === "ctrl") {
						if (ctrl) throw new Error(`invalid key spec ${JSON.stringify(spec)}: repeated ${token}`);
						ctrl = true;
					} else if (modifier === "alt") {
						if (alt) throw new Error(`invalid key spec ${JSON.stringify(spec)}: repeated ${token}`);
						alt = true;
					} else if (modifier === "meta") {
						if (meta) throw new Error(`invalid key spec ${JSON.stringify(spec)}: repeated ${token}`);
						meta = true;
					} else {
						if (shift) throw new Error(`invalid key spec ${JSON.stringify(spec)}: repeated ${token}`);
						shift = true;
					}
					continue;
				}
				if (key !== "") throw new Error(`invalid key spec ${JSON.stringify(spec)}: more than one key name`);
				key = token;
			}
			if (key === "") throw new Error(`invalid key spec ${JSON.stringify(spec)}: missing key name`);
			return {
				key,
				ctrl,
				alt,
				meta,
				shift
			};
		}
		/**
		* Whether a keyboard event matches a parsed chord exactly: every modifier
		* the chord declares is held, no undeclared modifier is held, and the key
		* name matches case-insensitively.
		* @param event - keyboard facts.
		* @param chord - parsed chord.
		*/
		function chordMatches(event, chord) {
			return event.ctrlKey === chord.ctrl && event.altKey === chord.alt && event.metaKey === chord.meta && event.shiftKey === chord.shift && event.key.toLowerCase() === chord.key.toLowerCase();
		}
		//#endregion
		//#region src/client/interceptor.ts
		/**
		* Browser wiring core: turns the pure {@link DraftRecall} machine into the
		* window-capture keyboard behavior. Everything platform-specific arrives
		* through the injected {@link ComposerHistoryHost}, so the full takeover
		* semantics (preventDefault/stopPropagation discipline, divergence on edit,
		* session-switch reset, search chord, key remapping) are testable under
		* jsdom with fakes.
		*
		* Contract: an event is only prevented once the machine produced a non-pass
		* effect; every pass path leaves the event untouched. After a takeover the
		* caret is moved to the end of the filled text on the next animation frame
		* (requestAnimationFrame + setSelectionRange, pending frames cancelled on
		* reschedule and dispose), and the draft write always goes through the
		* host's setDraft (the input machine's single write path).
		*/
		/**
		* Build the interception handle over a host and the resolved options.
		* Search chord specs are parsed here: a malformed spec throws, failing the
		* browser fiber loudly at load.
		* @param host - platform seams.
		* @param config - resolved tunables.
		* @returns the handle; wire it to window capture listeners and dispose with
		*   the owning fiber (the handle owns no external resources itself).
		*/
		function createComposerHistory(host, config) {
			const machine = new DraftRecall(config);
			const searchChords = config.searchKeys.map(parseChord);
			let lastSession;
			let rafId;
			const keyOf = (event) => {
				if (event.key === config.upKey) return "up";
				if (event.key === config.downKey) return "down";
				if (event.key === config.escapeKey) return "escape";
			};
			const caretTo = (composer, caret) => {
				if (rafId !== void 0) cancelAnimationFrame(rafId);
				rafId = requestAnimationFrame(() => {
					rafId = void 0;
					composer.setSelectionRange(caret, caret);
				});
			};
			const caretToEnd = (composer) => {
				caretTo(composer, composer.value.length);
			};
			const apply = (composer, effect) => {
				switch (effect.kind) {
					case "pass": return;
					case "hold": return;
					case "fill":
						host.setDraft(composer, effect.text);
						caretToEnd(composer);
						return;
					case "restore":
						host.setDraft(composer, effect.text);
						if (effect.caret !== void 0) caretTo(composer, Math.min(effect.caret, effect.text.length));
						return;
					case "openSearch":
						host.openSearch(composer, effect.history);
						return;
				}
			};
			const edgeVerdicts = (composer, draft, caret) => {
				if (config.edgeMode === "visual") {
					const spans = host.visualSpans?.(composer, draft) ?? [{
						start: 0,
						end: draft.length
					}];
					return {
						upEdge: upAtFirstVisualLine(spans, caret),
						downEdge: downAtLastVisualLine(spans, caret)
					};
				}
				return {
					upEdge: upAtLogicalEdge(draft, caret),
					downEdge: downAtLogicalEdge(draft, caret)
				};
			};
			/** Fresh merged history for this key press: supplemental entries, then the current session's. */
			const mergedHistory = (composer) => {
				const kinds = effectiveKinds(config.includeKinds, config.includeCompactionSummaries);
				const current = extractHistory(host.history(composer), {
					kinds,
					max: config.maxHistory
				});
				const merged = composeHistory(host.supplementalHistory?.(composer) ?? [], current);
				return config.maxHistory > 0 && merged.length > config.maxHistory ? merged.slice(-config.maxHistory) : merged;
			};
			const keydown = (event) => {
				const key = keyOf(event);
				const searchChord = config.enableSearch && !event.repeat ? searchChords.find((chord) => chordMatches(event, chord)) : void 0;
				if (key === void 0 && searchChord === void 0) return;
				const composer = host.composerOf(event.target);
				if (composer === void 0) return;
				const sessionKey = host.sessionKey(composer);
				if (sessionKey !== lastSession) {
					machine.reset();
					lastSession = sessionKey;
				}
				const input = host.inputState(composer);
				if (input === void 0) return;
				if (input.phase !== "plain") return;
				if (host.menuOpen(composer)) return;
				const caret = composer.selectionStart;
				if (composer.selectionEnd !== caret) return;
				if (event.isComposing) return;
				let effect;
				if (searchChord !== void 0) {
					machine.reset();
					effect = {
						kind: "openSearch",
						history: mergedHistory(composer)
					};
				} else {
					if (key === void 0) return;
					if (event.altKey || event.metaKey || event.shiftKey) return;
					if (key === "escape") {
						if (event.ctrlKey) return;
					} else if (event.ctrlKey && !config.enableCtrlAlias) return;
					if (machine.stateOf().kind === "browsing" && input.draft === "") machine.reset();
					const draft = input.draft;
					const { upEdge, downEdge } = edgeVerdicts(composer, draft, caret);
					const needsHistory = key === "up" || key === "down" && machine.stateOf().kind === "browsing";
					const frame = {
						key,
						ctrlKey: event.ctrlKey,
						altKey: event.altKey,
						metaKey: event.metaKey,
						shiftKey: event.shiftKey,
						isComposing: event.isComposing,
						hasSelection: false,
						phase: input.phase,
						menuOpen: false,
						draft,
						caret,
						history: needsHistory ? mergedHistory(composer) : [],
						upEdge,
						downEdge
					};
					effect = key === "up" ? machine.up(frame) : key === "down" ? machine.down(frame) : machine.escape(frame);
				}
				if (effect.kind === "pass") return;
				event.preventDefault();
				event.stopPropagation();
				apply(composer, effect);
			};
			const input = (event) => {
				const composer = host.composerOf(event.target);
				if (composer === void 0) return;
				const sessionKey = host.sessionKey(composer);
				if (sessionKey !== lastSession) {
					machine.reset();
					lastSession = sessionKey;
				}
				machine.noteDraftChange(composer.value);
			};
			return {
				keydown,
				input,
				state: () => machine.stateOf(),
				reset: () => {
					machine.reset();
				},
				fill: (composer, text) => {
					host.setDraft(composer, text);
					caretToEnd(composer);
				},
				dispose: () => {
					if (rafId !== void 0) cancelAnimationFrame(rafId);
					rafId = void 0;
					machine.reset();
				}
			};
		}
		//#endregion
		//#region src/client/visual-mirror.ts
		/** Computed styles the mirror copies so its line boxes match the textarea's. */
		const COPIED_PROPERTIES = [
			"boxSizing",
			"width",
			"fontFamily",
			"fontSize",
			"fontStyle",
			"fontVariant",
			"fontWeight",
			"lineHeight",
			"letterSpacing",
			"wordSpacing",
			"textIndent",
			"tabSize",
			"paddingTop",
			"paddingRight",
			"paddingBottom",
			"paddingLeft",
			"borderTopWidth",
			"borderRightWidth",
			"borderBottomWidth",
			"borderLeftWidth"
		];
		/** Safety bound against a pathological rect/loop disagreement. */
		const MAX_LINES = 1e3;
		/** Zero-width placeholder so an empty draft still produces one line box. */
		const EMPTY_TEXT = "​";
		/**
		* Find the first character index after `start` that opens a new visual
		* line, by binary-searching the index whose line top exceeds the line top
		* at `start`. Pure over the injected top probe; the probe is only ever
		* asked about offsets inside [start, length), so the caller needs no
		* sentinel semantics.
		* @param topAt - line-top probe.
		* @param start - first character of the current visual line.
		* @param length - draft length.
		* @returns the wrap offset (first index of the next line), or undefined
		*   when no later line exists.
		*/
		function nextWrapOffsetBy(topAt, start, length) {
			if (start >= length) return void 0;
			const base = topAt(start);
			if (topAt(length - 1) <= base) return void 0;
			let low = start + 1;
			let high = length - 1;
			while (low < high) {
				const mid = Math.floor((low + high) / 2);
				if (topAt(mid) > base) high = mid;
				else low = mid + 1;
			}
			return low;
		}
		/**
		* Recover the visual-line span list from a line-top probe: one span per
		* visual line, each boundary found with {@link nextWrapOffsetBy}. Pure over
		* the injected probe; the DOM layer supplies it from Range rects.
		* @param topAt - line-top probe over [0, draftLength].
		* @param draftLength - character count of the laid-out draft.
		* @param visualLines - rect count of the full range (the probe must agree).
		* @returns spans covering the draft, or undefined when the probe cannot
		*   resolve the layout.
		*/
		function computeSpans(topAt, draftLength, visualLines) {
			if (visualLines <= 1) return [{
				start: 0,
				end: draftLength
			}];
			const spans = [];
			let start = 0;
			for (let line = 0; line < visualLines && line < MAX_LINES; line++) {
				if (line === visualLines - 1) {
					spans.push({
						start,
						end: draftLength
					});
					break;
				}
				const next = nextWrapOffsetBy(topAt, start, draftLength);
				if (next === void 0 || next <= start) break;
				spans.push({
					start,
					end: next
				});
				start = next;
			}
			if (spans.length === 0 || spans[spans.length - 1]?.end !== draftLength) spans.push({
				start,
				end: draftLength
			});
			return spans;
		}
		/**
		* Create the hidden mirror and its span measurer. The mirror is appended to
		* document.body and removed by {@link MirrorMeasurer.dispose}.
		* @returns the measurer, or undefined outside a document.
		*/
		function createMirrorMeasurer() {
			if (typeof document === "undefined") return void 0;
			const mirror = document.createElement("div");
			const style = mirror.style;
			style.position = "fixed";
			style.left = "-9999px";
			style.top = "0";
			style.visibility = "hidden";
			style.pointerEvents = "none";
			style.setProperty("white-space", "pre-wrap");
			style.setProperty("word-break", "break-word");
			style.setProperty("overflow-wrap", "break-word");
			document.body.appendChild(mirror);
			let cachedComposer;
			let cachedDraft;
			let cachedWidth = -1;
			let cachedSpans;
			return {
				spans: (composer, draft) => {
					const width = composer.clientWidth;
					if (cachedComposer === composer && cachedDraft === draft && cachedWidth === width) return cachedSpans;
					cachedComposer = composer;
					cachedDraft = draft;
					cachedWidth = width;
					cachedSpans = measureSpans(mirror, composer, draft);
					return cachedSpans;
				},
				dispose: () => {
					mirror.remove();
				}
			};
		}
		/**
		* Copy the textarea's computed metrics onto the mirror and measure.
		* @param mirror - the hidden mirror div.
		* @param composer - the textarea to copy geometry from.
		* @param draft - the text to lay out.
		* @returns visual line spans, or undefined when rect measurement is unavailable.
		*/
		function measureSpans(mirror, composer, draft) {
			const computed = window.getComputedStyle(composer);
			for (const property of COPIED_PROPERTIES) mirror.style[property] = computed.getPropertyValue(property);
			mirror.textContent = draft === "" ? EMPTY_TEXT : draft;
			const node = mirror.firstChild;
			if (node === null) return void 0;
			const range = document.createRange();
			const textLength = node.textContent?.length ?? 0;
			const topAt = (offset) => {
				range.setStart(node, 0);
				range.setEnd(node, Math.min(offset + 1, textLength));
				const rects = range.getClientRects();
				const last = rects[rects.length - 1];
				return last === void 0 ? 0 : last.top;
			};
			range.setStart(node, 0);
			range.setEnd(node, textLength);
			const visualLines = range.getClientRects().length;
			return computeSpans(topAt, draft.length, visualLines);
		}
		//#endregion
		//#region src/client/history-extract.ts
		/**
		* Extraction memo for the wiring layer: conversation snapshots are immutable
		* (stable array reference until the next change), so repeated per-keypress
		* extraction can reuse the last result keyed by the nodes array reference.
		* Two extraction shapes coexist per source — unlimited and history-capped —
		* and each is cached separately so the persistence path (unlimited) and the
		* recall path (capped) never answer each other's slot.
		*/
		/** Cached extraction over one snapshot source. */
		var HistoryExtractor = class {
			kinds;
			max;
			convert;
			slots = /* @__PURE__ */ new WeakMap();
			/**
			* @param kinds - node kinds admitted (fixed per install).
			* @param max - the install's history cap (fixed per install).
			* @param convert - maps the raw snapshot nodes to projected views (runs
			*   only on cache misses).
			*/
			constructor(kinds, max, convert) {
				this.kinds = kinds;
				this.max = max;
				this.convert = convert;
			}
			/**
			* Extract the entries of one nodes snapshot, memoized by its reference.
			* @param nodes - the snapshot's nodes array.
			* @param max - this call's cap; 0 means unlimited (defaults to the
			*   install's cap).
			* @returns non-blank entries, oldest first.
			*/
			extract(nodes, max = this.max) {
				let slot = this.slots.get(nodes);
				if (slot === void 0) {
					slot = {};
					this.slots.set(nodes, slot);
				}
				const key = max <= 0 ? "unlimited" : "capped";
				const cached = slot[key];
				if (cached !== void 0) return cached;
				const entries = extractHistory(this.convert(nodes), {
					kinds: this.kinds,
					max
				});
				slot[key] = entries;
				return entries;
			}
		};
		//#endregion
		//#region src/client/node-views.ts
		/** Prefix marking an entry that came from a compaction checkpoint, not the composer. */
		const COMPACTED_PREFIX = "[compacted] ";
		/**
		* Project one conversation node onto a recall view.
		* @param node - one snapshot node (any kind).
		* @returns the view, or undefined when the node carries no recallable text
		*   (non-text kinds, compaction markers whose summary fell outside the
		*   window, blank content).
		*/
		function viewOfNode(node) {
			switch (node.kind) {
				case "user":
				case "steering": {
					const texts = [];
					for (const block of node.content) if (block.type === "text") texts.push(block.text);
					return {
						kind: node.kind,
						texts
					};
				}
				case "compaction": {
					const summary = node.summary;
					if (summary === null || summary.trim() === "") return void 0;
					return {
						kind: node.kind,
						texts: [COMPACTED_PREFIX + summary]
					};
				}
				default: return;
			}
		}
		/**
		* Project a snapshot's nodes onto recall views, keeping source order.
		* @param nodes - conversation nodes in seq order.
		* @returns views for every node that carries recallable text.
		*/
		function viewOfNodes(nodes) {
			const views = [];
			for (const node of nodes) {
				const view = viewOfNode(node);
				if (view !== void 0) views.push(view);
			}
			return views;
		}
		//#endregion
		//#region src/client/search.ts
		/**
		* Filter structured search entries by their text (same substring semantics
		* as {@link filterEntries}); the query matches text only, never the label.
		* @param entries - structured entries.
		* @param query - the search text.
		* @param caseSensitive - whether letter case matters.
		* @returns matching entries in their original order.
		*/
		function filterSearchEntries(entries, query, caseSensitive) {
			if (query === "") return [...entries];
			const needle = caseSensitive ? query : query.toLowerCase();
			return entries.filter((entry) => (caseSensitive ? entry.text : entry.text.toLowerCase()).includes(needle));
		}
		/**
		* All non-overlapping occurrences of the query inside one entry, as
		* half-open character ranges [start, end) in source order. An empty query
		* yields no ranges (nothing to highlight). Used by the overlay to mark the
		* matched substrings inside a listed row.
		* @param text - one history entry.
		* @param query - the search text.
		* @param caseSensitive - whether letter case matters.
		* @returns match ranges, or [] for an empty query / no occurrence.
		*/
		function matchRanges(text, query, caseSensitive) {
			if (query === "") return [];
			const haystack = caseSensitive ? text : text.toLowerCase();
			const needle = caseSensitive ? query : query.toLowerCase();
			const ranges = [];
			let from = 0;
			for (;;) {
				const at = haystack.indexOf(needle, from);
				if (at === -1) break;
				ranges.push([at, at + needle.length]);
				from = at + needle.length;
			}
			return ranges;
		}
		//#endregion
		//#region src/client/search-overlay.ts
		/**
		* Reverse-search overlay: a minimal DOM panel (query input + match list)
		* opened under the composer for terminal-style Ctrl+R recall. Owns its DOM,
		* styles, and listeners; keyboard events targeting the overlay pass the
		* window-capture interception untouched (the composerOf gate rejects them).
		* Pick (Enter / click) hands the chosen text to the caller; Escape or an
		* outside press cancels. All filter and highlight decisions delegate to
		* search.ts; the panel placement is the pure placePanel clamp (below the
		* composer, flipped above on downward overflow, horizontally clamped into
		* the viewport).
		*
		* Entries are either plain strings (history, backward compatible) or
		* structured {@link SearchEntry} values carrying a provenance badge
		* (compacted summaries are highlighted amber, snippets and templates show
		* their name) and optional footer actions (template import/export).
		*/
		const ROOT_CLASS$1 = "__dsh-composer-history-search__";
		const STYLE_ID$2 = "__dsh-composer-history-search-style__";
		const PANEL_MARGIN = 8;
		const PANEL_MIN_WIDTH = 320;
		const PANEL_MAX_HEIGHT = 328;
		/**
		* Resolve the panel's fixed-position placement for one composer anchor:
		* at least {@link PANEL_MIN_WIDTH} wide (never wider than the viewport
		* minus margins), horizontally clamped into the viewport, below the
		* composer by default and above it when the panel would overflow downward.
		* Pure over the injected rects so the clamp math is unit-testable.
		* @param anchor - the composer's viewport-relative bounding rect.
		* @param viewport - window inner size.
		* @returns rounded pixel placement.
		*/
		function placePanel(anchor, viewport) {
			const width = Math.min(Math.max(anchor.right - anchor.left, PANEL_MIN_WIDTH), viewport.width - 16);
			const left = Math.min(Math.max(anchor.left, PANEL_MARGIN), viewport.width - width - PANEL_MARGIN);
			const belowTop = anchor.bottom + PANEL_MARGIN;
			const top = belowTop + PANEL_MAX_HEIGHT <= viewport.height ? belowTop : Math.max(PANEL_MARGIN, anchor.top - PANEL_MARGIN - PANEL_MAX_HEIGHT);
			return {
				left: Math.round(left),
				top: Math.round(top),
				width: Math.round(width)
			};
		}
		/** Injected once per document: the panel chrome (positioned via inline rect math). */
		const STYLE_TEXT$2 = [
			`.${ROOT_CLASS$1}{`,
			"position:fixed;z-index:2147483000;display:flex;flex-direction:column;",
			"background:#1c2128;border:1px solid #444c56;border-radius:8px;",
			"box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px/1.4 system-ui,sans-serif;",
			"color:#e6edf3;max-height:320px;overflow:hidden;padding:6px;gap:6px;",
			"}",
			`.${ROOT_CLASS$1} input{`,
			"all:unset;box-sizing:border-box;width:100%;padding:6px 8px;border-radius:6px;",
			"background:#10151b;border:1px solid #3d444d;color:#e6edf3;",
			"}",
			`.${ROOT_CLASS$1} input:focus{border-color:#58a6ff;}`,
			`.${ROOT_CLASS$1} input::placeholder{color:#8b949e;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}list{overflow-y:auto;display:flex;flex-direction:column;gap:2px;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}status{padding:0 8px;color:#8b949e;font-size:11px;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}row{`,
			"padding:5px 8px;border-radius:6px;cursor:pointer;white-space:pre-wrap;",
			"overflow-wrap:anywhere;color:#c9d1d9;max-height:36px;overflow:hidden;",
			"}",
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}row[aria-selected="true"]{background:#316dca;color:#ffffff;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}match{background:transparent;color:#58a6ff;font-weight:600;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}row[aria-selected="true"] .${ROOT_CLASS$1}match{color:#ffffff;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}empty{padding:5px 8px;color:#8b949e;font-style:italic;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}badge{`,
			"display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;font-size:10px;",
			"line-height:16px;vertical-align:1px;flex:none;",
			"}",
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}badge--compacted{background:#4a3b10;color:#e3b341;border:1px solid #9e7a16;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}badge--snippet{background:#123b2a;color:#3fb950;border:1px solid #2ea043;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}badge--template{background:#2a1f4d;color:#bc8cff;border:1px solid #8250df;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}row[aria-selected="true"] .${ROOT_CLASS$1}badge{border-color:#ffffff;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}actions{display:flex;gap:6px;padding-top:2px;}`,
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}action{`,
			"all:unset;cursor:pointer;padding:4px 8px;border-radius:6px;font-size:11px;",
			"background:#21262d;border:1px solid #3d444d;color:#c9d1d9;",
			"}",
			`.${ROOT_CLASS$1} .${ROOT_CLASS$1}action:hover{border-color:#58a6ff;color:#e6edf3;}`
		].join("");
		/** The badge label for a structured entry's provenance ('' = no badge). */
		function badgeOf(entry) {
			if (entry.source === "compacted") return "compacted";
			if (entry.source === "snippet") return entry.label ?? "snippet";
			if (entry.source === "template") return entry.label ?? "template";
			return "";
		}
		/**
		* Create the overlay (injecting its shared stylesheet once per document).
		* @param deps - pick/cancel callbacks.
		* @returns the handle, or undefined outside a document.
		*/
		function createSearchOverlay(deps) {
			if (typeof document === "undefined") return void 0;
			if (document.getElementById(STYLE_ID$2) === null) {
				const style = document.createElement("style");
				style.id = STYLE_ID$2;
				style.textContent = STYLE_TEXT$2;
				document.head.appendChild(style);
			}
			const root = document.createElement("div");
			root.className = ROOT_CLASS$1;
			root.setAttribute("role", "dialog");
			root.setAttribute("aria-label", "Search composer history");
			root.style.display = "none";
			const input = document.createElement("input");
			input.setAttribute("role", "combobox");
			input.setAttribute("aria-label", "Search query");
			input.setAttribute("aria-autocomplete", "list");
			input.setAttribute("aria-expanded", "false");
			input.setAttribute("aria-controls", `${ROOT_CLASS$1}list`);
			input.placeholder = "Search history…";
			const status = document.createElement("div");
			status.className = `${ROOT_CLASS$1}status`;
			const list = document.createElement("div");
			list.className = `${ROOT_CLASS$1}list`;
			list.id = `${ROOT_CLASS$1}list`;
			list.setAttribute("role", "listbox");
			const actions = document.createElement("div");
			actions.className = `${ROOT_CLASS$1}actions`;
			root.append(input, status, list, actions);
			let open = false;
			let entries = [];
			let caseSensitive = false;
			let selected = 0;
			let matches = [];
			/** Stable id of one option row (the combobox's activedescendant target). */
			const rowId = (index) => `${ROOT_CLASS$1}option-${index}`;
			const close = () => {
				if (!open) return;
				open = false;
				input.setAttribute("aria-expanded", "false");
				input.removeAttribute("aria-activedescendant");
				root.style.display = "none";
				document.removeEventListener("mousedown", onOutside, true);
			};
			/** Append the row text with the matched substrings wrapped in mark spans. */
			const appendRowText = (row, text) => {
				const ranges = matchRanges(text, input.value, caseSensitive);
				if (ranges.length === 0) {
					row.append(document.createTextNode(text));
					return;
				}
				let cursor = 0;
				for (const [start, end] of ranges) {
					if (start > cursor) row.append(document.createTextNode(text.slice(cursor, start)));
					const mark = document.createElement("mark");
					mark.className = `${ROOT_CLASS$1}match`;
					mark.textContent = text.slice(start, end);
					row.append(mark);
					cursor = end;
				}
				if (cursor < text.length) row.append(document.createTextNode(text.slice(cursor)));
			};
			const render = () => {
				list.textContent = "";
				status.textContent = matches.length > 0 ? `${matches.length} ${input.value === "" ? "entries" : "matches"}` : "";
				input.setAttribute("aria-activedescendant", matches.length > 0 ? rowId(selected) : "");
				if (matches.length === 0) {
					const empty = document.createElement("div");
					empty.className = `${ROOT_CLASS$1}empty`;
					empty.textContent = "No matches";
					list.append(empty);
					selected = 0;
					return;
				}
				matches.forEach((entry, index) => {
					const row = document.createElement("div");
					row.className = `${ROOT_CLASS$1}row`;
					row.setAttribute("role", "option");
					row.id = rowId(index);
					row.setAttribute("aria-selected", index === selected ? "true" : "false");
					const badgeText = badgeOf(entry);
					if (badgeText !== "") {
						const badge = document.createElement("span");
						badge.className = `${ROOT_CLASS$1}badge ${ROOT_CLASS$1}badge--${entry.source}`;
						badge.textContent = badgeText;
						row.append(badge);
					}
					appendRowText(row, entry.text);
					row.addEventListener("click", () => pick(index));
					list.append(row);
				});
				const selectedRow = list.children[selected];
				if (selectedRow instanceof HTMLElement) selectedRow.scrollIntoView?.({ block: "nearest" });
			};
			const pick = (index) => {
				const entry = matches[index];
				if (entry === void 0) return;
				close();
				deps.onPick(entry.text, entry.source, entry.label);
			};
			const refilter = () => {
				matches = filterSearchEntries(entries, input.value, caseSensitive);
				if (matches.length > 0 && selected >= matches.length) selected = matches.length - 1;
				render();
			};
			const onKeydown = (event) => {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					if (matches.length > 0) {
						selected = selected + 1 >= matches.length ? 0 : selected + 1;
						render();
					}
					return;
				}
				if (event.key === "ArrowUp") {
					event.preventDefault();
					if (matches.length > 0) {
						selected = selected - 1 < 0 ? matches.length - 1 : selected - 1;
						render();
					}
					return;
				}
				if (event.key === "Enter") {
					event.preventDefault();
					if (matches.length === 0) {
						close();
						deps.onCancel();
					} else pick(selected);
					return;
				}
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					close();
					deps.onCancel();
				}
			};
			const onInput = () => {
				refilter();
			};
			const onOutside = (event) => {
				if (event.target instanceof Node && root.contains(event.target)) return;
				close();
				deps.onCancel();
			};
			root.addEventListener("keydown", onKeydown);
			input.addEventListener("input", onInput);
			return {
				isOpen: () => open,
				open: (anchor, rawEntries, matchCase, footerActions) => {
					entries = rawEntries.map((entry) => typeof entry === "string" ? {
						text: entry,
						source: "history"
					} : entry);
					caseSensitive = matchCase;
					selected = 0;
					input.value = "";
					actions.textContent = "";
					if (footerActions !== void 0 && footerActions.length > 0) for (const action of footerActions) {
						const button = document.createElement("button");
						button.className = `${ROOT_CLASS$1}action`;
						button.type = "button";
						button.textContent = action.label;
						button.addEventListener("click", () => action.onClick());
						actions.append(button);
					}
					refilter();
					open = true;
					root.style.display = "flex";
					const placement = placePanel(anchor.getBoundingClientRect(), {
						width: window.innerWidth,
						height: window.innerHeight
					});
					root.style.left = `${placement.left}px`;
					root.style.top = `${placement.top}px`;
					root.style.width = `${placement.width}px`;
					input.setAttribute("aria-expanded", "true");
					if (root.parentNode === null) document.body.appendChild(root);
					input.focus();
					document.addEventListener("mousedown", onOutside, true);
				},
				dispose: () => {
					close();
					root.remove();
				}
			};
		}
		//#endregion
		//#region src/client/compaction-notice.ts
		const ROOT_CLASS = "__dsh-composer-history-notice__";
		const STYLE_ID$1 = "__dsh-composer-history-notice-style__";
		const AUTO_DISMISS_MS = 6e3;
		const SUMMARY_SNIPPET_LENGTH = 160;
		/** Injected once per document: the snackbar chrome. */
		const STYLE_TEXT$1 = [
			`.${ROOT_CLASS}{`,
			"position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483001;",
			"display:flex;flex-direction:column;gap:4px;max-width:min(560px,calc(100vw - 32px));",
			"background:#1c2128;border:1px solid #444c56;border-radius:10px;",
			"box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px/1.4 system-ui,sans-serif;",
			"color:#e6edf3;padding:10px 12px;cursor:pointer;",
			"}",
			`.${ROOT_CLASS} .${ROOT_CLASS}head{display:flex;align-items:center;gap:8px;}`,
			`.${ROOT_CLASS} .${ROOT_CLASS}title{font-weight:600;color:#ffffff;}`,
			`.${ROOT_CLASS} .${ROOT_CLASS}hint{margin-left:auto;color:#8b949e;white-space:nowrap;}`,
			`.${ROOT_CLASS} .${ROOT_CLASS}detail{color:#c9d1d9;}`,
			`.${ROOT_CLASS} .${ROOT_CLASS}summary{color:#8b949e;font-style:italic;}`,
			`.${ROOT_CLASS} .${ROOT_CLASS}action{`,
			"all:unset;align-self:flex-end;margin-top:4px;padding:4px 10px;border-radius:6px;",
			"background:#316dca;color:#ffffff;cursor:pointer;font-weight:600;",
			"}",
			`.${ROOT_CLASS} .${ROOT_CLASS}action:hover{background:#3b7dd8;}`
		].join("");
		/** Truncate a long summary to a single readable snippet. */
		function snippet(summary) {
			if (summary.length <= SUMMARY_SNIPPET_LENGTH) return summary;
			return `${summary.slice(0, SUMMARY_SNIPPET_LENGTH)}…`;
		}
		/**
		* Create the notice (injecting its stylesheet once per document).
		* @param deps - compact-now wiring plus the command label.
		* @returns the handle, or undefined outside a document.
		*/
		function createCompactionNotice(deps) {
			if (typeof document === "undefined") return void 0;
			if (document.getElementById(STYLE_ID$1) === null) {
				const style = document.createElement("style");
				style.id = STYLE_ID$1;
				style.textContent = STYLE_TEXT$1;
				document.head.appendChild(style);
			}
			const root = document.createElement("div");
			root.className = ROOT_CLASS;
			root.setAttribute("role", "status");
			root.setAttribute("aria-live", "polite");
			root.style.display = "none";
			let timer;
			const hide = () => {
				if (timer !== void 0) {
					clearTimeout(timer);
					timer = void 0;
				}
				root.style.display = "none";
			};
			root.addEventListener("click", () => {
				hide();
			});
			return {
				show: (info) => {
					hide();
					root.textContent = "";
					const head = document.createElement("div");
					head.className = `${ROOT_CLASS}head`;
					const title = document.createElement("span");
					title.className = `${ROOT_CLASS}title`;
					title.textContent = "⧉ Context compacted";
					head.append(title);
					const hint = document.createElement("span");
					hint.className = `${ROOT_CLASS}hint`;
					hint.textContent = "click to dismiss";
					head.append(hint);
					root.append(head);
					const detail = document.createElement("div");
					detail.className = `${ROOT_CLASS}detail`;
					const parts = [];
					if (info.itemCount !== null) parts.push(`${info.itemCount} history items summarized`);
					if (info.tokenCount !== null) parts.push(`~${info.tokenCount} tokens`);
					detail.textContent = parts.length > 0 ? `${parts.join(" · ")}. Now in ↑ history and Ctrl+R search.` : "Earlier history summarized. Now in ↑ history and Ctrl+R search.";
					root.append(detail);
					if (info.summary !== null && info.summary.trim() !== "") {
						const summary = document.createElement("div");
						summary.className = `${ROOT_CLASS}summary`;
						summary.textContent = snippet(info.summary.trim());
						root.append(summary);
					}
					if (deps.compactCommandText !== "") {
						const action = document.createElement("button");
						action.className = `${ROOT_CLASS}action`;
						action.textContent = `Fill ${deps.compactCommandText}`;
						action.addEventListener("click", (event) => {
							event.stopPropagation();
							hide();
							deps.onCompactNow();
						});
						root.append(action);
					}
					if (root.parentNode === null) document.body.appendChild(root);
					root.style.display = "flex";
					timer = setTimeout(hide, AUTO_DISMISS_MS);
				},
				dispose: () => {
					hide();
					root.remove();
				}
			};
		}
		//#endregion
		//#region src/client/compaction-watch.ts
		/** Read a count-shaped field, accepting only non-negative integers. */
		function countOf(value) {
			return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
		}
		/** The newest checkpoint's summary, or null (unavailable/foreign shape). */
		function summaryOf(node) {
			return typeof node.summary === "string" ? node.summary : null;
		}
		/**
		* The seq of the newest compaction checkpoint in a snapshot (baseline
		* value: checkpoints at or below it predate the current plugin install).
		* @param nodes - snapshot nodes in seq order.
		* @returns the newest checkpoint seq, or undefined when there is none.
		*/
		function latestCompactionSeq(nodes) {
			let latest;
			for (const node of nodes) {
				if (node.kind !== "compaction") continue;
				if (typeof node.seq !== "number") continue;
				if (latest === void 0 || node.seq > latest) latest = node.seq;
			}
			return latest;
		}
		/**
		* The newest compaction checkpoint that landed after `afterSeq` (the last
		* reported one). Iterates the snapshot once and keeps the highest matching
		* seq, so a burst of checkpoints in one snapshot reports only the newest.
		* @param nodes - snapshot nodes in seq order.
		* @param afterSeq - last reported checkpoint seq (undefined = report the newest present).
		* @returns the newest unreported checkpoint, or undefined when none exists.
		*/
		function compactionAfter(nodes, afterSeq) {
			let best;
			for (const node of nodes) {
				if (node.kind !== "compaction") continue;
				if (typeof node.seq !== "number") continue;
				if (afterSeq !== void 0 && node.seq <= afterSeq) continue;
				const info = {
					seq: node.seq,
					summary: summaryOf(node),
					itemCount: countOf(node.shadowedItemCount),
					tokenCount: countOf(node.shadowedTokenCount)
				};
				if (best === void 0 || info.seq > best.seq) best = info;
			}
			return best;
		}
		//#endregion
		//#region src/client/history-store.ts
		/** LocalStorage key of the persisted history payload. */
		const STORE_KEY = "dsh.composer-history.v1";
const storeKeyOf = (id) => {
  return STORE_KEY + "@local";
};
		/** Payload format version; bumping it abandons older payloads. */
		const STORE_VERSION = 1;
		/** Shape guard for a parsed payload: exact version plus a string array. */
		function isStoredShape$3(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return record["v"] === STORE_VERSION && Array.isArray(record["entries"]);
		}
		/**
		* Read the persisted entries. Returns [] for an absent, corrupt, foreign, or
		* unreadable payload — persistence is a convenience, never a failure mode.
		* @param storage - readable storage.
		* @param key - storage key.
		* @returns stored entries, oldest first.
		*/
		function loadEntries(storage, key) {
			const raw = storage.getItem(key);
			if (raw === null) return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			if (!isStoredShape$3(parsed)) return [];
			return parsed.entries.filter((entry) => typeof entry === "string" && entry.trim() !== "");
		}
		/**
		* Persist entries (replace the payload wholesale).
		* @param storage - writable storage.
		* @param key - storage key.
		* @param entries - entries to store, oldest first.
		*/
		function saveEntries(storage, key, entries) {
			const payload = {
				v: STORE_VERSION,
				entries: [...entries]
			};
			storage.setItem(key, JSON.stringify(payload));
		}
		/**
		* Append new entries to the persisted store: exact-text dedupe against the
		* stored entries (new occurrences keep their stored position), then trim to
		* the newest `cap` (0 = unlimited) and write once. Nothing is written when
		* nothing was added.
		* @param storage - readable and writable storage.
		* @param key - storage key.
		* @param texts - candidate entries in oldest-first order.
		* @param cap - maximum stored entries, newest kept; 0 means unlimited.
		* @returns the entries actually added, in order.
		*/
		function appendEntries(storage, key, texts, cap) {
			const existing = loadEntries(storage, key);
			const seen = new Set(existing);
			const added = [];
			for (const text of texts) {
				if (text.trim() === "" || seen.has(text)) continue;
				seen.add(text);
				added.push(text);
				existing.push(text);
			}
			if (added.length === 0) return added;
			saveEntries(storage, key, cap > 0 ? existing.slice(-cap) : existing);
			return added;
		}
		/**
		* Wrap a DOM Storage in never-throw accessors: a disabled or full storage
		* (private mode, quota) degrades persistence to session lifetime instead of
		* breaking key handling.
		* @param storage - the ambient localStorage, or undefined outside a browser.
		* @returns the safe face, or undefined when no storage exists.
		*/
		function safeStorage(storage) {
			if (storage === void 0) return void 0;
			return {
				getItem: (key) => {
					try {
						return storage.getItem(key);
					} catch {
						return null;
					}
				},
				setItem: (key, value) => {
					try {
						storage.setItem(key, value);
					} catch {}
				}
			};
		}
		//#endregion
		//#region src/client/snippets.ts
		/** LocalStorage key of the snippet payload. */
		const SNIPPET_STORE_KEY = "dsh.composer-history.snippets.v1";
		/** Payload format version; bumping abandons older payloads. */
		const SNIPPET_STORE_VERSION = 1;
		/** Name grammar: kebab-case, 1..64 chars. */
		const SNIPPET_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
		function isStoredShape$2(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return record["v"] === SNIPPET_STORE_VERSION && Array.isArray(record["snippets"]);
		}
		/** Structural snippet guard: a stored record must carry every declared field with the right type. */
		function isSnippetRecord(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return typeof record["name"] === "string" && typeof record["text"] === "string" && Array.isArray(record["tags"]) && typeof record["scope"] === "string" && typeof record["createdAt"] === "number" && typeof record["updatedAt"] === "number" && typeof record["useCount"] === "number" && typeof record["lastUsedAt"] === "number";
		}
		/**
		* Parse a `/save <name>` or `/load <name>` command from a composer draft.
		* Only a draft whose first line is exactly the command qualifies; tags are
		* optional and only meaningful for save.
		* @param draft - the full composer draft.
		* @returns the parsed command, or undefined when the draft is not a snippet command.
		*/
		function parseSnippetCommand(draft) {
			const line = draft.split("\n", 1)[0] ?? "";
			const match = /^\/(save|load)\s+(\S+)(?:\s+--tag=([\w,-]+))?\s*$/.exec(line);
			if (match === null) return void 0;
			const verb = match[1] === "save" ? "save" : "load";
			const name = match[2] ?? "";
			if (!SNIPPET_NAME_PATTERN.test(name)) return void 0;
			const rawTags = match[3] ?? "";
			const tags = rawTags === "" ? [] : [...new Set(rawTags.split(",").map((tag) => tag.trim()).filter((tag) => tag !== ""))];
			if (tags.length > 8 || tags.some((tag) => tag.length > 32)) return void 0;
			return {
				verb,
				name,
				tags
			};
		}
		/**
		* The text a `/save <name>` command captures: the draft with the command's
		* first line removed, trimmed. Empty when there is nothing to save.
		* @param draft - the full composer draft.
		* @returns the snippet text ('' when nothing remains).
		*/
		function saveCommandText(draft) {
			return draft.split("\n").slice(1).join("\n").trim();
		}
		/**
		* Validate a snippet before persistence: name grammar, non-empty text,
		* tag caps. Throws a descriptive Error on the first violation (fail-loud).
		* @param name - snippet name.
		* @param text - snippet text.
		* @param tags - advisory tags.
		*/
		function validateSnippet(name, text, tags) {
			if (!SNIPPET_NAME_PATTERN.test(name)) throw new Error(`invalid snippet name ${JSON.stringify(name)}: use 1..64 kebab-case characters`);
			if (text.trim() === "") throw new Error("snippet text must not be empty");
			if (tags.length > 8) throw new Error(`at most 8 tags per snippet`);
			for (const tag of tags) if (tag.trim() === "" || tag.length > 32) throw new Error(`invalid snippet tag ${JSON.stringify(tag)}: non-empty, at most 32 chars`);
		}
		/**
		* Read the stored snippets, oldest first. Returns [] for an absent, corrupt,
		* or foreign payload — the library is a convenience, never a failure mode.
		* @param storage - readable storage.
		* @returns the stored snippets.
		*/
		function loadSnippets(storage) {
			const raw = storage.getItem(SNIPPET_STORE_KEY);
			if (raw === null) return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			if (!isStoredShape$2(parsed)) return [];
			return parsed.snippets.filter(isSnippetRecord);
		}
		/**
		* Save or replace one snippet: same name = replace (fresh updatedAt,
		* preserved use counters); new name = append. Trimmed to the newest `cap`
		* (0 = unlimited) and written once.
		* @param storage - readable and writable storage.
		* @param snippet - the snippet to persist.
		* @param cap - maximum stored snippets; 0 means unlimited.
		* @returns the stored record.
		*/
		function upsertSnippet(storage, snippet, cap) {
			validateSnippet(snippet.name, snippet.text, snippet.tags);
			const existing = loadSnippets(storage);
			const index = existing.findIndex((item) => item.name === snippet.name);
			const now = Date.now();
			const record = index === -1 ? {
				...snippet,
				tags: normalizeTags(snippet.tags),
				createdAt: now,
				updatedAt: now,
				useCount: 0,
				lastUsedAt: 0
			} : {
				...existing[index],
				text: snippet.text,
				tags: normalizeTags(snippet.tags),
				scope: snippet.scope,
				updatedAt: now
			};
			const next = index === -1 ? [...existing, record] : existing.map((item) => item.name === snippet.name ? record : item);
			saveSnippets(storage, cap > 0 ? next.slice(-cap) : next);
			return record;
		}
		/**
		* Record one snippet load: use counters and last-used time update in place.
		* @param storage - readable and writable storage.
		* @param name - the loaded snippet name.
		* @returns the updated record, or undefined when the snippet does not exist.
		*/
		function noteSnippetUse(storage, name) {
			const existing = loadSnippets(storage);
			const index = existing.findIndex((item) => item.name === name);
			if (index === -1) return void 0;
			const record = {
				...existing[index],
				useCount: existing[index].useCount + 1,
				lastUsedAt: Date.now()
			};
			saveSnippets(storage, existing.map((item) => item.name === name ? record : item));
			return record;
		}
		/** Dedupe and trim tags, preserving first-occurrence order. */
		function normalizeTags(tags) {
			return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag !== ""))];
		}
		/** Replace the stored payload wholesale. */
		function saveSnippets(storage, snippets) {
			const payload = {
				v: SNIPPET_STORE_VERSION,
				snippets: [...snippets]
			};
			storage.setItem(SNIPPET_STORE_KEY, JSON.stringify(payload));
		}
		//#endregion
		//#region src/client/templates.ts
		/** LocalStorage key of the template payload. */
		const TEMPLATE_STORE_KEY = "dsh.composer-history.templates.v1";
		/** Payload format version; bumping abandons older payloads. */
		const TEMPLATE_STORE_VERSION = 1;
		const TEMPLATE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
		const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\}\}/g;
		function isStoredShape$1(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return record["v"] === TEMPLATE_STORE_VERSION && Array.isArray(record["templates"]);
		}
		function isTemplateRecord(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return typeof record["name"] === "string" && typeof record["text"] === "string" && typeof record["description"] === "string" && typeof record["updatedAt"] === "number";
		}
		/**
		* Extract the `{{variable}}` names from a template, in first-occurrence
		* order. Duplicate occurrences collapse to one name.
		* @param text - template text.
		* @returns the variable names.
		*/
		function templateVariables(text) {
			const seen = /* @__PURE__ */ new Set();
			const names = [];
			for (const match of text.matchAll(VARIABLE_PATTERN)) {
				const name = match[1];
				if (!seen.has(name)) {
					seen.add(name);
					names.push(name);
				}
			}
			return names;
		}
		/**
		* Fill a template from the variable values. Unknown variables fail loudly
		* with the full missing list — a half-filled prompt is worse than an error.
		* @param text - template text.
		* @param values - variable values by name.
		* @returns the filled text.
		* @throws when a variable has no value.
		*/
		function fillTemplate(text, values) {
			const missing = templateVariables(text).filter((name) => values[name] === void 0);
			if (missing.length > 0) throw new Error(`template variables missing values: ${missing.map((name) => `{{${name}}}`).join(", ")}`);
			return text.replace(VARIABLE_PATTERN, (_whole, name) => values[name]);
		}
		/**
		* Validate a template before persistence. Throws on the first violation.
		* @param name - template name.
		* @param text - template text.
		*/
		function validateTemplate(name, text) {
			if (!TEMPLATE_NAME_PATTERN.test(name)) throw new Error(`invalid template name ${JSON.stringify(name)}: use 1..64 kebab-case characters`);
			if (text.trim() === "") throw new Error("template text must not be empty");
		}
		/**
		* Read the stored templates. Returns [] for an absent, corrupt, or foreign
		* payload — the library is a convenience, never a failure mode.
		* @param storage - readable storage.
		* @returns the stored templates, oldest first.
		*/
		function loadTemplates(storage) {
			const raw = storage.getItem(TEMPLATE_STORE_KEY);
			if (raw === null) return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			if (!isStoredShape$1(parsed)) return [];
			return parsed.templates.filter(isTemplateRecord);
		}
		/**
		* Serialize the template library to an export JSON document (an explicit
		* user action in the UI; this function never writes anywhere).
		* @param templates - the library.
		* @returns the export document as a JSON string.
		*/
		function templatesToJson(templates) {
			return JSON.stringify({
				plugin: "dsh-composer-history",
				schema: "composer-templates-v1",
				templates
			}, null, 2);
		}
		/**
		* Parse and validate an import JSON document. Unknown schema markers and
		* malformed templates throw with a descriptive message (fail-loud), and
		* the imported list is capped at {@link MAX_TEMPLATES}.
		* @param json - the import document.
		* @returns the validated templates, oldest first.
		* @throws on a foreign schema or malformed template.
		*/
		function templatesFromJson(json) {
			let parsed;
			try {
				parsed = JSON.parse(json);
			} catch (error) {
				throw new Error(`template import is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (typeof parsed !== "object" || parsed === null) throw new Error("template import must be a JSON object");
			const record = parsed;
			if (record["plugin"] !== "dsh-composer-history" || record["schema"] !== "composer-templates-v1") throw new Error("template import is not a dsh-composer-history templates document (expected schema \"composer-templates-v1\")");
			if (!Array.isArray(record["templates"])) throw new Error("template import must carry a templates array");
			const templates = record["templates"].filter(isTemplateRecord).map((item) => ({
				name: item.name,
				text: item.text,
				description: item.description,
				updatedAt: Date.now()
			}));
			if (templates.length !== record["templates"].length) throw new Error("template import contains malformed templates");
			for (const item of templates) validateTemplate(item.name, item.text);
			if (templates.length > 500) throw new Error(`template import exceeds 500 templates`);
			return templates;
		}
		/**
		* Merge imported templates into the library (same name = import wins) and
		* persist. Capped at {@link MAX_TEMPLATES} newest first.
		* @param storage - readable and writable storage.
		* @param incoming - imported templates.
		* @returns the number of templates written.
		*/
		function mergeTemplates(storage, incoming) {
			const existing = loadTemplates(storage);
			const byName = /* @__PURE__ */ new Map();
			for (const item of existing) byName.set(item.name, item);
			for (const item of incoming) byName.set(item.name, item);
			const trimmed = [...byName.values()].slice(-500);
			const payload = {
				v: TEMPLATE_STORE_VERSION,
				templates: trimmed
			};
			storage.setItem(TEMPLATE_STORE_KEY, JSON.stringify(payload));
			return trimmed.length;
		}
		//#endregion
		//#region src/client/insights.ts
		/** LocalStorage key of the usage payload. */
		const INSIGHT_STORE_KEY = "dsh.composer-history.insights.v1";
		/** Payload format version; bumping abandons older payloads. */
		const INSIGHT_STORE_VERSION = 1;
		function isStoredShape(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return record["v"] === INSIGHT_STORE_VERSION && Array.isArray(record["records"]);
		}
		function isUsageRecord(value) {
			if (typeof value !== "object" || value === null) return false;
			const record = value;
			return typeof record["text"] === "string" && Array.isArray(record["sessions"]) && typeof record["uses"] === "number" && typeof record["lastUsedAt"] === "number";
		}
		/**
		* Read the stored usage records. Returns [] for an absent, corrupt, or
		* foreign payload — insights are a convenience, never a failure mode.
		* @param storage - readable storage.
		* @returns the stored records.
		*/
		function loadUsage(storage) {
			const raw = storage.getItem(INSIGHT_STORE_KEY);
			if (raw === null) return [];
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return [];
			}
			if (!isStoredShape(parsed)) return [];
			return parsed.records.filter(isUsageRecord);
		}
		/**
		* Record one use of a prompt text in one session. Short texts are ignored
		* (noise filter); the record list is capped at {@link MAX_INSIGHT_RECORDS}
		* by last-used recency.
		* @param storage - readable and writable storage.
		* @param text - the used prompt text.
		* @param sessionId - the session it was used in ('' when unknown).
		* @returns the updated record, or undefined when the text was filtered out.
		*/
		function noteUsage(storage, text, sessionId) {
			const trimmed = text.trim();
			if (trimmed.length < 3) return void 0;
			const existing = loadUsage(storage);
			const index = existing.findIndex((item) => item.text === trimmed);
			const now = Date.now();
			const record = index === -1 ? {
				text: trimmed,
				sessions: sessionId === "" ? [] : [sessionId],
				uses: 1,
				lastUsedAt: now
			} : {
				text: trimmed,
				sessions: sessionId === "" || existing[index].sessions.includes(sessionId) ? existing[index].sessions : [sessionId, ...existing[index].sessions].slice(0, 50),
				uses: existing[index].uses + 1,
				lastUsedAt: now
			};
			const next = index === -1 ? [...existing, record] : existing.map((item) => item.text === trimmed ? record : item);
			next.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
			const payload = {
				v: INSIGHT_STORE_VERSION,
				records: next.slice(-500)
			};
			storage.setItem(INSIGHT_STORE_KEY, JSON.stringify(payload));
			return record;
		}
		/**
		* The reuse hint for a draft's first line: the usage record whose text the
		* draft exactly matches. Undefined when there is no match or the draft is
		* below the reusable length.
		* @param storage - readable storage.
		* @param draft - the current composer draft.
		* @returns the matching record, or undefined.
		*/
		function hintFor(storage, draft) {
			const first = draft.trim();
			if (first.length < 3) return void 0;
			return loadUsage(storage).find((item) => item.text === first);
		}
		/**
		* Render the hint line for a record: session and use counts, bilingual,
		* kept to one short line (it overlays the composer, never the message).
		* @param record - the usage record.
		* @returns the hint text.
		*/
		function hintText(record) {
			return `used ${record.uses}× in ${record.sessions.length} session${record.sessions.length === 1 ? "" : "s"} · 在 ${record.sessions.length} 个会话里用过 ${record.uses} 次`;
		}
		//#endregion
		//#region src/client/notice.ts
		/**
		* Transient composer notices: two tiny DOM surfaces the new capabilities
		* use for feedback. `createTransientNotice` flashes one line for a short
		* while (snippet saved/loaded, template errors, import results);
		* `createDraftHint` pins a small read-only line under the composer for the
		* reuse insight, hidden whenever the hint text is empty. Both own their DOM
		* and are fully removable — the wiring disposes them with the fiber.
		*/
		const NOTICE_CLASS = "__dsh-composer-history-notice__";
		const HINT_CLASS = "__dsh-composer-history-hint__";
		const STYLE_ID = "__dsh-composer-history-notice-style__";
		/** One shared stylesheet injected once per document. */
		const STYLE_TEXT = [
			`.${NOTICE_CLASS}{`,
			"position:fixed;z-index:2147483001;left:50%;bottom:64px;transform:translateX(-50%);",
			"background:#1c2128;color:#e6edf3;border:1px solid #444c56;border-radius:8px;",
			"padding:8px 14px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45);",
			"max-width:min(80vw,560px);overflow-wrap:anywhere;",
			"}",
			`.${NOTICE_CLASS}--error{border-color:#f85149;color:#ffa198;}`,
			`.${HINT_CLASS}{`,
			"position:fixed;z-index:2147483000;display:none;",
			"background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:6px;",
			"padding:3px 8px;font:11px/1.4 system-ui,sans-serif;pointer-events:none;",
			"max-width:min(60vw,480px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
			"}"
		].join("");
		function ensureStyle() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = STYLE_TEXT;
			document.head.appendChild(style);
		}
		/**
		* Create the transient notice surface. One node is reused across flashes;
		* the timer is cancelled on dispose.
		* @returns the handle, or undefined outside a document.
		*/
		function createTransientNotice() {
			if (typeof document === "undefined") return void 0;
			ensureStyle();
			const node = document.createElement("div");
			node.className = NOTICE_CLASS;
			node.style.display = "none";
			document.body.appendChild(node);
			let timer;
			return {
				show(text, kind = "info") {
					if (timer !== void 0) clearTimeout(timer);
					node.textContent = text;
					node.className = kind === "error" ? `${NOTICE_CLASS} ${NOTICE_CLASS}--error` : NOTICE_CLASS;
					node.style.display = "block";
					timer = setTimeout(() => {
						node.style.display = "none";
						timer = void 0;
					}, 3200);
				},
				dispose: () => {
					if (timer !== void 0) clearTimeout(timer);
					timer = void 0;
					node.remove();
				}
			};
		}
		/**
		* Create the reuse-insight hint. Hidden until {@link DraftHint.set} receives
		* non-empty text; positioned under the anchor composer's bounding rect.
		* @returns the handle, or undefined outside a document.
		*/
		function createDraftHint() {
			if (typeof document === "undefined") return void 0;
			ensureStyle();
			const node = document.createElement("div");
			node.className = HINT_CLASS;
			document.body.appendChild(node);
			return {
				set(text, anchor) {
					if (text === "") {
						node.style.display = "none";
						return;
					}
					node.textContent = text;
					const rect = anchor.getBoundingClientRect();
					node.style.display = "block";
					node.style.left = `${Math.round(rect.left)}px`;
					node.style.top = `${Math.round(rect.bottom + 4)}px`;
				},
				dispose: () => {
					node.remove();
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Plugin name: matches the package name, the graph row id, and the bundle id. */
		const name = "dsh-composer-history";
		/** Services the interception reads; activation waits on them. */
		const inject = [
			"conversation",
			"sessions",
			"inputTriggers",
			"settingsScope"
		];
		/** Settings namespace the host half registers (lowercase kebab-case). */
		const NAMESPACE = "composer-history";
		/**
		* Browser plugin body: resolve the effective options, wire the interception
		* host over the session/input/trigger services, keep the persisted history
		* store in sync with the current session's commits, and register the
		* window-capture listeners as one effect. The settings scope is observed;
		* every committed option change tears the wiring down and reinstalls it.
		* @param ctx - client root context.
		* @param config - partial config (browser boot passes none today); resolved
		*   against the schema so defaults apply and invalid values throw loudly.
		*/
		function apply(ctx, config = {}) {
			const fallback = resolveConfig(config);
			const storage = safeStorage(typeof localStorage === "undefined" ? void 0 : localStorage);
			ctx.effect(() => {
				const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
				let disposeWiring;
				const install = () => {
					disposeWiring?.();
					disposeWiring = void 0;
					const snapshot = scope.getSnapshot();
					disposeWiring = installWiring(ctx, snapshot.status === "ready" && snapshot.value !== void 0 ? resolveConfig(snapshot.value) : fallback, storage);
				};
				install();
				const disposeScope = scope.subscribe(install);
				return () => {
					disposeScope();
					disposeWiring?.();
					disposeWiring = void 0;
				};
			}, "dsh-composer-history: capture keyboard wiring");
		}
		/**
		* Build the full interception wiring for one effective option set. Returns
		* the disposer for every registration it made (listeners, subscriptions,
		* mirror node, overlay).
		* @param ctx - client root context.
		* @param options - resolved tunables.
		* @param storage - safe browser-local storage, or undefined outside a browser.
		*/
		function installWiring(ctx, options, storage) {
			const mirror = options.edgeMode === "visual" ? createMirrorMeasurer() : void 0;
			const currentActx = () => {
				const id = ctx.sessions.list.getSnapshot().current;
				return id === void 0 ? void 0 : ctx.sessions.scope(id);
			};
			const currentSessionId = () => {
				const id = ctx.sessions.list.getSnapshot().current;
				return id === void 0 ? void 0 : String(id);
			};
			const toViews = viewOfNodes;
			const recallExtractor = new HistoryExtractor(effectiveKinds(options.includeKinds, options.includeCompactionSummaries), options.maxHistory, toViews);
			const persistExtractor = new HistoryExtractor(options.includeKinds, 0, toViews);
			const extract = (nodes, max) => recallExtractor.extract(nodes, max);
			const extractPersist = (nodes) => persistExtractor.extract(nodes, 0);
			let handle;
			let searchAnchor;
			let lastComposer;
			const currentWorkspaceKey = () => {
				const id = ctx.sessions.list.getSnapshot().current;
				if (id === void 0) return "";
				const summary = ctx.sessions.list.getSnapshot().byId?.[String(id)];
				return summary?.cwd ?? summary?.title ?? "";
			};
			const visibleSnippets = () => {
				if (!options.enableSnippets || storage === void 0) return [];
				const key = currentWorkspaceKey();
				return loadSnippets(storage).filter((snippet) => snippet.scope === "global" || snippet.scope === key);
			};
			const transient = createTransientNotice();
			const hint = createDraftHint();
			/** Update the reuse-insight hint under the composer ('' hides it). */
			const updateDraftHint = (composer) => {
				if (hint === void 0) return;
				if (!options.enableInsights || storage === void 0) {
					hint.set("", composer);
					return;
				}
				const record = hintFor(storage, composer.value);
				if (record === void 0 || record.uses < options.insightMinUses) {
					hint.set("", composer);
					return;
				}
				hint.set(hintText(record), composer);
			};
			/**
			* `/save <name>` and `/load <name>` command handling on Enter: the draft's
			* first line is parsed as a snippet command; a match consumes the Enter so
			* the command never reaches the send path. The plugin never sends.
			* @returns true when the Enter was consumed.
			*/
			const runSnippetCommand = (composer) => {
				if (!options.enableSnippets || storage === void 0) return false;
				const input = host.inputState(composer);
				if (input === void 0 || input.phase !== "plain") return false;
				if (host.menuOpen(composer)) return false;
				const command = parseSnippetCommand(input.draft);
				if (command === void 0) return false;
				if (command.verb === "save") {
					const text = saveCommandText(input.draft);
					if (text === "") {
						transient?.show(`snippet ${command.name}: nothing to save (draft after the command is empty)`, "error");
						return true;
					}
					try {
						upsertSnippet(storage, {
							name: command.name,
							text,
							tags: command.tags,
							scope: currentWorkspaceKey() === "" ? "global" : currentWorkspaceKey()
						}, options.maxSnippets);
						transient?.show(`snippet saved: ${command.name}`);
					} catch (error) {
						transient?.show(`snippet ${command.name}: ${error instanceof Error ? error.message : String(error)}`, "error");
					}
					handle?.fill(composer, "");
					updateDraftHint(composer);
					return true;
				}
				const snippet = loadSnippets(storage).find((item) => item.name === command.name);
				if (snippet === void 0) {
					transient?.show(`no snippet named ${command.name} (open Ctrl+R search to browse snippets)`, "error");
					return true;
				}
				noteSnippetUse(storage, command.name);
				transient?.show(`snippet loaded: ${command.name}`);
				handle?.fill(composer, snippet.text);
				updateDraftHint(composer);
				return true;
			};
			const overlay = createSearchOverlay({
				onPick: (text, source, label) => {
					const composer = searchAnchor;
					composer?.focus();
					if (handle !== void 0 && composer !== void 0) {
						if (source === "template") try {
							const values = {
								workspace: currentWorkspaceKey() || "workspace",
								session: currentSessionId() ?? "",
								draft: composer.value
							};
							handle.fill(composer, fillTemplate(text, values));
						} catch (error) {
							transient?.show(`template ${label ?? ""}: ${error instanceof Error ? error.message : String(error)}`, "error");
						}
						else {
							if (source === "snippet" && label !== void 0 && storage !== void 0) {
								noteSnippetUse(storage, label);
								transient?.show(`snippet loaded: ${label}`);
							}
							handle.fill(composer, text);
						}
						updateDraftHint(composer);
					}
				},
				onCancel: () => {
					searchAnchor?.focus();
				}
			});
			const notice = createCompactionNotice({
				compactCommandText: options.compactCommandText,
				onCompactNow: () => {
					const composer = lastComposer;
					if (composer === void 0 || handle === void 0) return;
					composer.focus();
					handle.fill(composer, options.compactCommandText);
				}
			});
			/** Template library export: one explicit click downloads the JSON document. */
			const exportTemplates = () => {
				if (storage === void 0 || typeof document === "undefined") return;
				const json = templatesToJson(loadTemplates(storage));
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = "dsh-composer-templates.json";
				anchor.click();
				URL.revokeObjectURL(url);
			};
			/** Template library import: one explicit file pick, validated fail-loud. */
			const importTemplates = () => {
				if (storage === void 0 || typeof document === "undefined") return;
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "application/json,.json";
				input.addEventListener("change", () => {
					const file = input.files?.[0];
					if (file === void 0) return;
					file.text().then((raw) => {
						try {
							const written = mergeTemplates(storage, templatesFromJson(raw));
							transient?.show(`templates imported: ${written}`);
						} catch (error) {
							transient?.show(`template import failed: ${error instanceof Error ? error.message : String(error)}`, "error");
						}
					});
				});
				input.click();
			};
			const host = {
				composerOf: (target) => target instanceof HTMLTextAreaElement && target.closest("[data-input-scroll]") !== null ? target : void 0,
				sessionKey: () => currentSessionId(),
				inputState: () => {
					const actx = currentActx();
					if (actx === void 0) return void 0;
					const snapshot = ctx.conversation.input.for(actx).state.getSnapshot();
					return {
						draft: snapshot.draft,
						phase: snapshot.phase
					};
				},
								history: () => {
					const id = ctx.sessions.list.getSnapshot().current;
					if (id === void 0) return [];
					const nodes = ctx.sessions.binding(id)?.session.getSnapshot().nodes ?? [];
					return toViews(nodes);
				},
				supplementalHistory: () => {
					const list = ctx.sessions.list.getSnapshot();
					const current = list.current;
					const parts = [];
					if (options.persistHistory && storage !== void 0) parts.push(...loadEntries(storage, storeKeyOf(current)));
					if (options.historyScope === "workspace") for (const id of list.ids) {
						if (current !== void 0 && id === current) continue;
						const summary = list.byId[id];
						if (summary === void 0 || summary.blank) continue;
						const binding = ctx.sessions.binding(id);
						if (binding === void 0) continue;
						parts.push(...extract(binding.session.getSnapshot().nodes, options.maxHistory));
					}
					return parts;
				},
				menuOpen: (composer) => {
					const actx = currentActx();
					const triggers = ctx.get("inputTriggers");
					if (actx !== void 0) {
						if (triggers !== void 0 && triggers.sessionOf(actx).menu.getSnapshot().open) return true;
						const commands = ctx.get("commandUi");
						if (commands !== void 0 && commands.popupFor(actx).state.getSnapshot().open) return true;
					}
					return triggers === void 0 && hasActiveTriggerToken(composer.value, composer.selectionStart);
				},
				setDraft: (_composer, text) => {
					const actx = currentActx();
					if (actx === void 0) return;
					ctx.conversation.input.for(actx).setDraft(text);
				},
				openSearch: (composer, history) => {
					if (overlay === void 0) return;
					searchAnchor = composer;
					const entries = [];
					for (const text of history) if (options.enableCompactionHighlight && text.startsWith("[compacted]")) entries.push({
						text,
						source: "compacted"
					});
					else entries.push(text);
					if (storage !== void 0) {
						if (options.enableSnippets) for (const snippet of visibleSnippets()) entries.push({
							text: snippet.text,
							source: "snippet",
							label: snippet.name
						});
						if (options.enableTemplates) for (const template of loadTemplates(storage)) entries.push({
							text: template.text,
							source: "template",
							label: template.name
						});
					}
					const actions = options.enableTemplates && storage !== void 0 ? [{
						label: "Export templates",
						onClick: exportTemplates
					}, {
						label: "Import templates",
						onClick: importTemplates
					}] : void 0;
					overlay.open(composer, entries, options.searchCaseSensitive, actions);
				}
			};
			const visualSpans = mirror === void 0 ? void 0 : (composer, draft) => mirror.spans(composer, draft);
			handle = createComposerHistory(visualSpans === void 0 ? host : {
				...host,
				visualSpans
			}, options);
			const windowKeydown = (event) => {
				const composer = host.composerOf(event.target);
				if (composer !== void 0) lastComposer = composer;
				if (composer !== void 0 && event.key === "Enter" && !event.isComposing && runSnippetCommand(composer)) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				handle?.keydown(event);
			};
			const windowInput = (event) => {
				const composer = host.composerOf(event.target);
				if (composer !== void 0) {
					lastComposer = composer;
					updateDraftHint(composer);
				}
				handle?.input(event);
			};
			window.addEventListener("keydown", windowKeydown, true);
			window.addEventListener("input", windowInput, true);
			let lastSync = {
				length: -1,
				seq: -1
			};
			const syncPersisted = (nodes) => {
				if (!options.persistHistory || storage === void 0) return;
				const last = nodes[nodes.length - 1];
				const seq = typeof last?.seq === "number" ? last.seq : -1;
				if (nodes.length === lastSync.length && seq === lastSync.seq) return;
				lastSync = {
					length: nodes.length,
					seq
				};
				const added = appendEntries(storage, storeKeyOf(currentSessionId()), extractPersist(nodes), options.maxPersisted);
				if (options.enableInsights) for (const text of added) noteUsage(storage, text, currentSessionId() ?? "");
			};
			let lastCompactionSeq;
			const watchCompaction = (nodes) => {
				if (!options.showCompactionNotice || notice === void 0) return;
				const info = compactionAfter(nodes, lastCompactionSeq);
				if (info === void 0) return;
				lastCompactionSeq = info.seq;
				notice.show(info);
			};
			const PRELOAD_PAGE_CAP = 20;
			let preloadToken = 0;
			const preloadHistory = async (session) => {
				const token = ++preloadToken;
				// 等待会话真正打开(最长 5s),打开后再开始翻页
				for (let wait = 0; wait < 25; wait++) {
					if (token !== preloadToken) return;
					const snap = session.getSnapshot();
					if (snap.openState === "open") break;
					await new Promise((resolve) => setTimeout(resolve, 200));
				}
				// 后台翻页:窗口只增不删,翻完后 ↑ 能回溯到窗口之外的旧消息
				for (let page = 0; page < PRELOAD_PAGE_CAP; page++) {
					if (token !== preloadToken) return;
					const snap = session.getSnapshot();
					if (!snap.hasMore) return;
					try {
						await session.loadOlder();
					} catch (error) {
						console.error("[dsh-composer-history] preload failed:", error);
						return;
					}
				}
			};
			let disposeSessionSub;
			const reconcileSession = () => {
				disposeSessionSub?.();
				disposeSessionSub = void 0;
				const id = ctx.sessions.list.getSnapshot().current;
				if (id === void 0) return;
				const binding = ctx.sessions.binding(id);
				if (binding === void 0) return;
				const session = binding.session;
				lastCompactionSeq = latestCompactionSeq(session.getSnapshot().nodes);
				lastSync = {
					length: -1,
					seq: -1
				};
				syncPersisted(session.getSnapshot().nodes);
				void preloadHistory(session);
				disposeSessionSub = session.subscribe(() => {
					const nodes = session.getSnapshot().nodes;
					syncPersisted(nodes);
					watchCompaction(nodes);
				});
			};
			const disposeListSub = ctx.sessions.list.subscribe(reconcileSession);
			reconcileSession();
			return () => {
				disposeListSub();
				disposeSessionSub?.();
				window.removeEventListener("keydown", windowKeydown, true);
				window.removeEventListener("input", windowInput, true);
				handle?.dispose();
				handle = void 0;
				overlay?.dispose();
				notice?.dispose();
				mirror?.dispose();
				transient?.dispose();
				hint?.dispose();
			};
		}
		//#endregion
		exports.Config = Config;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		exports.resolveConfig = resolveConfig;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map