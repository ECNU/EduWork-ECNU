window.__ModuleLoader__.load({
	id: "@chatecnu-work/dsh-ecnu-cloud",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __exportAll = (all, no_symbols) => {
			let target = {};
			for (var name in all) __defProp(target, name, {
				get: all[name],
				enumerable: true
			});
			if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
			return target;
		};
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/conversation-entries.js
		const time$1 = (value) => Number.isFinite(value) ? value : 0;
		const workspaceTitle = (workspace) => workspace?.title === "default-workspace" ? "默认工作区" : workspace?.title || "本地工作区";
		/** A read-only projection shared by sidebar previews and full conversation lists. */
		function conversationEntries({ cloudRows = [], bindings = [], workspaceBindings = [], workspaces = [], sessions = {}, archived = [], project = null, workspaceID }) {
			const hidden = new Set(archived), entries = /* @__PURE__ */ new Map();
			const projectWorkspace = project && (workspaceID ?? workspaceBindings.find((row) => row.projectKey === project.projectKey)?.workspaceID);
			const projectWorkspaces = new Set(workspaceBindings.map((row) => row.workspaceID));
			const scopeWorkspace = project ? projectWorkspace : workspaces.find((row) => row.title === "default-workspace" && !projectWorkspaces.has(row.workspaceId))?.workspaceId;
			const inScope = (row) => project ? Boolean(project.projectID) && row.projectID === project.projectID : !row.projectID;
			const matchingBindings = bindings.filter(inScope);
			const cloud = new Map(cloudRows.filter(inScope).map((row) => [row.conversationID, row]));
			for (const binding of matchingBindings) {
				const workspace = workspaces.find((row) => row.workspaceId === binding.workspaceID);
				if (!cloud.has(binding.conversationID) && sessions[binding.sessionID] && !sessions[binding.sessionID].blank && workspace?.sessionIds.includes(binding.sessionID) && (!project || workspace.workspaceId === projectWorkspace)) cloud.set(binding.conversationID, {
					conversationID: binding.conversationID,
					projectID: binding.projectID,
					title: sessions[binding.sessionID].title || "ChatECNU 会话",
					updatedAt: 0
				});
			}
			for (const row of cloud.values()) {
				const binding = matchingBindings.find((item) => item.conversationID === row.conversationID);
				if (binding && hidden.has(binding.sessionID)) continue;
				const workspace = workspaces.find((item) => item.workspaceId === binding?.workspaceID);
				const session = binding && sessions[binding.sessionID];
				const valid = binding && session && !session.blank && workspace?.sessionIds.includes(binding.sessionID) && (!project || workspace.workspaceId === projectWorkspace);
				const key = valid ? `local:${binding.sessionID}` : `cloud:${row.conversationID}`;
				entries.set(key, valid ? {
					key,
					kind: "continued",
					cloud: row,
					sessionID: binding.sessionID,
					workspaceID: workspace.workspaceId,
					title: session.title || row.title,
					updatedAt: Math.max(time$1(session.updatedAt), time$1(row.updatedAt)),
					workspaceTitle: workspaceTitle(workspace),
					hint: `已在「${workspaceTitle(workspace)}」接续，点击打开本地会话`
				} : {
					key,
					kind: "cloud",
					cloud: row,
					title: row.title,
					updatedAt: time$1(row.updatedAt),
					hint: "ChatECNU 云端会话，点击预览；首次发送时在本地接续"
				});
			}
			const workspace = workspaces.find((row) => row.workspaceId === scopeWorkspace);
			for (const sessionID of workspace?.sessionIds ?? []) {
				const session = sessions[sessionID], key = `local:${sessionID}`;
				if (!session || session.blank || hidden.has(sessionID) || entries.has(key)) continue;
				if (!project && bindings.some((row) => row.sessionID === sessionID && row.projectID)) continue;
				entries.set(key, {
					key,
					kind: "local",
					sessionID,
					workspaceID: workspace.workspaceId,
					title: session.title || "未命名会话",
					updatedAt: time$1(session.updatedAt),
					workspaceTitle: workspaceTitle(workspace),
					hint: `本地会话，保存在「${workspaceTitle(workspace)}」，点击打开`
				});
			}
			return [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key));
		}
		//#endregion
		//#region src/conversation-row.tsx
		function ConversationRow({ entry, compact = false, selected = false, open, original }) {
			const Icon = entry.kind === "cloud" ? _deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular : _deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: compact ? "ecnu-nav-chat" : "ecnu-conversation-row",
				"data-conversation-kind": entry.kind,
				"data-conversation-key": entry.key,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: entry.hint,
					side: compact ? "right" : "top",
					delayMs: 350,
					portal: true,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: compact ? "ecnu-nav-row" : "ecnu-row",
						"aria-label": entry.title,
						"aria-current": selected ? "page" : void 0,
						onClick: () => open(entry),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { size: compact ? 14 : 17 }), compact ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ecnu-nav-label",
							children: entry.title
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ecnu-row-body",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ecnu-row-title",
								children: entry.title
							}), entry.workspaceTitle && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ecnu-row-meta",
								children: entry.workspaceTitle
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ecnu-row-end",
							children: [entry.updatedAt > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ecnu-date",
								children: new Date(entry.updatedAt).toLocaleDateString("zh-CN", {
									month: "short",
									day: "numeric"
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 15 })]
						})] })]
					})
				}), entry.kind === "continued" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: `查看 ${entry.cloud.title} 的云端原会话`,
					side: compact ? "right" : "top",
					delayMs: 350,
					portal: true,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ecnu-cloud-icon ecnu-conversation-origin",
						"aria-label": `查看 ${entry.cloud.title} 的云端原会话`,
						onClick: () => original(entry.cloud),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { size: 14 })
					})
				}) : !compact && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "ecnu-conversation-origin",
					"aria-hidden": "true"
				})]
			});
		}
		//#endregion
		//#region src/project-status.tsx
		function projectStatus(project, bindings = [], workspaces = []) {
			const binding = bindings.find((row) => row.projectKey === project.projectKey);
			const workspace = workspaces.find((row) => row.workspaceId === binding?.workspaceID);
			const title = workspace?.title === "default-workspace" ? "默认工作区" : workspace?.title;
			return {
				kind: binding ? "linked" : "cloud",
				label: workspace ? `已关联本地工作区「${title}」，可按需检索云端资料` : binding ? "已有关联记录，本地工作区暂不可用，请检查工作区" : project.projectID ? "ChatECNU 云端项目，尚未关联本地工作区" : "ChatECNU 云端资料库，尚未关联本地工作区"
			};
		}
		function ProjectStatusIcon({ status, size = 18 }) {
			const Icon = status.kind === "linked" ? _deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular : _deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { size });
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/util.js
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function joinValues(array, separator = "|") {
			return array.map((val) => stringifyPrimitive(val)).join(separator);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		var Cached = class {
			constructor(getter) {
				this._getter = getter;
				this._value = void 0;
			}
			get value() {
				const getter = this._getter;
				if (getter !== void 0) {
					this._value = getter();
					this._getter = void 0;
				}
				return this._value;
			}
		};
		function cached(getter) {
			return new Cached(getter);
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		/**
		* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
		*
		* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
		*/
		function rawShape(def) {
			const desc = Object.getOwnPropertyDescriptor(def, "shape");
			return desc?.get ? desc.get.raw : desc?.value;
		}
		function sourceShape(schema) {
			return rawShape(schema._zod.def) ?? schema._zod.def.shape;
		}
		function deferProp(target, key, getter) {
			Object.defineProperty(target, key, {
				get() {
					const value = getter();
					assignProp(this, key, value);
					return value;
				},
				enumerable: true,
				configurable: true
			});
		}
		function putProp(target, key, value) {
			if (key in target) assignProp(target, key, value);
			else target[key] = value;
		}
		/**
		* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
		*
		* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
		*/
		function mirrorShape(target, source, keys, wrap) {
			const raw = sourceShape(source);
			for (const key of keys) {
				const desc = Object.getOwnPropertyDescriptor(raw, key);
				if (!desc.enumerable) continue;
				if (desc.get) deferProp(target, key, () => {
					const value = source._zod.def.shape[key];
					return wrap ? wrap(value, key) : value;
				});
				else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
			}
		}
		function mirrorProps(target, source) {
			for (const key of Reflect.ownKeys(source)) {
				const desc = Object.getOwnPropertyDescriptor(source, key);
				if (!desc.enumerable) continue;
				if (desc.get) deferProp(target, key, () => source[key]);
				else putProp(target, key, desc.value);
			}
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) {
				const descriptors = Object.getOwnPropertyDescriptors(def);
				Object.assign(mergedDescriptors, descriptors);
			}
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function stringifyPrimitive(value) {
			if (typeof value === "bigint") return value.toString() + "n";
			if (typeof value === "string") return `"${value}"`;
			return `${value}`;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = /*@__PURE__*/ (() => ({
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		}))();
		const BIGINT_FORMAT_RANGES = {
			int64: [/* @__PURE__*/ BigInt("-9223372036854775808"), /* @__PURE__*/ BigInt("9223372036854775807")],
			uint64: [/* @__PURE__*/ BigInt(0), /* @__PURE__*/ BigInt("18446744073709551615")]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			const newShape = {};
			mirrorShape(newShape, schema, maskedKeys(schema, mask));
			return clone(schema, mergeDefs(currDef, {
				shape: newShape,
				checks: []
			}));
		}
		function maskedKeys(schema, mask) {
			const raw = sourceShape(schema);
			const keys = [];
			for (const key of Reflect.ownKeys(mask)) {
				if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
				if (mask[key]) keys.push(key);
			}
			return keys;
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			const omitted = new Set(maskedKeys(schema, mask));
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
			return clone(schema, mergeDefs(currDef, {
				shape: newShape,
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = sourceShape(schema);
				for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
		}
		function extended(schema, shape) {
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
			mirrorProps(newShape, shape);
			return newShape;
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
		}
		function merge(a, b) {
			if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			const newShape = {};
			mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
			mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
			return clone(a, mergeDefs(a._zod.def, {
				shape: newShape,
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask, name = "partial") {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
			const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
				type: "optional",
				innerType: value
			})));
			return clone(schema, mergeDefs(schema._zod.def, {
				shape: newShape,
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
			const newShape = {};
			mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
				type: "nonoptional",
				innerType: value
			}));
			return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		/** The leading size checks of `defChecks` that set an upper bound, each paired with it. */
		function sizeCaps(defChecks) {
			const caps = [];
			for (const ch of defChecks ?? []) {
				const d = ch._zod.def;
				if (!/_(length|size)$|_equals$/.test(d.check)) break;
				const max = d.maximum ?? d.length ?? d.size;
				if (max >= 0) caps.push([max, ch]);
			}
			return caps;
		}
		function attachSchema(issues, start, inst) {
			var _a;
			for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
		}
		function finalizeIssue(iss, ctx, config) {
			var _a;
			const traits = iss.inst?._zod?.traits;
			if (traits?.has("$ZodType")) {
				if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
				else iss.schema = iss.inst;
			}
			const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const full = {};
			for (const k of Object.keys(iss)) {
				if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
				full[k] = iss[k];
			}
			full.path ?? (full.path = []);
			full.message = message;
			if (ctx?.reportInput) full.input = iss.input;
			return full;
		}
		const highSurrogate = /[\uD800-\uDBFF]/;
		function codePointLength(str) {
			const units = str.length;
			if (!highSurrogate.test(str)) return units;
			let count = units;
			for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
				count--;
				i++;
			}
			return count;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function parsedType(data) {
			const t = typeof data;
			switch (t) {
				case "number": return Number.isNaN(data) ? "nan" : "number";
				case "object": {
					if (data === null) return "null";
					if (Array.isArray(data)) return "array";
					const obj = data;
					if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
				}
			}
			return t;
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		/**
		* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
		*
		* Call this from a `proto` initializer, which runs once per prototype — never per instance.
		*/
		function members(proto, table) {
			for (const key in table) {
				const desc = Object.getOwnPropertyDescriptor(table, key);
				if (desc.get) Object.defineProperty(proto, key, {
					...desc,
					enumerable: false
				});
				else defineBound(proto, key, desc.value);
			}
		}
		/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
		function own$2(inst, key, value, enumerable = true) {
			Object.defineProperty(inst, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
			return value;
		}
		/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
		function hide(inst, key, value) {
			return own$2(inst, key, value, false);
		}
		/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
		/* @__NO_SIDE_EFFECTS__ */
		function derived(computes, table) {
			for (const key in computes) {
				const compute = computes[key];
				Object.defineProperty(table, key, {
					configurable: true,
					enumerable: true,
					get() {
						return own$2(this, key, compute(this));
					},
					set(value) {
						own$2(this, key, value);
					}
				});
			}
			return table;
		}
		function defineBound(proto, key, fn) {
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					return this == null ? fn : own$2(this, key, fn.bind(this));
				},
				set(value) {
					own$2(this, key, value);
				}
			});
		}
		/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
		function claim(inst, sentinel) {
			const proto = Object.getPrototypeOf(inst);
			return sentinel in proto ? void 0 : proto;
		}
		let installing;
		let broke = false;
		const breaker = {
			configurable: true,
			get() {
				broke = true;
			}
		};
		/**
		* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
		* constructor, computed from the internals object itself and cached there on
		* first read. One accessor per constructor rather than one per instance.
		*/
		function defineLazyInternal(inst, key, compute) {
			const proto = Object.getPrototypeOf(inst._zod);
			if (key in proto && installing !== inst._zod) {
				installing = void 0;
				return;
			}
			installing = inst._zod;
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					Object.defineProperty(this, key, breaker);
					const outer = broke;
					broke = false;
					try {
						const value = compute(this);
						if (broke) delete this[key];
						else Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							value
						});
						broke = broke || outer;
						return value;
					} catch (err) {
						delete this[key];
						broke = broke || outer;
						throw err;
					}
				},
				set(value) {
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						value
					});
				}
			});
		}
		/**
		* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
		* data property. One accessor per constructor rather than one per instance, because an own accessor
		* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
		*/
		function installLazyProp(inst, key, make, enumerable) {
			const proto = claim(inst, key);
			if (!proto) return;
			Object.defineProperty(proto, key, {
				configurable: true,
				get() {
					const desc = {
						configurable: true,
						writable: true,
						enumerable,
						value: void 0
					};
					Object.defineProperty(this, key, desc);
					desc.value = make(this);
					Object.defineProperty(this, key, desc);
					return desc.value;
				},
				set(value) {
					Object.defineProperty(this, key, {
						configurable: true,
						writable: true,
						enumerable,
						value
					});
				}
			});
		}
		/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
		const CONSTANT_CATCH = "~constantCatch";
		/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
		function constantCatch(value) {
			const fn = () => value;
			fn[CONSTANT_CATCH] = true;
			return fn;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/core.js
		var _a$1;
		const _zodDesc = {
			value: void 0,
			enumerable: false
		};
		let _E = "captureStackTrace" in Error ? Error : null;
		function newError(Definition) {
			const E = _E;
			if (E) {
				const saved = E.stackTraceLimit;
				if (typeof saved === "number") {
					try {
						E.stackTraceLimit = 0;
					} catch {
						_E = null;
						return new Definition();
					}
					try {
						return new Definition();
					} finally {
						E.stackTraceLimit = saved;
					}
				}
			}
			return new Definition();
		}
		/* @__NO_SIDE_EFFECTS__ */
		function $constructor(name, initializer, proto, params) {
			const zodProto = {};
			function Internals(def) {
				this.def = def;
				this.constr = _;
				this.traits = /* @__PURE__ */ new Set();
			}
			Internals.prototype = zodProto;
			const protoMembers = proto;
			const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
			function init(inst, def) {
				if (!inst._zod) {
					_zodDesc.value = new Internals(def);
					try {
						Object.defineProperty(inst, "_zod", _zodDesc);
					} finally {
						_zodDesc.value = void 0;
					}
				} else if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				if (initialized) {
					const own = Object.getPrototypeOf(inst);
					const ctorProto = inst._zod.constr.prototype;
					let up = own;
					while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
					const target = up ?? own;
					if (!initialized.has(target)) {
						initialized.add(target);
						members(target, protoMembers);
					}
				}
				const proto = _.prototype;
				for (const k in proto) {
					if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				const inst = params?.Parent ? newError(Definition) : this;
				init(inst, def);
				const deferred = inst._zod.deferred;
				if (deferred) {
					for (const fn of deferred) fn();
					inst._zod.deferred = void 0;
				}
				const pp = globalThis.__zod_globalConfig?.postProcessor;
				if (pp) pp(inst);
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/errors.js
		function _getMessage() {
			const internals = this._zod;
			internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
			return internals.message;
		}
		function _setMessage(value) {
			this._zod.message = value;
		}
		const _messageDesc = {
			get: _getMessage,
			set: _setMessage,
			enumerable: true,
			configurable: true
		};
		const _issuesDesc = {
			value: void 0,
			enumerable: false
		};
		const _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			_issuesDesc.value = def;
			Object.defineProperty(inst, "issues", _issuesDesc);
			_issuesDesc.value = void 0;
			Object.defineProperty(inst, "message", _messageDesc);
			const proto = Object.getPrototypeOf(inst);
			if (!_installedToString.has(proto)) {
				_installedToString.add(proto);
				Object.defineProperty(proto, "toString", {
					configurable: true,
					enumerable: false,
					get() {
						const value = () => this.message;
						Object.defineProperty(this, "toString", {
							value,
							configurable: true,
							writable: true
						});
						return value;
					},
					set(value) {
						Object.defineProperty(this, "toString", {
							value,
							configurable: true,
							writable: true
						});
					}
				});
			}
		};
		const $ZodError = /* @__PURE__ */ $constructor("$ZodError", initializer$1);
		/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
		* ("toString", "constructor") would otherwise read through to the prototype, and assigning
		* "__proto__" would hit the setter instead of creating a key. */
		function node$1(obj, key, make) {
			if (!Object.prototype.hasOwnProperty.call(obj, key)) {
				if (key === "__proto__") Object.defineProperty(obj, key, {
					value: make(),
					writable: true,
					enumerable: true,
					configurable: true
				});
				else obj[key] = make();
			}
			return obj[key];
		}
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) node$1(fieldErrors, sub.path[0], () => []).push(mapper(sub));
			else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							const terminal = i === fullpath.length - 1;
							if (el === "_errors") {
								if (terminal) curr._errors.push(mapper(issue));
								i++;
								continue;
							}
							if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
								value: { _errors: [] },
								enumerable: true,
								writable: true,
								configurable: true
							});
							const node = curr[el];
							if (terminal) node._errors.push(mapper(issue));
							curr = node;
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/parse.js
		function finalizeParams(callee, params) {
			return {
				callee: params?.callee ?? callee,
				Err: params?.Err
			};
		}
		const _parse = (_Err) => {
			const fn = (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					async: false
				} : { async: false };
				const result = schema._zod.run({
					value,
					issues: []
				}, ctx);
				if (result instanceof Promise) throw new $ZodAsyncError();
				if (result.issues.length) {
					const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
					captureStackTrace(e, _params?.callee ?? fn);
					throw e;
				}
				return result.value;
			};
			return fn;
		};
		const _parseAsync = (_Err) => {
			const fn = async (schema, value, _ctx, params) => {
				const ctx = _ctx ? {
					..._ctx,
					async: true
				} : { async: true };
				let result = schema._zod.run({
					value,
					issues: []
				}, ctx);
				if (result instanceof Promise) result = await result;
				if (result.issues.length) {
					const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
					captureStackTrace(e, params?.callee ?? fn);
					throw e;
				}
				return result.value;
			};
			return fn;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? failure(_Err, result.issues, ctx) : {
				success: true,
				data: result.value
			};
		};
		function failure(Err, issues, ctx) {
			let error;
			return {
				success: false,
				get error() {
					if (!error) {
						error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
						issues = void 0;
						ctx = void 0;
					}
					return error;
				},
				set error(e) {
					error = e;
					issues = void 0;
					ctx = void 0;
				}
			};
		}
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? failure(_Err, result.issues, ctx) : {
				success: true,
				data: result.value
			};
		};
		const COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
		const COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
		const validate = ((schema, value, _ctx) => {
			const validator = schema._zod.bag.validator;
			if (validator !== void 0) {
				if (validator(value) !== COMPILE_INVALID) return true;
				if (validator.definite === true && _ctx === void 0) return false;
			}
			return validateFallback(schema, value, _ctx);
		});
		function validateFallback(schema, value, _ctx) {
			const ctx = _ctx ? {
				..._ctx,
				async: false,
				abortEarly: true
			} : {
				async: false,
				abortEarly: true
			};
			const fallbackRun = schema._zod.bag.fallbackRun;
			let result;
			if (fallbackRun) {
				ctx[COMPILE_FALLBACK] = true;
				result = fallbackRun({
					value,
					issues: []
				}, ctx);
			} else result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length === 0;
		}
		const validateAsync$1 = async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true,
				abortEarly: true
			} : {
				async: true,
				abortEarly: true
			};
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length === 0;
		};
		const _encode = (_Err) => {
			const parse = _parse(_Err);
			const fn = (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					direction: "backward"
				} : { direction: "backward" };
				return parse(schema, value, ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _decode = (_Err) => {
			const parse = _parse(_Err);
			const fn = (schema, value, _ctx, _params) => {
				return parse(schema, value, _ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _encodeAsync = (_Err) => {
			const parseAsync = _parseAsync(_Err);
			const fn = async (schema, value, _ctx, _params) => {
				const ctx = _ctx ? {
					..._ctx,
					direction: "backward"
				} : { direction: "backward" };
				return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _decodeAsync = (_Err) => {
			const parseAsync = _parseAsync(_Err);
			const fn = async (schema, value, _ctx, _params) => {
				return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
			};
			return fn;
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/regexes.js
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		function nanoidOfLength(length) {
			return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
		}
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		/** Anchors a pattern source. The interpolation lives here rather than at the call site because
		* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
		* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
		function anchor(source) {
			return new RegExp(`^${source}$`);
		}
		const date = /*@__PURE__*/ anchor(dateSource);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime(args) {
			const opts = ["Z"];
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const qualified = `${timeSource({
				precision: args.precision,
				seconds: true
			})}(?:${opts.join("|")})`;
			const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const anyString = /^[\s\S]{0,}$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/checks.js
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
		const _whenHasLength = (payload) => {
			const val = payload.value;
			return !nullish(val) && val.length !== void 0;
		};
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin: numericOriginMap[typeof payload.value] ?? origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin: numericOriginMap[typeof payload.value] ?? origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
			inst._zod.check = (payload) => {
				const input = payload.value;
				const units = input.length;
				const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/doc.js
		var Doc = class {
			constructor(args = [], closed = {}) {
				this.content = [];
				this.indent = 0;
				this.args = args;
				this.closed = closed;
			}
			indented(fn) {
				this.indent += 1;
				try {
					fn(this);
				} finally {
					this.indent -= 1;
				}
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const content = this?.content ?? [``];
				return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
			}
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/versions.js
		const version = {
			major: 4,
			minor: 6,
			patch: 6
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/schemas.js
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const defChecks = inst._zod.def.checks;
			const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					if (payload.memo) return payload;
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							attachSchema(payload.issues, currLen, inst);
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							attachSchema(payload.issues, currLen, inst);
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
		}, {
			get "~standard"() {
				return hide(this, "~standard", standardProps(this));
			},
			set "~standard"(value) {
				own$2(this, "~standard", value);
			}
		});
		/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
		const toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
		async function validateAsync(inst, value) {
			const ctx = { async: true };
			return toStandardResult(await inst._zod.run({
				value,
				issues: []
			}, ctx), ctx);
		}
		function standardProps(inst) {
			return {
				validate: (value) => {
					const ctx = { async: false };
					try {
						const r = inst._zod.run({
							value,
							issues: []
						}, ctx);
						if (!(r instanceof Promise)) return toStandardResult(r, ctx);
					} catch (_) {}
					return validateAsync(inst, value);
				},
				vendor: "zod",
				version: 1
			};
		}
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = def.pattern ?? anyString;
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		function canParseURL(input) {
			try {
				if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
				new URL(input);
				return true;
			} catch {
				return false;
			}
		}
		function validateURL(trimmed, def) {
			if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
			return parseURLObject(trimmed, def);
		}
		/** Parses a URL while preserving the non-normalizing HTTP guard. */
		function parseURLObject(trimmed, def) {
			if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
			try {
				if (typeof URL !== "undefined") {
					const URLStatic = URL;
					if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
				}
				return new URL(trimmed);
			} catch {
				return 2;
			}
		}
		const asciiTabOrNewline = /[\t\n\r]/g;
		/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
		function stripTabAndNewline(value) {
			return value.replace(asciiTabOrNewline, "");
		}
		function urlHostnameOk(url, hostname) {
			hostname.lastIndex = 0;
			return hostname.test(url.hostname);
		}
		function urlProtocolOk(url, protocol) {
			protocol.lastIndex = 0;
			return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
		}
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					const url = validateURL(trimmed, def);
					if (url === 1) {
						payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid URL format",
							input: payload.value,
							inst,
							continue: !def.abort
						});
						return;
					}
					if (url === 2) {
						payload.issues.push({
							code: "invalid_format",
							format: "url",
							input: payload.value,
							inst,
							continue: !def.abort
						});
						return;
					}
					if (url === true) {
						payload.value = stripTabAndNewline(trimmed);
						return;
					}
					if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid hostname",
						pattern: def.hostname.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
					if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid protocol",
						pattern: def.protocol.source,
						input: payload.value,
						inst,
						continue: !def.abort
					});
					payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
			def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
		});
		/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
		const ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
		function isValidIPv6(value) {
			if (!ipv6Alphabet.test(value)) return false;
			return canParseURL(`http://[${value}]`);
		}
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (!isValidIPv6(payload.value)) payload.issues.push({
					code: "invalid_format",
					format: "ipv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		function isValidCIDRv6(value) {
			const parts = value.split("/");
			if (parts.length !== 2) return false;
			const [address, prefix] = parts;
			if (!prefix) return false;
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) return false;
			if (prefixNum < 0 || prefixNum > 128) return false;
			return isValidIPv6(address);
		}
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (!isValidCIDRv6(payload.value)) payload.issues.push({
					code: "invalid_format",
					format: "cidrv6",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64Charset);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const base64urlCharset = /^[A-Za-z0-9_-]*$/;
		function isValidBase64URL(data) {
			if (!base64urlCharset.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64urlCharset);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		function capSize(inst, size) {
			const caps = sizeCaps(inst._zod.def.checks);
			if (!caps.length) return;
			const cap = Math.min(...caps.map((c) => c[0]));
			const parse = inst._zod.parse;
			inst._zod.parse = (payload, ctx) => {
				const n = size(payload.value);
				if (n > cap && !ctx?.skipChecks && ctx?.direction !== "backward") {
					for (const [max, ch] of sizeCaps(inst._zod.def.checks)) if (n > max && ch._zod.def.when(payload)) {
						const start = payload.issues.length;
						ch._zod.check(payload);
						payload.issues[start].continue = false;
						attachSchema(payload.issues, start, inst);
						return payload;
					}
				}
				return parse(payload, ctx);
			};
		}
		const arraySize = (input) => Array.isArray(input) ? input.length : -1;
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			const memo = globalConfig.memoizer;
			memo?.attach(inst);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
				const proms = [];
				const abortEarly = ctx?.abortEarly;
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else {
						handleArrayResult(result, payload, i);
						if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
					}
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
			capSize(inst, arraySize);
		});
		function handlePropertyResult(result, final, key, input, optin, optout) {
			const isPresent = key in input;
			const isOptionalOut = optout === "optional";
			if (!isPresent && isOptionalOut && optin === "optional") return;
			if (result.issues.length) {
				if (optin !== void 0 && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && optin === void 0) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		const NO_SYMBOL_KEYS = [];
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			const ownSymbols = Object.getOwnPropertySymbols(def.shape);
			const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
			const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
			for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				allKeys,
				symbolKeys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const optin = _catchall.optin;
			const optout = _catchall.optout;
			let seen = 0;
			for (const key in input) {
				if (abortEarly && payload.issues.length !== seen) {
					if (aborted(payload, seen)) break;
					seen = payload.issues.length;
				}
				if (keySet.has(key)) continue;
				if (key === "__proto__") {
					if (t === "never") unrecognized.push(key);
					continue;
				}
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
				else handlePropertyResult(r, payload, key, input, optin, optout);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst,
				continue: true
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			const desc = Object.getOwnPropertyDescriptor(def, "shape");
			const sh = desc?.get ? desc.get.raw : def.shape ?? {};
			if (sh) {
				const get = () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					get.raw = newSh;
					return newSh;
				};
				get.raw = sh;
				Object.defineProperty(def, "shape", { get });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazyInternal(inst, "propValues", (zod) => {
				const shape = zod.def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
						if (field.optin !== void 0) propValues[key].add(void 0);
					}
				}
				return propValues;
			});
			const isObject$1 = isObject;
			const catchall = def.catchall;
			let value;
			const memo = globalConfig.memoizer;
			memo?.attach(inst);
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
				const proms = [];
				const shape = value.shape;
				const abortEarly = ctx?.abortEarly;
				let seen = payload.issues.length;
				for (const key of value.allKeys) {
					if (abortEarly && payload.issues.length !== seen) {
						if (aborted(payload, seen)) break;
						seen = payload.issues.length;
					}
					if (key === "__proto__") continue;
					const el = shape[key];
					const optin = el._zod.optin;
					const optout = el._zod.optout;
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
					else handlePropertyResult(r, payload, key, input, optin, optout);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const memo = globalConfig.memoizer;
			const generateFastpass = (shape) => {
				const normalized = _normalized.value;
				const syms = normalized.symbolKeys;
				const doc = new Doc(["payload", "ctx"], {
					shape,
					inst,
					memo,
					syms
				});
				const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
				doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
				for (const key of normalized.allKeys) {
					if (key === "__proto__") continue;
					const id = ids[key];
					const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
					const isPresent = `${k} in input`;
					const schema = shape[key];
					const optin = schema?._zod?.optin;
					const isOptionalIn = optin !== void 0;
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(k)};`);
					if (isOptionalIn && isOptionalOut) {
						const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
						doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
					} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
					else {
						doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
						if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
						else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
					}
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				return doc.compile();
			};
			let fastpass;
			const isObject$2 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
			defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazyInternal(inst, "values", (zod) => {
				if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazyInternal(inst, "pattern", (zod) => {
				if (zod.def.options.every((o) => o._zod.pattern)) {
					const patterns = zod.def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
				for (const key of sharedKeys) {
					if (key === "__proto__") continue;
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			const keyIssues = /* @__PURE__ */ new Map();
			const collect = (iss, side) => {
				let keys;
				if (iss.code === "unrecognized_keys" && !iss.path?.length) {
					unrecIssue ?? (unrecIssue = iss);
					keys = iss.keys;
				} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
					const k = String(iss.path[0]);
					if (!keyIssues.has(k)) keyIssues.set(k, iss);
					keys = [k];
				} else return false;
				for (const k of keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k)[side] = true;
				}
				return true;
			};
			for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
			for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length) {
				const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
				if (aggregated.length) result.issues.push({
					...unrecIssue,
					keys: aggregated
				});
				for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
			}
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) {
				if (aborted(result)) return result;
				throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			}
			result.value = merged.data;
			return result;
		}
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			defineLazyInternal(inst, "pattern", (zod) => {
				const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
				return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
			});
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			globalConfig.memoizer?.guard(inst);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				return payload;
			};
		});
		function handleOptionalResult(payload, result) {
			payload.value = result.issues.length ? void 0 : result.value;
			return payload;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
			inst._zod.optout = "optional";
			defineLazyInternal(inst, "values", (zod) => {
				const values = zod.def.innerType._zod.values;
				return values ? /* @__PURE__ */ new Set([...values, void 0]) : void 0;
			});
			defineLazyInternal(inst, "pattern", (zod) => {
				const pattern = zod.def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === void 0) {
					if (def.innerType._zod.optin !== "defaulted") return payload;
					const result = def.innerType._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
					return handleOptionalResult(payload, result);
				}
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
			defineLazyInternal(inst, "pattern", (zod) => {
				const pattern = zod.def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazyInternal(inst, "values", (zod) => {
				return zod.def.innerType._zod.values ? /* @__PURE__ */ new Set([...zod.def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "defaulted";
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "defaulted";
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => {
				const v = zod.def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		function handleCatchResult(payload, result, def, ctx) {
			if (!result.issues.length) {
				payload.value = result.value;
				if (result.memo) payload.memo = true;
				return payload;
			}
			payload.value = def.catchValue({
				...result,
				value: payload.value,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run({
					value: payload.value,
					issues: []
				}, ctx);
				if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
				return handleCatchResult(payload, result, def, ctx);
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
			defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
			defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
			defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
			defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
			defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			if (!payload.memo) payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/memoizer.js
		var $ZodCyclicError = class extends Error {
			constructor() {
				super(`Cannot parse a reference cycle that closes through a transform`);
				this.name = "ZodCyclicError";
			}
		};
		/** Keyed off the context object every schema in one parse call already shares. */
		const STATE = "~memo";
		const NO_ISSUES = [];
		function isRef(value) {
			return value !== null && typeof value === "object";
		}
		function cloneIssues(issues) {
			return issues.map((iss) => iss.path ? {
				...iss,
				path: iss.path.slice()
			} : { ...iss });
		}
		const recursive = /*@__PURE__*/ new WeakMap();
		/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
		const NONE = 0;
		const ASSUMED = 1;
		const PROVEN = 2;
		/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
		function isRecursive(inst, stack, resolve) {
			const cached = recursive.get(inst);
			if (cached !== void 0) return cached ? PROVEN : NONE;
			if (stack.has(inst)) return PROVEN;
			stack.add(inst);
			let result = NONE;
			const check = (child) => {
				if (result !== PROVEN && child?._zod) {
					const answer = isRecursive(child, stack, resolve);
					if (answer > result) result = answer;
				}
			};
			const shape = (sh, spread) => {
				let answer = NONE;
				for (const key of Reflect.ownKeys(sh)) {
					const desc = Object.getOwnPropertyDescriptor(sh, key);
					if (spread && !desc.enumerable) continue;
					const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
					if (child > answer) answer = child;
				}
				return answer;
			};
			const merge = (answer) => {
				if (answer > result) result = answer;
			};
			const def = inst._zod.def;
			switch (def.type) {
				case "object": {
					const raw = rawShape(def);
					merge(raw ? shape(raw, true) : ASSUMED);
					check(def.catchall);
					break;
				}
				case "array":
					check(def.element);
					break;
				case "tuple":
					for (const el of def.items) check(el);
					check(def.rest);
					break;
				case "record":
				case "map":
					check(def.keyType);
					check(def.valueType);
					break;
				case "set":
					check(def.valueType);
					break;
				case "union":
					for (const el of def.options) check(el);
					break;
				case "intersection":
					check(def.left);
					check(def.right);
					break;
				case "optional":
				case "nullable":
				case "default":
				case "prefault":
				case "catch":
				case "readonly":
				case "nonoptional":
				case "promise":
				case "success":
					check(def.innerType);
					break;
				case "pipe":
					check(def.in);
					check(def.out);
					break;
				case "function":
					check(def.input);
					check(def.output);
					break;
				case "lazy": {
					const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
					merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
					break;
				}
				case "template_literal":
				case "string":
				case "number":
				case "int":
				case "boolean":
				case "bigint":
				case "symbol":
				case "undefined":
				case "null":
				case "void":
				case "never":
				case "any":
				case "unknown":
				case "date":
				case "nan":
				case "enum":
				case "literal":
				case "file":
				case "transform":
				case "custom": break;
				default: for (const key in def) {
					const desc = Object.getOwnPropertyDescriptor(def, key);
					if (!desc || desc.get) continue;
					const value = desc.value;
					if (!value || typeof value !== "object") continue;
					if (value._zod) check(value);
					else if (Array.isArray(value)) for (const el of value) check(el);
				}
			}
			stack.delete(inst);
			return settle(inst, result);
		}
		/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
		function settle(inst, answer) {
			if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
			return answer;
		}
		function bucketFor(state, inst) {
			let bucket = state.buckets.get(inst);
			if (!bucket) {
				bucket = /* @__PURE__ */ new WeakMap();
				state.buckets.set(inst, bucket);
			}
			return bucket;
		}
		let handoff;
		const open = [];
		const memo = {
			alloc(_inst, payload, empty) {
				const bucket = handoff;
				if (!bucket) return empty;
				handoff = void 0;
				const entry = {
					value: empty,
					issues: null
				};
				bucket.set(payload.value, entry);
				open.push(entry);
				return empty;
			},
			guard(inst) {
				var _a;
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred.push(() => {
					const base = inst._zod.parse;
					const wrapped = (payload, ctx) => {
						if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
						return base(payload, ctx);
					};
					inst._zod.parse = wrapped;
					if (inst._zod.run === base) inst._zod.run = wrapped;
				});
			},
			attach(inst) {
				var _a;
				let isRecursiveInst;
				let rechecked = false;
				let lastCtx;
				let lastBucket;
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred.push(() => {
					const base = inst._zod.parse;
					const wrapped = (payload, ctx) => {
						if (isRecursiveInst === void 0) {
							const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
							if (walked === NONE) {
								inst._zod.parse = base;
								if (inst._zod.run === wrapped) inst._zod.run = base;
								return base(payload, ctx);
							}
							if (walked === PROVEN || rechecked) isRecursiveInst = true;
							else rechecked = true;
						}
						const input = payload.value;
						if (!isRef(input)) return base(payload, ctx);
						let state = ctx[STATE];
						if (!state) {
							state = {
								buckets: /* @__PURE__ */ new WeakMap(),
								backEdges: void 0
							};
							ctx[STATE] = state;
						}
						let bucket;
						if (lastCtx === ctx) bucket = lastBucket;
						else {
							bucket = bucketFor(state, inst);
							lastCtx = ctx;
							lastBucket = bucket;
						}
						const hit = bucket.get(input);
						if (hit) {
							payload.value = hit.value;
							if (hit.issues) {
								if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
							} else {
								payload.memo = true;
								state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
								state.backEdges.add(hit.value);
							}
							return payload;
						}
						handoff = bucket;
						const depth = open.length;
						const result = base(payload, ctx);
						handoff = void 0;
						const entry = open.length > depth ? open.pop() : void 0;
						if (result instanceof Promise) return result.then((r) => {
							if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
							return r;
						});
						if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
						return result;
					};
					inst._zod.parse = wrapped;
					if (inst._zod.run === base) inst._zod.run = wrapped;
				});
			}
		};
		/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
		function memoizer() {
			return memo;
		}
		/** Whether this value is a node a back-edge resolved to before it finished. */
		function isBackEdge(ctx, value) {
			const backEdges = ctx[STATE]?.backEdges;
			return backEdges !== void 0 && isRef(value) && backEdges.has(value);
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/locales/en.js
		const error = () => {
			const Sizable = {
				string: {
					unit: "characters",
					verb: "to have"
				},
				file: {
					unit: "bytes",
					verb: "to have"
				},
				array: {
					unit: "items",
					verb: "to have"
				},
				set: {
					unit: "items",
					verb: "to have"
				},
				map: {
					unit: "entries",
					verb: "to have"
				}
			};
			function getSizing(origin) {
				return Sizable[origin] ?? null;
			}
			const FormatDictionary = {
				regex: "input",
				email: "email address",
				url: "URL",
				emoji: "emoji",
				uuid: "UUID",
				uuidv4: "UUIDv4",
				uuidv6: "UUIDv6",
				nanoid: "nanoid",
				guid: "GUID",
				cuid: "cuid",
				cuid2: "cuid2",
				ulid: "ULID",
				xid: "XID",
				ksuid: "KSUID",
				datetime: "ISO datetime",
				date: "ISO date",
				time: "ISO time",
				duration: "ISO duration",
				ipv4: "IPv4 address",
				ipv6: "IPv6 address",
				mac: "MAC address",
				cidrv4: "IPv4 range",
				cidrv6: "IPv6 range",
				base64: "base64-encoded string",
				base64url: "base64url-encoded string",
				json_string: "JSON string",
				e164: "E.164 number",
				currency_code: "currency code",
				credit_card: "credit card number",
				iban: "IBAN",
				jwt: "JWT",
				template_literal: "input"
			};
			const TypeDictionary = { nan: "NaN" };
			function getTypeName(type, input) {
				if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
				return TypeDictionary[type] ?? type;
			}
			return (issue) => {
				switch (issue.code) {
					case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
					case "invalid_value":
						if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
						return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
					case "too_big": {
						const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
						const sizing = getSizing(issue.origin);
						if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
						return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
					}
					case "too_small": {
						const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
						const sizing = getSizing(issue.origin);
						if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
						return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
					}
					case "invalid_format": {
						const _issue = issue;
						if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
						if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
						if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
						if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
						return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
					}
					case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
					case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
					case "invalid_key": return `Invalid key in ${issue.origin}`;
					case "invalid_union":
						if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
						if (issue.inclusive === false) return "Invalid input: more than one option matched";
						return "Invalid input";
					case "invalid_element": return `Invalid value in ${issue.origin}`;
					default: return `Invalid input`;
				}
			};
		};
		function en_default() {
			return { localeError: error() };
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/registries.js
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/api.js
		function snapshotChecks(def) {
			if (def.checks) def.checks = [...def.checks];
			return def;
		}
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class(snapshotChecks({
				type: "string",
				...normalizeParams(params)
			}));
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class(snapshotChecks({
				type: "number",
				checks: [],
				...normalizeParams(params)
			}));
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						if (!("input" in _issue)) _issue.input = payload.value;
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/to-json-schema.js
		function assignProps(target, ...sources) {
			for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
			return target;
		}
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				sharedDefsExtractedFor: void 0,
				sharedEmitDoneFor: void 0,
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				intersections: [],
				deferred: [],
				external: params?.external ?? void 0
			};
		}
		/**
		* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
		* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
		* custom JSON Schema was written into `json`, in which case the caller must not write its own.
		*/
		function handleUnrepresentable(schema, ctx, json, params, message) {
			const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
				zodSchema: schema,
				path: params.path,
				message
			}) : ctx.unrepresentable;
			if (result === "any") return false;
			if (result === void 0 || result === "throw") throw new Error(message);
			Object.assign(json, result);
			return true;
		}
		function processSchema(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			ctx.sharedDefsExtractedFor = void 0;
			ctx.sharedEmitDoneFor = void 0;
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					processSchema(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) assignProps(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function encodeJSONPointerSegment(segment) {
			return segment.replace(/~/g, "~0").replace(/\//g, "~1");
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
					};
				}
				const uriPrefix = `#`;
				const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
				if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + encodeJSONPointerSegment(defId)
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") extractToDef(entry);
				}
			}
			if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
		}
		/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
		function compactTypeUnion(schema) {
			const options = schema.anyOf;
			if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
			const types = [];
			for (const option of options) {
				if (!option || typeof option !== "object") return;
				compactTypeUnion(option);
				const keys = Object.keys(option);
				if (keys.length !== 1 || keys[0] !== "type") return;
				const type = option.type;
				for (const member of Array.isArray(type) ? type : [type]) {
					if (typeof member !== "string") return;
					if (!types.includes(member)) types.push(member);
				}
			}
			delete schema.anyOf;
			schema.type = types.length === 1 ? types[0] : types;
		}
		/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
		* an annotation like `description` — makes a member unfoldable, so a constraint this does not
		* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
		const FOLDABLE_KEYS = /* @__PURE__ */ new Set([
			"type",
			"properties",
			"required",
			"additionalProperties"
		]);
		const UNION_KEYS = ["oneOf", "anyOf"];
		/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
		function undeclaredConstraint(member) {
			const extra = member.additionalProperties;
			if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
			return Object.keys(extra).length ? extra : null;
		}
		/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
		function foldObjects(members) {
			const objects = [];
			for (const member of members) {
				if (typeof member !== "object" || member.type !== "object") return null;
				for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
				objects.push(member);
			}
			const properties = {};
			const required = /* @__PURE__ */ new Set();
			for (const object of objects) {
				for (const key in object.properties) {
					if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
					const parts = [];
					for (const other of objects) {
						const part = other.properties?.[key] ?? undeclaredConstraint(other);
						if (part === null || part === void 0) continue;
						if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
					}
					assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
				}
				for (const key of object.required ?? []) required.add(key);
			}
			const folded = {
				type: "object",
				properties
			};
			if (required.size) folded.required = [...required];
			if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
			else {
				const constraints = [];
				for (const object of objects) {
					const constraint = undeclaredConstraint(object);
					if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
				}
				if (constraints.length === 1) folded.additionalProperties = constraints[0];
				else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
			}
			return folded;
		}
		/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
		* closed object members reject each other's keys and the schema validates nothing. Zod's parser
		* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
		* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
		* into one object is the encoding that says so on every target.
		*
		* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
		* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
		* keeps its reference and its own closedness rather than being inlined as a stale copy. */
		function foldIntersection(json) {
			const allOf = json.allOf;
			if (!Array.isArray(allOf) || allOf.length < 2) return;
			for (const key of FOLDABLE_KEYS) if (key in json) return;
			const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
			let folded = null;
			if (!unions.length) folded = foldObjects(allOf);
			else {
				const union = unions[0];
				const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
				if (Object.keys(union).length !== 1) return;
				const rest = allOf.filter((m) => m !== union);
				const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
				if (branches.some((b) => !b)) return;
				folded = { [keyword]: branches };
			}
			if (!folded) return;
			delete json.allOf;
			assignProps(json, folded);
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else assignProps(schema, refSchema);
					assignProps(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
				for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
				if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
				for (const rewrite of ctx.deferred) rewrite();
				if (ctx.intersections.length) {
					const carriers = /* @__PURE__ */ new Map();
					for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
						const allOf = json?.allOf;
						if (!Array.isArray(allOf)) continue;
						const existing = carriers.get(allOf);
						if (existing) existing.push(json);
						else carriers.set(allOf, [json]);
					}
					for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
				}
			}
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					assignProp(defs, seen.defId, seen.def);
				}
			}
			if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
			if (ctx.external) {} else if (Object.keys(defs).length > 0) {
				if (ctx.target === "draft-2020-12") result.$defs = defs;
				else result.definitions = defs;
			}
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			processSchema(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			processSchema(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/core/json-schema-processors.js
		const narrowMin = (agg, key, value) => {
			if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
		};
		const narrowMax = (agg, key, value) => {
			if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
		};
		const narrowBoth = (agg, value) => {
			narrowMin(agg, "minimum", value);
			narrowMax(agg, "maximum", value);
		};
		const addDivisor = (agg, value) => {
			agg.multipleOf ?? (agg.multipleOf = []);
			if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
		};
		const addPattern = (agg, pattern) => {
			agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
			agg.patterns.add(pattern);
		};
		const intersectMime = (agg, mime) => {
			agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
		};
		const setFormat = (agg, format) => {
			agg.format = format;
			if (format.includes("int")) agg.isInt = true;
		};
		const minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
		const maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
		const formatContributor = (ranges) => (agg, def) => {
			setFormat(agg, def.format);
			const [minimum, maximum] = ranges[def.format];
			narrowMin(agg, "minimum", minimum);
			narrowMax(agg, "maximum", maximum);
		};
		const contributors = {
			greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
			less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
			multiple_of: (agg, def) => addDivisor(agg, def.value),
			number_format: formatContributor(NUMBER_FORMAT_RANGES),
			bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
			min_length: minContributor,
			max_length: maxContributor,
			length_equals: (agg, def) => narrowBoth(agg, def.length),
			min_size: minContributor,
			max_size: maxContributor,
			size_equals: (agg, def) => narrowBoth(agg, def.size),
			string_format: (agg, def) => {
				setFormat(agg, def.format);
				if (def.pattern) addPattern(agg, def.pattern);
				if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
				if (def.local || def.precision === -1) agg.laxFormat = true;
			},
			mime_type: (agg, def) => intersectMime(agg, def.mime)
		};
		function aggregateChecks(schema) {
			const agg = {};
			const def = schema._zod.def;
			const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
			for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
			const bag = schema._zod.bag;
			if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
			if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
			if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
			if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
			if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
			if (bag.format !== void 0) {
				agg.format ?? (agg.format = bag.format);
				if (bag.format.includes("int")) agg.isInt = true;
			}
			if (bag.mime) intersectMime(agg, bag.mime);
			for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
			return agg;
		}
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const exactPatterns = /* @__PURE__ */ new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
		const exactPattern = (p) => exactPatterns.get(p) ?? p;
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time" || laxFormat) delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const patternList = [...patterns].map(exactPattern);
				if (patternList.length === 1) json.pattern = patternList[0].source;
				else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
			json.type = isInt ? "integer" : "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) {
				if (legacy) {
					json.minimum = exclusiveMinimum;
					json.exclusiveMinimum = true;
				} else json.exclusiveMinimum = exclusiveMinimum;
			} else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) {
				if (legacy) {
					json.maximum = exclusiveMaximum;
					json.exclusiveMaximum = true;
				} else json.exclusiveMaximum = exclusiveMaximum;
			} else if (typeof maximum === "number") json.maximum = maximum;
			if (multipleOf) {
				const divisors = /* @__PURE__ */ new Set();
				for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
				else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
				const [first, ...rest] = divisors;
				if (first !== void 0) json.multipleOf = first;
				if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
			}
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.length === 0) {
				json.not = {};
				return;
			}
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const customProcessor = (schema, ctx, json, params) => {
			handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (schema, ctx, json, params) => {
			handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = aggregateChecks(schema);
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = processSchema(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		function inputOptin(schema) {
			const def = schema._zod.def;
			if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
			if (def.type === "catch") return inputOptin(def.innerType);
			return schema._zod.optin;
		}
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const shape = def.shape;
			if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
			json.type = "object";
			json.properties = {};
			for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			}));
			const requiredKeys = [];
			for (const key of Object.keys(shape)) {
				const field = def.shape[key];
				if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
			}
			if (requiredKeys.length > 0) json.required = requiredKeys;
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => processSchema(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = processSchema(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = processSchema(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
			json.allOf = allOf;
			ctx.intersections.push(allOf);
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
		* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
		* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
		const UNREPRESENTABLE_DEFAULT = Symbol();
		function serializeDefaultValue(value, schema, ctx, json, params) {
			let unrepresentable = false;
			const serialized = JSON.stringify(value, (_, val) => {
				if (typeof val !== "bigint") return val;
				unrepresentable = true;
				return null;
			});
			if (!unrepresentable) return JSON.parse(serialized);
			handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
			return UNREPRESENTABLE_DEFAULT;
		}
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
			if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io !== "input") return;
			const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
			if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
				return;
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			processSchema(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			processSchema(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/classic/errors.js
		const _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
		function _lazyMethod(proto, key, make) {
			Object.defineProperty(proto, key, {
				configurable: true,
				enumerable: false,
				get() {
					const value = make(this);
					Object.defineProperty(this, key, {
						value,
						configurable: true,
						writable: true
					});
					return value;
				},
				set(value) {
					Object.defineProperty(this, key, {
						value,
						configurable: true,
						writable: true
					});
				}
			});
		}
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			const proto = Object.getPrototypeOf(inst);
			if (_installedErrorProtos.has(proto)) return;
			_installedErrorProtos.add(proto);
			_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
			_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
			_lazyMethod(proto, "addIssue", (self) => (issue) => {
				self.issues.push(issue);
				self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
			});
			_lazyMethod(proto, "addIssues", (self) => (issues) => {
				self.issues.push(...issues);
				self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
			});
			Object.defineProperty(proto, "isEmpty", {
				configurable: true,
				enumerable: false,
				get() {
					return this.issues.length === 0;
				}
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, void 0, { Parent: Error });
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/classic/parse.js
		const parse$1 = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode$1 = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/zod/v4/classic/schemas.js
		function _ensureDefaultLocale() {
			if (!globalConfig.localeError) config(en_default());
		}
		function _ensureDefaultMemoizer() {
			if (!globalConfig.memoizer) config({ memoizer: memoizer() });
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			_ensureDefaultLocale();
			$ZodType.init(inst, def);
			inst.def = def;
			inst.type = def.type;
			return inst;
		}, {
			check(...chks) {
				const def = this.def;
				return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
					check: ch,
					def: { check: "custom" },
					onattach: []
				} } : ch)] }), { parent: true });
			},
			with(...chks) {
				return this.check(...chks);
			},
			clone(def, params) {
				return clone(this, def, params);
			},
			brand() {
				return this;
			},
			register(reg, meta) {
				reg.add(this, meta);
				return this;
			},
			refine(check, params) {
				return this.check(refine(check, params));
			},
			superRefine(refinement, params) {
				return this.check(superRefine(refinement, params));
			},
			overwrite(fn) {
				return this.check(/* @__PURE__ */ _overwrite(fn));
			},
			optional() {
				return optional(this);
			},
			exactOptional() {
				return exactOptional(this);
			},
			nullable() {
				return nullable(this);
			},
			nullish() {
				return optional(nullable(this));
			},
			nonoptional(params) {
				return nonoptional(this, params);
			},
			array() {
				return array(this);
			},
			or(arg) {
				return union([this, arg]);
			},
			and(arg) {
				return intersection(this, arg);
			},
			transform(tx) {
				return pipe(this, transform(tx));
			},
			default(d) {
				return _default(this, d);
			},
			prefault(d) {
				return prefault(this, d);
			},
			catch(params) {
				return _catch(this, params);
			},
			pipe(target) {
				return pipe(this, target);
			},
			readonly() {
				return readonly(this);
			},
			describe(description) {
				const cl = this.clone();
				globalRegistry.add(cl, { description });
				return cl;
			},
			meta(...args) {
				if (args.length === 0) return globalRegistry.get(this);
				const cl = this.clone();
				globalRegistry.add(cl, args[0]);
				return cl;
			},
			isOptional() {
				return this.safeParse(void 0).success;
			},
			isNullable() {
				return this.safeParse(null).success;
			},
			apply(fn, ...args) {
				return args.length === 0 ? fn(this) : fn(this, ...args);
			},
			get "~standard"() {
				return hide(this, "~standard", {
					...standardProps(this),
					jsonSchema: {
						input: createStandardJSONSchemaMethod(this, "input"),
						output: createStandardJSONSchemaMethod(this, "output")
					}
				});
			},
			set "~standard"(value) {
				own$2(this, "~standard", value);
			},
			parse: function _parse(data, params) {
				return parse$1(this, data, params, { callee: _parse });
			},
			parseAsync: async function _parseAsync(data, params) {
				return await parseAsync(this, data, params, { callee: _parseAsync });
			},
			safeParse(data, params) {
				return safeParse(this, data, params);
			},
			async safeParseAsync(data, params) {
				return safeParseAsync(this, data, params);
			},
			get spa() {
				return this?.safeParseAsync;
			},
			set spa(value) {
				own$2(this, "spa", value);
			},
			validate(data, params) {
				return validate(this, data, params);
			},
			validateAsync(data, params) {
				return validateAsync$1(this, data, params);
			},
			encode: function _encode(data, params) {
				return encode(this, data, params, { callee: _encode });
			},
			decode: function _decode(data, params) {
				return decode$1(this, data, params, { callee: _decode });
			},
			encodeAsync: async function _encodeAsync(data, params) {
				return await encodeAsync(this, data, params, { callee: _encodeAsync });
			},
			decodeAsync: async function _decodeAsync(data, params) {
				return await decodeAsync(this, data, params, { callee: _decodeAsync });
			},
			safeEncode(data, params) {
				return safeEncode(this, data, params);
			},
			safeDecode(data, params) {
				return safeDecode(this, data, params);
			},
			async safeEncodeAsync(data, params) {
				return safeEncodeAsync(this, data, params);
			},
			async safeDecodeAsync(data, params) {
				return safeDecodeAsync(this, data, params);
			},
			toJSONSchema(params) {
				return createToJSONSchemaMethod(this, {})(params);
			},
			get description() {
				return globalRegistry.get(this)?.description;
			},
			get _def() {
				return this._zod.def;
			}
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
		}, /*@__PURE__*/ derived({
			format: (inst) => aggregateChecks(inst).format ?? null,
			minLength: (inst) => aggregateChecks(inst).minimum ?? null,
			maxLength: (inst) => aggregateChecks(inst).maximum ?? null
		}, {
			regex(...args) {
				return this.check(/* @__PURE__ */ _regex(...args));
			},
			includes(...args) {
				return this.check(/* @__PURE__ */ _includes(...args));
			},
			startsWith(...args) {
				return this.check(/* @__PURE__ */ _startsWith(...args));
			},
			endsWith(...args) {
				return this.check(/* @__PURE__ */ _endsWith(...args));
			},
			min(...args) {
				return this.check(/* @__PURE__ */ _minLength(...args));
			},
			max(...args) {
				return this.check(/* @__PURE__ */ _maxLength(...args));
			},
			length(...args) {
				return this.check(/* @__PURE__ */ _length(...args));
			},
			nonempty(...args) {
				return this.check(/* @__PURE__ */ _minLength(1, ...args));
			},
			lowercase(params) {
				return this.check(/* @__PURE__ */ _lowercase(params));
			},
			uppercase(params) {
				return this.check(/* @__PURE__ */ _uppercase(params));
			},
			trim() {
				return this.check(/* @__PURE__ */ _trim());
			},
			normalize(...args) {
				return this.check(/* @__PURE__ */ _normalize(...args));
			},
			toLowerCase() {
				return this.check(/* @__PURE__ */ _toLowerCase());
			},
			toUpperCase() {
				return this.check(/* @__PURE__ */ _toUpperCase());
			},
			slugify() {
				return this.check(/* @__PURE__ */ _slugify());
			}
		}));
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
		}, {
			email(params) {
				return this.check(/* @__PURE__ */ _email(ZodEmail, params));
			},
			url(params) {
				return this.check(/* @__PURE__ */ _url(ZodURL, params));
			},
			jwt(params) {
				return this.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			},
			emoji(params) {
				return this.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			},
			guid(params) {
				return this.check(/* @__PURE__ */ _guid(ZodGUID, params));
			},
			uuid(params) {
				return this.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			},
			uuidv4(params) {
				return this.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			},
			uuidv6(params) {
				return this.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			},
			uuidv7(params) {
				return this.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			},
			nanoid(params) {
				return this.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			},
			cuid(params) {
				return this.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			},
			cuid2(params) {
				return this.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			},
			ulid(params) {
				return this.check(/* @__PURE__ */ _ulid(ZodULID, params));
			},
			base64(params) {
				return this.check(/* @__PURE__ */ _base64(ZodBase64, params));
			},
			base64url(params) {
				return this.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			},
			xid(params) {
				return this.check(/* @__PURE__ */ _xid(ZodXID, params));
			},
			ksuid(params) {
				return this.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			},
			ipv4(params) {
				return this.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			},
			ipv6(params) {
				return this.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			},
			cidrv4(params) {
				return this.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			},
			cidrv6(params) {
				return this.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			},
			e164(params) {
				return this.check(/* @__PURE__ */ _e164(ZodE164, params));
			},
			datetime(params) {
				return this.check(/* @__PURE__ */ _isoDateTime(ZodISODateTime, params));
			},
			date(params) {
				return this.check(/* @__PURE__ */ _isoDate(ZodISODate, params));
			},
			time(params) {
				return this.check(/* @__PURE__ */ _isoTime(ZodISOTime, params));
			},
			duration(params) {
				return this.check(/* @__PURE__ */ _isoDuration(ZodISODuration, params));
			}
		});
		function string$2(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			inst.isFinite = true;
		}, /*@__PURE__*/ derived({
			minValue: (inst) => {
				const { minimum, exclusiveMinimum } = aggregateChecks(inst);
				return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
			},
			maxValue: (inst) => {
				const { maximum, exclusiveMaximum } = aggregateChecks(inst);
				return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
			},
			isInt: (inst) => {
				const { isInt, multipleOf } = aggregateChecks(inst);
				return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
			},
			format: (inst) => aggregateChecks(inst).format ?? null
		}, {
			gt(value, params) {
				return this.check(/* @__PURE__ */ _gt(value, params));
			},
			gte(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			min(value, params) {
				return this.check(/* @__PURE__ */ _gte(value, params));
			},
			lt(value, params) {
				return this.check(/* @__PURE__ */ _lt(value, params));
			},
			lte(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			max(value, params) {
				return this.check(/* @__PURE__ */ _lte(value, params));
			},
			int(params) {
				return this.check(int(params));
			},
			safe(params) {
				return this.check(int(params));
			},
			positive(params) {
				return this.check(/* @__PURE__ */ _gt(0, params));
			},
			nonnegative(params) {
				return this.check(/* @__PURE__ */ _gte(0, params));
			},
			negative(params) {
				return this.check(/* @__PURE__ */ _lt(0, params));
			},
			nonpositive(params) {
				return this.check(/* @__PURE__ */ _lte(0, params));
			},
			multipleOf(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			step(value, params) {
				return this.check(/* @__PURE__ */ _multipleOf(value, params));
			},
			finite() {
				return this;
			}
		}));
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
		}, {
			min(n, params) {
				return this.check(/* @__PURE__ */ _minLength(n, params));
			},
			nonempty(params) {
				return this.check(/* @__PURE__ */ _minLength(1, params));
			},
			max(n, params) {
				return this.check(/* @__PURE__ */ _maxLength(n, params));
			},
			length(n, params) {
				return this.check(/* @__PURE__ */ _length(n, params));
			},
			unwrap() {
				return this.element;
			}
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
		}, {
			keyof() {
				return _enum(Object.keys(this._zod.def.shape));
			},
			catchall(catchall) {
				return this.clone(mergeDefs(this._zod.def, { catchall }));
			},
			passthrough() {
				return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
			},
			loose() {
				return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
			},
			strict() {
				return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
			},
			strip() {
				return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
			},
			extend(incoming) {
				return extend(this, incoming);
			},
			safeExtend(incoming) {
				return safeExtend(this, incoming);
			},
			merge(other) {
				return merge(this, other);
			},
			pick(mask) {
				return pick(this, mask);
			},
			omit(mask) {
				return omit(this, mask);
			},
			partial(...args) {
				return partial(ZodOptional, this, args[0]);
			},
			exactPartial(...args) {
				return partial(ZodExactOptional, this, args[0], "exactPartial");
			},
			required(...args) {
				return required(ZodNonOptional, this, args[0]);
			}
		});
		function object(shape, params) {
			const def = {
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			};
			return new ZodObject(def);
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = [...inst._zod.values];
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
			return new ZodEnum({
				type: "enum",
				entries,
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			_ensureDefaultMemoizer();
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						if (!("input" in _issue)) _issue.input = payload.value;
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					return payload;
				});
				payload.value = output;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		//#endregion
		//#region lib/typert-schemas.js
		const pkg = "@chatecnu-work/dsh-ecnu-cloud";
		const codec = (name, schema) => ({
			mode: "strict",
			typeSymbol: `${pkg}#${name}`,
			schema,
			create: () => schema
		});
		const id = string$2().min(1).max(256);
		const summary = object({
			conversationID: id,
			title: string$2().max(300),
			updatedAt: number(),
			projectID: id.nullable()
		}).strict();
		const message = object({
			messageID: id,
			role: _enum([
				"user",
				"assistant",
				"unsupported"
			]),
			text: string$2().max(1048576),
			at: number(),
			supported: boolean()
		}).strict();
		const input = codec("Input", object({
			lease: string$2().uuid(),
			page: number().int().min(1).max(1e4).optional(),
			conversationID: id.optional()
		}).strict());
		const result = codec("Result", object({
			state: string$2().max(64),
			lease: string$2().uuid().optional(),
			items: array(summary).max(20).optional(),
			page: number().int().optional(),
			hasMore: boolean().optional(),
			summary: summary.optional(),
			messages: array(message).max(1e3).optional(),
			importable: boolean().optional(),
			total: number().int().optional()
		}).strict());
		const importInput = codec("ImportInput", object({
			lease: string$2().uuid(),
			conversationID: id,
			workspaceID: id.optional(),
			snapshot: string$2().length(64).optional(),
			rememberProject: boolean().optional()
		}).strict());
		const importResult = codec("ImportResult", object({
			state: string$2().max(64),
			bindingState: string$2().max(64).optional(),
			sessionID: id.optional(),
			workspaceID: id.optional(),
			projectKey: id.optional(),
			pending: boolean().optional(),
			rememberProject: boolean().optional(),
			projectID: id.nullable().optional(),
			reused: boolean().optional()
		}).strict());
		const projectInput = codec("ProjectInput", object({
			lease: string$2().uuid(),
			projectKey: id.optional(),
			sourceID: number().int().positive().optional()
		}).strict());
		const project = object({
			projectKey: id,
			projectID: id.nullable(),
			title: string$2().max(300),
			description: string$2().max(1e3),
			updatedAt: number(),
			shared: boolean(),
			conversationCount: number().int()
		}).strict();
		const source = object({
			sourceID: number().int().positive(),
			title: string$2().max(500),
			type: string$2().max(40),
			status: string$2().max(40)
		}).strict();
		const projectResult = codec("ProjectResult", object({
			state: string$2().max(64),
			lease: string$2().uuid().optional(),
			projects: array(project).max(500).optional(),
			incomplete: boolean().optional(),
			projectKey: id.optional(),
			conversations: array(summary).max(2e3).optional(),
			sources: array(source).max(1e3).optional(),
			workspaceID: id.optional(),
			sourceID: number().int().optional(),
			text: string$2().max(2e5).optional(),
			empty: boolean().optional(),
			truncated: boolean().optional()
		}).strict());
		const workspaceInput = codec("WorkspaceInput", object({
			lease: string$2().uuid(),
			projectKey: id.optional(),
			workspaceID: id.optional()
		}).strict());
		const workspaceResult = codec("WorkspaceResult", object({
			state: string$2().max(64),
			bindingState: string$2().max(64).optional(),
			workspaceID: id.optional(),
			reused: boolean().optional(),
			bindings: array(object({
				projectKey: id,
				workspaceID: id,
				title: string$2().max(300)
			}).strict()).max(500).optional(),
			conversations: array(object({
				conversationID: id,
				sessionID: id,
				workspaceID: id,
				projectID: id.nullable()
			}).strict()).max(2e3).optional()
		}).strict());
		const workspaceMethods = [
			"cloudWorkspaceState",
			"cloudWorkspaceConnect",
			"cloudWorkspaceDisconnect",
			"cloudWorkspaceBindings"
		];
		//#endregion
		//#region lib/typert.remote-client.js
		var typert_remote_client_default = {
			package: "@chatecnu-work/dsh-ecnu-cloud",
			descriptors: [
				"cloudState",
				"cloudList",
				"cloudPreview",
				"cloudDestination",
				"cloudImport",
				"cloudProjects",
				"cloudProject",
				"cloudSource",
				...workspaceMethods
			].map((method) => ({
				id: `${pkg}#ecnuCloud/${method}`,
				service: "ecnuCloud",
				namespace: "ecnuCloud",
				method,
				invocation: { kind: "direct" },
				...[
					"cloudImport",
					"cloudProjects",
					"cloudProject",
					"cloudSource",
					...workspaceMethods
				].includes(method) ? { cancellation: { parameter: "signal" } } : {},
				parameters: method === "cloudState" ? [] : [{
					name: "input",
					wire: "input",
					source: "json",
					codec: workspaceMethods.includes(method) ? workspaceInput : [
						"cloudProjects",
						"cloudProject",
						"cloudSource"
					].includes(method) ? projectInput : ["cloudDestination", "cloudImport"].includes(method) ? importInput : input
				}],
				result: workspaceMethods.includes(method) ? workspaceResult : [
					"cloudProjects",
					"cloudProject",
					"cloudSource"
				].includes(method) ? projectResult : ["cloudDestination", "cloudImport"].includes(method) ? importResult : method === "cloudPreview" ? codec("Preview", result.schema.extend({ snapshot: string$2().length(64).optional() })) : result,
				sourceLocation: {
					file: "lib/index.js",
					line: 1,
					column: 1
				}
			}))
		};
		/**
		* The text one Workspace is labeled with. A Workspace still carrying the
		* automatic first-use title reads as the caller's localized default name; every
		* other title reads verbatim in every language. A title the user typed as
		* exactly {@link DEFAULT_WORKSPACE_DIRECTORY} is labeled as the default too;
		* nothing else depends on the distinction.
		* @param title - stored Workspace title.
		* @param localizedDefault - the default Workspace name in the active language.
		* @returns the title to display.
		*/
		function workspaceDisplayTitle(title, localizedDefault) {
			return title === "default-workspace" ? localizedDefault : title;
		}
		//#endregion
		//#region src/continuation.tsx
		const messages$1 = {
			history_changed: "云端历史已更新，请重新打开这段会话。草稿仍保留在此。",
			unsupported_history: "这段历史暂不能完整导入，可继续阅读。",
			missing_workspace: "原工作区已移除，请先恢复工作区。",
			missing_directory: "原工作区目录不可用，请先恢复目录。",
			project_missing_workspace: "项目工作区已移除，请先恢复工作区。",
			project_missing_directory: "项目工作区目录不可用，请先恢复目录。",
			missing_or_moved_session: "本地续聊已移出原工作区，请先恢复其位置。",
			binding_needs_repair: "本地续聊的关联需要修复，未创建重复会话。",
			project_workspace_mismatch: "这条会话之前接续到了其他工作区，需要先修复项目归属。不会重复导入。",
			project_mapping_unavailable: "项目关联暂未读取完整，请刷新云端项目后重试。",
			project_unbound: "请先设置此项目唯一的本地工作区。",
			workspace_already_linked: "这个工作区已关联其他项目，请选择另一个或新建工作区。",
			project_already_linked: "项目已关联其他工作区，请刷新后重试。",
			workspace_changed: "请先恢复上次导入使用的工作区。",
			account_changed: "学校登录状态已变化，请重新打开会话。"
		};
		const errorText$2 = (state) => messages$1[state] ?? "暂未完成，请重试。草稿和已保存的历史都会保留。";
		function Continuation({ preview, project, api, sendSession, createSession, changed, renderFactorySlot, useWorkspaces }) {
			const workspaces = useWorkspaces((state) => state.items);
			const [destination, setDestination] = (0, react.useState)(null), [busy, setBusy] = (0, react.useState)(false), [draft, setDraft] = (0, react.useState)("");
			const [workspaceID, setWorkspaceID] = (0, react.useState)(), [setup, setSetup] = (0, react.useState)(false);
			const [picker, setPicker] = (0, react.useState)(false), [failure, setFailure] = (0, react.useState)("");
			const anchor = (0, react.useRef)(null), active = (0, react.useRef)(true), request = (0, react.useRef)(null), lock = (0, react.useRef)(false), created = (0, react.useRef)(null);
			const isNew = !preview.summary.conversationID, isProject = !!project || !!preview.summary.projectID;
			const projectKey = project?.projectKey ?? destination?.projectKey;
			const input = {
				lease: preview.lease,
				conversationID: preview.summary.conversationID
			};
			(0, react.useEffect)(() => {
				active.current = true;
				(isNew ? api("cloudWorkspaceState", {
					lease: preview.lease,
					projectKey
				}) : api("cloudDestination", input)).then((value) => {
					if (!active.current) return;
					setDestination(value);
					setWorkspaceID(value.workspaceID ?? (!isProject ? workspaces.find((w) => w.title === "default-workspace")?.workspaceId ?? (workspaces.length === 1 ? workspaces[0].workspaceId : void 0) : void 0));
					if (value.state !== "available") setFailure(errorText$2(value.state));
				}).catch(() => {
					if (active.current) setFailure(errorText$2("unavailable"));
				});
				return () => {
					active.current = false;
					request.current?.abort();
				};
			}, []);
			const existing = !isNew && destination?.bindingState === "available";
			const unboundProject = isProject && ["unbound", "project_unbound"].includes(destination?.bindingState) && !destination?.workspaceID;
			const invalid = destination?.bindingState && ![
				"available",
				"unbound",
				"project_unbound"
			].includes(destination.bindingState);
			const selected = workspaces.find((item) => item.workspaceId === workspaceID);
			async function submit() {
				if (lock.current || !draft.trim()) return;
				if (unboundProject && !setup) {
					setSetup(true);
					return;
				}
				if (!selected && !existing) {
					setSetup(true);
					setPicker(true);
					return;
				}
				lock.current = true;
				setBusy(true);
				setFailure("");
				const controller = new AbortController();
				request.current = controller;
				const current = () => active.current && !controller.signal.aborted;
				try {
					let target = workspaceID;
					if (isProject) {
						const status = await api("cloudWorkspaceState", {
							lease: preview.lease,
							projectKey
						}, controller.signal);
						if (!current()) return;
						if (status.state !== "available") {
							setFailure(errorText$2(status.state));
							return;
						}
						if (status.bindingState === "unbound") {
							if (!setup || !target) {
								setSetup(true);
								return;
							}
							const linked = await api("cloudWorkspaceConnect", {
								lease: preview.lease,
								projectKey,
								workspaceID: target
							}, controller.signal);
							if (!current()) return;
							if (linked.state !== "available") {
								setFailure(errorText$2(linked.state));
								return;
							}
							target = linked.workspaceID;
							setDestination(linked);
							setWorkspaceID(target);
							changed?.();
						} else if (status.bindingState !== "available") {
							setFailure(errorText$2("project_" + status.bindingState));
							return;
						} else {
							target = status.workspaceID;
							setWorkspaceID(target);
						}
					}
					let result;
					if (isNew) {
						if (!created.current) created.current = await createSession(target, current);
						result = {
							state: "available",
							sessionID: created.current,
							workspaceID: target
						};
					} else result = await api("cloudImport", {
						...input,
						workspaceID: target,
						snapshot: preview.snapshot
					}, controller.signal);
					if (!current()) return;
					if (result.state !== "available") {
						setFailure(errorText$2(result.state));
						return;
					}
					if (isProject) {
						const grant = await api("cloudWorkspaceState", {
							lease: preview.lease,
							projectKey
						}, controller.signal);
						if (!current()) return;
						if (grant.state !== "available" || grant.bindingState !== "available" || grant.workspaceID !== target) {
							setFailure(errorText$2("project_workspace_mismatch"));
							return;
						}
					}
					await sendSession(result.sessionID, draft, current, preview.lease);
					if (current()) {
						setDraft("");
						changed?.();
					}
				} catch {
					if (current()) setFailure(errorText$2("unavailable"));
				} finally {
					lock.current = false;
					if (active.current) setBusy(false);
				}
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("footer", {
				className: "ecnu-continuation",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ecnu-continuation-inner",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ecnu-draft",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								"aria-label": isNew ? "在项目中新建会话" : "在 EduWork 继续这段对话",
								placeholder: isNew ? "基于这个项目，开始手边的工作…" : "继续这段对话…",
								rows: 2,
								value: draft,
								disabled: busy,
								maxLength: 2e4,
								onChange: (e) => setDraft(e.target.value),
								onKeyDown: (e) => {
									if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
										e.preventDefault();
										submit();
									}
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ecnu-draft-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ecnu-workspace-pick",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 15 }), isProject && !unboundProject ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "ecnu-caption",
										children: [project?.title || "项目工作区", " · 云端资料已关联"]
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										ref: anchor,
										variant: "ghost",
										size: "sm",
										disabled: busy || isProject && !setup,
										"aria-haspopup": "menu",
										"aria-expanded": picker,
										onClick: () => setPicker(true),
										title: selected?.path,
										children: [selected ? workspaceDisplayTitle(selected.title, "默认工作区") : isProject ? "首次发送时设置项目工作区" : "选择本地工作区", /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 13 })]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									ref: isProject && !setup ? anchor : void 0,
									variant: "primary",
									className: "ecnu-continue-primary",
									disabled: busy || !destination || destination.state !== "available" || invalid || !draft.trim() || !isNew && !preview.importable,
									onClick: () => void submit(),
									children: busy ? "正在接续…" : setup ? "确认并发送" : "在 EduWork 发送"
								})]
							})]
						}),
						setup && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ecnu-setup",
							role: "group",
							"aria-label": "首次本地接续设置",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: isProject ? "为项目设置一个本地工作区" : "选择本地保存位置" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: isProject ? "此项目的会话将在同一工作区继续，并可检索云端资料。选择目录不会下载全部资料。" : "后续消息和本地文件将保存在所选工作区。" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: busy,
									onClick: () => setPicker(true),
									children: "选择或新建工作区"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled: busy,
									onClick: () => {
										setSetup(false);
										setPicker(false);
									},
									children: "取消，保留草稿"
								})
							]
						}),
						renderFactorySlot("workspace.picker", {
							open: picker,
							anchorRef: anchor,
							selectedId: workspaceID,
							onPick: (id) => {
								setWorkspaceID(id);
								setPicker(false);
							},
							onClose: () => setPicker(false)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "ecnu-continue-note",
							children: [existing ? "继续已保存的本地会话。" : isNew ? "首次发送时建立本地会话。" : "首次发送时带入这段云端历史。", "后续消息保存在本地，不同步回 ChatECNU。"]
						}),
						invalid && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "ecnu-notice",
							children: errorText$2(destination.bindingState)
						}),
						failure && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							role: "alert",
							className: "ecnu-notice",
							children: failure
						})
					]
				})
			});
		}
		//#endregion
		//#region src/project-workspace.tsx
		const messages = {
			workspace_already_linked: "这个工作区已关联其他云端项目，请选择另一个或新建工作区。",
			project_already_linked: "这个项目已经关联工作区，请刷新关联状态后打开。",
			missing_workspace: "关联的工作区已移除。可先解除关联，再选择工作区。",
			missing_directory: "工作区目录暂不可用。请恢复目录，或解除关联后重新选择。",
			account_changed: "学校账号已变化，请重新打开项目。",
			permission_denied: "当前账号暂时无法读取这个项目。",
			rate_limited: "项目查询较多，请稍后重试。"
		};
		const errorText$1 = (state) => messages[state] ?? "暂未完成关联，请重试。已创建的本地工作区会保留。";
		/** Local grants stay manageable even after the cloud project is no longer visible. */
		function WorkspaceBindings({ lease, api, useWorkspaces, changed }) {
			const workspaces = useWorkspaces((state) => state.items);
			const [bindings, setBindings] = (0, react.useState)([]), [error, setError] = (0, react.useState)(""), [busy, setBusy] = (0, react.useState)(false);
			const request = (0, react.useRef)(null);
			async function refresh() {
				const controller = new AbortController();
				request.current?.abort();
				request.current = controller;
				setBusy(true);
				setError("");
				try {
					const value = await api("cloudWorkspaceBindings", { lease }, controller.signal);
					if (controller.signal.aborted) return;
					if (value.state !== "available") setError("暂时无法读取本地关联，可稍后重试。");
					else setBindings(value.bindings);
				} catch {
					if (!controller.signal.aborted) setError("暂时无法读取本地关联，可稍后重试。");
				} finally {
					if (!controller.signal.aborted) setBusy(false);
				}
			}
			(0, react.useEffect)(() => {
				refresh();
				return () => {
					request.current?.abort();
				};
			}, [lease]);
			async function disconnect(row) {
				const controller = new AbortController();
				request.current?.abort();
				request.current = controller;
				setBusy(true);
				setError("");
				try {
					const value = await api("cloudWorkspaceDisconnect", {
						lease,
						projectKey: row.projectKey,
						workspaceID: row.workspaceID
					}, controller.signal);
					if (controller.signal.aborted) return;
					if (value.state !== "available") setError(errorText$1(value.state));
					else {
						setBindings((old) => old.filter((item) => item !== row));
						changed?.();
					}
				} catch {
					if (!controller.signal.aborted) setError(errorText$1("unavailable"));
				} finally {
					if (!controller.signal.aborted) setBusy(false);
				}
			}
			if (!bindings.length && !error) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "ecnu-local-bindings",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: ["已关联工作区", bindings.length ? ` · ${bindings.length}` : ""] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ecnu-caption",
						children: "解除关联仅停止此工作区的项目检索，保留本地任务和文件。"
					}),
					bindings.map((row) => {
						const workspace = workspaces.find((item) => item.workspaceId === row.workspaceID);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ecnu-project-workspace-foot",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								row.title,
								" · ",
								workspace ? workspaceDisplayTitle(workspace.title, "默认工作区") : "已移除的工作区"
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: busy,
								"aria-label": `解除 ${row.title} 的工作区关联`,
								onClick: () => void disconnect(row),
								children: "解除关联"
							})]
						}, row.workspaceID);
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						role: "alert",
						className: "ecnu-notice",
						children: [error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							disabled: busy,
							onClick: () => void refresh(),
							children: "重试"
						})]
					})
				]
			});
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/mdast-util-to-string/lib/index.js
		/**
		* @typedef {import('mdast').Nodes} Nodes
		*
		* @typedef Options
		*   Configuration (optional).
		* @property {boolean | null | undefined} [includeImageAlt=true]
		*   Whether to use `alt` for `image`s (default: `true`).
		* @property {boolean | null | undefined} [includeHtml=true]
		*   Whether to use `value` of HTML (default: `true`).
		*/
		/** @type {Options} */
		const emptyOptions = {};
		/**
		* Get the text content of a node or list of nodes.
		*
		* Prefers the node’s plain-text fields, otherwise serializes its children,
		* and if the given value is an array, serialize the nodes in it.
		*
		* @param {unknown} [value]
		*   Thing to serialize, typically `Node`.
		* @param {Options | null | undefined} [options]
		*   Configuration (optional).
		* @returns {string}
		*   Serialized `value`.
		*/
		function toString(value, options) {
			const settings = options || emptyOptions;
			return one(value, typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true, typeof settings.includeHtml === "boolean" ? settings.includeHtml : true);
		}
		/**
		* One node or several nodes.
		*
		* @param {unknown} value
		*   Thing to serialize.
		* @param {boolean} includeImageAlt
		*   Include image `alt`s.
		* @param {boolean} includeHtml
		*   Include HTML.
		* @returns {string}
		*   Serialized node.
		*/
		function one(value, includeImageAlt, includeHtml) {
			if (node(value)) {
				if ("value" in value) return value.type === "html" && !includeHtml ? "" : value.value;
				if (includeImageAlt && "alt" in value && value.alt) return value.alt;
				if ("children" in value) return all(value.children, includeImageAlt, includeHtml);
			}
			if (Array.isArray(value)) return all(value, includeImageAlt, includeHtml);
			return "";
		}
		/**
		* Serialize a list of nodes.
		*
		* @param {Array<unknown>} values
		*   Thing to serialize.
		* @param {boolean} includeImageAlt
		*   Include image `alt`s.
		* @param {boolean} includeHtml
		*   Include HTML.
		* @returns {string}
		*   Serialized nodes.
		*/
		function all(values, includeImageAlt, includeHtml) {
			/** @type {Array<string>} */
			const result = [];
			let index = -1;
			while (++index < values.length) result[index] = one(values[index], includeImageAlt, includeHtml);
			return result.join("");
		}
		/**
		* Check if `value` looks like a node.
		*
		* @param {unknown} value
		*   Thing.
		* @returns {value is Nodes}
		*   Whether `value` is a node.
		*/
		function node(value) {
			return Boolean(value && typeof value === "object");
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/character-entities/index.js
		/**
		* Map of named character references.
		*
		* @type {Record<string, string>}
		*/
		const characterEntities = {
			AElig: "Æ",
			AMP: "&",
			Aacute: "Á",
			Abreve: "Ă",
			Acirc: "Â",
			Acy: "А",
			Afr: "𝔄",
			Agrave: "À",
			Alpha: "Α",
			Amacr: "Ā",
			And: "⩓",
			Aogon: "Ą",
			Aopf: "𝔸",
			ApplyFunction: "⁡",
			Aring: "Å",
			Ascr: "𝒜",
			Assign: "≔",
			Atilde: "Ã",
			Auml: "Ä",
			Backslash: "∖",
			Barv: "⫧",
			Barwed: "⌆",
			Bcy: "Б",
			Because: "∵",
			Bernoullis: "ℬ",
			Beta: "Β",
			Bfr: "𝔅",
			Bopf: "𝔹",
			Breve: "˘",
			Bscr: "ℬ",
			Bumpeq: "≎",
			CHcy: "Ч",
			COPY: "©",
			Cacute: "Ć",
			Cap: "⋒",
			CapitalDifferentialD: "ⅅ",
			Cayleys: "ℭ",
			Ccaron: "Č",
			Ccedil: "Ç",
			Ccirc: "Ĉ",
			Cconint: "∰",
			Cdot: "Ċ",
			Cedilla: "¸",
			CenterDot: "·",
			Cfr: "ℭ",
			Chi: "Χ",
			CircleDot: "⊙",
			CircleMinus: "⊖",
			CirclePlus: "⊕",
			CircleTimes: "⊗",
			ClockwiseContourIntegral: "∲",
			CloseCurlyDoubleQuote: "”",
			CloseCurlyQuote: "’",
			Colon: "∷",
			Colone: "⩴",
			Congruent: "≡",
			Conint: "∯",
			ContourIntegral: "∮",
			Copf: "ℂ",
			Coproduct: "∐",
			CounterClockwiseContourIntegral: "∳",
			Cross: "⨯",
			Cscr: "𝒞",
			Cup: "⋓",
			CupCap: "≍",
			DD: "ⅅ",
			DDotrahd: "⤑",
			DJcy: "Ђ",
			DScy: "Ѕ",
			DZcy: "Џ",
			Dagger: "‡",
			Darr: "↡",
			Dashv: "⫤",
			Dcaron: "Ď",
			Dcy: "Д",
			Del: "∇",
			Delta: "Δ",
			Dfr: "𝔇",
			DiacriticalAcute: "´",
			DiacriticalDot: "˙",
			DiacriticalDoubleAcute: "˝",
			DiacriticalGrave: "`",
			DiacriticalTilde: "˜",
			Diamond: "⋄",
			DifferentialD: "ⅆ",
			Dopf: "𝔻",
			Dot: "¨",
			DotDot: "⃜",
			DotEqual: "≐",
			DoubleContourIntegral: "∯",
			DoubleDot: "¨",
			DoubleDownArrow: "⇓",
			DoubleLeftArrow: "⇐",
			DoubleLeftRightArrow: "⇔",
			DoubleLeftTee: "⫤",
			DoubleLongLeftArrow: "⟸",
			DoubleLongLeftRightArrow: "⟺",
			DoubleLongRightArrow: "⟹",
			DoubleRightArrow: "⇒",
			DoubleRightTee: "⊨",
			DoubleUpArrow: "⇑",
			DoubleUpDownArrow: "⇕",
			DoubleVerticalBar: "∥",
			DownArrow: "↓",
			DownArrowBar: "⤓",
			DownArrowUpArrow: "⇵",
			DownBreve: "̑",
			DownLeftRightVector: "⥐",
			DownLeftTeeVector: "⥞",
			DownLeftVector: "↽",
			DownLeftVectorBar: "⥖",
			DownRightTeeVector: "⥟",
			DownRightVector: "⇁",
			DownRightVectorBar: "⥗",
			DownTee: "⊤",
			DownTeeArrow: "↧",
			Downarrow: "⇓",
			Dscr: "𝒟",
			Dstrok: "Đ",
			ENG: "Ŋ",
			ETH: "Ð",
			Eacute: "É",
			Ecaron: "Ě",
			Ecirc: "Ê",
			Ecy: "Э",
			Edot: "Ė",
			Efr: "𝔈",
			Egrave: "È",
			Element: "∈",
			Emacr: "Ē",
			EmptySmallSquare: "◻",
			EmptyVerySmallSquare: "▫",
			Eogon: "Ę",
			Eopf: "𝔼",
			Epsilon: "Ε",
			Equal: "⩵",
			EqualTilde: "≂",
			Equilibrium: "⇌",
			Escr: "ℰ",
			Esim: "⩳",
			Eta: "Η",
			Euml: "Ë",
			Exists: "∃",
			ExponentialE: "ⅇ",
			Fcy: "Ф",
			Ffr: "𝔉",
			FilledSmallSquare: "◼",
			FilledVerySmallSquare: "▪",
			Fopf: "𝔽",
			ForAll: "∀",
			Fouriertrf: "ℱ",
			Fscr: "ℱ",
			GJcy: "Ѓ",
			GT: ">",
			Gamma: "Γ",
			Gammad: "Ϝ",
			Gbreve: "Ğ",
			Gcedil: "Ģ",
			Gcirc: "Ĝ",
			Gcy: "Г",
			Gdot: "Ġ",
			Gfr: "𝔊",
			Gg: "⋙",
			Gopf: "𝔾",
			GreaterEqual: "≥",
			GreaterEqualLess: "⋛",
			GreaterFullEqual: "≧",
			GreaterGreater: "⪢",
			GreaterLess: "≷",
			GreaterSlantEqual: "⩾",
			GreaterTilde: "≳",
			Gscr: "𝒢",
			Gt: "≫",
			HARDcy: "Ъ",
			Hacek: "ˇ",
			Hat: "^",
			Hcirc: "Ĥ",
			Hfr: "ℌ",
			HilbertSpace: "ℋ",
			Hopf: "ℍ",
			HorizontalLine: "─",
			Hscr: "ℋ",
			Hstrok: "Ħ",
			HumpDownHump: "≎",
			HumpEqual: "≏",
			IEcy: "Е",
			IJlig: "Ĳ",
			IOcy: "Ё",
			Iacute: "Í",
			Icirc: "Î",
			Icy: "И",
			Idot: "İ",
			Ifr: "ℑ",
			Igrave: "Ì",
			Im: "ℑ",
			Imacr: "Ī",
			ImaginaryI: "ⅈ",
			Implies: "⇒",
			Int: "∬",
			Integral: "∫",
			Intersection: "⋂",
			InvisibleComma: "⁣",
			InvisibleTimes: "⁢",
			Iogon: "Į",
			Iopf: "𝕀",
			Iota: "Ι",
			Iscr: "ℐ",
			Itilde: "Ĩ",
			Iukcy: "І",
			Iuml: "Ï",
			Jcirc: "Ĵ",
			Jcy: "Й",
			Jfr: "𝔍",
			Jopf: "𝕁",
			Jscr: "𝒥",
			Jsercy: "Ј",
			Jukcy: "Є",
			KHcy: "Х",
			KJcy: "Ќ",
			Kappa: "Κ",
			Kcedil: "Ķ",
			Kcy: "К",
			Kfr: "𝔎",
			Kopf: "𝕂",
			Kscr: "𝒦",
			LJcy: "Љ",
			LT: "<",
			Lacute: "Ĺ",
			Lambda: "Λ",
			Lang: "⟪",
			Laplacetrf: "ℒ",
			Larr: "↞",
			Lcaron: "Ľ",
			Lcedil: "Ļ",
			Lcy: "Л",
			LeftAngleBracket: "⟨",
			LeftArrow: "←",
			LeftArrowBar: "⇤",
			LeftArrowRightArrow: "⇆",
			LeftCeiling: "⌈",
			LeftDoubleBracket: "⟦",
			LeftDownTeeVector: "⥡",
			LeftDownVector: "⇃",
			LeftDownVectorBar: "⥙",
			LeftFloor: "⌊",
			LeftRightArrow: "↔",
			LeftRightVector: "⥎",
			LeftTee: "⊣",
			LeftTeeArrow: "↤",
			LeftTeeVector: "⥚",
			LeftTriangle: "⊲",
			LeftTriangleBar: "⧏",
			LeftTriangleEqual: "⊴",
			LeftUpDownVector: "⥑",
			LeftUpTeeVector: "⥠",
			LeftUpVector: "↿",
			LeftUpVectorBar: "⥘",
			LeftVector: "↼",
			LeftVectorBar: "⥒",
			Leftarrow: "⇐",
			Leftrightarrow: "⇔",
			LessEqualGreater: "⋚",
			LessFullEqual: "≦",
			LessGreater: "≶",
			LessLess: "⪡",
			LessSlantEqual: "⩽",
			LessTilde: "≲",
			Lfr: "𝔏",
			Ll: "⋘",
			Lleftarrow: "⇚",
			Lmidot: "Ŀ",
			LongLeftArrow: "⟵",
			LongLeftRightArrow: "⟷",
			LongRightArrow: "⟶",
			Longleftarrow: "⟸",
			Longleftrightarrow: "⟺",
			Longrightarrow: "⟹",
			Lopf: "𝕃",
			LowerLeftArrow: "↙",
			LowerRightArrow: "↘",
			Lscr: "ℒ",
			Lsh: "↰",
			Lstrok: "Ł",
			Lt: "≪",
			Map: "⤅",
			Mcy: "М",
			MediumSpace: " ",
			Mellintrf: "ℳ",
			Mfr: "𝔐",
			MinusPlus: "∓",
			Mopf: "𝕄",
			Mscr: "ℳ",
			Mu: "Μ",
			NJcy: "Њ",
			Nacute: "Ń",
			Ncaron: "Ň",
			Ncedil: "Ņ",
			Ncy: "Н",
			NegativeMediumSpace: "​",
			NegativeThickSpace: "​",
			NegativeThinSpace: "​",
			NegativeVeryThinSpace: "​",
			NestedGreaterGreater: "≫",
			NestedLessLess: "≪",
			NewLine: "\n",
			Nfr: "𝔑",
			NoBreak: "⁠",
			NonBreakingSpace: "\xA0",
			Nopf: "ℕ",
			Not: "⫬",
			NotCongruent: "≢",
			NotCupCap: "≭",
			NotDoubleVerticalBar: "∦",
			NotElement: "∉",
			NotEqual: "≠",
			NotEqualTilde: "≂̸",
			NotExists: "∄",
			NotGreater: "≯",
			NotGreaterEqual: "≱",
			NotGreaterFullEqual: "≧̸",
			NotGreaterGreater: "≫̸",
			NotGreaterLess: "≹",
			NotGreaterSlantEqual: "⩾̸",
			NotGreaterTilde: "≵",
			NotHumpDownHump: "≎̸",
			NotHumpEqual: "≏̸",
			NotLeftTriangle: "⋪",
			NotLeftTriangleBar: "⧏̸",
			NotLeftTriangleEqual: "⋬",
			NotLess: "≮",
			NotLessEqual: "≰",
			NotLessGreater: "≸",
			NotLessLess: "≪̸",
			NotLessSlantEqual: "⩽̸",
			NotLessTilde: "≴",
			NotNestedGreaterGreater: "⪢̸",
			NotNestedLessLess: "⪡̸",
			NotPrecedes: "⊀",
			NotPrecedesEqual: "⪯̸",
			NotPrecedesSlantEqual: "⋠",
			NotReverseElement: "∌",
			NotRightTriangle: "⋫",
			NotRightTriangleBar: "⧐̸",
			NotRightTriangleEqual: "⋭",
			NotSquareSubset: "⊏̸",
			NotSquareSubsetEqual: "⋢",
			NotSquareSuperset: "⊐̸",
			NotSquareSupersetEqual: "⋣",
			NotSubset: "⊂⃒",
			NotSubsetEqual: "⊈",
			NotSucceeds: "⊁",
			NotSucceedsEqual: "⪰̸",
			NotSucceedsSlantEqual: "⋡",
			NotSucceedsTilde: "≿̸",
			NotSuperset: "⊃⃒",
			NotSupersetEqual: "⊉",
			NotTilde: "≁",
			NotTildeEqual: "≄",
			NotTildeFullEqual: "≇",
			NotTildeTilde: "≉",
			NotVerticalBar: "∤",
			Nscr: "𝒩",
			Ntilde: "Ñ",
			Nu: "Ν",
			OElig: "Œ",
			Oacute: "Ó",
			Ocirc: "Ô",
			Ocy: "О",
			Odblac: "Ő",
			Ofr: "𝔒",
			Ograve: "Ò",
			Omacr: "Ō",
			Omega: "Ω",
			Omicron: "Ο",
			Oopf: "𝕆",
			OpenCurlyDoubleQuote: "“",
			OpenCurlyQuote: "‘",
			Or: "⩔",
			Oscr: "𝒪",
			Oslash: "Ø",
			Otilde: "Õ",
			Otimes: "⨷",
			Ouml: "Ö",
			OverBar: "‾",
			OverBrace: "⏞",
			OverBracket: "⎴",
			OverParenthesis: "⏜",
			PartialD: "∂",
			Pcy: "П",
			Pfr: "𝔓",
			Phi: "Φ",
			Pi: "Π",
			PlusMinus: "±",
			Poincareplane: "ℌ",
			Popf: "ℙ",
			Pr: "⪻",
			Precedes: "≺",
			PrecedesEqual: "⪯",
			PrecedesSlantEqual: "≼",
			PrecedesTilde: "≾",
			Prime: "″",
			Product: "∏",
			Proportion: "∷",
			Proportional: "∝",
			Pscr: "𝒫",
			Psi: "Ψ",
			QUOT: "\"",
			Qfr: "𝔔",
			Qopf: "ℚ",
			Qscr: "𝒬",
			RBarr: "⤐",
			REG: "®",
			Racute: "Ŕ",
			Rang: "⟫",
			Rarr: "↠",
			Rarrtl: "⤖",
			Rcaron: "Ř",
			Rcedil: "Ŗ",
			Rcy: "Р",
			Re: "ℜ",
			ReverseElement: "∋",
			ReverseEquilibrium: "⇋",
			ReverseUpEquilibrium: "⥯",
			Rfr: "ℜ",
			Rho: "Ρ",
			RightAngleBracket: "⟩",
			RightArrow: "→",
			RightArrowBar: "⇥",
			RightArrowLeftArrow: "⇄",
			RightCeiling: "⌉",
			RightDoubleBracket: "⟧",
			RightDownTeeVector: "⥝",
			RightDownVector: "⇂",
			RightDownVectorBar: "⥕",
			RightFloor: "⌋",
			RightTee: "⊢",
			RightTeeArrow: "↦",
			RightTeeVector: "⥛",
			RightTriangle: "⊳",
			RightTriangleBar: "⧐",
			RightTriangleEqual: "⊵",
			RightUpDownVector: "⥏",
			RightUpTeeVector: "⥜",
			RightUpVector: "↾",
			RightUpVectorBar: "⥔",
			RightVector: "⇀",
			RightVectorBar: "⥓",
			Rightarrow: "⇒",
			Ropf: "ℝ",
			RoundImplies: "⥰",
			Rrightarrow: "⇛",
			Rscr: "ℛ",
			Rsh: "↱",
			RuleDelayed: "⧴",
			SHCHcy: "Щ",
			SHcy: "Ш",
			SOFTcy: "Ь",
			Sacute: "Ś",
			Sc: "⪼",
			Scaron: "Š",
			Scedil: "Ş",
			Scirc: "Ŝ",
			Scy: "С",
			Sfr: "𝔖",
			ShortDownArrow: "↓",
			ShortLeftArrow: "←",
			ShortRightArrow: "→",
			ShortUpArrow: "↑",
			Sigma: "Σ",
			SmallCircle: "∘",
			Sopf: "𝕊",
			Sqrt: "√",
			Square: "□",
			SquareIntersection: "⊓",
			SquareSubset: "⊏",
			SquareSubsetEqual: "⊑",
			SquareSuperset: "⊐",
			SquareSupersetEqual: "⊒",
			SquareUnion: "⊔",
			Sscr: "𝒮",
			Star: "⋆",
			Sub: "⋐",
			Subset: "⋐",
			SubsetEqual: "⊆",
			Succeeds: "≻",
			SucceedsEqual: "⪰",
			SucceedsSlantEqual: "≽",
			SucceedsTilde: "≿",
			SuchThat: "∋",
			Sum: "∑",
			Sup: "⋑",
			Superset: "⊃",
			SupersetEqual: "⊇",
			Supset: "⋑",
			THORN: "Þ",
			TRADE: "™",
			TSHcy: "Ћ",
			TScy: "Ц",
			Tab: "	",
			Tau: "Τ",
			Tcaron: "Ť",
			Tcedil: "Ţ",
			Tcy: "Т",
			Tfr: "𝔗",
			Therefore: "∴",
			Theta: "Θ",
			ThickSpace: "  ",
			ThinSpace: " ",
			Tilde: "∼",
			TildeEqual: "≃",
			TildeFullEqual: "≅",
			TildeTilde: "≈",
			Topf: "𝕋",
			TripleDot: "⃛",
			Tscr: "𝒯",
			Tstrok: "Ŧ",
			Uacute: "Ú",
			Uarr: "↟",
			Uarrocir: "⥉",
			Ubrcy: "Ў",
			Ubreve: "Ŭ",
			Ucirc: "Û",
			Ucy: "У",
			Udblac: "Ű",
			Ufr: "𝔘",
			Ugrave: "Ù",
			Umacr: "Ū",
			UnderBar: "_",
			UnderBrace: "⏟",
			UnderBracket: "⎵",
			UnderParenthesis: "⏝",
			Union: "⋃",
			UnionPlus: "⊎",
			Uogon: "Ų",
			Uopf: "𝕌",
			UpArrow: "↑",
			UpArrowBar: "⤒",
			UpArrowDownArrow: "⇅",
			UpDownArrow: "↕",
			UpEquilibrium: "⥮",
			UpTee: "⊥",
			UpTeeArrow: "↥",
			Uparrow: "⇑",
			Updownarrow: "⇕",
			UpperLeftArrow: "↖",
			UpperRightArrow: "↗",
			Upsi: "ϒ",
			Upsilon: "Υ",
			Uring: "Ů",
			Uscr: "𝒰",
			Utilde: "Ũ",
			Uuml: "Ü",
			VDash: "⊫",
			Vbar: "⫫",
			Vcy: "В",
			Vdash: "⊩",
			Vdashl: "⫦",
			Vee: "⋁",
			Verbar: "‖",
			Vert: "‖",
			VerticalBar: "∣",
			VerticalLine: "|",
			VerticalSeparator: "❘",
			VerticalTilde: "≀",
			VeryThinSpace: " ",
			Vfr: "𝔙",
			Vopf: "𝕍",
			Vscr: "𝒱",
			Vvdash: "⊪",
			Wcirc: "Ŵ",
			Wedge: "⋀",
			Wfr: "𝔚",
			Wopf: "𝕎",
			Wscr: "𝒲",
			Xfr: "𝔛",
			Xi: "Ξ",
			Xopf: "𝕏",
			Xscr: "𝒳",
			YAcy: "Я",
			YIcy: "Ї",
			YUcy: "Ю",
			Yacute: "Ý",
			Ycirc: "Ŷ",
			Ycy: "Ы",
			Yfr: "𝔜",
			Yopf: "𝕐",
			Yscr: "𝒴",
			Yuml: "Ÿ",
			ZHcy: "Ж",
			Zacute: "Ź",
			Zcaron: "Ž",
			Zcy: "З",
			Zdot: "Ż",
			ZeroWidthSpace: "​",
			Zeta: "Ζ",
			Zfr: "ℨ",
			Zopf: "ℤ",
			Zscr: "𝒵",
			aacute: "á",
			abreve: "ă",
			ac: "∾",
			acE: "∾̳",
			acd: "∿",
			acirc: "â",
			acute: "´",
			acy: "а",
			aelig: "æ",
			af: "⁡",
			afr: "𝔞",
			agrave: "à",
			alefsym: "ℵ",
			aleph: "ℵ",
			alpha: "α",
			amacr: "ā",
			amalg: "⨿",
			amp: "&",
			and: "∧",
			andand: "⩕",
			andd: "⩜",
			andslope: "⩘",
			andv: "⩚",
			ang: "∠",
			ange: "⦤",
			angle: "∠",
			angmsd: "∡",
			angmsdaa: "⦨",
			angmsdab: "⦩",
			angmsdac: "⦪",
			angmsdad: "⦫",
			angmsdae: "⦬",
			angmsdaf: "⦭",
			angmsdag: "⦮",
			angmsdah: "⦯",
			angrt: "∟",
			angrtvb: "⊾",
			angrtvbd: "⦝",
			angsph: "∢",
			angst: "Å",
			angzarr: "⍼",
			aogon: "ą",
			aopf: "𝕒",
			ap: "≈",
			apE: "⩰",
			apacir: "⩯",
			ape: "≊",
			apid: "≋",
			apos: "'",
			approx: "≈",
			approxeq: "≊",
			aring: "å",
			ascr: "𝒶",
			ast: "*",
			asymp: "≈",
			asympeq: "≍",
			atilde: "ã",
			auml: "ä",
			awconint: "∳",
			awint: "⨑",
			bNot: "⫭",
			backcong: "≌",
			backepsilon: "϶",
			backprime: "‵",
			backsim: "∽",
			backsimeq: "⋍",
			barvee: "⊽",
			barwed: "⌅",
			barwedge: "⌅",
			bbrk: "⎵",
			bbrktbrk: "⎶",
			bcong: "≌",
			bcy: "б",
			bdquo: "„",
			becaus: "∵",
			because: "∵",
			bemptyv: "⦰",
			bepsi: "϶",
			bernou: "ℬ",
			beta: "β",
			beth: "ℶ",
			between: "≬",
			bfr: "𝔟",
			bigcap: "⋂",
			bigcirc: "◯",
			bigcup: "⋃",
			bigodot: "⨀",
			bigoplus: "⨁",
			bigotimes: "⨂",
			bigsqcup: "⨆",
			bigstar: "★",
			bigtriangledown: "▽",
			bigtriangleup: "△",
			biguplus: "⨄",
			bigvee: "⋁",
			bigwedge: "⋀",
			bkarow: "⤍",
			blacklozenge: "⧫",
			blacksquare: "▪",
			blacktriangle: "▴",
			blacktriangledown: "▾",
			blacktriangleleft: "◂",
			blacktriangleright: "▸",
			blank: "␣",
			blk12: "▒",
			blk14: "░",
			blk34: "▓",
			block: "█",
			bne: "=⃥",
			bnequiv: "≡⃥",
			bnot: "⌐",
			bopf: "𝕓",
			bot: "⊥",
			bottom: "⊥",
			bowtie: "⋈",
			boxDL: "╗",
			boxDR: "╔",
			boxDl: "╖",
			boxDr: "╓",
			boxH: "═",
			boxHD: "╦",
			boxHU: "╩",
			boxHd: "╤",
			boxHu: "╧",
			boxUL: "╝",
			boxUR: "╚",
			boxUl: "╜",
			boxUr: "╙",
			boxV: "║",
			boxVH: "╬",
			boxVL: "╣",
			boxVR: "╠",
			boxVh: "╫",
			boxVl: "╢",
			boxVr: "╟",
			boxbox: "⧉",
			boxdL: "╕",
			boxdR: "╒",
			boxdl: "┐",
			boxdr: "┌",
			boxh: "─",
			boxhD: "╥",
			boxhU: "╨",
			boxhd: "┬",
			boxhu: "┴",
			boxminus: "⊟",
			boxplus: "⊞",
			boxtimes: "⊠",
			boxuL: "╛",
			boxuR: "╘",
			boxul: "┘",
			boxur: "└",
			boxv: "│",
			boxvH: "╪",
			boxvL: "╡",
			boxvR: "╞",
			boxvh: "┼",
			boxvl: "┤",
			boxvr: "├",
			bprime: "‵",
			breve: "˘",
			brvbar: "¦",
			bscr: "𝒷",
			bsemi: "⁏",
			bsim: "∽",
			bsime: "⋍",
			bsol: "\\",
			bsolb: "⧅",
			bsolhsub: "⟈",
			bull: "•",
			bullet: "•",
			bump: "≎",
			bumpE: "⪮",
			bumpe: "≏",
			bumpeq: "≏",
			cacute: "ć",
			cap: "∩",
			capand: "⩄",
			capbrcup: "⩉",
			capcap: "⩋",
			capcup: "⩇",
			capdot: "⩀",
			caps: "∩︀",
			caret: "⁁",
			caron: "ˇ",
			ccaps: "⩍",
			ccaron: "č",
			ccedil: "ç",
			ccirc: "ĉ",
			ccups: "⩌",
			ccupssm: "⩐",
			cdot: "ċ",
			cedil: "¸",
			cemptyv: "⦲",
			cent: "¢",
			centerdot: "·",
			cfr: "𝔠",
			chcy: "ч",
			check: "✓",
			checkmark: "✓",
			chi: "χ",
			cir: "○",
			cirE: "⧃",
			circ: "ˆ",
			circeq: "≗",
			circlearrowleft: "↺",
			circlearrowright: "↻",
			circledR: "®",
			circledS: "Ⓢ",
			circledast: "⊛",
			circledcirc: "⊚",
			circleddash: "⊝",
			cire: "≗",
			cirfnint: "⨐",
			cirmid: "⫯",
			cirscir: "⧂",
			clubs: "♣",
			clubsuit: "♣",
			colon: ":",
			colone: "≔",
			coloneq: "≔",
			comma: ",",
			commat: "@",
			comp: "∁",
			compfn: "∘",
			complement: "∁",
			complexes: "ℂ",
			cong: "≅",
			congdot: "⩭",
			conint: "∮",
			copf: "𝕔",
			coprod: "∐",
			copy: "©",
			copysr: "℗",
			crarr: "↵",
			cross: "✗",
			cscr: "𝒸",
			csub: "⫏",
			csube: "⫑",
			csup: "⫐",
			csupe: "⫒",
			ctdot: "⋯",
			cudarrl: "⤸",
			cudarrr: "⤵",
			cuepr: "⋞",
			cuesc: "⋟",
			cularr: "↶",
			cularrp: "⤽",
			cup: "∪",
			cupbrcap: "⩈",
			cupcap: "⩆",
			cupcup: "⩊",
			cupdot: "⊍",
			cupor: "⩅",
			cups: "∪︀",
			curarr: "↷",
			curarrm: "⤼",
			curlyeqprec: "⋞",
			curlyeqsucc: "⋟",
			curlyvee: "⋎",
			curlywedge: "⋏",
			curren: "¤",
			curvearrowleft: "↶",
			curvearrowright: "↷",
			cuvee: "⋎",
			cuwed: "⋏",
			cwconint: "∲",
			cwint: "∱",
			cylcty: "⌭",
			dArr: "⇓",
			dHar: "⥥",
			dagger: "†",
			daleth: "ℸ",
			darr: "↓",
			dash: "‐",
			dashv: "⊣",
			dbkarow: "⤏",
			dblac: "˝",
			dcaron: "ď",
			dcy: "д",
			dd: "ⅆ",
			ddagger: "‡",
			ddarr: "⇊",
			ddotseq: "⩷",
			deg: "°",
			delta: "δ",
			demptyv: "⦱",
			dfisht: "⥿",
			dfr: "𝔡",
			dharl: "⇃",
			dharr: "⇂",
			diam: "⋄",
			diamond: "⋄",
			diamondsuit: "♦",
			diams: "♦",
			die: "¨",
			digamma: "ϝ",
			disin: "⋲",
			div: "÷",
			divide: "÷",
			divideontimes: "⋇",
			divonx: "⋇",
			djcy: "ђ",
			dlcorn: "⌞",
			dlcrop: "⌍",
			dollar: "$",
			dopf: "𝕕",
			dot: "˙",
			doteq: "≐",
			doteqdot: "≑",
			dotminus: "∸",
			dotplus: "∔",
			dotsquare: "⊡",
			doublebarwedge: "⌆",
			downarrow: "↓",
			downdownarrows: "⇊",
			downharpoonleft: "⇃",
			downharpoonright: "⇂",
			drbkarow: "⤐",
			drcorn: "⌟",
			drcrop: "⌌",
			dscr: "𝒹",
			dscy: "ѕ",
			dsol: "⧶",
			dstrok: "đ",
			dtdot: "⋱",
			dtri: "▿",
			dtrif: "▾",
			duarr: "⇵",
			duhar: "⥯",
			dwangle: "⦦",
			dzcy: "џ",
			dzigrarr: "⟿",
			eDDot: "⩷",
			eDot: "≑",
			eacute: "é",
			easter: "⩮",
			ecaron: "ě",
			ecir: "≖",
			ecirc: "ê",
			ecolon: "≕",
			ecy: "э",
			edot: "ė",
			ee: "ⅇ",
			efDot: "≒",
			efr: "𝔢",
			eg: "⪚",
			egrave: "è",
			egs: "⪖",
			egsdot: "⪘",
			el: "⪙",
			elinters: "⏧",
			ell: "ℓ",
			els: "⪕",
			elsdot: "⪗",
			emacr: "ē",
			empty: "∅",
			emptyset: "∅",
			emptyv: "∅",
			emsp13: " ",
			emsp14: " ",
			emsp: " ",
			eng: "ŋ",
			ensp: " ",
			eogon: "ę",
			eopf: "𝕖",
			epar: "⋕",
			eparsl: "⧣",
			eplus: "⩱",
			epsi: "ε",
			epsilon: "ε",
			epsiv: "ϵ",
			eqcirc: "≖",
			eqcolon: "≕",
			eqsim: "≂",
			eqslantgtr: "⪖",
			eqslantless: "⪕",
			equals: "=",
			equest: "≟",
			equiv: "≡",
			equivDD: "⩸",
			eqvparsl: "⧥",
			erDot: "≓",
			erarr: "⥱",
			escr: "ℯ",
			esdot: "≐",
			esim: "≂",
			eta: "η",
			eth: "ð",
			euml: "ë",
			euro: "€",
			excl: "!",
			exist: "∃",
			expectation: "ℰ",
			exponentiale: "ⅇ",
			fallingdotseq: "≒",
			fcy: "ф",
			female: "♀",
			ffilig: "ﬃ",
			fflig: "ﬀ",
			ffllig: "ﬄ",
			ffr: "𝔣",
			filig: "ﬁ",
			fjlig: "fj",
			flat: "♭",
			fllig: "ﬂ",
			fltns: "▱",
			fnof: "ƒ",
			fopf: "𝕗",
			forall: "∀",
			fork: "⋔",
			forkv: "⫙",
			fpartint: "⨍",
			frac12: "½",
			frac13: "⅓",
			frac14: "¼",
			frac15: "⅕",
			frac16: "⅙",
			frac18: "⅛",
			frac23: "⅔",
			frac25: "⅖",
			frac34: "¾",
			frac35: "⅗",
			frac38: "⅜",
			frac45: "⅘",
			frac56: "⅚",
			frac58: "⅝",
			frac78: "⅞",
			frasl: "⁄",
			frown: "⌢",
			fscr: "𝒻",
			gE: "≧",
			gEl: "⪌",
			gacute: "ǵ",
			gamma: "γ",
			gammad: "ϝ",
			gap: "⪆",
			gbreve: "ğ",
			gcirc: "ĝ",
			gcy: "г",
			gdot: "ġ",
			ge: "≥",
			gel: "⋛",
			geq: "≥",
			geqq: "≧",
			geqslant: "⩾",
			ges: "⩾",
			gescc: "⪩",
			gesdot: "⪀",
			gesdoto: "⪂",
			gesdotol: "⪄",
			gesl: "⋛︀",
			gesles: "⪔",
			gfr: "𝔤",
			gg: "≫",
			ggg: "⋙",
			gimel: "ℷ",
			gjcy: "ѓ",
			gl: "≷",
			glE: "⪒",
			gla: "⪥",
			glj: "⪤",
			gnE: "≩",
			gnap: "⪊",
			gnapprox: "⪊",
			gne: "⪈",
			gneq: "⪈",
			gneqq: "≩",
			gnsim: "⋧",
			gopf: "𝕘",
			grave: "`",
			gscr: "ℊ",
			gsim: "≳",
			gsime: "⪎",
			gsiml: "⪐",
			gt: ">",
			gtcc: "⪧",
			gtcir: "⩺",
			gtdot: "⋗",
			gtlPar: "⦕",
			gtquest: "⩼",
			gtrapprox: "⪆",
			gtrarr: "⥸",
			gtrdot: "⋗",
			gtreqless: "⋛",
			gtreqqless: "⪌",
			gtrless: "≷",
			gtrsim: "≳",
			gvertneqq: "≩︀",
			gvnE: "≩︀",
			hArr: "⇔",
			hairsp: " ",
			half: "½",
			hamilt: "ℋ",
			hardcy: "ъ",
			harr: "↔",
			harrcir: "⥈",
			harrw: "↭",
			hbar: "ℏ",
			hcirc: "ĥ",
			hearts: "♥",
			heartsuit: "♥",
			hellip: "…",
			hercon: "⊹",
			hfr: "𝔥",
			hksearow: "⤥",
			hkswarow: "⤦",
			hoarr: "⇿",
			homtht: "∻",
			hookleftarrow: "↩",
			hookrightarrow: "↪",
			hopf: "𝕙",
			horbar: "―",
			hscr: "𝒽",
			hslash: "ℏ",
			hstrok: "ħ",
			hybull: "⁃",
			hyphen: "‐",
			iacute: "í",
			ic: "⁣",
			icirc: "î",
			icy: "и",
			iecy: "е",
			iexcl: "¡",
			iff: "⇔",
			ifr: "𝔦",
			igrave: "ì",
			ii: "ⅈ",
			iiiint: "⨌",
			iiint: "∭",
			iinfin: "⧜",
			iiota: "℩",
			ijlig: "ĳ",
			imacr: "ī",
			image: "ℑ",
			imagline: "ℐ",
			imagpart: "ℑ",
			imath: "ı",
			imof: "⊷",
			imped: "Ƶ",
			in: "∈",
			incare: "℅",
			infin: "∞",
			infintie: "⧝",
			inodot: "ı",
			int: "∫",
			intcal: "⊺",
			integers: "ℤ",
			intercal: "⊺",
			intlarhk: "⨗",
			intprod: "⨼",
			iocy: "ё",
			iogon: "į",
			iopf: "𝕚",
			iota: "ι",
			iprod: "⨼",
			iquest: "¿",
			iscr: "𝒾",
			isin: "∈",
			isinE: "⋹",
			isindot: "⋵",
			isins: "⋴",
			isinsv: "⋳",
			isinv: "∈",
			it: "⁢",
			itilde: "ĩ",
			iukcy: "і",
			iuml: "ï",
			jcirc: "ĵ",
			jcy: "й",
			jfr: "𝔧",
			jmath: "ȷ",
			jopf: "𝕛",
			jscr: "𝒿",
			jsercy: "ј",
			jukcy: "є",
			kappa: "κ",
			kappav: "ϰ",
			kcedil: "ķ",
			kcy: "к",
			kfr: "𝔨",
			kgreen: "ĸ",
			khcy: "х",
			kjcy: "ќ",
			kopf: "𝕜",
			kscr: "𝓀",
			lAarr: "⇚",
			lArr: "⇐",
			lAtail: "⤛",
			lBarr: "⤎",
			lE: "≦",
			lEg: "⪋",
			lHar: "⥢",
			lacute: "ĺ",
			laemptyv: "⦴",
			lagran: "ℒ",
			lambda: "λ",
			lang: "⟨",
			langd: "⦑",
			langle: "⟨",
			lap: "⪅",
			laquo: "«",
			larr: "←",
			larrb: "⇤",
			larrbfs: "⤟",
			larrfs: "⤝",
			larrhk: "↩",
			larrlp: "↫",
			larrpl: "⤹",
			larrsim: "⥳",
			larrtl: "↢",
			lat: "⪫",
			latail: "⤙",
			late: "⪭",
			lates: "⪭︀",
			lbarr: "⤌",
			lbbrk: "❲",
			lbrace: "{",
			lbrack: "[",
			lbrke: "⦋",
			lbrksld: "⦏",
			lbrkslu: "⦍",
			lcaron: "ľ",
			lcedil: "ļ",
			lceil: "⌈",
			lcub: "{",
			lcy: "л",
			ldca: "⤶",
			ldquo: "“",
			ldquor: "„",
			ldrdhar: "⥧",
			ldrushar: "⥋",
			ldsh: "↲",
			le: "≤",
			leftarrow: "←",
			leftarrowtail: "↢",
			leftharpoondown: "↽",
			leftharpoonup: "↼",
			leftleftarrows: "⇇",
			leftrightarrow: "↔",
			leftrightarrows: "⇆",
			leftrightharpoons: "⇋",
			leftrightsquigarrow: "↭",
			leftthreetimes: "⋋",
			leg: "⋚",
			leq: "≤",
			leqq: "≦",
			leqslant: "⩽",
			les: "⩽",
			lescc: "⪨",
			lesdot: "⩿",
			lesdoto: "⪁",
			lesdotor: "⪃",
			lesg: "⋚︀",
			lesges: "⪓",
			lessapprox: "⪅",
			lessdot: "⋖",
			lesseqgtr: "⋚",
			lesseqqgtr: "⪋",
			lessgtr: "≶",
			lesssim: "≲",
			lfisht: "⥼",
			lfloor: "⌊",
			lfr: "𝔩",
			lg: "≶",
			lgE: "⪑",
			lhard: "↽",
			lharu: "↼",
			lharul: "⥪",
			lhblk: "▄",
			ljcy: "љ",
			ll: "≪",
			llarr: "⇇",
			llcorner: "⌞",
			llhard: "⥫",
			lltri: "◺",
			lmidot: "ŀ",
			lmoust: "⎰",
			lmoustache: "⎰",
			lnE: "≨",
			lnap: "⪉",
			lnapprox: "⪉",
			lne: "⪇",
			lneq: "⪇",
			lneqq: "≨",
			lnsim: "⋦",
			loang: "⟬",
			loarr: "⇽",
			lobrk: "⟦",
			longleftarrow: "⟵",
			longleftrightarrow: "⟷",
			longmapsto: "⟼",
			longrightarrow: "⟶",
			looparrowleft: "↫",
			looparrowright: "↬",
			lopar: "⦅",
			lopf: "𝕝",
			loplus: "⨭",
			lotimes: "⨴",
			lowast: "∗",
			lowbar: "_",
			loz: "◊",
			lozenge: "◊",
			lozf: "⧫",
			lpar: "(",
			lparlt: "⦓",
			lrarr: "⇆",
			lrcorner: "⌟",
			lrhar: "⇋",
			lrhard: "⥭",
			lrm: "‎",
			lrtri: "⊿",
			lsaquo: "‹",
			lscr: "𝓁",
			lsh: "↰",
			lsim: "≲",
			lsime: "⪍",
			lsimg: "⪏",
			lsqb: "[",
			lsquo: "‘",
			lsquor: "‚",
			lstrok: "ł",
			lt: "<",
			ltcc: "⪦",
			ltcir: "⩹",
			ltdot: "⋖",
			lthree: "⋋",
			ltimes: "⋉",
			ltlarr: "⥶",
			ltquest: "⩻",
			ltrPar: "⦖",
			ltri: "◃",
			ltrie: "⊴",
			ltrif: "◂",
			lurdshar: "⥊",
			luruhar: "⥦",
			lvertneqq: "≨︀",
			lvnE: "≨︀",
			mDDot: "∺",
			macr: "¯",
			male: "♂",
			malt: "✠",
			maltese: "✠",
			map: "↦",
			mapsto: "↦",
			mapstodown: "↧",
			mapstoleft: "↤",
			mapstoup: "↥",
			marker: "▮",
			mcomma: "⨩",
			mcy: "м",
			mdash: "—",
			measuredangle: "∡",
			mfr: "𝔪",
			mho: "℧",
			micro: "µ",
			mid: "∣",
			midast: "*",
			midcir: "⫰",
			middot: "·",
			minus: "−",
			minusb: "⊟",
			minusd: "∸",
			minusdu: "⨪",
			mlcp: "⫛",
			mldr: "…",
			mnplus: "∓",
			models: "⊧",
			mopf: "𝕞",
			mp: "∓",
			mscr: "𝓂",
			mstpos: "∾",
			mu: "μ",
			multimap: "⊸",
			mumap: "⊸",
			nGg: "⋙̸",
			nGt: "≫⃒",
			nGtv: "≫̸",
			nLeftarrow: "⇍",
			nLeftrightarrow: "⇎",
			nLl: "⋘̸",
			nLt: "≪⃒",
			nLtv: "≪̸",
			nRightarrow: "⇏",
			nVDash: "⊯",
			nVdash: "⊮",
			nabla: "∇",
			nacute: "ń",
			nang: "∠⃒",
			nap: "≉",
			napE: "⩰̸",
			napid: "≋̸",
			napos: "ŉ",
			napprox: "≉",
			natur: "♮",
			natural: "♮",
			naturals: "ℕ",
			nbsp: "\xA0",
			nbump: "≎̸",
			nbumpe: "≏̸",
			ncap: "⩃",
			ncaron: "ň",
			ncedil: "ņ",
			ncong: "≇",
			ncongdot: "⩭̸",
			ncup: "⩂",
			ncy: "н",
			ndash: "–",
			ne: "≠",
			neArr: "⇗",
			nearhk: "⤤",
			nearr: "↗",
			nearrow: "↗",
			nedot: "≐̸",
			nequiv: "≢",
			nesear: "⤨",
			nesim: "≂̸",
			nexist: "∄",
			nexists: "∄",
			nfr: "𝔫",
			ngE: "≧̸",
			nge: "≱",
			ngeq: "≱",
			ngeqq: "≧̸",
			ngeqslant: "⩾̸",
			nges: "⩾̸",
			ngsim: "≵",
			ngt: "≯",
			ngtr: "≯",
			nhArr: "⇎",
			nharr: "↮",
			nhpar: "⫲",
			ni: "∋",
			nis: "⋼",
			nisd: "⋺",
			niv: "∋",
			njcy: "њ",
			nlArr: "⇍",
			nlE: "≦̸",
			nlarr: "↚",
			nldr: "‥",
			nle: "≰",
			nleftarrow: "↚",
			nleftrightarrow: "↮",
			nleq: "≰",
			nleqq: "≦̸",
			nleqslant: "⩽̸",
			nles: "⩽̸",
			nless: "≮",
			nlsim: "≴",
			nlt: "≮",
			nltri: "⋪",
			nltrie: "⋬",
			nmid: "∤",
			nopf: "𝕟",
			not: "¬",
			notin: "∉",
			notinE: "⋹̸",
			notindot: "⋵̸",
			notinva: "∉",
			notinvb: "⋷",
			notinvc: "⋶",
			notni: "∌",
			notniva: "∌",
			notnivb: "⋾",
			notnivc: "⋽",
			npar: "∦",
			nparallel: "∦",
			nparsl: "⫽⃥",
			npart: "∂̸",
			npolint: "⨔",
			npr: "⊀",
			nprcue: "⋠",
			npre: "⪯̸",
			nprec: "⊀",
			npreceq: "⪯̸",
			nrArr: "⇏",
			nrarr: "↛",
			nrarrc: "⤳̸",
			nrarrw: "↝̸",
			nrightarrow: "↛",
			nrtri: "⋫",
			nrtrie: "⋭",
			nsc: "⊁",
			nsccue: "⋡",
			nsce: "⪰̸",
			nscr: "𝓃",
			nshortmid: "∤",
			nshortparallel: "∦",
			nsim: "≁",
			nsime: "≄",
			nsimeq: "≄",
			nsmid: "∤",
			nspar: "∦",
			nsqsube: "⋢",
			nsqsupe: "⋣",
			nsub: "⊄",
			nsubE: "⫅̸",
			nsube: "⊈",
			nsubset: "⊂⃒",
			nsubseteq: "⊈",
			nsubseteqq: "⫅̸",
			nsucc: "⊁",
			nsucceq: "⪰̸",
			nsup: "⊅",
			nsupE: "⫆̸",
			nsupe: "⊉",
			nsupset: "⊃⃒",
			nsupseteq: "⊉",
			nsupseteqq: "⫆̸",
			ntgl: "≹",
			ntilde: "ñ",
			ntlg: "≸",
			ntriangleleft: "⋪",
			ntrianglelefteq: "⋬",
			ntriangleright: "⋫",
			ntrianglerighteq: "⋭",
			nu: "ν",
			num: "#",
			numero: "№",
			numsp: " ",
			nvDash: "⊭",
			nvHarr: "⤄",
			nvap: "≍⃒",
			nvdash: "⊬",
			nvge: "≥⃒",
			nvgt: ">⃒",
			nvinfin: "⧞",
			nvlArr: "⤂",
			nvle: "≤⃒",
			nvlt: "<⃒",
			nvltrie: "⊴⃒",
			nvrArr: "⤃",
			nvrtrie: "⊵⃒",
			nvsim: "∼⃒",
			nwArr: "⇖",
			nwarhk: "⤣",
			nwarr: "↖",
			nwarrow: "↖",
			nwnear: "⤧",
			oS: "Ⓢ",
			oacute: "ó",
			oast: "⊛",
			ocir: "⊚",
			ocirc: "ô",
			ocy: "о",
			odash: "⊝",
			odblac: "ő",
			odiv: "⨸",
			odot: "⊙",
			odsold: "⦼",
			oelig: "œ",
			ofcir: "⦿",
			ofr: "𝔬",
			ogon: "˛",
			ograve: "ò",
			ogt: "⧁",
			ohbar: "⦵",
			ohm: "Ω",
			oint: "∮",
			olarr: "↺",
			olcir: "⦾",
			olcross: "⦻",
			oline: "‾",
			olt: "⧀",
			omacr: "ō",
			omega: "ω",
			omicron: "ο",
			omid: "⦶",
			ominus: "⊖",
			oopf: "𝕠",
			opar: "⦷",
			operp: "⦹",
			oplus: "⊕",
			or: "∨",
			orarr: "↻",
			ord: "⩝",
			order: "ℴ",
			orderof: "ℴ",
			ordf: "ª",
			ordm: "º",
			origof: "⊶",
			oror: "⩖",
			orslope: "⩗",
			orv: "⩛",
			oscr: "ℴ",
			oslash: "ø",
			osol: "⊘",
			otilde: "õ",
			otimes: "⊗",
			otimesas: "⨶",
			ouml: "ö",
			ovbar: "⌽",
			par: "∥",
			para: "¶",
			parallel: "∥",
			parsim: "⫳",
			parsl: "⫽",
			part: "∂",
			pcy: "п",
			percnt: "%",
			period: ".",
			permil: "‰",
			perp: "⊥",
			pertenk: "‱",
			pfr: "𝔭",
			phi: "φ",
			phiv: "ϕ",
			phmmat: "ℳ",
			phone: "☎",
			pi: "π",
			pitchfork: "⋔",
			piv: "ϖ",
			planck: "ℏ",
			planckh: "ℎ",
			plankv: "ℏ",
			plus: "+",
			plusacir: "⨣",
			plusb: "⊞",
			pluscir: "⨢",
			plusdo: "∔",
			plusdu: "⨥",
			pluse: "⩲",
			plusmn: "±",
			plussim: "⨦",
			plustwo: "⨧",
			pm: "±",
			pointint: "⨕",
			popf: "𝕡",
			pound: "£",
			pr: "≺",
			prE: "⪳",
			prap: "⪷",
			prcue: "≼",
			pre: "⪯",
			prec: "≺",
			precapprox: "⪷",
			preccurlyeq: "≼",
			preceq: "⪯",
			precnapprox: "⪹",
			precneqq: "⪵",
			precnsim: "⋨",
			precsim: "≾",
			prime: "′",
			primes: "ℙ",
			prnE: "⪵",
			prnap: "⪹",
			prnsim: "⋨",
			prod: "∏",
			profalar: "⌮",
			profline: "⌒",
			profsurf: "⌓",
			prop: "∝",
			propto: "∝",
			prsim: "≾",
			prurel: "⊰",
			pscr: "𝓅",
			psi: "ψ",
			puncsp: " ",
			qfr: "𝔮",
			qint: "⨌",
			qopf: "𝕢",
			qprime: "⁗",
			qscr: "𝓆",
			quaternions: "ℍ",
			quatint: "⨖",
			quest: "?",
			questeq: "≟",
			quot: "\"",
			rAarr: "⇛",
			rArr: "⇒",
			rAtail: "⤜",
			rBarr: "⤏",
			rHar: "⥤",
			race: "∽̱",
			racute: "ŕ",
			radic: "√",
			raemptyv: "⦳",
			rang: "⟩",
			rangd: "⦒",
			range: "⦥",
			rangle: "⟩",
			raquo: "»",
			rarr: "→",
			rarrap: "⥵",
			rarrb: "⇥",
			rarrbfs: "⤠",
			rarrc: "⤳",
			rarrfs: "⤞",
			rarrhk: "↪",
			rarrlp: "↬",
			rarrpl: "⥅",
			rarrsim: "⥴",
			rarrtl: "↣",
			rarrw: "↝",
			ratail: "⤚",
			ratio: "∶",
			rationals: "ℚ",
			rbarr: "⤍",
			rbbrk: "❳",
			rbrace: "}",
			rbrack: "]",
			rbrke: "⦌",
			rbrksld: "⦎",
			rbrkslu: "⦐",
			rcaron: "ř",
			rcedil: "ŗ",
			rceil: "⌉",
			rcub: "}",
			rcy: "р",
			rdca: "⤷",
			rdldhar: "⥩",
			rdquo: "”",
			rdquor: "”",
			rdsh: "↳",
			real: "ℜ",
			realine: "ℛ",
			realpart: "ℜ",
			reals: "ℝ",
			rect: "▭",
			reg: "®",
			rfisht: "⥽",
			rfloor: "⌋",
			rfr: "𝔯",
			rhard: "⇁",
			rharu: "⇀",
			rharul: "⥬",
			rho: "ρ",
			rhov: "ϱ",
			rightarrow: "→",
			rightarrowtail: "↣",
			rightharpoondown: "⇁",
			rightharpoonup: "⇀",
			rightleftarrows: "⇄",
			rightleftharpoons: "⇌",
			rightrightarrows: "⇉",
			rightsquigarrow: "↝",
			rightthreetimes: "⋌",
			ring: "˚",
			risingdotseq: "≓",
			rlarr: "⇄",
			rlhar: "⇌",
			rlm: "‏",
			rmoust: "⎱",
			rmoustache: "⎱",
			rnmid: "⫮",
			roang: "⟭",
			roarr: "⇾",
			robrk: "⟧",
			ropar: "⦆",
			ropf: "𝕣",
			roplus: "⨮",
			rotimes: "⨵",
			rpar: ")",
			rpargt: "⦔",
			rppolint: "⨒",
			rrarr: "⇉",
			rsaquo: "›",
			rscr: "𝓇",
			rsh: "↱",
			rsqb: "]",
			rsquo: "’",
			rsquor: "’",
			rthree: "⋌",
			rtimes: "⋊",
			rtri: "▹",
			rtrie: "⊵",
			rtrif: "▸",
			rtriltri: "⧎",
			ruluhar: "⥨",
			rx: "℞",
			sacute: "ś",
			sbquo: "‚",
			sc: "≻",
			scE: "⪴",
			scap: "⪸",
			scaron: "š",
			sccue: "≽",
			sce: "⪰",
			scedil: "ş",
			scirc: "ŝ",
			scnE: "⪶",
			scnap: "⪺",
			scnsim: "⋩",
			scpolint: "⨓",
			scsim: "≿",
			scy: "с",
			sdot: "⋅",
			sdotb: "⊡",
			sdote: "⩦",
			seArr: "⇘",
			searhk: "⤥",
			searr: "↘",
			searrow: "↘",
			sect: "§",
			semi: ";",
			seswar: "⤩",
			setminus: "∖",
			setmn: "∖",
			sext: "✶",
			sfr: "𝔰",
			sfrown: "⌢",
			sharp: "♯",
			shchcy: "щ",
			shcy: "ш",
			shortmid: "∣",
			shortparallel: "∥",
			shy: "­",
			sigma: "σ",
			sigmaf: "ς",
			sigmav: "ς",
			sim: "∼",
			simdot: "⩪",
			sime: "≃",
			simeq: "≃",
			simg: "⪞",
			simgE: "⪠",
			siml: "⪝",
			simlE: "⪟",
			simne: "≆",
			simplus: "⨤",
			simrarr: "⥲",
			slarr: "←",
			smallsetminus: "∖",
			smashp: "⨳",
			smeparsl: "⧤",
			smid: "∣",
			smile: "⌣",
			smt: "⪪",
			smte: "⪬",
			smtes: "⪬︀",
			softcy: "ь",
			sol: "/",
			solb: "⧄",
			solbar: "⌿",
			sopf: "𝕤",
			spades: "♠",
			spadesuit: "♠",
			spar: "∥",
			sqcap: "⊓",
			sqcaps: "⊓︀",
			sqcup: "⊔",
			sqcups: "⊔︀",
			sqsub: "⊏",
			sqsube: "⊑",
			sqsubset: "⊏",
			sqsubseteq: "⊑",
			sqsup: "⊐",
			sqsupe: "⊒",
			sqsupset: "⊐",
			sqsupseteq: "⊒",
			squ: "□",
			square: "□",
			squarf: "▪",
			squf: "▪",
			srarr: "→",
			sscr: "𝓈",
			ssetmn: "∖",
			ssmile: "⌣",
			sstarf: "⋆",
			star: "☆",
			starf: "★",
			straightepsilon: "ϵ",
			straightphi: "ϕ",
			strns: "¯",
			sub: "⊂",
			subE: "⫅",
			subdot: "⪽",
			sube: "⊆",
			subedot: "⫃",
			submult: "⫁",
			subnE: "⫋",
			subne: "⊊",
			subplus: "⪿",
			subrarr: "⥹",
			subset: "⊂",
			subseteq: "⊆",
			subseteqq: "⫅",
			subsetneq: "⊊",
			subsetneqq: "⫋",
			subsim: "⫇",
			subsub: "⫕",
			subsup: "⫓",
			succ: "≻",
			succapprox: "⪸",
			succcurlyeq: "≽",
			succeq: "⪰",
			succnapprox: "⪺",
			succneqq: "⪶",
			succnsim: "⋩",
			succsim: "≿",
			sum: "∑",
			sung: "♪",
			sup1: "¹",
			sup2: "²",
			sup3: "³",
			sup: "⊃",
			supE: "⫆",
			supdot: "⪾",
			supdsub: "⫘",
			supe: "⊇",
			supedot: "⫄",
			suphsol: "⟉",
			suphsub: "⫗",
			suplarr: "⥻",
			supmult: "⫂",
			supnE: "⫌",
			supne: "⊋",
			supplus: "⫀",
			supset: "⊃",
			supseteq: "⊇",
			supseteqq: "⫆",
			supsetneq: "⊋",
			supsetneqq: "⫌",
			supsim: "⫈",
			supsub: "⫔",
			supsup: "⫖",
			swArr: "⇙",
			swarhk: "⤦",
			swarr: "↙",
			swarrow: "↙",
			swnwar: "⤪",
			szlig: "ß",
			target: "⌖",
			tau: "τ",
			tbrk: "⎴",
			tcaron: "ť",
			tcedil: "ţ",
			tcy: "т",
			tdot: "⃛",
			telrec: "⌕",
			tfr: "𝔱",
			there4: "∴",
			therefore: "∴",
			theta: "θ",
			thetasym: "ϑ",
			thetav: "ϑ",
			thickapprox: "≈",
			thicksim: "∼",
			thinsp: " ",
			thkap: "≈",
			thksim: "∼",
			thorn: "þ",
			tilde: "˜",
			times: "×",
			timesb: "⊠",
			timesbar: "⨱",
			timesd: "⨰",
			tint: "∭",
			toea: "⤨",
			top: "⊤",
			topbot: "⌶",
			topcir: "⫱",
			topf: "𝕥",
			topfork: "⫚",
			tosa: "⤩",
			tprime: "‴",
			trade: "™",
			triangle: "▵",
			triangledown: "▿",
			triangleleft: "◃",
			trianglelefteq: "⊴",
			triangleq: "≜",
			triangleright: "▹",
			trianglerighteq: "⊵",
			tridot: "◬",
			trie: "≜",
			triminus: "⨺",
			triplus: "⨹",
			trisb: "⧍",
			tritime: "⨻",
			trpezium: "⏢",
			tscr: "𝓉",
			tscy: "ц",
			tshcy: "ћ",
			tstrok: "ŧ",
			twixt: "≬",
			twoheadleftarrow: "↞",
			twoheadrightarrow: "↠",
			uArr: "⇑",
			uHar: "⥣",
			uacute: "ú",
			uarr: "↑",
			ubrcy: "ў",
			ubreve: "ŭ",
			ucirc: "û",
			ucy: "у",
			udarr: "⇅",
			udblac: "ű",
			udhar: "⥮",
			ufisht: "⥾",
			ufr: "𝔲",
			ugrave: "ù",
			uharl: "↿",
			uharr: "↾",
			uhblk: "▀",
			ulcorn: "⌜",
			ulcorner: "⌜",
			ulcrop: "⌏",
			ultri: "◸",
			umacr: "ū",
			uml: "¨",
			uogon: "ų",
			uopf: "𝕦",
			uparrow: "↑",
			updownarrow: "↕",
			upharpoonleft: "↿",
			upharpoonright: "↾",
			uplus: "⊎",
			upsi: "υ",
			upsih: "ϒ",
			upsilon: "υ",
			upuparrows: "⇈",
			urcorn: "⌝",
			urcorner: "⌝",
			urcrop: "⌎",
			uring: "ů",
			urtri: "◹",
			uscr: "𝓊",
			utdot: "⋰",
			utilde: "ũ",
			utri: "▵",
			utrif: "▴",
			uuarr: "⇈",
			uuml: "ü",
			uwangle: "⦧",
			vArr: "⇕",
			vBar: "⫨",
			vBarv: "⫩",
			vDash: "⊨",
			vangrt: "⦜",
			varepsilon: "ϵ",
			varkappa: "ϰ",
			varnothing: "∅",
			varphi: "ϕ",
			varpi: "ϖ",
			varpropto: "∝",
			varr: "↕",
			varrho: "ϱ",
			varsigma: "ς",
			varsubsetneq: "⊊︀",
			varsubsetneqq: "⫋︀",
			varsupsetneq: "⊋︀",
			varsupsetneqq: "⫌︀",
			vartheta: "ϑ",
			vartriangleleft: "⊲",
			vartriangleright: "⊳",
			vcy: "в",
			vdash: "⊢",
			vee: "∨",
			veebar: "⊻",
			veeeq: "≚",
			vellip: "⋮",
			verbar: "|",
			vert: "|",
			vfr: "𝔳",
			vltri: "⊲",
			vnsub: "⊂⃒",
			vnsup: "⊃⃒",
			vopf: "𝕧",
			vprop: "∝",
			vrtri: "⊳",
			vscr: "𝓋",
			vsubnE: "⫋︀",
			vsubne: "⊊︀",
			vsupnE: "⫌︀",
			vsupne: "⊋︀",
			vzigzag: "⦚",
			wcirc: "ŵ",
			wedbar: "⩟",
			wedge: "∧",
			wedgeq: "≙",
			weierp: "℘",
			wfr: "𝔴",
			wopf: "𝕨",
			wp: "℘",
			wr: "≀",
			wreath: "≀",
			wscr: "𝓌",
			xcap: "⋂",
			xcirc: "◯",
			xcup: "⋃",
			xdtri: "▽",
			xfr: "𝔵",
			xhArr: "⟺",
			xharr: "⟷",
			xi: "ξ",
			xlArr: "⟸",
			xlarr: "⟵",
			xmap: "⟼",
			xnis: "⋻",
			xodot: "⨀",
			xopf: "𝕩",
			xoplus: "⨁",
			xotime: "⨂",
			xrArr: "⟹",
			xrarr: "⟶",
			xscr: "𝓍",
			xsqcup: "⨆",
			xuplus: "⨄",
			xutri: "△",
			xvee: "⋁",
			xwedge: "⋀",
			yacute: "ý",
			yacy: "я",
			ycirc: "ŷ",
			ycy: "ы",
			yen: "¥",
			yfr: "𝔶",
			yicy: "ї",
			yopf: "𝕪",
			yscr: "𝓎",
			yucy: "ю",
			yuml: "ÿ",
			zacute: "ź",
			zcaron: "ž",
			zcy: "з",
			zdot: "ż",
			zeetrf: "ℨ",
			zeta: "ζ",
			zfr: "𝔷",
			zhcy: "ж",
			zigrarr: "⇝",
			zopf: "𝕫",
			zscr: "𝓏",
			zwj: "‍",
			zwnj: "‌"
		};
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/decode-named-character-reference/index.js
		const own$1 = {}.hasOwnProperty;
		/**
		* Decode a single character reference (without the `&` or `;`).
		* You probably only need this when you’re building parsers yourself that follow
		* different rules compared to HTML.
		* This is optimized to be tiny in browsers.
		*
		* @param {string} value
		*   `notin` (named), `#123` (deci), `#x123` (hexa).
		* @returns {string|false}
		*   Decoded reference.
		*/
		function decodeNamedCharacterReference(value) {
			return own$1.call(characterEntities, value) ? characterEntities[value] : false;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-chunked/index.js
		/**
		* Like `Array#splice`, but smarter for giant arrays.
		*
		* `Array#splice` takes all items to be inserted as individual argument which
		* causes a stack overflow in V8 when trying to insert 100k items for instance.
		*
		* Otherwise, this does not return the removed items, and takes `items` as an
		* array instead of rest parameters.
		*
		* @template {unknown} T
		*   Item type.
		* @param {Array<T>} list
		*   List to operate on.
		* @param {number} start
		*   Index to remove/insert at (can be negative).
		* @param {number} remove
		*   Number of items to remove.
		* @param {Array<T>} items
		*   Items to inject into `list`.
		* @returns {undefined}
		*   Nothing.
		*/
		function splice(list, start, remove, items) {
			const end = list.length;
			let chunkStart = 0;
			/** @type {Array<unknown>} */
			let parameters;
			if (start < 0) start = -start > end ? 0 : end + start;
			else start = start > end ? end : start;
			remove = remove > 0 ? remove : 0;
			if (items.length < 1e4) {
				parameters = Array.from(items);
				parameters.unshift(start, remove);
				list.splice(...parameters);
			} else {
				if (remove) list.splice(start, remove);
				while (chunkStart < items.length) {
					parameters = items.slice(chunkStart, chunkStart + 1e4);
					parameters.unshift(start, 0);
					list.splice(...parameters);
					chunkStart += 1e4;
					start += 1e4;
				}
			}
		}
		/**
		* Append `items` (an array) at the end of `list` (another array).
		* When `list` was empty, returns `items` instead.
		*
		* This prevents a potentially expensive operation when `list` is empty,
		* and adds items in batches to prevent V8 from hanging.
		*
		* @template {unknown} T
		*   Item type.
		* @param {Array<T>} list
		*   List to operate on.
		* @param {Array<T>} items
		*   Items to add to `list`.
		* @returns {Array<T>}
		*   Either `list` or `items`.
		*/
		function push(list, items) {
			if (list.length > 0) {
				splice(list, list.length, 0, items);
				return list;
			}
			return items;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-combine-extensions/index.js
		/**
		* @import {
		*   Extension,
		*   Handles,
		*   HtmlExtension,
		*   NormalizedExtension
		* } from 'micromark-util-types'
		*/
		const hasOwnProperty = {}.hasOwnProperty;
		/**
		* Combine multiple syntax extensions into one.
		*
		* @param {ReadonlyArray<Extension>} extensions
		*   List of syntax extensions.
		* @returns {NormalizedExtension}
		*   A single combined extension.
		*/
		function combineExtensions(extensions) {
			/** @type {NormalizedExtension} */
			const all = {};
			let index = -1;
			while (++index < extensions.length) syntaxExtension(all, extensions[index]);
			return all;
		}
		/**
		* Merge `extension` into `all`.
		*
		* @param {NormalizedExtension} all
		*   Extension to merge into.
		* @param {Extension} extension
		*   Extension to merge.
		* @returns {undefined}
		*   Nothing.
		*/
		function syntaxExtension(all, extension) {
			/** @type {keyof Extension} */
			let hook;
			for (hook in extension) {
				/** @type {Record<string, unknown>} */
				const left = (hasOwnProperty.call(all, hook) ? all[hook] : void 0) || (all[hook] = {});
				/** @type {Record<string, unknown> | undefined} */
				const right = extension[hook];
				/** @type {string} */
				let code;
				if (right) for (code in right) {
					if (!hasOwnProperty.call(left, code)) left[code] = [];
					const value = right[code];
					constructs(left[code], Array.isArray(value) ? value : value ? [value] : []);
				}
			}
		}
		/**
		* Merge `list` into `existing` (both lists of constructs).
		* Mutates `existing`.
		*
		* @param {Array<unknown>} existing
		*   List of constructs to merge into.
		* @param {Array<unknown>} list
		*   List of constructs to merge.
		* @returns {undefined}
		*   Nothing.
		*/
		function constructs(existing, list) {
			let index = -1;
			/** @type {Array<unknown>} */
			const before = [];
			while (++index < list.length) (list[index].add === "after" ? existing : before).push(list[index]);
			splice(existing, 0, 0, before);
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-decode-numeric-character-reference/index.js
		/**
		* Turn the number (in string form as either hexa- or plain decimal) coming from
		* a numeric character reference into a character.
		*
		* Sort of like `String.fromCodePoint(Number.parseInt(value, base))`, but makes
		* non-characters and control characters safe.
		*
		* @param {string} value
		*   Value to decode.
		* @param {number} base
		*   Numeric base.
		* @returns {string}
		*   Character.
		*/
		function decodeNumericCharacterReference(value, base) {
			const code = Number.parseInt(value, base);
			if (code < 9 || code === 11 || code > 13 && code < 32 || code > 126 && code < 160 || code > 55295 && code < 57344 || code > 64975 && code < 65008 || (code & 65535) === 65535 || (code & 65535) === 65534 || code > 1114111) return "�";
			return String.fromCodePoint(code);
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-normalize-identifier/index.js
		/**
		* Normalize an identifier (as found in references, definitions).
		*
		* Collapses markdown whitespace, trim, and then lower- and uppercase.
		*
		* Some characters are considered “uppercase”, such as U+03F4 (`ϴ`), but if their
		* lowercase counterpart (U+03B8 (`θ`)) is uppercased will result in a different
		* uppercase character (U+0398 (`Θ`)).
		* So, to get a canonical form, we perform both lower- and uppercase.
		*
		* Using uppercase last makes sure keys will never interact with default
		* prototypal values (such as `constructor`): nothing in the prototype of
		* `Object` is uppercase.
		*
		* @param {string} value
		*   Identifier to normalize.
		* @returns {string}
		*   Normalized identifier.
		*/
		function normalizeIdentifier(value) {
			return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-character/index.js
		/**
		* @import {Code} from 'micromark-util-types'
		*/
		/**
		* Check whether the character code represents an ASCII alpha (`a` through `z`,
		* case insensitive).
		*
		* An **ASCII alpha** is an ASCII upper alpha or ASCII lower alpha.
		*
		* An **ASCII upper alpha** is a character in the inclusive range U+0041 (`A`)
		* to U+005A (`Z`).
		*
		* An **ASCII lower alpha** is a character in the inclusive range U+0061 (`a`)
		* to U+007A (`z`).
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiAlpha = regexCheck(/[A-Za-z]/);
		/**
		* Check whether the character code represents an ASCII alphanumeric (`a`
		* through `z`, case insensitive, or `0` through `9`).
		*
		* An **ASCII alphanumeric** is an ASCII digit (see `asciiDigit`) or ASCII alpha
		* (see `asciiAlpha`).
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
		/**
		* Check whether the character code represents an ASCII atext.
		*
		* atext is an ASCII alphanumeric (see `asciiAlphanumeric`), or a character in
		* the inclusive ranges U+0023 NUMBER SIGN (`#`) to U+0027 APOSTROPHE (`'`),
		* U+002A ASTERISK (`*`), U+002B PLUS SIGN (`+`), U+002D DASH (`-`), U+002F
		* SLASH (`/`), U+003D EQUALS TO (`=`), U+003F QUESTION MARK (`?`), U+005E
		* CARET (`^`) to U+0060 GRAVE ACCENT (`` ` ``), or U+007B LEFT CURLY BRACE
		* (`{`) to U+007E TILDE (`~`).
		*
		* See:
		* **\[RFC5322]**:
		* [Internet Message Format](https://tools.ietf.org/html/rfc5322).
		* P. Resnick.
		* IETF.
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
		/**
		* Check whether a character code is an ASCII control character.
		*
		* An **ASCII control** is a character in the inclusive range U+0000 NULL (NUL)
		* to U+001F (US), or U+007F (DEL).
		*
		* @param {Code} code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		function asciiControl(code) {
			return code !== null && (code < 32 || code === 127);
		}
		/**
		* Check whether the character code represents an ASCII digit (`0` through `9`).
		*
		* An **ASCII digit** is a character in the inclusive range U+0030 (`0`) to
		* U+0039 (`9`).
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiDigit = regexCheck(/\d/);
		/**
		* Check whether the character code represents an ASCII hex digit (`a` through
		* `f`, case insensitive, or `0` through `9`).
		*
		* An **ASCII hex digit** is an ASCII digit (see `asciiDigit`), ASCII upper hex
		* digit, or an ASCII lower hex digit.
		*
		* An **ASCII upper hex digit** is a character in the inclusive range U+0041
		* (`A`) to U+0046 (`F`).
		*
		* An **ASCII lower hex digit** is a character in the inclusive range U+0061
		* (`a`) to U+0066 (`f`).
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
		/**
		* Check whether the character code represents ASCII punctuation.
		*
		* An **ASCII punctuation** is a character in the inclusive ranges U+0021
		* EXCLAMATION MARK (`!`) to U+002F SLASH (`/`), U+003A COLON (`:`) to U+0040 AT
		* SIGN (`@`), U+005B LEFT SQUARE BRACKET (`[`) to U+0060 GRAVE ACCENT
		* (`` ` ``), or U+007B LEFT CURLY BRACE (`{`) to U+007E TILDE (`~`).
		*
		* @param code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		const asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
		/**
		* Check whether a character code is a markdown line ending.
		*
		* A **markdown line ending** is the virtual characters M-0003 CARRIAGE RETURN
		* LINE FEED (CRLF), M-0004 LINE FEED (LF) and M-0005 CARRIAGE RETURN (CR).
		*
		* In micromark, the actual character U+000A LINE FEED (LF) and U+000D CARRIAGE
		* RETURN (CR) are replaced by these virtual characters depending on whether
		* they occurred together.
		*
		* @param {Code} code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		function markdownLineEnding(code) {
			return code !== null && code < -2;
		}
		/**
		* Check whether a character code is a markdown line ending (see
		* `markdownLineEnding`) or markdown space (see `markdownSpace`).
		*
		* @param {Code} code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		function markdownLineEndingOrSpace(code) {
			return code !== null && (code < 0 || code === 32);
		}
		/**
		* Check whether a character code is a markdown space.
		*
		* A **markdown space** is the concrete character U+0020 SPACE (SP) and the
		* virtual characters M-0001 VIRTUAL SPACE (VS) and M-0002 HORIZONTAL TAB (HT).
		*
		* In micromark, the actual character U+0009 CHARACTER TABULATION (HT) is
		* replaced by one M-0002 HORIZONTAL TAB (HT) and between 0 and 3 M-0001 VIRTUAL
		* SPACE (VS) characters, depending on the column at which the tab occurred.
		*
		* @param {Code} code
		*   Code.
		* @returns {boolean}
		*   Whether it matches.
		*/
		function markdownSpace(code) {
			return code === -2 || code === -1 || code === 32;
		}
		/**
		* Check whether the character code represents Unicode punctuation.
		*
		* A **Unicode punctuation** is a character in the Unicode `Pc` (Punctuation,
		* Connector), `Pd` (Punctuation, Dash), `Pe` (Punctuation, Close), `Pf`
		* (Punctuation, Final quote), `Pi` (Punctuation, Initial quote), `Po`
		* (Punctuation, Other), or `Ps` (Punctuation, Open) categories, or an ASCII
		* punctuation (see `asciiPunctuation`).
		*
		* See:
		* **\[UNICODE]**:
		* [The Unicode Standard](https://www.unicode.org/versions/).
		* Unicode Consortium.
		*
		* @param code
		*   Code.
		* @returns
		*   Whether it matches.
		*/
		const unicodePunctuation = regexCheck(/\p{P}|\p{S}/u);
		/**
		* Check whether the character code represents Unicode whitespace.
		*
		* Note that this does handle micromark specific markdown whitespace characters.
		* See `markdownLineEndingOrSpace` to check that.
		*
		* A **Unicode whitespace** is a character in the Unicode `Zs` (Separator,
		* Space) category, or U+0009 CHARACTER TABULATION (HT), U+000A LINE FEED (LF),
		* U+000C (FF), or U+000D CARRIAGE RETURN (CR) (**\[UNICODE]**).
		*
		* See:
		* **\[UNICODE]**:
		* [The Unicode Standard](https://www.unicode.org/versions/).
		* Unicode Consortium.
		*
		* @param code
		*   Code.
		* @returns
		*   Whether it matches.
		*/
		const unicodeWhitespace = regexCheck(/\s/);
		/**
		* Create a code check from a regex.
		*
		* @param {RegExp} regex
		*   Expression.
		* @returns {(code: Code) => boolean}
		*   Check.
		*/
		function regexCheck(regex) {
			return check;
			/**
			* Check whether a code matches the bound regex.
			*
			* @param {Code} code
			*   Character code.
			* @returns {boolean}
			*   Whether the character code matches the bound regex.
			*/
			function check(code) {
				return code !== null && code > -1 && regex.test(String.fromCharCode(code));
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-factory-space/index.js
		/**
		* @import {Effects, State, TokenType} from 'micromark-util-types'
		*/
		/**
		* Parse spaces and tabs.
		*
		* There is no `nok` parameter:
		*
		* *   spaces in markdown are often optional, in which case this factory can be
		*     used and `ok` will be switched to whether spaces were found or not
		* *   one line ending or space can be detected with `markdownSpace(code)` right
		*     before using `factorySpace`
		*
		* ###### Examples
		*
		* Where `␉` represents a tab (plus how much it expands) and `␠` represents a
		* single space.
		*
		* ```markdown
		* ␉
		* ␠␠␠␠
		* ␉␠
		* ```
		*
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @param {TokenType} type
		*   Type of the whole whitespace.
		* @param {number | undefined} [max=Infinity]
		*   Max (exclusive).
		* @returns {State}
		*   Start state.
		*/
		function factorySpace(effects, ok, type, max) {
			const limit = max ? max - 1 : Infinity;
			let size = 0;
			return start;
			/** @type {State} */
			function start(code) {
				if (markdownSpace(code)) {
					effects.enter(type);
					return prefix(code);
				}
				return ok(code);
			}
			/** @type {State} */
			function prefix(code) {
				if (markdownSpace(code) && size++ < limit) {
					effects.consume(code);
					return prefix;
				}
				effects.exit(type);
				return ok(code);
			}
		}
		/**
		* Parse spaces and tabs, with a required minimum and maximum, matching
		* `markdown-rs`’s `space_or_tab_min_max`.
		*
		* Unlike `factorySpace`, this can fail: `nok` is used when fewer than
		* `min` spaces or tabs are found.
		*
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @param {State} nok
		*   State switched to when unsuccessful.
		* @param {TokenType} type
		*   Type of the whole whitespace.
		* @param {number} min
		*   Minimum allowed characters (inclusive).
		* @param {number} max
		*   Maximum allowed characters (inclusive).
		* @returns {State}
		*   Start state.
		*/
		function factorySpaceMinMax(effects, ok, nok, type, min, max) {
			let size = 0;
			return start;
			/** @type {State} */
			function start(code) {
				if (max > 0 && markdownSpace(code)) {
					effects.enter(type);
					return prefix(code);
				}
				return after(code);
			}
			/** @type {State} */
			function prefix(code) {
				if (markdownSpace(code) && size < max) {
					effects.consume(code);
					size++;
					return prefix;
				}
				effects.exit(type);
				return after(code);
			}
			/** @type {State} */
			function after(code) {
				return size >= min ? ok(code) : nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/initialize/content.js
		/**
		* @import {
		*   InitialConstruct,
		*   Initializer,
		*   State,
		*   TokenizeContext,
		*   Token
		* } from 'micromark-util-types'
		*/
		/** @type {InitialConstruct} */
		const content$1 = { tokenize: initializeContent };
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Initializer}
		*   Content.
		*/
		function initializeContent(effects) {
			const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
			/** @type {Token} */
			let previous;
			return contentStart;
			/** @type {State} */
			function afterContentStartConstruct(code) {
				if (code === null) {
					effects.consume(code);
					return;
				}
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return factorySpace(effects, contentStart, "linePrefix");
			}
			/** @type {State} */
			function paragraphInitial(code) {
				effects.enter("paragraph");
				return lineStart(code);
			}
			/** @type {State} */
			function lineStart(code) {
				const token = effects.enter("chunkText", {
					contentType: "text",
					previous
				});
				if (previous) previous.next = token;
				previous = token;
				return data(code);
			}
			/** @type {State} */
			function data(code) {
				if (code === null) {
					effects.exit("chunkText");
					effects.exit("paragraph");
					effects.consume(code);
					return;
				}
				if (markdownLineEnding(code)) {
					effects.consume(code);
					effects.exit("chunkText");
					return lineStart;
				}
				effects.consume(code);
				return data;
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-edit-map/index.js
		/**
		* @import {Event} from 'micromark-util-types'
		*/
		/**
		* @typedef {[number, number, Array<Event>]} Change
		* @typedef {[number, number, number]} Jump
		*/
		/**
		* Tracks a bunch of edits.
		*
		* Port of `edit_map.rs` from `markdown-rs`:
		* <https://github.com/wooorm/markdown-rs/blob/1506572f/src/util/edit_map.rs>.
		*
		* Deal with several changes in events, batching them together.
		*
		* Preferably, changes should be kept to a minimum.
		* Sometimes, it’s needed to change the list of events, because parsing can be
		* messy, and it helps to expose a cleaner interface of events to the compiler
		* and other users.
		* It can also help to merge many adjacent similar events.
		* And, in other cases, it’s needed to parse subcontent: pass some events
		* through another tokenizer and inject the result.
		*/
		var EditMap = class {
			/**
			* Create a new edit map.
			*
			* @returns
			*   New instance.
			*/
			constructor() {
				/**
				* Changes by index, so `add` does not need to scan `map` (which is
				* quadratic for documents with many edits at different places).
				*
				* @type {Map<number, Change>}
				*/
				this.index = /* @__PURE__ */ new Map();
				/**
				* Record of changes.
				*
				* @type {Array<Change>}
				*/
				this.map = [];
			}
			/**
			* Create an edit: a remove and/or add at a certain place.
			*
			* @param {number} index
			*   Index at which to apply the edit.
			* @param {number} remove
			*   Count of items to remove at the index.
			* @param {Array<Event>} add
			*   Items to add at the index.
			* @returns {undefined}
			*   Nothing.
			*/
			add(index, remove, add) {
				addImplementation(this, index, remove, add, false);
			}
			/**
			* Create an edit: but insert `add` before existing additions, instead of
			* after them.
			*
			* @param {number} index
			*   Index at which to apply the edit.
			* @param {number} remove
			*   Count of items to remove at the index.
			* @param {Array<Event>} add
			*   Items to add at the index.
			* @returns {undefined}
			*   Nothing.
			*/
			addBefore(index, remove, add) {
				addImplementation(this, index, remove, add, true);
			}
			/**
			* Done, change the events.
			*
			* @param {Array<Event>} events
			*   List of events to apply the edits to.
			* @returns {undefined}
			*   Nothing.
			*/
			consume(events) {
				this.map.sort(function(a, b) {
					return a[0] - b[0];
				});
				if (this.map.length === 0) return;
				let index = this.map.length;
				/** @type {Array<Array<Event>>} */
				const vecs = [];
				while (index > 0) {
					index -= 1;
					vecs.push(events.slice(this.map[index][0] + this.map[index][1]), this.map[index][2]);
					events.length = this.map[index][0];
				}
				vecs.push(events.slice());
				events.length = 0;
				let slice = vecs.pop();
				while (slice) {
					for (const element of slice) events.push(element);
					slice = vecs.pop();
				}
				this.map.length = 0;
				this.index.clear();
			}
		};
		/**
		* Create an edit.
		*
		* @param {EditMap} editMap
		*   Edit map to apply to.
		* @param {number} at
		*   Index at which to apply the edit.
		* @param {number} remove
		*   Count of items to remove at the index.
		* @param {Array<Event>} add
		*   Items to add at the index.
		* @param {boolean} before
		*   Insert `add` before existing additions at `at`, instead of after them.
		* @returns {undefined}
		*   Nothing.
		*/
		function addImplementation(editMap, at, remove, add, before) {
			if (remove === 0 && add.length === 0) return;
			const existing = editMap.index.get(at);
			if (existing) {
				existing[1] += remove;
				if (before) {
					add.push(...existing[2]);
					existing[2] = add;
				} else existing[2].push(...add);
				return;
			}
			/** @type {Change} */
			const change = [
				at,
				remove,
				add
			];
			editMap.map.push(change);
			editMap.index.set(at, change);
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/initialize/document.js
		/**
		* @import {
		*   Construct,
		*   ContainerState,
		*   InitialConstruct,
		*   Initializer,
		*   Point,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/**
		* @typedef {[Construct, ContainerState]} StackItem
		*   Construct and its state.
		*/
		/** @type {InitialConstruct} */
		const document$1 = { tokenize: initializeDocument };
		/** @type {Construct} */
		const containerConstruct = { tokenize: tokenizeContainer };
		/**
		* @this {TokenizeContext}
		*   Self.
		* @type {Initializer}
		*   Initializer.
		*/
		function initializeDocument(effects) {
			const self = this;
			/** @type {Array<StackItem>} */
			const stack = [];
			let continued = 0;
			/** @type {TokenizeContext | undefined} */
			let childFlow;
			/** @type {Token | undefined} */
			let childToken;
			/** @type {number} */
			let lineStartOffset;
			return start;
			/** @type {State} */
			function start(code) {
				if (continued < stack.length) {
					const item = stack[continued];
					self.containerState = item[1];
					return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code);
				}
				return checkNewContainers(code);
			}
			/** @type {State} */
			function documentContinue(code) {
				continued++;
				if (self.containerState._closeFlow) {
					self.containerState._closeFlow = void 0;
					if (childFlow) closeFlow();
					const indexBeforeExits = self.events.length;
					let indexBeforeFlow = indexBeforeExits;
					/** @type {Point | undefined} */
					let point;
					while (indexBeforeFlow--) if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
						point = self.events[indexBeforeFlow][1].end;
						break;
					}
					exitContainers(continued);
					let index = indexBeforeExits;
					while (index < self.events.length) {
						self.events[index][1].end = { ...point };
						index++;
					}
					const editMap = new EditMap();
					editMap.add(indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
					editMap.add(indexBeforeExits, index - indexBeforeExits, []);
					editMap.consume(self.events);
					return checkNewContainers(code);
				}
				return start(code);
			}
			/** @type {State} */
			function checkNewContainers(code) {
				if (continued === stack.length) {
					if (!childFlow) return documentContinued(code);
					if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) return flowStart(code);
					self.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
				}
				self.containerState = {};
				return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code);
			}
			/** @type {State} */
			function thereIsANewContainer(code) {
				if (childFlow) closeFlow();
				exitContainers(continued);
				return documentContinued(code);
			}
			/** @type {State} */
			function thereIsNoNewContainer(code) {
				self.parser.lazy[self.now().line] = continued !== stack.length;
				lineStartOffset = self.now().offset;
				return flowStart(code);
			}
			/** @type {State} */
			function documentContinued(code) {
				self.containerState = {};
				return effects.attempt(containerConstruct, containerContinue, flowStart)(code);
			}
			/** @type {State} */
			function containerContinue(code) {
				continued++;
				stack.push([self.currentConstruct, self.containerState]);
				return documentContinued(code);
			}
			/** @type {State} */
			function flowStart(code) {
				if (code === null) {
					if (childFlow) closeFlow();
					exitContainers(0);
					effects.consume(code);
					return;
				}
				childFlow = childFlow || self.parser.flow(self.now());
				effects.enter("chunkFlow", {
					_tokenizer: childFlow,
					contentType: "flow",
					previous: childToken
				});
				return flowContinue(code);
			}
			/** @type {State} */
			function flowContinue(code) {
				if (code === null) {
					writeToChild(effects.exit("chunkFlow"), true);
					exitContainers(0);
					effects.consume(code);
					return;
				}
				if (markdownLineEnding(code)) {
					effects.consume(code);
					writeToChild(effects.exit("chunkFlow"));
					continued = 0;
					self.interrupt = void 0;
					return start;
				}
				effects.consume(code);
				return flowContinue;
			}
			/**
			* @param {Token} token
			*   Token.
			* @param {boolean | undefined} [endOfFile]
			*   Whether the token is at the end of the file (default: `false`).
			* @returns {undefined}
			*   Nothing.
			*/
			function writeToChild(token, endOfFile) {
				const stream = self.sliceStream(token);
				if (endOfFile) stream.push(null);
				token.previous = childToken;
				if (childToken) childToken.next = token;
				childToken = token;
				childFlow.defineSkip(token.start);
				childFlow.write(stream);
				if (self.parser.lazy[token.start.line]) {
					let index = childFlow.events.length;
					while (index--) if (childFlow.events[index][1].start.offset < lineStartOffset && (!childFlow.events[index][1].end || childFlow.events[index][1].end.offset > lineStartOffset)) return;
					const indexBeforeExits = self.events.length;
					let indexBeforeFlow = indexBeforeExits;
					/** @type {boolean | undefined} */
					let seen;
					/** @type {Point | undefined} */
					let point;
					while (indexBeforeFlow--) if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
						if (seen) {
							point = self.events[indexBeforeFlow][1].end;
							break;
						}
						seen = true;
					}
					exitContainers(continued);
					index = indexBeforeExits;
					while (index < self.events.length) {
						self.events[index][1].end = { ...point };
						index++;
					}
					const editMap = new EditMap();
					editMap.add(indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
					editMap.add(indexBeforeExits, index - indexBeforeExits, []);
					editMap.consume(self.events);
				}
			}
			/**
			* @param {number} size
			*   Size.
			* @returns {undefined}
			*   Nothing.
			*/
			function exitContainers(size) {
				let index = stack.length;
				while (index-- > size) {
					const entry = stack[index];
					self.containerState = entry[1];
					entry[0].exit.call(self, effects);
				}
				stack.length = size;
			}
			function closeFlow() {
				childFlow.write([null]);
				childToken = void 0;
				childFlow = void 0;
				self.containerState._closeFlow = void 0;
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*   Tokenizer.
		*/
		function tokenizeContainer(effects, ok, nok) {
			return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-classify-character/index.js
		/**
		* @import {Code} from 'micromark-util-types'
		*/
		/**
		* Classify whether a code represents whitespace, punctuation, or something
		* else.
		*
		* Used for attention (emphasis, strong), whose sequences can open or close
		* based on the class of surrounding characters.
		*
		* > 👉 **Note**: eof (`null`) is seen as whitespace.
		*
		* @param {Code} code
		*   Code.
		* @returns {typeof constants.characterGroupWhitespace | typeof constants.characterGroupPunctuation | undefined}
		*   Group.
		*/
		function classifyCharacter(code) {
			if (code === null || markdownLineEndingOrSpace(code) || unicodeWhitespace(code)) return 1;
			if (unicodePunctuation(code)) return 2;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-resolve-all/index.js
		/**
		* @import {Event, Resolver, TokenizeContext} from 'micromark-util-types'
		*/
		/**
		* Call all `resolveAll`s.
		*
		* @param {ReadonlyArray<{resolveAll?: Resolver | undefined}>} constructs
		*   List of constructs, optionally with `resolveAll`s.
		* @param {Array<Event>} events
		*   List of events.
		* @param {TokenizeContext} context
		*   Context used by `tokenize`.
		* @returns {Array<Event>}
		*   Changed events.
		*/
		function resolveAll(constructs, events, context) {
			/** @type {Array<Resolver>} */
			const called = [];
			let index = -1;
			while (++index < constructs.length) {
				const resolve = constructs[index].resolveAll;
				if (resolve && !called.includes(resolve)) {
					events = resolve(events, context);
					called.push(resolve);
				}
			}
			return events;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/attention.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   Event,
		*   Point,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const attention = {
			name: "attention",
			resolveAll: resolveAllAttention,
			tokenize: tokenizeAttention
		};
		/**
		* Take all events and resolve attention to emphasis or strong.
		*
		* @type {Resolver}
		*/
		function resolveAllAttention(events, context) {
			let index = -1;
			/** @type {Array<Event>} */
			let nextEvents;
			while (++index < events.length) if (events[index][0] === "enter" && events[index][1].type === "attentionSequence" && events[index][1]._close) {
				let open = index;
				while (open--) if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index][1]).charCodeAt(0)) {
					if ((events[open][1]._close || events[index][1]._open) && (events[index][1].end.offset - events[index][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index][1].end.offset - events[index][1].start.offset) % 3)) continue;
					const use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index][1].end.offset - events[index][1].start.offset > 1 ? 2 : 1;
					const start = { ...events[open][1].end };
					const end = { ...events[index][1].start };
					movePoint(start, -use);
					movePoint(end, use);
					const openingSequence = {
						type: use > 1 ? "strongSequence" : "emphasisSequence",
						start,
						end: { ...events[open][1].end }
					};
					const closingSequence = {
						type: use > 1 ? "strongSequence" : "emphasisSequence",
						start: { ...events[index][1].start },
						end
					};
					const text = {
						type: use > 1 ? "strongText" : "emphasisText",
						start: { ...events[open][1].end },
						end: { ...events[index][1].start }
					};
					const group = {
						type: use > 1 ? "strong" : "emphasis",
						start: { ...openingSequence.start },
						end: { ...closingSequence.end }
					};
					events[open][1].end = { ...openingSequence.start };
					events[index][1].start = { ...closingSequence.end };
					nextEvents = [];
					if (events[open][1].end.offset - events[open][1].start.offset) nextEvents = push(nextEvents, [[
						"enter",
						events[open][1],
						context
					], [
						"exit",
						events[open][1],
						context
					]]);
					nextEvents = push(nextEvents, [
						[
							"enter",
							group,
							context
						],
						[
							"enter",
							openingSequence,
							context
						],
						[
							"exit",
							openingSequence,
							context
						],
						[
							"enter",
							text,
							context
						]
					]);
					nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index), context));
					nextEvents = push(nextEvents, [
						[
							"exit",
							text,
							context
						],
						[
							"enter",
							closingSequence,
							context
						],
						[
							"exit",
							closingSequence,
							context
						],
						[
							"exit",
							group,
							context
						]
					]);
					/** @type {number} */
					let offset = 0;
					if (events[index][1].end.offset - events[index][1].start.offset) {
						offset = 2;
						nextEvents = push(nextEvents, [[
							"enter",
							events[index][1],
							context
						], [
							"exit",
							events[index][1],
							context
						]]);
					}
					splice(events, open - 1, index - open + 3, nextEvents);
					index = open + nextEvents.length - offset - 2;
					break;
				}
			}
			index = -1;
			while (++index < events.length) if (events[index][1].type === "attentionSequence") events[index][1].type = "data";
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeAttention(effects, ok) {
			const attentionMarkers = this.parser.constructs.attentionMarkers.null;
			const previous = this.previous;
			const before = classifyCharacter(previous);
			/** @type {NonNullable<Code>} */
			let marker;
			return start;
			/**
			* Before a sequence.
			*
			* ```markdown
			* > | **
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				marker = code;
				effects.enter("attentionSequence");
				return inside(code);
			}
			/**
			* In a sequence.
			*
			* ```markdown
			* > | **
			*     ^^
			* ```
			*
			* @type {State}
			*/
			function inside(code) {
				if (code === marker) {
					effects.consume(code);
					return inside;
				}
				const token = effects.exit("attentionSequence");
				const after = classifyCharacter(code);
				const open = !after || after === 2 && before || attentionMarkers.includes(code) && code !== 42 && code !== 95;
				const close = !before || before === 2 && after || attentionMarkers.includes(previous) && previous !== 42 && previous !== 95;
				token._open = Boolean(marker === 42 ? open : open && (before || !close));
				token._close = Boolean(marker === 42 ? close : close && (after || !open));
				return ok(code);
			}
		}
		/**
		* Move a point a bit.
		*
		* Note: `move` only works inside lines! It’s not possible to move past other
		* chunks (replacement characters, tabs, or line endings).
		*
		* @param {Point} point
		*   Point.
		* @param {number} offset
		*   Amount to move.
		* @returns {undefined}
		*   Nothing.
		*/
		function movePoint(point, offset) {
			point.column += offset;
			point.offset += offset;
			point._bufferIndex += offset;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/autolink.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const autolink = {
			name: "autolink",
			tokenize: tokenizeAutolink
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeAutolink(effects, ok, nok) {
			let size = 0;
			return start;
			/**
			* Start of an autolink.
			*
			* ```markdown
			* > | a<https://example.com>b
			*      ^
			* > | a<user@example.com>b
			*      ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("autolink");
				effects.enter("autolinkMarker");
				effects.consume(code);
				effects.exit("autolinkMarker");
				effects.enter("autolinkProtocol");
				return open;
			}
			/**
			* After `<`, at protocol or atext.
			*
			* ```markdown
			* > | a<https://example.com>b
			*       ^
			* > | a<user@example.com>b
			*       ^
			* ```
			*
			* @type {State}
			*/
			function open(code) {
				if (asciiAlpha(code)) {
					effects.consume(code);
					return schemeOrEmailAtext;
				}
				if (code === 64) return nok(code);
				return emailAtext(code);
			}
			/**
			* At second byte of protocol or atext.
			*
			* ```markdown
			* > | a<https://example.com>b
			*        ^
			* > | a<user@example.com>b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function schemeOrEmailAtext(code) {
				if (code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) {
					size = 1;
					return schemeInsideOrEmailAtext(code);
				}
				return emailAtext(code);
			}
			/**
			* In ambiguous protocol or atext.
			*
			* ```markdown
			* > | a<https://example.com>b
			*        ^
			* > | a<user@example.com>b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function schemeInsideOrEmailAtext(code) {
				if (code === 58) {
					effects.consume(code);
					size = 0;
					return urlInside;
				}
				if ((code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) && size++ < 32) {
					effects.consume(code);
					return schemeInsideOrEmailAtext;
				}
				size = 0;
				return emailAtext(code);
			}
			/**
			* After protocol, in URL.
			*
			* ```markdown
			* > | a<https://example.com>b
			*             ^
			* ```
			*
			* @type {State}
			*/
			function urlInside(code) {
				if (code === 62) {
					effects.exit("autolinkProtocol");
					effects.enter("autolinkMarker");
					effects.consume(code);
					effects.exit("autolinkMarker");
					effects.exit("autolink");
					return ok;
				}
				if (code === null || code === 32 || code === 60 || asciiControl(code)) return nok(code);
				effects.consume(code);
				return urlInside;
			}
			/**
			* In email atext.
			*
			* ```markdown
			* > | a<user.name@example.com>b
			*              ^
			* ```
			*
			* @type {State}
			*/
			function emailAtext(code) {
				if (code === 64) {
					effects.consume(code);
					return emailAtSignOrDot;
				}
				if (asciiAtext(code)) {
					effects.consume(code);
					return emailAtext;
				}
				return nok(code);
			}
			/**
			* In label, after at-sign or dot.
			*
			* ```markdown
			* > | a<user.name@example.com>b
			*                 ^       ^
			* ```
			*
			* @type {State}
			*/
			function emailAtSignOrDot(code) {
				return asciiAlphanumeric(code) ? emailLabel(code) : nok(code);
			}
			/**
			* In label, where `.` and `>` are allowed.
			*
			* ```markdown
			* > | a<user.name@example.com>b
			*                   ^
			* ```
			*
			* @type {State}
			*/
			function emailLabel(code) {
				if (code === 46) {
					effects.consume(code);
					size = 0;
					return emailAtSignOrDot;
				}
				if (code === 62) {
					effects.exit("autolinkProtocol").type = "autolinkEmail";
					effects.enter("autolinkMarker");
					effects.consume(code);
					effects.exit("autolinkMarker");
					effects.exit("autolink");
					return ok;
				}
				return emailValue(code);
			}
			/**
			* In label, where `.` and `>` are *not* allowed.
			*
			* Though, this is also used in `emailLabel` to parse other values.
			*
			* ```markdown
			* > | a<user.name@ex-ample.com>b
			*                    ^
			* ```
			*
			* @type {State}
			*/
			function emailValue(code) {
				if ((code === 45 || asciiAlphanumeric(code)) && size++ < 63) {
					const next = code === 45 ? emailValue : emailLabel;
					effects.consume(code);
					return next;
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/blank-line.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const blankLine = {
			partial: true,
			tokenize: tokenizeBlankLine
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeBlankLine(effects, ok, nok) {
			return start;
			/**
			* Start of blank line.
			*
			* > 👉 **Note**: `␠` represents a space character.
			*
			* ```markdown
			* > | ␠␠␊
			*     ^
			* > | ␊
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				return markdownSpace(code) ? factorySpace(effects, after, "linePrefix")(code) : after(code);
			}
			/**
			* At eof/eol, after optional whitespace.
			*
			* > 👉 **Note**: `␠` represents a space character.
			*
			* ```markdown
			* > | ␠␠␊
			*       ^
			* > | ␊
			*     ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/block-quote.js
		/**
		* @import {
		*   Construct,
		*   Exiter,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const blockQuote = {
			continuation: { tokenize: tokenizeBlockQuoteContinuation },
			exit,
			name: "blockQuote",
			tokenize: tokenizeBlockQuoteStart
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeBlockQuoteStart(effects, ok, nok) {
			const self = this;
			return start;
			/**
			* Start of block quote.
			*
			* ```markdown
			* > | > a
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				if (code === 62) {
					const state = self.containerState;
					if (!state.open) {
						effects.enter("blockQuote", { _container: true });
						state.open = true;
					}
					effects.enter("blockQuotePrefix");
					effects.enter("blockQuoteMarker");
					effects.consume(code);
					effects.exit("blockQuoteMarker");
					return after;
				}
				return nok(code);
			}
			/**
			* After `>`, before optional whitespace.
			*
			* ```markdown
			* > | > a
			*      ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				if (markdownSpace(code)) {
					effects.enter("blockQuotePrefixWhitespace");
					effects.consume(code);
					effects.exit("blockQuotePrefixWhitespace");
					effects.exit("blockQuotePrefix");
					return ok;
				}
				effects.exit("blockQuotePrefix");
				return ok(code);
			}
		}
		/**
		* Start of block quote continuation.
		*
		* ```markdown
		*   | > a
		* > | > b
		*     ^
		* ```
		*
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeBlockQuoteContinuation(effects, ok, nok) {
			const self = this;
			return contStart;
			/**
			* Start of block quote continuation.
			*
			* Also used to parse the first block quote opening.
			*
			* ```markdown
			*   | > a
			* > | > b
			*     ^
			* ```
			*
			* @type {State}
			*/
			function contStart(code) {
				if (markdownSpace(code)) return factorySpace(effects, contBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
				return contBefore(code);
			}
			/**
			* At `>`, after optional whitespace.
			*
			* Also used to parse the first block quote opening.
			*
			* ```markdown
			*   | > a
			* > | > b
			*     ^
			* ```
			*
			* @type {State}
			*/
			function contBefore(code) {
				return effects.attempt(blockQuote, ok, nok)(code);
			}
		}
		/** @type {Exiter} */
		function exit(effects) {
			effects.exit("blockQuote");
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/character-escape.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const characterEscape = {
			name: "characterEscape",
			tokenize: tokenizeCharacterEscape
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeCharacterEscape(effects, ok, nok) {
			return start;
			/**
			* Start of character escape.
			*
			* ```markdown
			* > | a\*b
			*      ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("characterEscape");
				effects.enter("escapeMarker");
				effects.consume(code);
				effects.exit("escapeMarker");
				return inside;
			}
			/**
			* After `\`, at punctuation.
			*
			* ```markdown
			* > | a\*b
			*       ^
			* ```
			*
			* @type {State}
			*/
			function inside(code) {
				if (asciiPunctuation(code)) {
					effects.enter("characterEscapeValue");
					effects.consume(code);
					effects.exit("characterEscapeValue");
					effects.exit("characterEscape");
					return ok;
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/character-reference.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const characterReference = {
			name: "characterReference",
			tokenize: tokenizeCharacterReference
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeCharacterReference(effects, ok, nok) {
			const self = this;
			let size = 0;
			/** @type {number} */
			let max;
			/** @type {(code: Code) => boolean} */
			let test;
			return start;
			/**
			* Start of character reference.
			*
			* ```markdown
			* > | a&amp;b
			*      ^
			* > | a&#123;b
			*      ^
			* > | a&#x9;b
			*      ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("characterReference");
				effects.enter("characterReferenceMarker");
				effects.consume(code);
				effects.exit("characterReferenceMarker");
				return open;
			}
			/**
			* After `&`, at `#` for numeric references or alphanumeric for named
			* references.
			*
			* ```markdown
			* > | a&amp;b
			*       ^
			* > | a&#123;b
			*       ^
			* > | a&#x9;b
			*       ^
			* ```
			*
			* @type {State}
			*/
			function open(code) {
				if (code === 35) {
					effects.enter("characterReferenceMarkerNumeric");
					effects.consume(code);
					effects.exit("characterReferenceMarkerNumeric");
					return numeric;
				}
				effects.enter("characterReferenceValue");
				max = 31;
				test = asciiAlphanumeric;
				return value(code);
			}
			/**
			* After `#`, at `x` for hexadecimals or digit for decimals.
			*
			* ```markdown
			* > | a&#123;b
			*        ^
			* > | a&#x9;b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function numeric(code) {
				if (code === 88 || code === 120) {
					effects.enter("characterReferenceMarkerHexadecimal");
					effects.consume(code);
					effects.exit("characterReferenceMarkerHexadecimal");
					effects.enter("characterReferenceValue");
					max = 6;
					test = asciiHexDigit;
					return value;
				}
				effects.enter("characterReferenceValue");
				max = 7;
				test = asciiDigit;
				return value(code);
			}
			/**
			* After markers (`&#x`, `&#`, or `&`), in value, before `;`.
			*
			* The character reference kind defines what and how many characters are
			* allowed.
			*
			* ```markdown
			* > | a&amp;b
			*       ^^^
			* > | a&#123;b
			*        ^^^
			* > | a&#x9;b
			*         ^
			* ```
			*
			* @type {State}
			*/
			function value(code) {
				if (code === 59 && size) {
					const token = effects.exit("characterReferenceValue");
					if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self.sliceSerialize(token))) return nok(code);
					effects.enter("characterReferenceMarker");
					effects.consume(code);
					effects.exit("characterReferenceMarker");
					effects.exit("characterReference");
					return ok;
				}
				if (test(code) && size++ < max) {
					effects.consume(code);
					return value;
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/partial-non-lazy-continuation.js
		/** @type {Construct} */
		const nonLazyContinuation = {
			partial: true,
			tokenize: tokenizeNonLazyContinuation
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeNonLazyContinuation(effects, ok, nok) {
			const self = this;
			return start;
			/**
			* At eol, before continuation.
			*
			* ```markdown
			* > | * ```js
			*            ^
			*   | b
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				if (code === null) return nok(code);
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return after;
			}
			/**
			* A continuation.
			*
			* ```markdown
			*   | * ```js
			* > | b
			*     ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/code-fenced.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const codeFenced = {
			concrete: true,
			name: "codeFenced",
			tokenize: tokenizeCodeFenced
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeCodeFenced(effects, ok, nok) {
			const self = this;
			/** @type {Construct} */
			const closeStart = {
				partial: true,
				tokenize: tokenizeCloseStart
			};
			let initialPrefix = 0;
			let sizeOpen = 0;
			/** @type {NonNullable<Code>} */
			let marker;
			return start;
			/**
			* Start of code.
			*
			* ```markdown
			* > | ~~~js
			*     ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				return beforeSequenceOpen(code);
			}
			/**
			* In opening fence, after prefix, at sequence.
			*
			* ```markdown
			* > | ~~~js
			*     ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function beforeSequenceOpen(code) {
				const tail = self.events[self.events.length - 1];
				initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
				marker = code;
				effects.enter("codeFenced");
				effects.enter("codeFencedFence");
				effects.enter("codeFencedFenceSequence");
				return sequenceOpen(code);
			}
			/**
			* In opening fence sequence.
			*
			* ```markdown
			* > | ~~~js
			*      ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function sequenceOpen(code) {
				if (code === marker) {
					sizeOpen++;
					effects.consume(code);
					return sequenceOpen;
				}
				if (sizeOpen < 3) return nok(code);
				effects.exit("codeFencedFenceSequence");
				return markdownSpace(code) ? factorySpace(effects, infoBefore, "whitespace")(code) : infoBefore(code);
			}
			/**
			* In opening fence, after the sequence (and optional whitespace), before info.
			*
			* ```markdown
			* > | ~~~js
			*        ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function infoBefore(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("codeFencedFence");
					return self.interrupt ? ok(code) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
				}
				effects.enter("codeFencedFenceInfo");
				effects.enter("chunkString", { contentType: "string" });
				return info(code);
			}
			/**
			* In info.
			*
			* ```markdown
			* > | ~~~js
			*        ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function info(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("chunkString");
					effects.exit("codeFencedFenceInfo");
					return infoBefore(code);
				}
				if (markdownSpace(code)) {
					effects.exit("chunkString");
					effects.exit("codeFencedFenceInfo");
					return factorySpace(effects, metaBefore, "whitespace")(code);
				}
				if (code === 96 && code === marker) return nok(code);
				effects.consume(code);
				return info;
			}
			/**
			* In opening fence, after info and whitespace, before meta.
			*
			* ```markdown
			* > | ~~~js eval
			*           ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function metaBefore(code) {
				if (code === null || markdownLineEnding(code)) return infoBefore(code);
				effects.enter("codeFencedFenceMeta");
				effects.enter("chunkString", { contentType: "string" });
				return meta(code);
			}
			/**
			* In meta.
			*
			* ```markdown
			* > | ~~~js eval
			*           ^
			*   | alert(1)
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function meta(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("chunkString");
					effects.exit("codeFencedFenceMeta");
					return infoBefore(code);
				}
				if (code === 96 && code === marker) return nok(code);
				effects.consume(code);
				return meta;
			}
			/**
			* At eol/eof in code, before a non-lazy closing fence or content.
			*
			* ```markdown
			* > | ~~~js
			*          ^
			* > | alert(1)
			*             ^
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function atNonLazyBreak(code) {
				return effects.attempt(closeStart, after, contentBefore)(code);
			}
			/**
			* Before code content, not a closing fence, at eol.
			*
			* ```markdown
			*   | ~~~js
			* > | alert(1)
			*             ^
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function contentBefore(code) {
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return contentStart;
			}
			/**
			* Before code content, not a closing fence.
			*
			* ```markdown
			*   | ~~~js
			* > | alert(1)
			*     ^
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function contentStart(code) {
				return initialPrefix > 0 && markdownSpace(code) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code) : beforeContentChunk(code);
			}
			/**
			* Before code content, after optional prefix.
			*
			* ```markdown
			*   | ~~~js
			* > | alert(1)
			*     ^
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function beforeContentChunk(code) {
				if (code === null || markdownLineEnding(code)) return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
				effects.enter("codeFlowValue");
				return contentChunk(code);
			}
			/**
			* In code content.
			*
			* ```markdown
			*   | ~~~js
			* > | alert(1)
			*     ^^^^^^^^
			*   | ~~~
			* ```
			*
			* @type {State}
			*/
			function contentChunk(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("codeFlowValue");
					return beforeContentChunk(code);
				}
				effects.consume(code);
				return contentChunk;
			}
			/**
			* After code.
			*
			* ```markdown
			*   | ~~~js
			*   | alert(1)
			* > | ~~~
			*        ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				effects.exit("codeFenced");
				return ok(code);
			}
			/**
			* @this {TokenizeContext}
			*   Context.
			* @type {Tokenizer}
			*/
			function tokenizeCloseStart(effects, ok, nok) {
				let size = 0;
				return startBefore;
				/**
				*
				*
				* @type {State}
				*/
				function startBefore(code) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					return start;
				}
				/**
				* Before closing fence, at optional whitespace.
				*
				* ```markdown
				*   | ~~~js
				*   | alert(1)
				* > | ~~~
				*     ^
				* ```
				*
				* @type {State}
				*/
				function start(code) {
					effects.enter("codeFencedFence");
					return markdownSpace(code) ? factorySpace(effects, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : beforeSequenceClose(code);
				}
				/**
				* In closing fence, after optional whitespace, at sequence.
				*
				* ```markdown
				*   | ~~~js
				*   | alert(1)
				* > | ~~~
				*     ^
				* ```
				*
				* @type {State}
				*/
				function beforeSequenceClose(code) {
					if (code === marker) {
						effects.enter("codeFencedFenceSequence");
						return sequenceClose(code);
					}
					return nok(code);
				}
				/**
				* In closing fence sequence.
				*
				* ```markdown
				*   | ~~~js
				*   | alert(1)
				* > | ~~~
				*     ^
				* ```
				*
				* @type {State}
				*/
				function sequenceClose(code) {
					if (code === marker) {
						size++;
						effects.consume(code);
						return sequenceClose;
					}
					if (size >= sizeOpen) {
						effects.exit("codeFencedFenceSequence");
						return markdownSpace(code) ? factorySpace(effects, sequenceCloseAfter, "whitespace")(code) : sequenceCloseAfter(code);
					}
					return nok(code);
				}
				/**
				* After closing fence sequence, after optional whitespace.
				*
				* ```markdown
				*   | ~~~js
				*   | alert(1)
				* > | ~~~
				*        ^
				* ```
				*
				* @type {State}
				*/
				function sequenceCloseAfter(code) {
					if (code === null || markdownLineEnding(code)) {
						effects.exit("codeFencedFence");
						return ok(code);
					}
					return nok(code);
				}
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/code-indented.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const codeIndented = {
			name: "codeIndented",
			tokenize: tokenizeCodeIndented
		};
		/** @type {Construct} */
		const furtherStart = {
			partial: true,
			tokenize: tokenizeFurtherStart
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeCodeIndented(effects, ok, nok) {
			return start;
			/**
			* Start of code (indented).
			*
			* > **Parsing note**: it is not needed to check if this first line is a
			* > filled line (that it has a non-whitespace character), because blank lines
			* > are parsed already, so we never run into that.
			*
			* ```markdown
			* > |     aaa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("codeIndented");
				return factorySpaceMinMax(effects, atBreak, nok, "linePrefix", 4, 4)(code);
			}
			/**
			* At a break.
			*
			* ```markdown
			* > |     aaa
			*         ^  ^
			* ```
			*
			* @type {State}
			*/
			function atBreak(code) {
				if (code === null) return after(code);
				if (markdownLineEnding(code)) return effects.attempt(furtherStart, atBreak, after)(code);
				effects.enter("codeFlowValue");
				return inside(code);
			}
			/**
			* In code content.
			*
			* ```markdown
			* > |     aaa
			*         ^^^^
			* ```
			*
			* @type {State}
			*/
			function inside(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("codeFlowValue");
					return atBreak(code);
				}
				effects.consume(code);
				return inside;
			}
			/** @type {State} */
			function after(code) {
				effects.exit("codeIndented");
				return ok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeFurtherStart(effects, ok, nok) {
			const self = this;
			return furtherStart;
			/**
			* At eol, trying to parse another indent.
			*
			* ```markdown
			* > |     aaa
			*            ^
			*   |     bbb
			* ```
			*
			* @type {State}
			*/
			function furtherStart(code) {
				if (self.parser.lazy[self.now().line]) return nok(code);
				if (markdownLineEnding(code)) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					return furtherStart;
				}
				return factorySpaceMinMax(effects, ok, onNotEnoughPrefix, "linePrefix", 4, 4)(code);
			}
			/**
			* After not enough of a prefix.
			*
			* A following line ending is another (potentially blank) line to try,
			* anything else means this isn’t a continuation.
			*
			* ```markdown
			* > |     aaa
			*
			*   |     bbb
			* ```
			*
			* @type {State}
			*/
			function onNotEnoughPrefix(code) {
				return markdownLineEnding(code) ? furtherStart(code) : nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/code-text.js
		/**
		* @import {
		*   Construct,
		*   Previous,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const codeText = {
			name: "codeText",
			previous,
			resolve: resolveCodeText,
			tokenize: tokenizeCodeText
		};
		/** @type {Resolver} */
		function resolveCodeText(events) {
			let tailExitIndex = events.length - 4;
			let headEnterIndex = 3;
			/** @type {number} */
			let index;
			/** @type {number | undefined} */
			let enter;
			if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
				index = headEnterIndex;
				while (++index < tailExitIndex) if (events[index][1].type === "codeTextData") {
					events[headEnterIndex][1].type = "codeTextPadding";
					events[tailExitIndex][1].type = "codeTextPadding";
					headEnterIndex += 2;
					tailExitIndex -= 2;
					break;
				}
			}
			index = headEnterIndex - 1;
			tailExitIndex++;
			while (++index <= tailExitIndex) if (enter === void 0) {
				if (index !== tailExitIndex && events[index][1].type !== "lineEnding") enter = index;
			} else if (index === tailExitIndex || events[index][1].type === "lineEnding") {
				events[enter][1].type = "codeTextData";
				if (index !== enter + 2) {
					events[enter][1].end = events[index - 1][1].end;
					events.splice(enter + 2, index - enter - 2);
					tailExitIndex -= index - enter - 2;
					index = enter + 2;
				}
				enter = void 0;
			}
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Previous}
		*/
		function previous(code) {
			return code !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeCodeText(effects, ok, nok) {
			let sizeOpen = 0;
			/** @type {number} */
			let size;
			/** @type {Token} */
			let token;
			return start;
			/**
			* Start of code (text).
			*
			* ```markdown
			* > | `a`
			*     ^
			* > | \`a`
			*      ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("codeText");
				effects.enter("codeTextSequence");
				return sequenceOpen(code);
			}
			/**
			* In opening sequence.
			*
			* ```markdown
			* > | `a`
			*     ^
			* ```
			*
			* @type {State}
			*/
			function sequenceOpen(code) {
				if (code === 96) {
					effects.consume(code);
					sizeOpen++;
					return sequenceOpen;
				}
				effects.exit("codeTextSequence");
				return between(code);
			}
			/**
			* Between something and something else.
			*
			* ```markdown
			* > | `a`
			*      ^^
			* ```
			*
			* @type {State}
			*/
			function between(code) {
				if (code === null) return nok(code);
				if (code === 32) {
					effects.enter("space");
					effects.consume(code);
					effects.exit("space");
					return between;
				}
				if (code === 96) {
					token = effects.enter("codeTextSequence");
					size = 0;
					return sequenceClose(code);
				}
				if (markdownLineEnding(code)) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					return between;
				}
				effects.enter("codeTextData");
				return data(code);
			}
			/**
			* In data.
			*
			* ```markdown
			* > | `a`
			*      ^
			* ```
			*
			* @type {State}
			*/
			function data(code) {
				if (code === null || code === 32 || code === 96 || markdownLineEnding(code)) {
					effects.exit("codeTextData");
					return between(code);
				}
				effects.consume(code);
				return data;
			}
			/**
			* In closing sequence.
			*
			* ```markdown
			* > | `a`
			*       ^
			* ```
			*
			* @type {State}
			*/
			function sequenceClose(code) {
				if (code === 96) {
					effects.consume(code);
					size++;
					return sequenceClose;
				}
				if (size === sizeOpen) {
					effects.exit("codeTextSequence");
					effects.exit("codeText");
					return ok(code);
				}
				token.type = "codeTextData";
				return data(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-subtokenize/lib/splice-buffer.js
		/**
		* Some of the internal operations of micromark do lots of editing
		* operations on very large arrays. This runs into problems with two
		* properties of most circa-2020 JavaScript interpreters:
		*
		*  - Array-length modifications at the high end of an array (push/pop) are
		*    expected to be common and are implemented in (amortized) time
		*    proportional to the number of elements added or removed, whereas
		*    other operations (shift/unshift and splice) are much less efficient.
		*  - Function arguments are passed on the stack, so adding tens of thousands
		*    of elements to an array with `arr.push(...newElements)` will frequently
		*    cause stack overflows. (see <https://stackoverflow.com/questions/22123769/rangeerror-maximum-call-stack-size-exceeded-why>)
		*
		* SpliceBuffers are an implementation of gap buffers, which are a
		* generalization of the "queue made of two stacks" idea. The splice buffer
		* maintains a cursor, and moving the cursor has cost proportional to the
		* distance the cursor moves, but inserting, deleting, or splicing in
		* new information at the cursor is as efficient as the push/pop operation.
		* This allows for an efficient sequence of splices (or pushes, pops, shifts,
		* or unshifts) as long such edits happen at the same part of the array or
		* generally sweep through the array from the beginning to the end.
		*
		* The interface for splice buffers also supports large numbers of inputs by
		* passing a single array argument rather passing multiple arguments on the
		* function call stack.
		*
		* @template T
		*   Item type.
		*/
		var SpliceBuffer = class {
			/**
			* @param {ReadonlyArray<T> | null | undefined} [initial]
			*   Initial items (optional).
			* @returns
			*   Splice buffer.
			*/
			constructor(initial) {
				/** @type {Array<T>} */
				this.left = initial ? [...initial] : [];
				/** @type {Array<T>} */
				this.right = [];
			}
			/**
			* Array access;
			* does not move the cursor.
			*
			* @param {number} index
			*   Index.
			* @return {T}
			*   Item.
			*/
			get(index) {
				if (index < 0 || index >= this.left.length + this.right.length) throw new RangeError("Cannot access index `" + index + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
				if (index < this.left.length) return this.left[index];
				return this.right[this.right.length - index + this.left.length - 1];
			}
			/**
			* The length of the splice buffer, one greater than the largest index in the
			* array.
			*/
			get length() {
				return this.left.length + this.right.length;
			}
			/**
			* Remove and return `list[0]`;
			* moves the cursor to `0`.
			*
			* @returns {T | undefined}
			*   Item, optional.
			*/
			shift() {
				this.setCursor(0);
				return this.right.pop();
			}
			/**
			* Slice the buffer to get an array;
			* does not move the cursor.
			*
			* @param {number} start
			*   Start.
			* @param {number | null | undefined} [end]
			*   End (optional).
			* @returns {Array<T>}
			*   Array of items.
			*/
			slice(start, end) {
				/** @type {number} */
				const stop = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
				if (stop < this.left.length) return this.left.slice(start, stop);
				if (start > this.left.length) return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start + this.left.length).reverse();
				return this.left.slice(start).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
			}
			/**
			* Mimics the behavior of Array.prototype.splice() except for the change of
			* interface necessary to avoid segfaults when patching in very large arrays.
			*
			* This operation moves cursor is moved to `start` and results in the cursor
			* placed after any inserted items.
			*
			* @param {number} start
			*   Start;
			*   zero-based index at which to start changing the array;
			*   negative numbers count backwards from the end of the array and values
			*   that are out-of bounds are clamped to the appropriate end of the array.
			* @param {number | null | undefined} [deleteCount=0]
			*   Delete count (default: `0`);
			*   maximum number of elements to delete, starting from start.
			* @param {Array<T> | null | undefined} [items=[]]
			*   Items to include in place of the deleted items (default: `[]`).
			* @return {Array<T>}
			*   Any removed items.
			*/
			splice(start, deleteCount, items) {
				/** @type {number} */
				const count = deleteCount || 0;
				this.setCursor(Math.trunc(start));
				const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
				if (items) chunkedPush(this.left, items);
				return removed.reverse();
			}
			/**
			* Remove and return the highest-numbered item in the array, so
			* `list[list.length - 1]`;
			* Moves the cursor to `length`.
			*
			* @returns {T | undefined}
			*   Item, optional.
			*/
			pop() {
				this.setCursor(Number.POSITIVE_INFINITY);
				return this.left.pop();
			}
			/**
			* Inserts a single item to the high-numbered side of the array;
			* moves the cursor to `length`.
			*
			* @param {T} item
			*   Item.
			* @returns {undefined}
			*   Nothing.
			*/
			push(item) {
				this.setCursor(Number.POSITIVE_INFINITY);
				this.left.push(item);
			}
			/**
			* Inserts many items to the high-numbered side of the array.
			* Moves the cursor to `length`.
			*
			* @param {Array<T>} items
			*   Items.
			* @returns {undefined}
			*   Nothing.
			*/
			pushMany(items) {
				this.setCursor(Number.POSITIVE_INFINITY);
				chunkedPush(this.left, items);
			}
			/**
			* Inserts a single item to the low-numbered side of the array;
			* Moves the cursor to `0`.
			*
			* @param {T} item
			*   Item.
			* @returns {undefined}
			*   Nothing.
			*/
			unshift(item) {
				this.setCursor(0);
				this.right.push(item);
			}
			/**
			* Inserts many items to the low-numbered side of the array;
			* moves the cursor to `0`.
			*
			* @param {Array<T>} items
			*   Items.
			* @returns {undefined}
			*   Nothing.
			*/
			unshiftMany(items) {
				this.setCursor(0);
				chunkedPush(this.right, items.reverse());
			}
			/**
			* Move the cursor to a specific position in the array. Requires
			* time proportional to the distance moved.
			*
			* If `n < 0`, the cursor will end up at the beginning.
			* If `n > length`, the cursor will end up at the end.
			*
			* @param {number} n
			*   Position.
			* @return {undefined}
			*   Nothing.
			*/
			setCursor(n) {
				if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
				if (n < this.left.length) {
					const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
					chunkedPush(this.right, removed.reverse());
				} else {
					const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
					chunkedPush(this.left, removed.reverse());
				}
			}
		};
		/**
		* Avoid stack overflow by pushing items onto the stack in segments
		*
		* @template T
		*   Item type.
		* @param {Array<T>} list
		*   List to inject into.
		* @param {ReadonlyArray<T>} right
		*   Items to inject.
		* @return {undefined}
		*   Nothing.
		*/
		function chunkedPush(list, right) {
			/** @type {number} */
			let chunkStart = 0;
			if (right.length < 1e4) list.push(...right);
			else while (chunkStart < right.length) {
				list.push(...right.slice(chunkStart, chunkStart + 1e4));
				chunkStart += 1e4;
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-subtokenize/index.js
		/**
		* @import {Chunk, Event, Token} from 'micromark-util-types'
		*/
		/**
		* Tokenize subcontent.
		*
		* @param {Array<Event>} eventsArray
		*   List of events.
		* @returns {boolean}
		*   Whether subtokens were found.
		*/
		function subtokenize(eventsArray) {
			/** @type {Record<string, number>} */
			const jumps = {};
			let index = -1;
			/** @type {Event} */
			let event;
			/** @type {number | undefined} */
			let lineIndex;
			/** @type {number} */
			let otherIndex;
			/** @type {Event} */
			let otherEvent;
			/** @type {Array<Event>} */
			let parameters;
			/** @type {Array<Event>} */
			let subevents;
			/** @type {boolean | undefined} */
			let more;
			const events = new SpliceBuffer(eventsArray);
			while (++index < events.length) {
				while (index in jumps) index = jumps[index];
				event = events.get(index);
				if (index && event[1].type === "chunkFlow" && events.get(index - 1)[1].type === "listItemPrefix") {
					subevents = event[1]._tokenizer.events;
					otherIndex = 0;
					if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") otherIndex += 2;
					if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") while (++otherIndex < subevents.length) {
						if (subevents[otherIndex][1].type === "content") break;
						if (subevents[otherIndex][1].type === "chunkText") {
							subevents[otherIndex][1]._isInFirstContentOfListItem = true;
							otherIndex++;
						}
					}
				}
				if (event[0] === "enter") {
					if (event[1].contentType) {
						Object.assign(jumps, subcontent(events, index));
						index = jumps[index];
						more = true;
					}
				} else if (event[1]._container) {
					otherIndex = index;
					lineIndex = void 0;
					while (otherIndex--) {
						otherEvent = events.get(otherIndex);
						if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
							if (otherEvent[0] === "enter") {
								if (lineIndex) events.get(lineIndex)[1].type = "lineEndingBlank";
								otherEvent[1].type = "lineEnding";
								lineIndex = otherIndex;
							}
						} else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {} else break;
					}
					if (lineIndex) {
						event[1].end = { ...events.get(lineIndex)[1].start };
						parameters = events.slice(lineIndex, index);
						parameters.unshift(event);
						events.splice(lineIndex, index - lineIndex + 1, parameters);
					}
				}
			}
			splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
			return !more;
		}
		/**
		* Tokenize embedded tokens.
		*
		* @param {SpliceBuffer<Event>} events
		*   Events.
		* @param {number} eventIndex
		*   Index.
		* @returns {Record<string, number>}
		*   Gaps.
		*/
		function subcontent(events, eventIndex) {
			const token = events.get(eventIndex)[1];
			const context = events.get(eventIndex)[2];
			let startPosition = eventIndex - 1;
			/** @type {Array<number>} */
			const startPositions = [];
			let tokenizer = token._tokenizer;
			if (!tokenizer) {
				tokenizer = context.parser[token.contentType](token.start);
				if (token._contentTypeTextTrailing) tokenizer._contentTypeTextTrailing = true;
			}
			const childEvents = tokenizer.events;
			/** @type {Array<[number, number]>} */
			const jumps = [];
			/** @type {Record<string, number>} */
			const gaps = {};
			/** @type {Array<Chunk>} */
			let stream;
			/** @type {Token | undefined} */
			let previous;
			let index = -1;
			/** @type {Token | undefined} */
			let current = token;
			let adjust = 0;
			let start = 0;
			const breaks = [start];
			while (current) {
				while (events.get(++startPosition)[1] !== current);
				startPositions.push(startPosition);
				if (!current._tokenizer) {
					stream = context.sliceStream(current);
					if (!current.next) stream.push(null);
					if (previous) tokenizer.defineSkip(current.start);
					if (current._isInFirstContentOfListItem) tokenizer._gfmTasklistFirstContentOfListItem = true;
					tokenizer.write(stream);
					if (current._isInFirstContentOfListItem) tokenizer._gfmTasklistFirstContentOfListItem = void 0;
				}
				previous = current;
				current = current.next;
			}
			current = token;
			while (++index < childEvents.length) if (childEvents[index][0] === "exit" && childEvents[index - 1][0] === "enter" && childEvents[index][1].type === childEvents[index - 1][1].type && childEvents[index][1].start.line !== childEvents[index][1].end.line) {
				start = index + 1;
				breaks.push(start);
				current._tokenizer = void 0;
				current.previous = void 0;
				current = current.next;
			}
			tokenizer.events = [];
			if (current) {
				current._tokenizer = void 0;
				current.previous = void 0;
			} else breaks.pop();
			index = breaks.length;
			while (index--) {
				const slice = childEvents.slice(breaks[index], breaks[index + 1]);
				const start = startPositions.pop();
				jumps.push([start, start + slice.length - 1]);
				events.splice(start, 2, slice);
			}
			jumps.reverse();
			index = -1;
			while (++index < jumps.length) {
				gaps[adjust + jumps[index][0]] = adjust + jumps[index][1];
				adjust += jumps[index][1] - jumps[index][0] - 1;
			}
			return gaps;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/content.js
		/**
		* @import {
		*   Construct,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/**
		* No name because it must not be turned off.
		* @type {Construct}
		*/
		const content = {
			resolve: resolveContent,
			tokenize: tokenizeContent
		};
		/** @type {Construct} */
		const continuationConstruct = {
			partial: true,
			tokenize: tokenizeContinuation
		};
		/**
		* Content is transparent: it’s parsed right now. That way, definitions are also
		* parsed right now: before text in paragraphs (specifically, media) are parsed.
		*
		* @type {Resolver}
		*/
		function resolveContent(events) {
			subtokenize(events);
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeContent(effects, ok) {
			/** @type {Token | undefined} */
			let previous;
			return chunkStart;
			/**
			* Before a content chunk.
			*
			* ```markdown
			* > | abc
			*     ^
			* ```
			*
			* @type {State}
			*/
			function chunkStart(code) {
				effects.enter("content");
				previous = effects.enter("chunkContent", { contentType: "content" });
				return chunkInside(code);
			}
			/**
			* In a content chunk.
			*
			* ```markdown
			* > | abc
			*     ^^^
			* ```
			*
			* @type {State}
			*/
			function chunkInside(code) {
				if (code === null) return contentEnd(code);
				if (markdownLineEnding(code)) return effects.check(continuationConstruct, contentContinue, contentEnd)(code);
				effects.consume(code);
				return chunkInside;
			}
			/**
			*
			*
			* @type {State}
			*/
			function contentEnd(code) {
				effects.exit("chunkContent");
				effects.exit("content");
				return ok(code);
			}
			/**
			*
			*
			* @type {State}
			*/
			function contentContinue(code) {
				effects.consume(code);
				effects.exit("chunkContent");
				previous.next = effects.enter("chunkContent", {
					contentType: "content",
					previous
				});
				previous = previous.next;
				return chunkInside;
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeContinuation(effects, ok, nok) {
			const self = this;
			return startLookahead;
			/**
			*
			*
			* @type {State}
			*/
			function startLookahead(code) {
				effects.exit("chunkContent");
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return factorySpace(effects, prefixed, "linePrefix");
			}
			/**
			*
			*
			* @type {State}
			*/
			function prefixed(code) {
				if (code === null || markdownLineEnding(code)) return nok(code);
				const tail = self.events[self.events.length - 1];
				if (!self.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) return ok(code);
				return effects.interrupt(self.parser.constructs.flow, nok, ok)(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-factory-destination/index.js
		/**
		* @import {Effects, State, TokenType} from 'micromark-util-types'
		*/
		/**
		* Parse destinations.
		*
		* ###### Examples
		*
		* ```markdown
		* <a>
		* <a\>b>
		* <a b>
		* <a)>
		* a
		* a\)b
		* a(b)c
		* a(b)
		* ```
		*
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @param {State} nok
		*   State switched to when unsuccessful.
		* @param {TokenType} type
		*   Type for whole (`<a>` or `b`).
		* @param {TokenType} literalType
		*   Type when enclosed (`<a>`).
		* @param {TokenType} literalMarkerType
		*   Type for enclosing (`<` and `>`).
		* @param {TokenType} rawType
		*   Type when not enclosed (`b`).
		* @param {TokenType} stringType
		*   Type for the value (`a` or `b`).
		* @param {number | undefined} [max=Infinity]
		*   Depth of nested parens (inclusive).
		* @returns {State}
		*   Start state.
		*/
		function factoryDestination(effects, ok, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
			const limit = max || Number.POSITIVE_INFINITY;
			let balance = 0;
			return start;
			/**
			* Start of destination.
			*
			* ```markdown
			* > | <aa>
			*     ^
			* > | aa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				if (code === 60) {
					effects.enter(type);
					effects.enter(literalType);
					effects.enter(literalMarkerType);
					effects.consume(code);
					effects.exit(literalMarkerType);
					return enclosedBefore;
				}
				if (code === null || code === 32 || code === 41 || asciiControl(code)) return nok(code);
				effects.enter(type);
				effects.enter(rawType);
				effects.enter(stringType);
				effects.enter("chunkString", { contentType: "string" });
				return raw(code);
			}
			/**
			* After `<`, at an enclosed destination.
			*
			* ```markdown
			* > | <aa>
			*      ^
			* ```
			*
			* @type {State}
			*/
			function enclosedBefore(code) {
				if (code === 62) {
					effects.enter(literalMarkerType);
					effects.consume(code);
					effects.exit(literalMarkerType);
					effects.exit(literalType);
					effects.exit(type);
					return ok;
				}
				effects.enter(stringType);
				effects.enter("chunkString", { contentType: "string" });
				return enclosed(code);
			}
			/**
			* In enclosed destination.
			*
			* ```markdown
			* > | <aa>
			*      ^
			* ```
			*
			* @type {State}
			*/
			function enclosed(code) {
				if (code === 62) {
					effects.exit("chunkString");
					effects.exit(stringType);
					return enclosedBefore(code);
				}
				if (code === null || code === 60 || markdownLineEnding(code)) return nok(code);
				effects.consume(code);
				return code === 92 ? enclosedEscape : enclosed;
			}
			/**
			* After `\`, at a special character.
			*
			* ```markdown
			* > | <a\*a>
			*        ^
			* ```
			*
			* @type {State}
			*/
			function enclosedEscape(code) {
				if (code === 60 || code === 62 || code === 92) {
					effects.consume(code);
					return enclosed;
				}
				return enclosed(code);
			}
			/**
			* In raw destination.
			*
			* ```markdown
			* > | aa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function raw(code) {
				if (!balance && (code === null || code === 41 || markdownLineEndingOrSpace(code))) {
					effects.exit("chunkString");
					effects.exit(stringType);
					effects.exit(rawType);
					effects.exit(type);
					return ok(code);
				}
				if (balance < limit && code === 40) {
					effects.consume(code);
					balance++;
					return raw;
				}
				if (code === 41) {
					effects.consume(code);
					balance--;
					return raw;
				}
				if (code === null || code === 32 || code === 40 || asciiControl(code)) return nok(code);
				effects.consume(code);
				return code === 92 ? rawEscape : raw;
			}
			/**
			* After `\`, at special character.
			*
			* ```markdown
			* > | a\*a
			*       ^
			* ```
			*
			* @type {State}
			*/
			function rawEscape(code) {
				if (code === 40 || code === 41 || code === 92) {
					effects.consume(code);
					return raw;
				}
				return raw(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-factory-label/index.js
		/**
		* @import {
		*   Effects,
		*   State,
		*   TokenizeContext,
		*   TokenType
		* } from 'micromark-util-types'
		*/
		/**
		* Parse labels.
		*
		* > 👉 **Note**: labels in markdown are capped at 999 characters in the string.
		*
		* ###### Examples
		*
		* ```markdown
		* [a]
		* [a
		* b]
		* [a\]b]
		* ```
		*
		* @this {TokenizeContext}
		*   Tokenize context.
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @param {State} nok
		*   State switched to when unsuccessful.
		* @param {TokenType} type
		*   Type of the whole label (`[a]`).
		* @param {TokenType} markerType
		*   Type for the markers (`[` and `]`).
		* @param {TokenType} stringType
		*   Type for the identifier (`a`).
		* @returns {State}
		*   Start state.
		*/
		function factoryLabel(effects, ok, nok, type, markerType, stringType) {
			const self = this;
			let size = 0;
			/** @type {boolean} */
			let seen;
			return start;
			/**
			* Start of label.
			*
			* ```markdown
			* > | [a]
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter(type);
				effects.enter(markerType);
				effects.consume(code);
				effects.exit(markerType);
				effects.enter(stringType);
				return atBreak;
			}
			/**
			* In label, at something, before something else.
			*
			* ```markdown
			* > | [a]
			*      ^
			* ```
			*
			* @type {State}
			*/
			function atBreak(code) {
				if (size > 999 || code === null || code === 91 || code === 93 && !seen || 
				/* c8 ignore next 3 */
				code === 94 && !size && "_hiddenFootnoteSupport" in self.parser.constructs) return nok(code);
				if (code === 93) {
					effects.exit(stringType);
					effects.enter(markerType);
					effects.consume(code);
					effects.exit(markerType);
					effects.exit(type);
					return ok;
				}
				if (markdownLineEnding(code)) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					return atBreak;
				}
				effects.enter("chunkString", { contentType: "string" });
				return labelInside(code);
			}
			/**
			* In label, in text.
			*
			* ```markdown
			* > | [a]
			*      ^
			* ```
			*
			* @type {State}
			*/
			function labelInside(code) {
				if (code === null || code === 91 || code === 93 || markdownLineEnding(code) || size++ > 999) {
					effects.exit("chunkString");
					return atBreak(code);
				}
				effects.consume(code);
				if (!seen) seen = !markdownSpace(code);
				return code === 92 ? labelEscape : labelInside;
			}
			/**
			* After `\`, at a special character.
			*
			* ```markdown
			* > | [a\*a]
			*        ^
			* ```
			*
			* @type {State}
			*/
			function labelEscape(code) {
				if (code === 91 || code === 92 || code === 93) {
					effects.consume(code);
					size++;
					return labelInside;
				}
				return labelInside(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-factory-title/index.js
		/**
		* @import {
		*   Code,
		*   Effects,
		*   State,
		*   TokenType
		* } from 'micromark-util-types'
		*/
		/**
		* Parse titles.
		*
		* ###### Examples
		*
		* ```markdown
		* "a"
		* 'b'
		* (c)
		* "a
		* b"
		* 'a
		*     b'
		* (a\)b)
		* ```
		*
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @param {State} nok
		*   State switched to when unsuccessful.
		* @param {TokenType} type
		*   Type of the whole title (`"a"`, `'b'`, `(c)`).
		* @param {TokenType} markerType
		*   Type for the markers (`"`, `'`, `(`, and `)`).
		* @param {TokenType} stringType
		*   Type for the value (`a`).
		* @returns {State}
		*   Start state.
		*/
		function factoryTitle(effects, ok, nok, type, markerType, stringType) {
			/** @type {NonNullable<Code>} */
			let marker;
			return start;
			/**
			* Start of title.
			*
			* ```markdown
			* > | "a"
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				if (code === 34 || code === 39 || code === 40) {
					effects.enter(type);
					effects.enter(markerType);
					effects.consume(code);
					effects.exit(markerType);
					marker = code === 40 ? 41 : code;
					return begin;
				}
				return nok(code);
			}
			/**
			* After opening marker.
			*
			* This is also used at the closing marker.
			*
			* ```markdown
			* > | "a"
			*      ^
			* ```
			*
			* @type {State}
			*/
			function begin(code) {
				if (code === marker) {
					effects.enter(markerType);
					effects.consume(code);
					effects.exit(markerType);
					effects.exit(type);
					return ok;
				}
				effects.enter(stringType);
				return atBreak(code);
			}
			/**
			* At something, before something else.
			*
			* ```markdown
			* > | "a"
			*      ^
			* ```
			*
			* @type {State}
			*/
			function atBreak(code) {
				if (code === marker) {
					effects.exit(stringType);
					return begin(marker);
				}
				if (code === null) return nok(code);
				if (markdownLineEnding(code)) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					return factorySpace(effects, atBreak, "linePrefix");
				}
				effects.enter("chunkString", { contentType: "string" });
				return inside(code);
			}
			/**
			*
			*
			* @type {State}
			*/
			function inside(code) {
				if (code === marker || code === null || markdownLineEnding(code)) {
					effects.exit("chunkString");
					return atBreak(code);
				}
				effects.consume(code);
				return code === 92 ? escape : inside;
			}
			/**
			* After `\`, at a special character.
			*
			* ```markdown
			* > | "a\*b"
			*      ^
			* ```
			*
			* @type {State}
			*/
			function escape(code) {
				if (code === marker || code === 92) {
					effects.consume(code);
					return inside;
				}
				return inside(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-factory-whitespace/index.js
		/**
		* @import {Effects, State} from 'micromark-util-types'
		*/
		/**
		* Parse spaces and tabs.
		*
		* There is no `nok` parameter:
		*
		* *   line endings or spaces in markdown are often optional, in which case this
		*     factory can be used and `ok` will be switched to whether spaces were found
		*     or not
		* *   one line ending or space can be detected with
		*     `markdownLineEndingOrSpace(code)` right before using `factoryWhitespace`
		*
		* @param {Effects} effects
		*   Context.
		* @param {State} ok
		*   State switched to when successful.
		* @returns {State}
		*   Start state.
		*/
		function factoryWhitespace(effects, ok) {
			/** @type {boolean} */
			let seen;
			return start;
			/** @type {State} */
			function start(code) {
				if (markdownLineEnding(code)) {
					effects.enter("lineEnding");
					effects.consume(code);
					effects.exit("lineEnding");
					seen = true;
					return start;
				}
				if (markdownSpace(code)) return factorySpace(effects, start, seen ? "linePrefix" : "lineSuffix")(code);
				return ok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/definition.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const definition = {
			name: "definition",
			tokenize: tokenizeDefinition
		};
		/** @type {Construct} */
		const titleBefore = {
			partial: true,
			tokenize: tokenizeTitleBefore
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeDefinition(effects, ok, nok) {
			const self = this;
			/** @type {string} */
			let identifier;
			return start;
			/**
			* At start of a definition.
			*
			* ```markdown
			* > | [a]: b "c"
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("definition");
				return before(code);
			}
			/**
			* After optional whitespace, at `[`.
			*
			* ```markdown
			* > | [a]: b "c"
			*     ^
			* ```
			*
			* @type {State}
			*/
			function before(code) {
				return factoryLabel.call(self, effects, labelAfter, nok, "definitionLabel", "definitionLabelMarker", "definitionLabelString")(code);
			}
			/**
			* After label.
			*
			* ```markdown
			* > | [a]: b "c"
			*        ^
			* ```
			*
			* @type {State}
			*/
			function labelAfter(code) {
				identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));
				if (code === 58) {
					effects.enter("definitionMarker");
					effects.consume(code);
					effects.exit("definitionMarker");
					return markerAfter;
				}
				return nok(code);
			}
			/**
			* After marker.
			*
			* ```markdown
			* > | [a]: b "c"
			*         ^
			* ```
			*
			* @type {State}
			*/
			function markerAfter(code) {
				return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, destinationBefore)(code) : destinationBefore(code);
			}
			/**
			* Before destination.
			*
			* ```markdown
			* > | [a]: b "c"
			*          ^
			* ```
			*
			* @type {State}
			*/
			function destinationBefore(code) {
				return factoryDestination(effects, destinationAfter, nok, "definitionDestination", "definitionDestinationLiteral", "definitionDestinationLiteralMarker", "definitionDestinationRaw", "definitionDestinationString")(code);
			}
			/**
			* After destination.
			*
			* ```markdown
			* > | [a]: b "c"
			*           ^
			* ```
			*
			* @type {State}
			*/
			function destinationAfter(code) {
				return effects.attempt(titleBefore, after, after)(code);
			}
			/**
			* After definition.
			*
			* ```markdown
			* > | [a]: b
			*           ^
			* > | [a]: b "c"
			*               ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				return markdownSpace(code) ? factorySpace(effects, afterWhitespace, "whitespace")(code) : afterWhitespace(code);
			}
			/**
			* After definition, after optional whitespace.
			*
			* ```markdown
			* > | [a]: b
			*           ^
			* > | [a]: b "c"
			*               ^
			* ```
			*
			* @type {State}
			*/
			function afterWhitespace(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("definition");
					self.parser.defined.push(identifier);
					return ok(code);
				}
				return nok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeTitleBefore(effects, ok, nok) {
			return titleBefore;
			/**
			* After destination, at whitespace.
			*
			* ```markdown
			* > | [a]: b
			*           ^
			* > | [a]: b "c"
			*           ^
			* ```
			*
			* @type {State}
			*/
			function titleBefore(code) {
				return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, beforeMarker)(code) : nok(code);
			}
			/**
			* At title.
			*
			* ```markdown
			*   | [a]: b
			* > | "c"
			*     ^
			* ```
			*
			* @type {State}
			*/
			function beforeMarker(code) {
				return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code);
			}
			/**
			* After title.
			*
			* ```markdown
			* > | [a]: b "c"
			*               ^
			* ```
			*
			* @type {State}
			*/
			function titleAfter(code) {
				return markdownSpace(code) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code) : titleAfterOptionalWhitespace(code);
			}
			/**
			* After title, after optional whitespace.
			*
			* ```markdown
			* > | [a]: b "c"
			*               ^
			* ```
			*
			* @type {State}
			*/
			function titleAfterOptionalWhitespace(code) {
				return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/hard-break-escape.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const hardBreakEscape = {
			name: "hardBreakEscape",
			tokenize: tokenizeHardBreakEscape
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeHardBreakEscape(effects, ok, nok) {
			return start;
			/**
			* Start of a hard break (escape).
			*
			* ```markdown
			* > | a\
			*      ^
			*   | b
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("hardBreakEscape");
				effects.consume(code);
				return after;
			}
			/**
			* After `\`, at eol.
			*
			* ```markdown
			* > | a\
			*       ^
			*   | b
			* ```
			*
			*  @type {State}
			*/
			function after(code) {
				if (markdownLineEnding(code)) {
					effects.exit("hardBreakEscape");
					return ok(code);
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/heading-atx.js
		/**
		* @import {
		*   Construct,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const headingAtx = {
			name: "headingAtx",
			resolve: resolveHeadingAtx,
			tokenize: tokenizeHeadingAtx
		};
		/** @type {Resolver} */
		function resolveHeadingAtx(events, context) {
			let contentEnd = events.length - 2;
			let contentStart = 3;
			if (events[contentStart][1].type === "whitespace") contentStart += 2;
			if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") contentEnd -= 2;
			if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
			if (contentEnd > contentStart) {
				const content = {
					type: "atxHeadingText",
					start: events[contentStart][1].start,
					end: events[contentEnd][1].end
				};
				const text = {
					type: "chunkText",
					start: events[contentStart][1].start,
					end: events[contentEnd][1].end,
					contentType: "text"
				};
				splice(events, contentStart, contentEnd - contentStart + 1, [
					[
						"enter",
						content,
						context
					],
					[
						"enter",
						text,
						context
					],
					[
						"exit",
						text,
						context
					],
					[
						"exit",
						content,
						context
					]
				]);
			}
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeHeadingAtx(effects, ok, nok) {
			let size = 0;
			return start;
			/**
			* Start of a heading (atx).
			*
			* ```markdown
			* > | ## aa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("atxHeading");
				return before(code);
			}
			/**
			* After optional whitespace, at `#`.
			*
			* ```markdown
			* > | ## aa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function before(code) {
				effects.enter("atxHeadingSequence");
				return sequenceOpen(code);
			}
			/**
			* In opening sequence.
			*
			* ```markdown
			* > | ## aa
			*     ^
			* ```
			*
			* @type {State}
			*/
			function sequenceOpen(code) {
				if (code === 35 && size++ < 6) {
					effects.consume(code);
					return sequenceOpen;
				}
				if (code === null || markdownLineEndingOrSpace(code)) {
					effects.exit("atxHeadingSequence");
					return atBreak(code);
				}
				return nok(code);
			}
			/**
			* After something, before something else.
			*
			* ```markdown
			* > | ## aa
			*       ^
			* ```
			*
			* @type {State}
			*/
			function atBreak(code) {
				if (code === 35) {
					effects.enter("atxHeadingSequence");
					return sequenceFurther(code);
				}
				if (code === null || markdownLineEnding(code)) {
					effects.exit("atxHeading");
					return ok(code);
				}
				if (markdownSpace(code)) return factorySpace(effects, atBreak, "whitespace")(code);
				effects.enter("atxHeadingText");
				return data(code);
			}
			/**
			* In further sequence (after whitespace).
			*
			* Could be normal “visible” hashes in the heading or a final sequence.
			*
			* ```markdown
			* > | ## aa ##
			*           ^
			* ```
			*
			* @type {State}
			*/
			function sequenceFurther(code) {
				if (code === 35) {
					effects.consume(code);
					return sequenceFurther;
				}
				effects.exit("atxHeadingSequence");
				return atBreak(code);
			}
			/**
			* In text.
			*
			* ```markdown
			* > | ## aa
			*        ^
			* ```
			*
			* @type {State}
			*/
			function data(code) {
				if (code === null || code === 35 || markdownLineEndingOrSpace(code)) {
					effects.exit("atxHeadingText");
					return atBreak(code);
				}
				effects.consume(code);
				return data;
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-html-tag-name/index.js
		/**
		* List of lowercase HTML “block” tag names.
		*
		* The list, when parsing HTML (flow), results in more relaxed rules (condition
		* 6).
		* Because they are known blocks, the HTML-like syntax doesn’t have to be
		* strictly parsed.
		* For tag names not in this list, a more strict algorithm (condition 7) is used
		* to detect whether the HTML-like syntax is seen as HTML (flow) or not.
		*
		* This is copied from:
		* <https://spec.commonmark.org/0.30/#html-blocks>.
		*
		* > 👉 **Note**: `search` was added in `CommonMark@0.31`.
		*/
		const htmlBlockNames = [
			"address",
			"article",
			"aside",
			"base",
			"basefont",
			"blockquote",
			"body",
			"caption",
			"center",
			"col",
			"colgroup",
			"dd",
			"details",
			"dialog",
			"dir",
			"div",
			"dl",
			"dt",
			"fieldset",
			"figcaption",
			"figure",
			"footer",
			"form",
			"frame",
			"frameset",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"head",
			"header",
			"hr",
			"html",
			"iframe",
			"legend",
			"li",
			"link",
			"main",
			"menu",
			"menuitem",
			"nav",
			"noframes",
			"ol",
			"optgroup",
			"option",
			"p",
			"param",
			"search",
			"section",
			"summary",
			"table",
			"tbody",
			"td",
			"tfoot",
			"th",
			"thead",
			"title",
			"tr",
			"track",
			"ul"
		];
		/**
		* List of lowercase HTML “raw” tag names.
		*
		* The list, when parsing HTML (flow), results in HTML that can include lines
		* without exiting, until a closing tag also in this list is found (condition
		* 1).
		*
		* This module is copied from:
		* <https://spec.commonmark.org/0.30/#html-blocks>.
		*
		* > 👉 **Note**: `textarea` was added in `CommonMark@0.30`.
		*/
		const htmlRawNames = [
			"pre",
			"script",
			"style",
			"textarea"
		];
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/html-flow.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const htmlFlow = {
			concrete: true,
			name: "htmlFlow",
			resolveTo: resolveToHtmlFlow,
			tokenize: tokenizeHtmlFlow
		};
		/** @type {Construct} */
		const blankLineBefore = {
			partial: true,
			tokenize: tokenizeBlankLineBefore
		};
		/** @type {Resolver} */
		function resolveToHtmlFlow(events) {
			let index = events.length;
			while (index--) if (events[index][0] === "enter" && events[index][1].type === "htmlFlow") break;
			if (index > 1 && events[index - 2][1].type === "linePrefix") {
				events[index][1].start = events[index - 2][1].start;
				events[index + 1][1].start = events[index - 2][1].start;
				events.splice(index - 2, 2);
			}
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeHtmlFlow(effects, ok, nok) {
			const self = this;
			/** @type {number} */
			let marker;
			/** @type {boolean} */
			let closingTag;
			/** @type {string} */
			let buffer;
			/** @type {number} */
			let index;
			/** @type {Code} */
			let markerB;
			return start;
			/**
			* Start of HTML (flow).
			*
			* ```markdown
			* > | <x />
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				return before(code);
			}
			/**
			* At `<`, after optional whitespace.
			*
			* ```markdown
			* > | <x />
			*     ^
			* ```
			*
			* @type {State}
			*/
			function before(code) {
				effects.enter("htmlFlow");
				effects.enter("htmlFlowData");
				effects.consume(code);
				return open;
			}
			/**
			* After `<`, at tag name or other stuff.
			*
			* ```markdown
			* > | <x />
			*      ^
			* > | <!doctype>
			*      ^
			* > | <!--xxx-->
			*      ^
			* ```
			*
			* @type {State}
			*/
			function open(code) {
				if (code === 33) {
					effects.consume(code);
					return declarationOpen;
				}
				if (code === 47) {
					effects.consume(code);
					closingTag = true;
					return tagCloseStart;
				}
				if (code === 63) {
					effects.consume(code);
					marker = 3;
					return self.interrupt ? ok : continuationDeclarationInside;
				}
				if (asciiAlpha(code)) {
					effects.consume(code);
					buffer = String.fromCharCode(code);
					return tagName;
				}
				return nok(code);
			}
			/**
			* After `<!`, at declaration, comment, or CDATA.
			*
			* ```markdown
			* > | <!doctype>
			*       ^
			* > | <!--xxx-->
			*       ^
			* > | <![CDATA[>&<]]>
			*       ^
			* ```
			*
			* @type {State}
			*/
			function declarationOpen(code) {
				if (code === 45) {
					effects.consume(code);
					marker = 2;
					return commentOpenInside;
				}
				if (code === 91) {
					effects.consume(code);
					marker = 5;
					index = 0;
					return cdataOpenInside;
				}
				if (asciiAlpha(code)) {
					effects.consume(code);
					marker = 4;
					return self.interrupt ? ok : continuationDeclarationInside;
				}
				return nok(code);
			}
			/**
			* After `<!-`, inside a comment, at another `-`.
			*
			* ```markdown
			* > | <!--xxx-->
			*        ^
			* ```
			*
			* @type {State}
			*/
			function commentOpenInside(code) {
				if (code === 45) {
					effects.consume(code);
					return self.interrupt ? ok : continuationDeclarationInside;
				}
				return nok(code);
			}
			/**
			* After `<![`, inside CDATA, expecting `CDATA[`.
			*
			* ```markdown
			* > | <![CDATA[>&<]]>
			*        ^^^^^^
			* ```
			*
			* @type {State}
			*/
			function cdataOpenInside(code) {
				if (code === "CDATA[".charCodeAt(index++)) {
					effects.consume(code);
					if (index === 6) return self.interrupt ? ok : continuation;
					return cdataOpenInside;
				}
				return nok(code);
			}
			/**
			* After `</`, in closing tag, at tag name.
			*
			* ```markdown
			* > | </x>
			*       ^
			* ```
			*
			* @type {State}
			*/
			function tagCloseStart(code) {
				if (asciiAlpha(code)) {
					effects.consume(code);
					buffer = String.fromCharCode(code);
					return tagName;
				}
				return nok(code);
			}
			/**
			* In tag name.
			*
			* ```markdown
			* > | <ab>
			*      ^^
			* > | </ab>
			*       ^^
			* ```
			*
			* @type {State}
			*/
			function tagName(code) {
				if (code === null || code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
					const slash = code === 47;
					const name = buffer.toLowerCase();
					if (!slash && !closingTag && htmlRawNames.includes(name)) {
						marker = 1;
						return self.interrupt ? ok(code) : continuation(code);
					}
					if (htmlBlockNames.includes(buffer.toLowerCase())) {
						marker = 6;
						if (slash) {
							effects.consume(code);
							return basicSelfClosing;
						}
						return self.interrupt ? ok(code) : continuation(code);
					}
					marker = 7;
					return self.interrupt && !self.parser.lazy[self.now().line] ? nok(code) : closingTag ? completeClosingTagAfter(code) : completeAttributeNameBefore(code);
				}
				if (code === 45 || asciiAlphanumeric(code)) {
					effects.consume(code);
					buffer += String.fromCharCode(code);
					return tagName;
				}
				return nok(code);
			}
			/**
			* After closing slash of a basic tag name.
			*
			* ```markdown
			* > | <div/>
			*          ^
			* ```
			*
			* @type {State}
			*/
			function basicSelfClosing(code) {
				if (code === 62) {
					effects.consume(code);
					return self.interrupt ? ok : continuation;
				}
				return nok(code);
			}
			/**
			* After closing slash of a complete tag name.
			*
			* ```markdown
			* > | <x/>
			*        ^
			* ```
			*
			* @type {State}
			*/
			function completeClosingTagAfter(code) {
				if (markdownSpace(code)) {
					effects.consume(code);
					return completeClosingTagAfter;
				}
				return completeEnd(code);
			}
			/**
			* At an attribute name.
			*
			* At first, this state is used after a complete tag name, after whitespace,
			* where it expects optional attributes or the end of the tag.
			* It is also reused after attributes, when expecting more optional
			* attributes.
			*
			* ```markdown
			* > | <a />
			*        ^
			* > | <a :b>
			*        ^
			* > | <a _b>
			*        ^
			* > | <a b>
			*        ^
			* > | <a >
			*        ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeNameBefore(code) {
				if (code === 47) {
					effects.consume(code);
					return completeEnd;
				}
				if (code === 58 || code === 95 || asciiAlpha(code)) {
					effects.consume(code);
					return completeAttributeName;
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return completeAttributeNameBefore;
				}
				return completeEnd(code);
			}
			/**
			* In attribute name.
			*
			* ```markdown
			* > | <a :b>
			*         ^
			* > | <a _b>
			*         ^
			* > | <a b>
			*         ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeName(code) {
				if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
					effects.consume(code);
					return completeAttributeName;
				}
				return completeAttributeNameAfter(code);
			}
			/**
			* After attribute name, at an optional initializer, the end of the tag, or
			* whitespace.
			*
			* ```markdown
			* > | <a b>
			*         ^
			* > | <a b=c>
			*         ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeNameAfter(code) {
				if (code === 61) {
					effects.consume(code);
					return completeAttributeValueBefore;
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return completeAttributeNameAfter;
				}
				return completeAttributeNameBefore(code);
			}
			/**
			* Before unquoted, double quoted, or single quoted attribute value, allowing
			* whitespace.
			*
			* ```markdown
			* > | <a b=c>
			*          ^
			* > | <a b="c">
			*          ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeValueBefore(code) {
				if (code === null || code === 60 || code === 61 || code === 62 || code === 96) return nok(code);
				if (code === 34 || code === 39) {
					effects.consume(code);
					markerB = code;
					return completeAttributeValueQuoted;
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return completeAttributeValueBefore;
				}
				return completeAttributeValueUnquoted(code);
			}
			/**
			* In double or single quoted attribute value.
			*
			* ```markdown
			* > | <a b="c">
			*           ^
			* > | <a b='c'>
			*           ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeValueQuoted(code) {
				if (code === markerB) {
					effects.consume(code);
					markerB = null;
					return completeAttributeValueQuotedAfter;
				}
				if (code === null || markdownLineEnding(code)) return nok(code);
				effects.consume(code);
				return completeAttributeValueQuoted;
			}
			/**
			* In unquoted attribute value.
			*
			* ```markdown
			* > | <a b=c>
			*          ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeValueUnquoted(code) {
				if (code === null || code === 34 || code === 39 || code === 47 || code === 60 || code === 61 || code === 62 || code === 96 || markdownLineEndingOrSpace(code)) return completeAttributeNameAfter(code);
				effects.consume(code);
				return completeAttributeValueUnquoted;
			}
			/**
			* After double or single quoted attribute value, before whitespace or the
			* end of the tag.
			*
			* ```markdown
			* > | <a b="c">
			*            ^
			* ```
			*
			* @type {State}
			*/
			function completeAttributeValueQuotedAfter(code) {
				if (code === 47 || code === 62 || markdownSpace(code)) return completeAttributeNameBefore(code);
				return nok(code);
			}
			/**
			* In certain circumstances of a complete tag where only an `>` is allowed.
			*
			* ```markdown
			* > | <a b="c">
			*             ^
			* ```
			*
			* @type {State}
			*/
			function completeEnd(code) {
				if (code === 62) {
					effects.consume(code);
					return completeAfter;
				}
				return nok(code);
			}
			/**
			* After `>` in a complete tag.
			*
			* ```markdown
			* > | <x>
			*        ^
			* ```
			*
			* @type {State}
			*/
			function completeAfter(code) {
				if (code === null || markdownLineEnding(code)) return continuation(code);
				if (markdownSpace(code)) {
					effects.consume(code);
					return completeAfter;
				}
				return nok(code);
			}
			/**
			* In continuation of any HTML kind.
			*
			* ```markdown
			* > | <!--xxx-->
			*          ^
			* ```
			*
			* @type {State}
			*/
			function continuation(code) {
				if (code === 45 && marker === 2) {
					effects.consume(code);
					return continuationCommentInside;
				}
				if (code === 60 && marker === 1) {
					effects.consume(code);
					return continuationRawTagOpen;
				}
				if (code === 62 && marker === 4) {
					effects.consume(code);
					return continuationClose;
				}
				if (code === 63 && marker === 3) {
					effects.consume(code);
					return continuationDeclarationInside;
				}
				if (code === 93 && marker === 5) {
					effects.consume(code);
					return continuationCdataInside;
				}
				if (markdownLineEnding(code) && (marker === 6 || marker === 7)) {
					effects.exit("htmlFlowData");
					return effects.check(blankLineBefore, continuationAfter, continuationStart)(code);
				}
				if (code === null || markdownLineEnding(code)) {
					effects.exit("htmlFlowData");
					return continuationStart(code);
				}
				effects.consume(code);
				return continuation;
			}
			/**
			* In continuation, at eol.
			*
			* ```markdown
			* > | <x>
			*        ^
			*   | asd
			* ```
			*
			* @type {State}
			*/
			function continuationStart(code) {
				return effects.check(nonLazyContinuation, continuationStartNonLazy, continuationAfter)(code);
			}
			/**
			* In continuation, at eol, before non-lazy content.
			*
			* ```markdown
			* > | <x>
			*        ^
			*   | asd
			* ```
			*
			* @type {State}
			*/
			function continuationStartNonLazy(code) {
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return continuationBefore;
			}
			/**
			* In continuation, before non-lazy content.
			*
			* ```markdown
			*   | <x>
			* > | asd
			*     ^
			* ```
			*
			* @type {State}
			*/
			function continuationBefore(code) {
				if (code === null || markdownLineEnding(code)) return continuationStart(code);
				effects.enter("htmlFlowData");
				return continuation(code);
			}
			/**
			* In comment continuation, after one `-`, expecting another.
			*
			* ```markdown
			* > | <!--xxx-->
			*             ^
			* ```
			*
			* @type {State}
			*/
			function continuationCommentInside(code) {
				if (code === 45) {
					effects.consume(code);
					return continuationDeclarationInside;
				}
				return continuation(code);
			}
			/**
			* In raw continuation, after `<`, at `/`.
			*
			* ```markdown
			* > | <script>console.log(1)<\/script>
			*                            ^
			* ```
			*
			* @type {State}
			*/
			function continuationRawTagOpen(code) {
				if (code === 47) {
					effects.consume(code);
					buffer = "";
					return continuationRawEndTag;
				}
				return continuation(code);
			}
			/**
			* In raw continuation, after `</`, in a raw tag name.
			*
			* ```markdown
			* > | <script>console.log(1)<\/script>
			*                             ^^^^^^
			* ```
			*
			* @type {State}
			*/
			function continuationRawEndTag(code) {
				if (code === 62) {
					const name = buffer.toLowerCase();
					if (htmlRawNames.includes(name)) {
						effects.consume(code);
						return continuationClose;
					}
					return continuation(code);
				}
				if (asciiAlpha(code) && buffer.length < 8) {
					effects.consume(code);
					buffer += String.fromCharCode(code);
					return continuationRawEndTag;
				}
				return continuation(code);
			}
			/**
			* In cdata continuation, after `]`, expecting `]>`.
			*
			* ```markdown
			* > | <![CDATA[>&<]]>
			*                  ^
			* ```
			*
			* @type {State}
			*/
			function continuationCdataInside(code) {
				if (code === 93) {
					effects.consume(code);
					return continuationDeclarationInside;
				}
				return continuation(code);
			}
			/**
			* In declaration or instruction continuation, at `>`.
			*
			* ```markdown
			* > | <!-->
			*         ^
			* > | <?>
			*       ^
			* > | <!q>
			*        ^
			* > | <!--ab-->
			*             ^
			* > | <![CDATA[>&<]]>
			*                   ^
			* ```
			*
			* @type {State}
			*/
			function continuationDeclarationInside(code) {
				if (code === 62) {
					effects.consume(code);
					return continuationClose;
				}
				if (code === 45 && marker === 2) {
					effects.consume(code);
					return continuationDeclarationInside;
				}
				return continuation(code);
			}
			/**
			* In closed continuation: everything we get until the eol/eof is part of it.
			*
			* ```markdown
			* > | <!doctype>
			*               ^
			* ```
			*
			* @type {State}
			*/
			function continuationClose(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("htmlFlowData");
					return continuationAfter(code);
				}
				effects.consume(code);
				return continuationClose;
			}
			/**
			* Done.
			*
			* ```markdown
			* > | <!doctype>
			*               ^
			* ```
			*
			* @type {State}
			*/
			function continuationAfter(code) {
				effects.exit("htmlFlow");
				return ok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeBlankLineBefore(effects, ok, nok) {
			return start;
			/**
			* Before eol, expecting blank line.
			*
			* ```markdown
			* > | <div>
			*          ^
			*   |
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return effects.attempt(blankLine, ok, nok);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/html-text.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const htmlText = {
			name: "htmlText",
			tokenize: tokenizeHtmlText
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeHtmlText(effects, ok, nok) {
			const self = this;
			/** @type {NonNullable<Code> | undefined} */
			let marker;
			/** @type {number} */
			let index;
			/** @type {State} */
			let returnState;
			return start;
			/**
			* Start of HTML (text).
			*
			* ```markdown
			* > | a <b> c
			*       ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("htmlText");
				effects.enter("htmlTextData");
				effects.consume(code);
				return open;
			}
			/**
			* After `<`, at tag name or other stuff.
			*
			* ```markdown
			* > | a <b> c
			*        ^
			* > | a <!doctype> c
			*        ^
			* > | a <!--b--> c
			*        ^
			* ```
			*
			* @type {State}
			*/
			function open(code) {
				if (code === 33) {
					effects.consume(code);
					return declarationOpen;
				}
				if (code === 47) {
					effects.consume(code);
					return tagCloseStart;
				}
				if (code === 63) {
					effects.consume(code);
					return instruction;
				}
				if (asciiAlpha(code)) {
					effects.consume(code);
					return tagOpen;
				}
				return nok(code);
			}
			/**
			* After `<!`, at declaration, comment, or CDATA.
			*
			* ```markdown
			* > | a <!doctype> c
			*         ^
			* > | a <!--b--> c
			*         ^
			* > | a <![CDATA[>&<]]> c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function declarationOpen(code) {
				if (code === 45) {
					effects.consume(code);
					return commentOpenInside;
				}
				if (code === 91) {
					effects.consume(code);
					index = 0;
					return cdataOpenInside;
				}
				if (asciiAlpha(code)) {
					effects.consume(code);
					return declaration;
				}
				return nok(code);
			}
			/**
			* In a comment, after `<!-`, at another `-`.
			*
			* ```markdown
			* > | a <!--b--> c
			*          ^
			* ```
			*
			* @type {State}
			*/
			function commentOpenInside(code) {
				if (code === 45) {
					effects.consume(code);
					return commentEnd;
				}
				return nok(code);
			}
			/**
			* In comment.
			*
			* ```markdown
			* > | a <!--b--> c
			*           ^
			* ```
			*
			* @type {State}
			*/
			function comment(code) {
				if (code === null) return nok(code);
				if (code === 45) {
					effects.consume(code);
					return commentClose;
				}
				if (markdownLineEnding(code)) {
					returnState = comment;
					return lineEndingBefore(code);
				}
				effects.consume(code);
				return comment;
			}
			/**
			* In comment, after `-`.
			*
			* ```markdown
			* > | a <!--b--> c
			*             ^
			* ```
			*
			* @type {State}
			*/
			function commentClose(code) {
				if (code === 45) {
					effects.consume(code);
					return commentEnd;
				}
				return comment(code);
			}
			/**
			* In comment, after `--`.
			*
			* ```markdown
			* > | a <!--b--> c
			*              ^
			* ```
			*
			* @type {State}
			*/
			function commentEnd(code) {
				return code === 62 ? end(code) : code === 45 ? commentClose(code) : comment(code);
			}
			/**
			* After `<![`, in CDATA, expecting `CDATA[`.
			*
			* ```markdown
			* > | a <![CDATA[>&<]]> b
			*          ^^^^^^
			* ```
			*
			* @type {State}
			*/
			function cdataOpenInside(code) {
				if (code === "CDATA[".charCodeAt(index++)) {
					effects.consume(code);
					return index === 6 ? cdata : cdataOpenInside;
				}
				return nok(code);
			}
			/**
			* In CDATA.
			*
			* ```markdown
			* > | a <![CDATA[>&<]]> b
			*                ^^^
			* ```
			*
			* @type {State}
			*/
			function cdata(code) {
				if (code === null) return nok(code);
				if (code === 93) {
					effects.consume(code);
					return cdataClose;
				}
				if (markdownLineEnding(code)) {
					returnState = cdata;
					return lineEndingBefore(code);
				}
				effects.consume(code);
				return cdata;
			}
			/**
			* In CDATA, after `]`, at another `]`.
			*
			* ```markdown
			* > | a <![CDATA[>&<]]> b
			*                    ^
			* ```
			*
			* @type {State}
			*/
			function cdataClose(code) {
				if (code === 93) {
					effects.consume(code);
					return cdataEnd;
				}
				return cdata(code);
			}
			/**
			* In CDATA, after `]]`, at `>`.
			*
			* ```markdown
			* > | a <![CDATA[>&<]]> b
			*                     ^
			* ```
			*
			* @type {State}
			*/
			function cdataEnd(code) {
				if (code === 62) return end(code);
				if (code === 93) {
					effects.consume(code);
					return cdataEnd;
				}
				return cdata(code);
			}
			/**
			* In declaration.
			*
			* ```markdown
			* > | a <!b> c
			*          ^
			* ```
			*
			* @type {State}
			*/
			function declaration(code) {
				if (code === null || code === 62) return end(code);
				if (markdownLineEnding(code)) {
					returnState = declaration;
					return lineEndingBefore(code);
				}
				effects.consume(code);
				return declaration;
			}
			/**
			* In instruction.
			*
			* ```markdown
			* > | a <?b?> c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function instruction(code) {
				if (code === null) return nok(code);
				if (code === 63) {
					effects.consume(code);
					return instructionClose;
				}
				if (markdownLineEnding(code)) {
					returnState = instruction;
					return lineEndingBefore(code);
				}
				effects.consume(code);
				return instruction;
			}
			/**
			* In instruction, after `?`, at `>`.
			*
			* ```markdown
			* > | a <?b?> c
			*           ^
			* ```
			*
			* @type {State}
			*/
			function instructionClose(code) {
				return code === 62 ? end(code) : instruction(code);
			}
			/**
			* After `</`, in closing tag, at tag name.
			*
			* ```markdown
			* > | a </b> c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function tagCloseStart(code) {
				if (asciiAlpha(code)) {
					effects.consume(code);
					return tagClose;
				}
				return nok(code);
			}
			/**
			* After `</x`, in a tag name.
			*
			* ```markdown
			* > | a </b> c
			*          ^
			* ```
			*
			* @type {State}
			*/
			function tagClose(code) {
				if (code === 45 || asciiAlphanumeric(code)) {
					effects.consume(code);
					return tagClose;
				}
				return tagCloseBetween(code);
			}
			/**
			* In closing tag, after tag name.
			*
			* ```markdown
			* > | a </b> c
			*          ^
			* ```
			*
			* @type {State}
			*/
			function tagCloseBetween(code) {
				if (markdownLineEnding(code)) {
					returnState = tagCloseBetween;
					return lineEndingBefore(code);
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return tagCloseBetween;
				}
				return end(code);
			}
			/**
			* After `<x`, in opening tag name.
			*
			* ```markdown
			* > | a <b> c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function tagOpen(code) {
				if (code === 45 || asciiAlphanumeric(code)) {
					effects.consume(code);
					return tagOpen;
				}
				if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) return tagOpenBetween(code);
				return nok(code);
			}
			/**
			* In opening tag, after tag name.
			*
			* ```markdown
			* > | a <b> c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenBetween(code) {
				if (code === 47) {
					effects.consume(code);
					return end;
				}
				if (code === 58 || code === 95 || asciiAlpha(code)) {
					effects.consume(code);
					return tagOpenAttributeName;
				}
				if (markdownLineEnding(code)) {
					returnState = tagOpenBetween;
					return lineEndingBefore(code);
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return tagOpenBetween;
				}
				return end(code);
			}
			/**
			* In attribute name.
			*
			* ```markdown
			* > | a <b c> d
			*          ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeName(code) {
				if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
					effects.consume(code);
					return tagOpenAttributeName;
				}
				return tagOpenAttributeNameAfter(code);
			}
			/**
			* After attribute name, before initializer, the end of the tag, or
			* whitespace.
			*
			* ```markdown
			* > | a <b c> d
			*           ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeNameAfter(code) {
				if (code === 61) {
					effects.consume(code);
					return tagOpenAttributeValueBefore;
				}
				if (markdownLineEnding(code)) {
					returnState = tagOpenAttributeNameAfter;
					return lineEndingBefore(code);
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return tagOpenAttributeNameAfter;
				}
				return tagOpenBetween(code);
			}
			/**
			* Before unquoted, double quoted, or single quoted attribute value, allowing
			* whitespace.
			*
			* ```markdown
			* > | a <b c=d> e
			*            ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeValueBefore(code) {
				if (code === null || code === 60 || code === 61 || code === 62 || code === 96) return nok(code);
				if (code === 34 || code === 39) {
					effects.consume(code);
					marker = code;
					return tagOpenAttributeValueQuoted;
				}
				if (markdownLineEnding(code)) {
					returnState = tagOpenAttributeValueBefore;
					return lineEndingBefore(code);
				}
				if (markdownSpace(code)) {
					effects.consume(code);
					return tagOpenAttributeValueBefore;
				}
				effects.consume(code);
				return tagOpenAttributeValueUnquoted;
			}
			/**
			* In double or single quoted attribute value.
			*
			* ```markdown
			* > | a <b c="d"> e
			*             ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeValueQuoted(code) {
				if (code === marker) {
					effects.consume(code);
					marker = void 0;
					return tagOpenAttributeValueQuotedAfter;
				}
				if (code === null) return nok(code);
				if (markdownLineEnding(code)) {
					returnState = tagOpenAttributeValueQuoted;
					return lineEndingBefore(code);
				}
				effects.consume(code);
				return tagOpenAttributeValueQuoted;
			}
			/**
			* In unquoted attribute value.
			*
			* ```markdown
			* > | a <b c=d> e
			*            ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeValueUnquoted(code) {
				if (code === null || code === 34 || code === 39 || code === 60 || code === 61 || code === 96) return nok(code);
				if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) return tagOpenBetween(code);
				effects.consume(code);
				return tagOpenAttributeValueUnquoted;
			}
			/**
			* After double or single quoted attribute value, before whitespace or the end
			* of the tag.
			*
			* ```markdown
			* > | a <b c="d"> e
			*               ^
			* ```
			*
			* @type {State}
			*/
			function tagOpenAttributeValueQuotedAfter(code) {
				if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) return tagOpenBetween(code);
				return nok(code);
			}
			/**
			* In certain circumstances of a tag where only an `>` is allowed.
			*
			* ```markdown
			* > | a <b c="d"> e
			*               ^
			* ```
			*
			* @type {State}
			*/
			function end(code) {
				if (code === 62) {
					effects.consume(code);
					effects.exit("htmlTextData");
					effects.exit("htmlText");
					return ok;
				}
				return nok(code);
			}
			/**
			* At eol.
			*
			* > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
			* > empty tokens.
			*
			* ```markdown
			* > | a <!--a
			*            ^
			*   | b-->
			* ```
			*
			* @type {State}
			*/
			function lineEndingBefore(code) {
				effects.exit("htmlTextData");
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return lineEndingAfter;
			}
			/**
			* After eol, at optional whitespace.
			*
			* > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
			* > empty tokens.
			*
			* ```markdown
			*   | a <!--a
			* > | b-->
			*     ^
			* ```
			*
			* @type {State}
			*/
			function lineEndingAfter(code) {
				return markdownSpace(code) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : lineEndingAfterPrefix(code);
			}
			/**
			* After eol, after optional whitespace.
			*
			* > 👉 **Note**: we can’t have blank lines in text, so no need to worry about
			* > empty tokens.
			*
			* ```markdown
			*   | a <!--a
			* > | b-->
			*     ^
			* ```
			*
			* @type {State}
			*/
			function lineEndingAfterPrefix(code) {
				effects.enter("htmlTextData");
				return returnState(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/label-end.js
		/**
		* @import {
		*   Construct,
		*   Event,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer,
		*   Token
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const labelEnd = {
			name: "labelEnd",
			resolveAll: resolveAllLabelEnd,
			resolveTo: resolveToLabelEnd,
			tokenize: tokenizeLabelEnd
		};
		/** @type {Construct} */
		const resourceConstruct = { tokenize: tokenizeResource };
		/** @type {Construct} */
		const referenceFullConstruct = { tokenize: tokenizeReferenceFull };
		/** @type {Construct} */
		const referenceCollapsedConstruct = { tokenize: tokenizeReferenceCollapsed };
		/** @type {Resolver} */
		function resolveAllLabelEnd(events) {
			let index = -1;
			/** @type {Array<Event>} */
			const newEvents = [];
			while (++index < events.length) {
				const token = events[index][1];
				newEvents.push(events[index]);
				if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
					const offset = token.type === "labelImage" ? 4 : 2;
					token.type = "data";
					index += offset;
				}
			}
			if (events.length !== newEvents.length) splice(events, 0, events.length, newEvents);
			return events;
		}
		/** @type {Resolver} */
		function resolveToLabelEnd(events, context) {
			let index = events.length;
			let offset = 0;
			/** @type {number | undefined} */
			let open;
			/** @type {number | undefined} */
			let close;
			/** @type {Array<Event>} */
			let media;
			while (index--) {
				const token = events[index][1];
				if (open) {
					if (token.type === "link" || token.type === "labelLink" && token._inactive) break;
					if (events[index][0] === "enter" && token.type === "labelLink") token._inactive = true;
				} else if (close) {
					if (events[index][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
						open = index;
						if (token.type !== "labelLink") {
							offset = 2;
							break;
						}
					}
				} else if (token.type === "labelEnd") close = index;
			}
			const group = {
				type: events[open][1].type === "labelLink" ? "link" : "image",
				start: { ...events[open][1].start },
				end: { ...events[events.length - 1][1].end }
			};
			const label = {
				type: "label",
				start: { ...events[open][1].start },
				end: { ...events[close][1].end }
			};
			const text = {
				type: "labelText",
				start: { ...events[open + offset + 2][1].end },
				end: { ...events[close - 2][1].start }
			};
			media = [[
				"enter",
				group,
				context
			], [
				"enter",
				label,
				context
			]];
			media = push(media, events.slice(open + 1, open + offset + 3));
			media = push(media, [[
				"enter",
				text,
				context
			]]);
			media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
			media = push(media, [
				[
					"exit",
					text,
					context
				],
				events[close - 2],
				events[close - 1],
				[
					"exit",
					label,
					context
				]
			]);
			media = push(media, events.slice(close + 1));
			media = push(media, [[
				"exit",
				group,
				context
			]]);
			splice(events, open, events.length, media);
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeLabelEnd(effects, ok, nok) {
			const self = this;
			const labelStarts = self._labelStarts;
			/** @type {Token} */
			let labelStart;
			/** @type {boolean} */
			let defined;
			if (labelStarts) {
				while (labelStarts.length > 0 && labelStarts[labelStarts.length - 1]._balanced) labelStarts.pop();
				labelStart = labelStarts[labelStarts.length - 1];
			}
			return start;
			/**
			* Start of label end.
			*
			* ```markdown
			* > | [a](b) c
			*       ^
			* > | [a][b] c
			*       ^
			* > | [a][] b
			*       ^
			* > | [a] b
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				if (!labelStart) return nok(code);
				if (labelStart._inactive) return labelEndNok(code);
				defined = self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize({
					start: labelStart.end,
					end: self.now()
				})));
				effects.enter("labelEnd");
				effects.enter("labelMarker");
				effects.consume(code);
				effects.exit("labelMarker");
				effects.exit("labelEnd");
				return after;
			}
			/**
			* After `]`.
			*
			* ```markdown
			* > | [a](b) c
			*       ^
			* > | [a][b] c
			*       ^
			* > | [a][] b
			*       ^
			* > | [a] b
			*       ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				if (code === 40) return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code);
				if (code === 91) return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code);
				return defined ? labelEndOk(code) : labelEndNok(code);
			}
			/**
			* After `]`, at `[`, but not at a full reference.
			*
			* > 👉 **Note**: we only get here if the label is defined.
			*
			* ```markdown
			* > | [a][] b
			*        ^
			* > | [a] b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function referenceNotFull(code) {
				return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code);
			}
			/**
			* Done, we found something.
			*
			* ```markdown
			* > | [a](b) c
			*           ^
			* > | [a][b] c
			*           ^
			* > | [a][] b
			*          ^
			* > | [a] b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function labelEndOk(code) {
				labelStarts.pop();
				return ok(code);
			}
			/**
			* Done, it’s nothing.
			*
			* There was an okay opening, but we didn’t match anything.
			*
			* ```markdown
			* > | [a](b c
			*        ^
			* > | [a][b c
			*        ^
			* > | [a] b
			*        ^
			* ```
			*
			* @type {State}
			*/
			function labelEndNok(code) {
				labelStart._balanced = true;
				return nok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeResource(effects, ok, nok) {
			return resourceStart;
			/**
			* At a resource.
			*
			* ```markdown
			* > | [a](b) c
			*        ^
			* ```
			*
			* @type {State}
			*/
			function resourceStart(code) {
				effects.enter("resource");
				effects.enter("resourceMarker");
				effects.consume(code);
				effects.exit("resourceMarker");
				return resourceBefore;
			}
			/**
			* In resource, after `(`, at optional whitespace.
			*
			* ```markdown
			* > | [a](b) c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function resourceBefore(code) {
				return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceOpen)(code) : resourceOpen(code);
			}
			/**
			* In resource, after optional whitespace, at `)` or a destination.
			*
			* ```markdown
			* > | [a](b) c
			*         ^
			* ```
			*
			* @type {State}
			*/
			function resourceOpen(code) {
				if (code === 41) return resourceEnd(code);
				return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code);
			}
			/**
			* In resource, after destination, at optional whitespace.
			*
			* ```markdown
			* > | [a](b) c
			*          ^
			* ```
			*
			* @type {State}
			*/
			function resourceDestinationAfter(code) {
				return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceBetween)(code) : resourceEnd(code);
			}
			/**
			* At invalid destination.
			*
			* ```markdown
			* > | [a](<<) b
			*         ^
			* ```
			*
			* @type {State}
			*/
			function resourceDestinationMissing(code) {
				return nok(code);
			}
			/**
			* In resource, after destination and whitespace, at `(` or title.
			*
			* ```markdown
			* > | [a](b ) c
			*           ^
			* ```
			*
			* @type {State}
			*/
			function resourceBetween(code) {
				if (code === 34 || code === 39 || code === 40) return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code);
				return resourceEnd(code);
			}
			/**
			* In resource, after title, at optional whitespace.
			*
			* ```markdown
			* > | [a](b "c") d
			*              ^
			* ```
			*
			* @type {State}
			*/
			function resourceTitleAfter(code) {
				return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceEnd)(code) : resourceEnd(code);
			}
			/**
			* In resource, at `)`.
			*
			* ```markdown
			* > | [a](b) d
			*          ^
			* ```
			*
			* @type {State}
			*/
			function resourceEnd(code) {
				if (code === 41) {
					effects.enter("resourceMarker");
					effects.consume(code);
					effects.exit("resourceMarker");
					effects.exit("resource");
					return ok;
				}
				return nok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeReferenceFull(effects, ok, nok) {
			const self = this;
			return referenceFull;
			/**
			* In a reference (full), at the `[`.
			*
			* ```markdown
			* > | [a][b] d
			*        ^
			* ```
			*
			* @type {State}
			*/
			function referenceFull(code) {
				return factoryLabel.call(self, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code);
			}
			/**
			* In a reference (full), after `]`.
			*
			* ```markdown
			* > | [a][b] d
			*          ^
			* ```
			*
			* @type {State}
			*/
			function referenceFullAfter(code) {
				return self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) ? ok(code) : nok(code);
			}
			/**
			* In reference (full) that was missing.
			*
			* ```markdown
			* > | [a][b d
			*        ^
			* ```
			*
			* @type {State}
			*/
			function referenceFullMissing(code) {
				return nok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeReferenceCollapsed(effects, ok, nok) {
			return referenceCollapsedStart;
			/**
			* In reference (collapsed), at `[`.
			*
			* > 👉 **Note**: we only get here if the label is defined.
			*
			* ```markdown
			* > | [a][] d
			*        ^
			* ```
			*
			* @type {State}
			*/
			function referenceCollapsedStart(code) {
				effects.enter("reference");
				effects.enter("referenceMarker");
				effects.consume(code);
				effects.exit("referenceMarker");
				return referenceCollapsedOpen;
			}
			/**
			* In reference (collapsed), at `]`.
			*
			* > 👉 **Note**: we only get here if the label is defined.
			*
			* ```markdown
			* > | [a][] d
			*         ^
			* ```
			*
			*  @type {State}
			*/
			function referenceCollapsedOpen(code) {
				if (code === 93) {
					effects.enter("referenceMarker");
					effects.consume(code);
					effects.exit("referenceMarker");
					effects.exit("reference");
					return ok;
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/label-start-image.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   Token,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const labelStartImage = {
			name: "labelStartImage",
			resolveAll: labelEnd.resolveAll,
			tokenize: tokenizeLabelStartImage
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeLabelStartImage(effects, ok, nok) {
			const self = this;
			/** @type {Token} */
			let labelImage;
			return start;
			/**
			* Start of label (image) start.
			*
			* ```markdown
			* > | a ![b] c
			*       ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("labelImage");
				effects.enter("labelImageMarker");
				effects.consume(code);
				effects.exit("labelImageMarker");
				return open;
			}
			/**
			* After `!`, at `[`.
			*
			* ```markdown
			* > | a ![b] c
			*        ^
			* ```
			*
			* @type {State}
			*/
			function open(code) {
				if (code === 91) {
					effects.enter("labelMarker");
					effects.consume(code);
					effects.exit("labelMarker");
					labelImage = effects.exit("labelImage");
					return after;
				}
				return nok(code);
			}
			/**
			* After `![`.
			*
			* ```markdown
			* > | a ![b] c
			*         ^
			* ```
			*
			* This is needed in because, when GFM footnotes are enabled, images never
			* form when started with a `^`.
			* Instead, links form:
			*
			* ```markdown
			* ![^a](b)
			*
			* ![^a][b]
			*
			* [b]: c
			* ```
			*
			* ```html
			* <p>!<a href=\"b\">^a</a></p>
			* <p>!<a href=\"c\">^a</a></p>
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				/* c8 ignore next 6 */
				if (code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs) return nok(code);
				self._labelStarts = self._labelStarts || [];
				self._labelStarts.push(labelImage);
				return ok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/label-start-link.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   Token,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const labelStartLink = {
			name: "labelStartLink",
			resolveAll: labelEnd.resolveAll,
			tokenize: tokenizeLabelStartLink
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeLabelStartLink(effects, ok, nok) {
			const self = this;
			/** @type {Token} */
			let labelLink;
			return start;
			/**
			* Start of label (link) start.
			*
			* ```markdown
			* > | a [b] c
			*       ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("labelLink");
				effects.enter("labelMarker");
				effects.consume(code);
				effects.exit("labelMarker");
				labelLink = effects.exit("labelLink");
				return after;
			}
			/** @type {State} */
			function after(code) {
				/* c8 ignore next 6 */
				if (code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs) return nok(code);
				self._labelStarts = self._labelStarts || [];
				self._labelStarts.push(labelLink);
				return ok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/line-ending.js
		/**
		* @import {
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const lineEnding = {
			name: "lineEnding",
			tokenize: tokenizeLineEnding
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeLineEnding(effects, ok) {
			return start;
			/** @type {State} */
			function start(code) {
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				return factorySpace(effects, ok, "linePrefix");
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/thematic-break.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const thematicBreak = {
			name: "thematicBreak",
			tokenize: tokenizeThematicBreak
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeThematicBreak(effects, ok, nok) {
			let size = 0;
			/** @type {NonNullable<Code>} */
			let marker;
			return start;
			/**
			* Start of thematic break.
			*
			* ```markdown
			* > | ***
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				effects.enter("thematicBreak");
				return before(code);
			}
			/**
			* After optional whitespace, at marker.
			*
			* ```markdown
			* > | ***
			*     ^
			* ```
			*
			* @type {State}
			*/
			function before(code) {
				marker = code;
				return atBreak(code);
			}
			/**
			* After something, before something else.
			*
			* ```markdown
			* > | ***
			*     ^
			* ```
			*
			* @type {State}
			*/
			function atBreak(code) {
				if (code === marker) {
					effects.enter("thematicBreakSequence");
					return sequence(code);
				}
				if (size >= 3 && (code === null || markdownLineEnding(code))) {
					effects.exit("thematicBreak");
					return ok(code);
				}
				return nok(code);
			}
			/**
			* In sequence.
			*
			* ```markdown
			* > | ***
			*     ^
			* ```
			*
			* @type {State}
			*/
			function sequence(code) {
				if (code === marker) {
					effects.consume(code);
					size++;
					return sequence;
				}
				effects.exit("thematicBreakSequence");
				return markdownSpace(code) ? factorySpace(effects, atBreak, "whitespace")(code) : atBreak(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/list.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   Exiter,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const list = {
			continuation: { tokenize: tokenizeListContinuation },
			exit: tokenizeListEnd,
			name: "list",
			tokenize: tokenizeListStart
		};
		/** @type {Construct} */
		const listItemPrefixWhitespaceConstruct = {
			partial: true,
			tokenize: tokenizeListItemPrefixWhitespace
		};
		/** @type {Construct} */
		const indentConstruct = {
			partial: true,
			tokenize: tokenizeIndent
		};
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeListStart(effects, ok, nok) {
			const self = this;
			const tail = self.events[self.events.length - 1];
			let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
			let size = 0;
			return start;
			/** @type {State} */
			function start(code) {
				const kind = self.containerState.type || (code === 42 || code === 43 || code === 45 ? "listUnordered" : "listOrdered");
				if (kind === "listUnordered" ? !self.containerState.marker || code === self.containerState.marker : asciiDigit(code)) {
					if (!self.containerState.type) {
						self.containerState.type = kind;
						effects.enter(kind, { _container: true });
					}
					if (kind === "listUnordered") {
						effects.enter("listItemPrefix");
						return code === 42 || code === 45 ? effects.check(thematicBreak, nok, atMarker)(code) : atMarker(code);
					}
					if (!self.interrupt || code === 49) {
						effects.enter("listItemPrefix");
						effects.enter("listItemValue");
						return inside(code);
					}
				}
				return nok(code);
			}
			/** @type {State} */
			function inside(code) {
				if (asciiDigit(code) && ++size < 10) {
					effects.consume(code);
					return inside;
				}
				if ((!self.interrupt || size < 2) && (self.containerState.marker ? code === self.containerState.marker : code === 41 || code === 46)) {
					effects.exit("listItemValue");
					return atMarker(code);
				}
				return nok(code);
			}
			/**
			* @type {State}
			**/
			function atMarker(code) {
				effects.enter("listItemMarker");
				effects.consume(code);
				effects.exit("listItemMarker");
				self.containerState.marker = self.containerState.marker || code;
				return effects.check(blankLine, self.interrupt ? nok : onBlank, effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix));
			}
			/** @type {State} */
			function onBlank(code) {
				self.containerState.initialBlankLine = true;
				initialSize++;
				return endOfPrefix(code);
			}
			/** @type {State} */
			function otherPrefix(code) {
				if (markdownSpace(code)) {
					effects.enter("listItemPrefixWhitespace");
					effects.consume(code);
					effects.exit("listItemPrefixWhitespace");
					return endOfPrefix;
				}
				return nok(code);
			}
			/** @type {State} */
			function endOfPrefix(code) {
				self.containerState.size = initialSize + self.sliceSerialize(effects.exit("listItemPrefix"), true).length;
				return ok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeListContinuation(effects, ok, nok) {
			const self = this;
			self.containerState._closeFlow = void 0;
			return effects.check(blankLine, onBlank, notBlank);
			/** @type {State} */
			function onBlank(code) {
				self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
				return factorySpace(effects, ok, "listItemIndent", self.containerState.size + 1)(code);
			}
			/** @type {State} */
			function notBlank(code) {
				if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
					self.containerState.furtherBlankLines = void 0;
					self.containerState.initialBlankLine = void 0;
					return notInCurrentItem(code);
				}
				self.containerState.furtherBlankLines = void 0;
				self.containerState.initialBlankLine = void 0;
				return effects.attempt(indentConstruct, ok, notInCurrentItem)(code);
			}
			/** @type {State} */
			function notInCurrentItem(code) {
				self.containerState._closeFlow = true;
				self.interrupt = void 0;
				return factorySpace(effects, effects.attempt(list, ok, nok), "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeIndent(effects, ok, nok) {
			const self = this;
			return factorySpace(effects, afterPrefix, "listItemIndent", self.containerState.size + 1);
			/** @type {State} */
			function afterPrefix(code) {
				const tail = self.events[self.events.length - 1];
				return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self.containerState.size ? ok(code) : nok(code);
			}
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Exiter}
		*/
		function tokenizeListEnd(effects) {
			effects.exit(this.containerState.type);
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
			const self = this;
			return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 5);
			/** @type {State} */
			function afterPrefix(code) {
				const tail = self.events[self.events.length - 1];
				return !markdownSpace(code) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok(code) : nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-core-commonmark/lib/setext-underline.js
		/**
		* @import {
		*   Code,
		*   Construct,
		*   Resolver,
		*   State,
		*   TokenizeContext,
		*   Tokenizer
		* } from 'micromark-util-types'
		*/
		/** @type {Construct} */
		const setextUnderline = {
			name: "setextUnderline",
			resolveTo: resolveToSetextUnderline,
			tokenize: tokenizeSetextUnderline
		};
		/** @type {Resolver} */
		function resolveToSetextUnderline(events, context) {
			const editMap = new EditMap();
			let index = events.length;
			/** @type {number | undefined} */
			let content;
			/** @type {number | undefined} */
			let text;
			/** @type {number | undefined} */
			let definition;
			while (index--) if (events[index][0] === "enter") {
				if (events[index][1].type === "content") {
					content = index;
					break;
				}
				if (events[index][1].type === "paragraph") text = index;
			} else {
				if (events[index][1].type === "content") editMap.add(index, 1, []);
				if (!definition && events[index][1].type === "definition") definition = index;
			}
			const heading = {
				type: "setextHeading",
				start: { ...events[content][1].start },
				end: { ...events[events.length - 1][1].end }
			};
			events[text][1].type = "setextHeadingText";
			if (definition) {
				editMap.add(text, 0, [[
					"enter",
					heading,
					context
				]]);
				editMap.add(definition + 1, 0, [[
					"exit",
					events[content][1],
					context
				]]);
				events[content][1].end = { ...events[definition][1].end };
			} else events[content][1] = heading;
			editMap.add(events.length, 0, [[
				"exit",
				heading,
				context
			]]);
			editMap.consume(events);
			return events;
		}
		/**
		* @this {TokenizeContext}
		*   Context.
		* @type {Tokenizer}
		*/
		function tokenizeSetextUnderline(effects, ok, nok) {
			const self = this;
			/** @type {NonNullable<Code>} */
			let marker;
			return start;
			/**
			* At start of heading (setext) underline.
			*
			* ```markdown
			*   | aa
			* > | ==
			*     ^
			* ```
			*
			* @type {State}
			*/
			function start(code) {
				let index = self.events.length;
				/** @type {boolean | undefined} */
				let paragraph;
				while (index--) if (self.events[index][1].type !== "lineEnding" && self.events[index][1].type !== "linePrefix" && self.events[index][1].type !== "content") {
					paragraph = self.events[index][1].type === "paragraph";
					break;
				}
				if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph)) {
					effects.enter("setextHeadingLine");
					marker = code;
					return before(code);
				}
				return nok(code);
			}
			/**
			* After optional whitespace, at `-` or `=`.
			*
			* ```markdown
			*   | aa
			* > | ==
			*     ^
			* ```
			*
			* @type {State}
			*/
			function before(code) {
				effects.enter("setextHeadingLineSequence");
				return inside(code);
			}
			/**
			* In sequence.
			*
			* ```markdown
			*   | aa
			* > | ==
			*     ^
			* ```
			*
			* @type {State}
			*/
			function inside(code) {
				if (code === marker) {
					effects.consume(code);
					return inside;
				}
				effects.exit("setextHeadingLineSequence");
				return markdownSpace(code) ? factorySpace(effects, after, "lineSuffix")(code) : after(code);
			}
			/**
			* After sequence, after optional whitespace.
			*
			* ```markdown
			*   | aa
			* > | ==
			*       ^
			* ```
			*
			* @type {State}
			*/
			function after(code) {
				if (code === null || markdownLineEnding(code)) {
					effects.exit("setextHeadingLine");
					return ok(code);
				}
				return nok(code);
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/initialize/flow.js
		/**
		* @import {
		*   InitialConstruct,
		*   Initializer,
		*   State,
		*   TokenizeContext
		* } from 'micromark-util-types'
		*/
		/** @type {InitialConstruct} */
		const flow$1 = { tokenize: initializeFlow };
		/**
		* @this {TokenizeContext}
		*   Self.
		* @type {Initializer}
		*   Initializer.
		*/
		function initializeFlow(effects) {
			const self = this;
			const initial = effects.attempt(blankLine, atBlankEnding, effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content, afterConstruct)), "linePrefix")));
			return initial;
			/** @type {State} */
			function atBlankEnding(code) {
				if (code === null) {
					effects.consume(code);
					return;
				}
				effects.enter("lineEndingBlank");
				effects.consume(code);
				effects.exit("lineEndingBlank");
				self.currentConstruct = void 0;
				return initial;
			}
			/** @type {State} */
			function afterConstruct(code) {
				if (code === null) {
					effects.consume(code);
					return;
				}
				effects.enter("lineEnding");
				effects.consume(code);
				effects.exit("lineEnding");
				self.currentConstruct = void 0;
				return initial;
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/initialize/text.js
		/**
		* @import {
		*   Code,
		*   InitialConstruct,
		*   Initializer,
		*   Resolver,
		*   State,
		*   TokenizeContext
		* } from 'micromark-util-types'
		*/
		const resolver = { resolveAll: createResolver() };
		const string$1 = initializeFactory("string");
		const text$1 = initializeFactory("text");
		/**
		* @param {'string' | 'text'} field
		*   Field.
		* @returns {InitialConstruct}
		*   Construct.
		*/
		function initializeFactory(field) {
			return {
				resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
				tokenize: initializeText
			};
			/**
			* @this {TokenizeContext}
			*   Context.
			* @type {Initializer}
			*/
			function initializeText(effects) {
				const self = this;
				const constructs = this.parser.constructs[field];
				const text = effects.attempt(constructs, start, notText);
				return start;
				/** @type {State} */
				function start(code) {
					return atBreak(code) ? text(code) : notText(code);
				}
				/** @type {State} */
				function notText(code) {
					if (code === null) {
						effects.consume(code);
						return;
					}
					effects.enter("data");
					effects.consume(code);
					return data;
				}
				/** @type {State} */
				function data(code) {
					if (atBreak(code)) {
						effects.exit("data");
						return text(code);
					}
					effects.consume(code);
					return data;
				}
				/**
				* @param {Code} code
				*   Code.
				* @returns {boolean}
				*   Whether the code is a break.
				*/
				function atBreak(code) {
					if (code === null) return true;
					const list = constructs[code];
					let index = -1;
					if (list) while (++index < list.length) {
						const item = list[index];
						if (!item.previous || item.previous.call(self, self.previous)) return true;
					}
					return false;
				}
			}
		}
		/**
		* @param {Resolver | undefined} [extraResolver]
		*   Resolver.
		* @returns {Resolver}
		*   Resolver.
		*/
		function createResolver(extraResolver) {
			return resolveAllText;
			/** @type {Resolver} */
			function resolveAllText(events, context) {
				let index = -1;
				/** @type {number | undefined} */
				let enter;
				while (++index <= events.length) if (enter === void 0) {
					if (events[index] && events[index][1].type === "data") {
						enter = index;
						index++;
					}
				} else if (!events[index] || events[index][1].type !== "data") {
					if (index !== enter + 2) {
						events[enter][1].end = events[index - 1][1].end;
						events.splice(enter + 2, index - enter - 2);
						index = enter + 2;
					}
					enter = void 0;
				}
				return extraResolver ? extraResolver(events, context) : events;
			}
		}
		/**
		* A rather ugly set of instructions which again looks at chunks in the input
		* stream.
		* The reason to do this here is that it is *much* faster to parse in reverse.
		* And that we can’t hook into `null` to split the line suffix before an EOF.
		* To do: figure out if we can make this into a clean utility, or even in core.
		* As it will be useful for GFMs literal autolink extension (and maybe even
		* tables?)
		*
		* @type {Resolver}
		*/
		function resolveAllLineSuffixes(events, context) {
			const editMap = new EditMap();
			let eventIndex = 0;
			while (++eventIndex <= events.length) if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
				const data = events[eventIndex - 1][1];
				const chunks = context.sliceStream(data);
				let index = chunks.length;
				let bufferIndex = -1;
				let size = 0;
				/** @type {boolean | undefined} */
				let tabs;
				while (index--) {
					const chunk = chunks[index];
					if (typeof chunk === "string") {
						bufferIndex = chunk.length;
						while (chunk.charCodeAt(bufferIndex - 1) === 32) {
							size++;
							bufferIndex--;
						}
						if (bufferIndex) break;
						bufferIndex = -1;
					} else if (chunk === -2) {
						tabs = true;
						size++;
					} else if (chunk === -1) {} else {
						index++;
						break;
					}
				}
				if (context._contentTypeTextTrailing && eventIndex === events.length) size = 0;
				if (size) {
					const token = {
						type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
						start: {
							_bufferIndex: index ? bufferIndex : data.start._bufferIndex + bufferIndex,
							_index: data.start._index + index,
							line: data.end.line,
							column: data.end.column - size,
							offset: data.end.offset - size
						},
						end: { ...data.end }
					};
					data.end = { ...token.start };
					if (data.start.offset === data.end.offset) Object.assign(data, token);
					else editMap.add(eventIndex, 0, [[
						"enter",
						token,
						context
					], [
						"exit",
						token,
						context
					]]);
				}
				eventIndex++;
			}
			editMap.consume(events);
			return events;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/constructs.js
		/**
		* @import {Extension} from 'micromark-util-types'
		*/
		var constructs_exports = /* @__PURE__ */ __exportAll({
			attentionMarkers: () => attentionMarkers,
			contentInitial: () => contentInitial,
			disable: () => disable,
			document: () => document,
			flow: () => flow,
			flowInitial: () => flowInitial,
			insideSpan: () => insideSpan,
			string: () => string,
			text: () => text
		});
		/** @satisfies {Extension['document']} */
		const document = {
			[42]: list,
			[43]: list,
			[45]: list,
			[48]: list,
			[49]: list,
			[50]: list,
			[51]: list,
			[52]: list,
			[53]: list,
			[54]: list,
			[55]: list,
			[56]: list,
			[57]: list,
			[62]: blockQuote
		};
		/** @satisfies {Extension['contentInitial']} */
		const contentInitial = { [91]: definition };
		/** @satisfies {Extension['flowInitial']} */
		const flowInitial = {
			[-2]: codeIndented,
			[-1]: codeIndented,
			[32]: codeIndented
		};
		/** @satisfies {Extension['flow']} */
		const flow = {
			[35]: headingAtx,
			[42]: thematicBreak,
			[45]: [setextUnderline, thematicBreak],
			[60]: htmlFlow,
			[61]: setextUnderline,
			[95]: thematicBreak,
			[96]: codeFenced,
			[126]: codeFenced
		};
		/** @satisfies {Extension['string']} */
		const string = {
			[38]: characterReference,
			[92]: characterEscape
		};
		/** @satisfies {Extension['text']} */
		const text = {
			[-5]: lineEnding,
			[-4]: lineEnding,
			[-3]: lineEnding,
			[33]: labelStartImage,
			[38]: characterReference,
			[42]: attention,
			[60]: [autolink, htmlText],
			[91]: labelStartLink,
			[92]: [hardBreakEscape, characterEscape],
			[93]: labelEnd,
			[95]: attention,
			[96]: codeText
		};
		/** @satisfies {Extension['insideSpan']} */
		const insideSpan = { null: [attention, resolver] };
		/** @satisfies {Extension['attentionMarkers']} */
		const attentionMarkers = { null: [42, 95] };
		/** @satisfies {Extension['disable']} */
		const disable = { null: [] };
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/create-tokenizer.js
		/**
		* @import {
		*   Chunk,
		*   Code,
		*   ConstructRecord,
		*   Construct,
		*   Effects,
		*   InitialConstruct,
		*   ParseContext,
		*   Point,
		*   State,
		*   TokenizeContext,
		*   Token
		* } from 'micromark-util-types'
		*/
		/**
		* @callback Restore
		*   Restore the state.
		* @returns {undefined}
		*   Nothing.
		*
		* @typedef Info
		*   Info.
		* @property {Restore} restore
		*   Restore.
		* @property {number} from
		*   From.
		*
		* @callback ReturnHandle
		*   Handle a successful run.
		* @param {Construct} construct
		*   Construct.
		* @param {Info} info
		*   Info.
		* @returns {undefined}
		*   Nothing.
		*/
		/**
		* Create a tokenizer.
		* Tokenizers deal with one type of data (e.g., containers, flow, text).
		* The parser is the object dealing with it all.
		* `initialize` works like other constructs, except that only its `tokenize`
		* function is used, in which case it doesn’t receive an `ok` or `nok`.
		* `from` can be given to set the point before the first character, although
		* when further lines are indented, they must be set with `defineSkip`.
		*
		* @param {ParseContext} parser
		*   Parser.
		* @param {InitialConstruct} initialize
		*   Construct.
		* @param {Omit<Point, '_bufferIndex' | '_index'> | undefined} [from]
		*   Point (optional).
		* @returns {TokenizeContext}
		*   Context.
		*/
		function createTokenizer(parser, initialize, from) {
			/** @type {Point} */
			let point = {
				_bufferIndex: -1,
				_index: 0,
				line: from && from.line || 1,
				column: from && from.column || 1,
				offset: from && from.offset || 0
			};
			/** @type {Record<string, number>} */
			const columnStart = {};
			/** @type {Array<Construct>} */
			const resolveAllConstructs = [];
			/** @type {Array<Chunk>} */
			let chunks = [];
			/** @type {Array<Token>} */
			let stack = [];
			/**
			* Tools used for tokenizing.
			*
			* @type {Effects}
			*/
			const effects = {
				attempt: constructFactory(onsuccessfulconstruct),
				check: constructFactory(onsuccessfulcheck),
				consume,
				enter,
				exit,
				interrupt: constructFactory(onsuccessfulcheck, { interrupt: true })
			};
			/**
			* State and tools for resolving and serializing.
			*
			* @type {TokenizeContext}
			*/
			const context = {
				code: null,
				containerState: {},
				defineSkip,
				events: [],
				now,
				parser,
				previous: null,
				sliceSerialize,
				sliceStream,
				write
			};
			/**
			* The state function.
			*
			* @type {State | undefined}
			*/
			let state = initialize.tokenize.call(context, effects);
			if (initialize.resolveAll) resolveAllConstructs.push(initialize);
			return context;
			/** @type {TokenizeContext['write']} */
			function write(slice) {
				chunks = push(chunks, slice);
				main();
				if (chunks[chunks.length - 1] !== null) return [];
				addResult(initialize, 0);
				context.events = resolveAll(resolveAllConstructs, context.events, context);
				return context.events;
			}
			/** @type {TokenizeContext['sliceSerialize']} */
			function sliceSerialize(token, expandTabs) {
				return serializeChunks(sliceStream(token), expandTabs);
			}
			/** @type {TokenizeContext['sliceStream']} */
			function sliceStream(token) {
				return sliceChunks(chunks, token);
			}
			/** @type {TokenizeContext['now']} */
			function now() {
				const { _bufferIndex, _index, line, column, offset } = point;
				return {
					_bufferIndex,
					_index,
					line,
					column,
					offset
				};
			}
			/** @type {TokenizeContext['defineSkip']} */
			function defineSkip(value) {
				columnStart[value.line] = value.column;
				accountForPotentialSkip();
			}
			/**
			* Main loop (note that `_index` and `_bufferIndex` in `point` are modified by
			* `consume`).
			* Here is where we walk through the chunks, which either include strings of
			* several characters, or numerical character codes.
			* The reason to do this in a loop instead of a call is so the stack can
			* drain.
			*
			* @returns {undefined}
			*   Nothing.
			*/
			function main() {
				while (point._index < chunks.length) {
					const chunk = chunks[point._index];
					if (typeof chunk === "string") {
						const chunkIndex = point._index;
						if (point._bufferIndex < 0) point._bufferIndex = 0;
						while (point._index === chunkIndex && point._bufferIndex < chunk.length) go(chunk.charCodeAt(point._bufferIndex));
					} else go(chunk);
				}
			}
			/**
			* Deal with one code.
			*
			* @param {Code} code
			*   Code.
			* @returns {undefined}
			*   Nothing.
			*/
			function go(code) {
				state = state(code);
			}
			/** @type {Effects['consume']} */
			function consume(code) {
				if (markdownLineEnding(code)) {
					point.line++;
					point.column = 1;
					point.offset += code === -3 ? 2 : 1;
					accountForPotentialSkip();
				} else if (code !== -1) {
					point.column++;
					point.offset++;
				}
				if (point._bufferIndex < 0) point._index++;
				else {
					point._bufferIndex++;
					if (point._bufferIndex === chunks[point._index].length) {
						point._bufferIndex = -1;
						point._index++;
					}
				}
				context.previous = code;
			}
			/** @type {Effects['enter']} */
			function enter(type, fields) {
				/** @type {Token} */
				const token = fields || {};
				token.type = type;
				token.start = now();
				context.events.push([
					"enter",
					token,
					context
				]);
				stack.push(token);
				return token;
			}
			/** @type {Effects['exit']} */
			function exit(type) {
				const token = stack.pop();
				token.end = now();
				context.events.push([
					"exit",
					token,
					context
				]);
				return token;
			}
			/**
			* Use results.
			*
			* @type {ReturnHandle}
			*/
			function onsuccessfulconstruct(construct, info) {
				addResult(construct, info.from);
			}
			/**
			* Discard results.
			*
			* @type {ReturnHandle}
			*/
			function onsuccessfulcheck(_, info) {
				info.restore();
			}
			/**
			* Factory to attempt/check/interrupt.
			*
			* @param {ReturnHandle} onreturn
			*   Callback.
			* @param {{interrupt?: boolean | undefined} | undefined} [fields]
			*   Fields.
			*/
			function constructFactory(onreturn, fields) {
				return hook;
				/**
				* Handle either an object mapping codes to constructs, a list of
				* constructs, or a single construct.
				*
				* @param {Array<Construct> | ConstructRecord | Construct} constructs
				*   Constructs.
				* @param {State} returnState
				*   State.
				* @param {State | undefined} [bogusState]
				*   State.
				* @returns {State}
				*   State.
				*/
				function hook(constructs, returnState, bogusState) {
					/** @type {ReadonlyArray<Construct>} */
					let listOfConstructs;
					/** @type {number} */
					let constructIndex;
					/** @type {Construct} */
					let currentConstruct;
					/** @type {Info} */
					let info;
					return Array.isArray(constructs) ? handleListOfConstructs(constructs) : "tokenize" in constructs ? handleListOfConstructs([constructs]) : handleMapOfConstructs(constructs);
					/**
					* Handle a list of construct.
					*
					* @param {ConstructRecord} map
					*   Constructs.
					* @returns {State}
					*   State.
					*/
					function handleMapOfConstructs(map) {
						return start;
						/** @type {State} */
						function start(code) {
							const left = code !== null && map[code];
							const all = code !== null && map.null;
							return handleListOfConstructs([...Array.isArray(left) ? left : left ? [left] : [], ...Array.isArray(all) ? all : all ? [all] : []])(code);
						}
					}
					/**
					* Handle a list of construct.
					*
					* @param {ReadonlyArray<Construct>} list
					*   Constructs.
					* @returns {State}
					*   State.
					*/
					function handleListOfConstructs(list) {
						listOfConstructs = list;
						constructIndex = 0;
						if (list.length === 0) return bogusState;
						return handleConstruct(list[constructIndex]);
					}
					/**
					* Handle a single construct.
					*
					* @param {Construct} construct
					*   Construct.
					* @returns {State}
					*   State.
					*/
					function handleConstruct(construct) {
						return start;
						/** @type {State} */
						function start(code) {
							info = store();
							currentConstruct = construct;
							if (!construct.partial) context.currentConstruct = construct;
							if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) return nok(code);
							return construct.tokenize.call(fields ? Object.assign(Object.create(context), fields) : context, effects, ok, nok)(code);
						}
					}
					/** @type {State} */
					function ok(code) {
						onreturn(currentConstruct, info);
						return returnState;
					}
					/** @type {State} */
					function nok(code) {
						info.restore();
						if (++constructIndex < listOfConstructs.length) return handleConstruct(listOfConstructs[constructIndex]);
						return bogusState;
					}
				}
			}
			/**
			* @param {Construct} construct
			*   Construct.
			* @param {number} from
			*   From.
			* @returns {undefined}
			*   Nothing.
			*/
			function addResult(construct, from) {
				if (construct.resolveAll && !resolveAllConstructs.includes(construct)) resolveAllConstructs.push(construct);
				if (construct.resolve) splice(context.events, from, context.events.length - from, construct.resolve(context.events.slice(from), context));
				if (construct.resolveTo) context.events = construct.resolveTo(context.events, context);
			}
			/**
			* Store state.
			*
			* @returns {Info}
			*   Info.
			*/
			function store() {
				const startPoint = now();
				const startPrevious = context.previous;
				const startCurrentConstruct = context.currentConstruct;
				const startEventsIndex = context.events.length;
				const startStack = Array.from(stack);
				return {
					from: startEventsIndex,
					restore
				};
				/**
				* Restore state.
				*
				* @returns {undefined}
				*   Nothing.
				*/
				function restore() {
					point = startPoint;
					context.previous = startPrevious;
					context.currentConstruct = startCurrentConstruct;
					context.events.length = startEventsIndex;
					stack = startStack;
					accountForPotentialSkip();
				}
			}
			/**
			* Move the current point a bit forward in the line when it’s on a column
			* skip.
			*
			* @returns {undefined}
			*   Nothing.
			*/
			function accountForPotentialSkip() {
				if (point.line in columnStart && point.column < 2) {
					point.column = columnStart[point.line];
					point.offset += columnStart[point.line] - 1;
				}
			}
		}
		/**
		* Get the chunks from a slice of chunks in the range of a token.
		*
		* @param {ReadonlyArray<Chunk>} chunks
		*   Chunks.
		* @param {Pick<Token, 'end' | 'start'>} token
		*   Token.
		* @returns {Array<Chunk>}
		*   Chunks.
		*/
		function sliceChunks(chunks, token) {
			const startIndex = token.start._index;
			const startBufferIndex = token.start._bufferIndex;
			const endIndex = token.end._index;
			const endBufferIndex = token.end._bufferIndex;
			/** @type {Array<Chunk>} */
			let view;
			if (startIndex === endIndex) view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
			else {
				view = chunks.slice(startIndex, endIndex);
				if (startBufferIndex > -1) {
					const head = view[0];
					if (typeof head === "string") view[0] = head.slice(startBufferIndex);
					else view.shift();
				}
				if (endBufferIndex > 0) view.push(chunks[endIndex].slice(0, endBufferIndex));
			}
			return view;
		}
		/**
		* Get the string value of a slice of chunks.
		*
		* @param {ReadonlyArray<Chunk>} chunks
		*   Chunks.
		* @param {boolean | undefined} [expandTabs=false]
		*   Whether to expand tabs (default: `false`).
		* @returns {string}
		*   Result.
		*/
		function serializeChunks(chunks, expandTabs) {
			let index = -1;
			/** @type {Array<string>} */
			const result = [];
			/** @type {boolean | undefined} */
			let atTab;
			while (++index < chunks.length) {
				const chunk = chunks[index];
				/** @type {string} */
				let value;
				if (typeof chunk === "string") value = chunk;
				else switch (chunk) {
					case -5:
						value = "\r";
						break;
					case -4:
						value = "\n";
						break;
					case -3:
						value = "\r\n";
						break;
					case -2:
						value = expandTabs ? " " : "	";
						break;
					case -1:
						if (!expandTabs && atTab) continue;
						value = " ";
						break;
					default: value = String.fromCharCode(chunk);
				}
				atTab = chunk === -2;
				result.push(value);
			}
			return result.join("");
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/parse.js
		/**
		* @import {
		*   Create,
		*   FullNormalizedExtension,
		*   InitialConstruct,
		*   ParseContext,
		*   ParseOptions
		* } from 'micromark-util-types'
		*/
		/**
		* @param {ParseOptions | null | undefined} [options]
		*   Configuration (optional).
		* @returns {ParseContext}
		*   Parser.
		*/
		function parse(options) {
			/** @type {ParseContext} */
			const parser = {
				constructs: combineExtensions([constructs_exports, ...(options || {}).extensions || []]),
				content: create(content$1),
				defined: [],
				document: create(document$1),
				flow: create(flow$1),
				lazy: {},
				string: create(string$1),
				text: create(text$1)
			};
			return parser;
			/**
			* @param {InitialConstruct} initial
			*   Construct to start with.
			* @returns {Create}
			*   Create a tokenizer.
			*/
			function create(initial) {
				return creator;
				/** @type {Create} */
				function creator(from) {
					return createTokenizer(parser, initial, from);
				}
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/postprocess.js
		/**
		* @import {Event} from 'micromark-util-types'
		*/
		/**
		* @param {Array<Event>} events
		*   Events.
		* @returns {Array<Event>}
		*   Events.
		*/
		function postprocess(events) {
			while (!subtokenize(events));
			return events;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark/lib/preprocess.js
		/**
		* @import {Chunk, Code, Encoding, Value} from 'micromark-util-types'
		*/
		/**
		* @callback Preprocessor
		*   Preprocess a value.
		* @param {Value} value
		*   Value.
		* @param {Encoding | null | undefined} [encoding]
		*   Encoding when `value` is a typed array (optional).
		* @param {boolean | null | undefined} [end=false]
		*   Whether this is the last chunk (default: `false`).
		* @returns {Array<Chunk>}
		*   Chunks.
		*/
		const search = /[\0\t\n\r]/g;
		/**
		* @returns {Preprocessor}
		*   Preprocess a value.
		*/
		function preprocess() {
			let column = 1;
			let buffer = "";
			/** @type {boolean | undefined} */
			let start = true;
			/** @type {boolean | undefined} */
			let atCarriageReturn;
			return preprocessor;
			/** @type {Preprocessor} */
			function preprocessor(value, encoding, end) {
				value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
				/** @type {Array<Chunk>} */
				const chunks = [];
				let startPosition = 0;
				buffer = "";
				if (start) {
					if (value.charCodeAt(0) === 65279) startPosition++;
					start = void 0;
				}
				while (startPosition < value.length) {
					search.lastIndex = startPosition;
					const match = search.exec(value);
					const endPosition = match && match.index !== void 0 ? match.index : value.length;
					const code = value.charCodeAt(endPosition);
					if (!match) {
						buffer = value.slice(startPosition);
						break;
					}
					if (code === 10 && startPosition === endPosition && atCarriageReturn) {
						chunks.push(-3);
						atCarriageReturn = void 0;
					} else {
						if (atCarriageReturn) {
							chunks.push(-5);
							atCarriageReturn = void 0;
						}
						if (startPosition < endPosition) {
							chunks.push(value.slice(startPosition, endPosition));
							column += endPosition - startPosition;
						}
						switch (code) {
							case 0:
								chunks.push(65533);
								column++;
								break;
							case 9: {
								const next = Math.ceil(column / 4) * 4;
								chunks.push(-2);
								while (column++ < next) chunks.push(-1);
								break;
							}
							case 10:
								chunks.push(-4);
								column = 1;
								break;
							default:
								atCarriageReturn = true;
								column = 1;
						}
					}
					startPosition = endPosition + 1;
				}
				if (end) {
					if (atCarriageReturn) chunks.push(-5);
					if (buffer) chunks.push(buffer);
					chunks.push(null);
				}
				return chunks;
			}
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/micromark-util-decode-string/index.js
		const characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
		/**
		* Decode markdown strings (which occur in places such as fenced code info
		* strings, destinations, labels, and titles).
		*
		* The “string” content type allows character escapes and -references.
		* This decodes those.
		*
		* @param {string} value
		*   Value to decode.
		* @returns {string}
		*   Decoded value.
		*/
		function decodeString(value) {
			return value.replace(characterEscapeOrReference, decode);
		}
		/**
		* @param {string} $0
		*   Match.
		* @param {string} $1
		*   Character escape.
		* @param {string} $2
		*   Character reference.
		* @returns {string}
		*   Decoded value
		*/
		function decode($0, $1, $2) {
			if ($1) return $1;
			if ($2.charCodeAt(0) === 35) {
				const head = $2.charCodeAt(1);
				const hex = head === 120 || head === 88;
				return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
			}
			return decodeNamedCharacterReference($2) || $0;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/unist-util-stringify-position/lib/index.js
		/**
		* @typedef {import('unist').Node} Node
		* @typedef {import('unist').Point} Point
		* @typedef {import('unist').Position} Position
		*/
		/**
		* @typedef NodeLike
		* @property {string} type
		* @property {PositionLike | null | undefined} [position]
		*
		* @typedef PointLike
		* @property {number | null | undefined} [line]
		* @property {number | null | undefined} [column]
		* @property {number | null | undefined} [offset]
		*
		* @typedef PositionLike
		* @property {PointLike | null | undefined} [start]
		* @property {PointLike | null | undefined} [end]
		*/
		/**
		* Serialize the positional info of a point, position (start and end points),
		* or node.
		*
		* @param {Node | NodeLike | Point | PointLike | Position | PositionLike | null | undefined} [value]
		*   Node, position, or point.
		* @returns {string}
		*   Pretty printed positional info of a node (`string`).
		*
		*   In the format of a range `ls:cs-le:ce` (when given `node` or `position`)
		*   or a point `l:c` (when given `point`), where `l` stands for line, `c` for
		*   column, `s` for `start`, and `e` for end.
		*   An empty string (`''`) is returned if the given value is neither `node`,
		*   `position`, nor `point`.
		*/
		function stringifyPosition(value) {
			if (!value || typeof value !== "object") return "";
			if ("position" in value || "type" in value) return position(value.position);
			if ("start" in value || "end" in value) return position(value);
			if ("line" in value || "column" in value) return point$1(value);
			return "";
		}
		/**
		* @param {Point | PointLike | null | undefined} point
		* @returns {string}
		*/
		function point$1(point) {
			return index(point && point.line) + ":" + index(point && point.column);
		}
		/**
		* @param {Position | PositionLike | null | undefined} pos
		* @returns {string}
		*/
		function position(pos) {
			return point$1(pos && pos.start) + "-" + point$1(pos && pos.end);
		}
		/**
		* @param {number | null | undefined} value
		* @returns {number}
		*/
		function index(value) {
			return value && typeof value === "number" ? value : 1;
		}
		//#endregion
		//#region ../../../../../../dsh-022-rc3-20261115/runtime-final/node_modules/mdast-util-from-markdown/lib/index.js
		/**
		* @import {
		*   Break,
		*   Blockquote,
		*   Code,
		*   Definition,
		*   Emphasis,
		*   Heading,
		*   Html,
		*   Image,
		*   InlineCode,
		*   Link,
		*   ListItem,
		*   List,
		*   Nodes,
		*   Paragraph,
		*   PhrasingContent,
		*   ReferenceType,
		*   Root,
		*   Strong,
		*   Text,
		*   ThematicBreak
		* } from 'mdast'
		* @import {
		*   Encoding,
		*   Event,
		*   Token,
		*   Value
		* } from 'micromark-util-types'
		* @import {Point} from 'unist'
		* @import {
		*   CompileContext,
		*   CompileData,
		*   Config,
		*   Extension,
		*   Handle,
		*   OnEnterError,
		*   Options
		* } from './types.js'
		*/
		const own = {}.hasOwnProperty;
		/**
		* Turn markdown into a syntax tree.
		*
		* @overload
		* @param {Value} value
		* @param {Encoding | null | undefined} [encoding]
		* @param {Options | null | undefined} [options]
		* @returns {Root}
		*
		* @overload
		* @param {Value} value
		* @param {Options | null | undefined} [options]
		* @returns {Root}
		*
		* @param {Value} value
		*   Markdown to parse.
		* @param {Encoding | Options | null | undefined} [encoding]
		*   Character encoding for when `value` is `Buffer`.
		* @param {Options | null | undefined} [options]
		*   Configuration.
		* @returns {Root}
		*   mdast tree.
		*/
		function fromMarkdown(value, encoding, options) {
			if (encoding && typeof encoding === "object") {
				options = encoding;
				encoding = void 0;
			}
			return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
		}
		/**
		* Note this compiler only understand complete buffering, not streaming.
		*
		* @param {Options | null | undefined} [options]
		*/
		function compiler(options) {
			/** @type {Config} */
			const config = {
				transforms: [],
				canContainEols: [
					"emphasis",
					"fragment",
					"heading",
					"paragraph",
					"strong"
				],
				enter: {
					autolink: opener(link),
					autolinkProtocol: onenterdata,
					autolinkEmail: onenterdata,
					atxHeading: opener(heading),
					blockQuote: opener(blockQuote),
					characterEscape: onenterdata,
					characterReference: onenterdata,
					codeFenced: opener(codeFlow),
					codeFencedFenceInfo: buffer,
					codeFencedFenceMeta: buffer,
					codeIndented: opener(codeFlow, buffer),
					codeText: opener(codeText, buffer),
					codeTextData: onenterdata,
					data: onenterdata,
					codeFlowValue: onenterdata,
					definition: opener(definition),
					definitionDestinationString: buffer,
					definitionLabelString: buffer,
					definitionTitleString: buffer,
					emphasis: opener(emphasis),
					hardBreakEscape: opener(hardBreak),
					hardBreakTrailing: opener(hardBreak),
					htmlFlow: opener(html, buffer),
					htmlFlowData: onenterdata,
					htmlText: opener(html, buffer),
					htmlTextData: onenterdata,
					image: opener(image),
					label: buffer,
					link: opener(link),
					listItem: opener(listItem),
					listItemValue: onenterlistitemvalue,
					listOrdered: opener(list, onenterlistordered),
					listUnordered: opener(list),
					paragraph: opener(paragraph),
					reference: onenterreference,
					referenceString: buffer,
					resourceDestinationString: buffer,
					resourceTitleString: buffer,
					setextHeading: opener(heading),
					strong: opener(strong),
					thematicBreak: opener(thematicBreak)
				},
				exit: {
					atxHeading: closer(),
					atxHeadingSequence: onexitatxheadingsequence,
					autolink: closer(),
					autolinkEmail: onexitautolinkemail,
					autolinkProtocol: onexitautolinkprotocol,
					blockQuote: closer(),
					characterEscapeValue: onexitdata,
					characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
					characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
					characterReferenceValue: onexitcharacterreferencevalue,
					characterReference: onexitcharacterreference,
					codeFenced: closer(onexitcodefenced),
					codeFencedFence: onexitcodefencedfence,
					codeFencedFenceInfo: onexitcodefencedfenceinfo,
					codeFencedFenceMeta: onexitcodefencedfencemeta,
					codeFlowValue: onexitdata,
					codeIndented: closer(onexitcodeindented),
					codeText: closer(onexitcodetext),
					codeTextData: onexitdata,
					data: onexitdata,
					definition: closer(),
					definitionDestinationString: onexitdefinitiondestinationstring,
					definitionLabelString: onexitdefinitionlabelstring,
					definitionTitleString: onexitdefinitiontitlestring,
					emphasis: closer(),
					hardBreakEscape: closer(onexithardbreak),
					hardBreakTrailing: closer(onexithardbreak),
					htmlFlow: closer(onexithtmlflow),
					htmlFlowData: onexitdata,
					htmlText: closer(onexithtmltext),
					htmlTextData: onexitdata,
					image: closer(onexitimage),
					label: onexitlabel,
					labelText: onexitlabeltext,
					lineEnding: onexitlineending,
					link: closer(onexitlink),
					listItem: closer(),
					listOrdered: closer(),
					listUnordered: closer(),
					paragraph: closer(),
					referenceString: onexitreferencestring,
					resourceDestinationString: onexitresourcedestinationstring,
					resourceTitleString: onexitresourcetitlestring,
					resource: onexitresource,
					setextHeading: closer(onexitsetextheading),
					setextHeadingLineSequence: onexitsetextheadinglinesequence,
					setextHeadingText: onexitsetextheadingtext,
					strong: closer(),
					thematicBreak: closer()
				}
			};
			configure(config, (options || {}).mdastExtensions || []);
			/** @type {CompileData} */
			const data = {};
			return compile;
			/**
			* Turn micromark events into an mdast tree.
			*
			* @param {Array<Event>} events
			*   Events.
			* @returns {Root}
			*   mdast tree.
			*/
			function compile(events) {
				/** @type {Root} */
				let tree = {
					type: "root",
					children: []
				};
				/** @type {Omit<CompileContext, 'sliceSerialize'>} */
				const context = {
					stack: [tree],
					tokenStack: [],
					config,
					enter,
					exit,
					buffer,
					resume,
					data
				};
				/** @type {Array<number>} */
				const listStack = [];
				let index = -1;
				while (++index < events.length) if (events[index][1].type === "listOrdered" || events[index][1].type === "listUnordered") {
					if (events[index][0] === "enter") listStack.push(index);
					else index = prepareList(events, listStack.pop(), index);
				}
				index = -1;
				while (++index < events.length) {
					const handler = config[events[index][0]];
					if (own.call(handler, events[index][1].type)) handler[events[index][1].type].call(Object.assign({ sliceSerialize: events[index][2].sliceSerialize }, context), events[index][1]);
				}
				if (context.tokenStack.length > 0) {
					const tail = context.tokenStack[context.tokenStack.length - 1];
					(tail[1] || defaultOnError).call(context, void 0, tail[0]);
				}
				tree.position = {
					start: point(events.length > 0 ? events[0][1].start : {
						line: 1,
						column: 1,
						offset: 0
					}),
					end: point(events.length > 0 ? events[events.length - 2][1].end : {
						line: 1,
						column: 1,
						offset: 0
					})
				};
				index = -1;
				while (++index < config.transforms.length) tree = config.transforms[index](tree) || tree;
				return tree;
			}
			/**
			* @param {Array<Event>} events
			* @param {number} start
			* @param {number} length
			* @returns {number}
			*/
			function prepareList(events, start, length) {
				let index = start - 1;
				let containerBalance = -1;
				let listSpread = false;
				/** @type {Token | undefined} */
				let listItem;
				/** @type {number | undefined} */
				let lineIndex;
				/** @type {number | undefined} */
				let firstBlankLineIndex;
				/** @type {boolean | undefined} */
				let atMarker;
				while (++index <= length) {
					const event = events[index];
					switch (event[1].type) {
						case "listUnordered":
						case "listOrdered":
						case "blockQuote":
							if (event[0] === "enter") containerBalance++;
							else containerBalance--;
							atMarker = void 0;
							break;
						case "lineEndingBlank":
							if (event[0] === "enter") {
								if (listItem && !atMarker && !containerBalance && !firstBlankLineIndex) firstBlankLineIndex = index;
								atMarker = void 0;
							}
							break;
						case "linePrefix":
						case "listItemValue":
						case "listItemMarker":
						case "listItemPrefix":
						case "listItemPrefixWhitespace": break;
						default: atMarker = void 0;
					}
					if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
						if (listItem) {
							let tailIndex = index;
							lineIndex = void 0;
							while (tailIndex--) {
								const tailEvent = events[tailIndex];
								if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
									if (tailEvent[0] === "exit") continue;
									if (lineIndex) {
										events[lineIndex][1].type = "lineEndingBlank";
										listSpread = true;
									}
									tailEvent[1].type = "lineEnding";
									lineIndex = tailIndex;
								} else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {} else break;
							}
							if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) listItem._spread = true;
							listItem.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
							events.splice(lineIndex || index, 0, [
								"exit",
								listItem,
								event[2]
							]);
							index++;
							length++;
						}
						if (event[1].type === "listItemPrefix") {
							/** @type {Token} */
							const item = {
								type: "listItem",
								_spread: false,
								start: Object.assign({}, event[1].start),
								end: void 0
							};
							listItem = item;
							events.splice(index, 0, [
								"enter",
								item,
								event[2]
							]);
							index++;
							length++;
							firstBlankLineIndex = void 0;
							atMarker = true;
						}
					}
				}
				events[start][1]._spread = listSpread;
				return length;
			}
			/**
			* Create an opener handle.
			*
			* @param {(token: Token) => Nodes} create
			*   Create a node.
			* @param {Handle | undefined} [and]
			*   Optional function to also run.
			* @returns {Handle}
			*   Handle.
			*/
			function opener(create, and) {
				return open;
				/**
				* @this {CompileContext}
				* @param {Token} token
				* @returns {undefined}
				*/
				function open(token) {
					enter.call(this, create(token), token);
					if (and) and.call(this, token);
				}
			}
			/**
			* @type {CompileContext['buffer']}
			*/
			function buffer() {
				this.stack.push({
					type: "fragment",
					children: []
				});
			}
			/**
			* @type {CompileContext['enter']}
			*/
			function enter(node, token, errorHandler) {
				this.stack[this.stack.length - 1].children.push(node);
				this.stack.push(node);
				this.tokenStack.push([token, errorHandler || void 0]);
				node.position = {
					start: point(token.start),
					end: void 0
				};
			}
			/**
			* Create a closer handle.
			*
			* @param {Handle | undefined} [and]
			*   Optional function to also run.
			* @returns {Handle}
			*   Handle.
			*/
			function closer(and) {
				return close;
				/**
				* @this {CompileContext}
				* @param {Token} token
				* @returns {undefined}
				*/
				function close(token) {
					if (and) and.call(this, token);
					exit.call(this, token);
				}
			}
			/**
			* @type {CompileContext['exit']}
			*/
			function exit(token, onExitError) {
				const node = this.stack.pop();
				const open = this.tokenStack.pop();
				if (!open) throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
					start: token.start,
					end: token.end
				}) + "): it’s not open");
				else if (open[0].type !== token.type) {
					if (onExitError) onExitError.call(this, token, open[0]);
					else (open[1] || defaultOnError).call(this, token, open[0]);
				}
				node.position.end = point(token.end);
			}
			/**
			* @type {CompileContext['resume']}
			*/
			function resume() {
				return toString(this.stack.pop());
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onenterlistordered() {
				this.data.expectingFirstListItemValue = true;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onenterlistitemvalue(token) {
				if (this.data.expectingFirstListItemValue) {
					const ancestor = this.stack[this.stack.length - 2];
					ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
					this.data.expectingFirstListItemValue = void 0;
				}
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodefencedfenceinfo() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.lang = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodefencedfencemeta() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.meta = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodefencedfence() {
				if (this.data.flowCodeInside) return;
				this.buffer();
				this.data.flowCodeInside = true;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodefenced() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.value = data.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
				this.data.flowCodeInside = void 0;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodeindented() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.value = data.replace(/(\r?\n|\r)$/g, "");
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitdefinitionlabelstring(token) {
				const label = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.label = label;
				node.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitdefinitiontitlestring() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.title = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitdefinitiondestinationstring() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.url = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitatxheadingsequence(token) {
				const node = this.stack[this.stack.length - 1];
				if (!node.depth) node.depth = this.sliceSerialize(token).length;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitsetextheadingtext() {
				this.data.setextHeadingSlurpLineEnding = true;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitsetextheadinglinesequence(token) {
				const node = this.stack[this.stack.length - 1];
				node.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitsetextheading() {
				this.data.setextHeadingSlurpLineEnding = void 0;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onenterdata(token) {
				/** @type {Array<Nodes>} */
				const siblings = this.stack[this.stack.length - 1].children;
				let tail = siblings[siblings.length - 1];
				if (!tail || tail.type !== "text") {
					tail = text();
					tail.position = {
						start: point(token.start),
						end: void 0
					};
					siblings.push(tail);
				}
				this.stack.push(tail);
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitdata(token) {
				const tail = this.stack.pop();
				tail.value += this.sliceSerialize(token);
				tail.position.end = point(token.end);
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitlineending(token) {
				const context = this.stack[this.stack.length - 1];
				if (this.data.atHardBreak) {
					const tail = context.children[context.children.length - 1];
					tail.position.end = point(token.end);
					this.data.atHardBreak = void 0;
					return;
				}
				if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
					onenterdata.call(this, token);
					onexitdata.call(this, token);
				}
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexithardbreak() {
				this.data.atHardBreak = true;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexithtmlflow() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.value = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexithtmltext() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.value = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcodetext() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.value = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitlink() {
				const node = this.stack[this.stack.length - 1];
				if (this.data.inReference) {
					/** @type {ReferenceType} */
					const referenceType = this.data.referenceType || "shortcut";
					node.type += "Reference";
					node.referenceType = referenceType;
					delete node.url;
					delete node.title;
				} else {
					delete node.identifier;
					delete node.label;
				}
				this.data.referenceType = void 0;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitimage() {
				const node = this.stack[this.stack.length - 1];
				if (this.data.inReference) {
					/** @type {ReferenceType} */
					const referenceType = this.data.referenceType || "shortcut";
					node.type += "Reference";
					node.referenceType = referenceType;
					delete node.url;
					delete node.title;
				} else {
					delete node.identifier;
					delete node.label;
				}
				this.data.referenceType = void 0;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitlabeltext(token) {
				const string = this.sliceSerialize(token);
				const ancestor = this.stack[this.stack.length - 2];
				ancestor.label = decodeString(string);
				ancestor.identifier = normalizeIdentifier(string).toLowerCase();
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitlabel() {
				const fragment = this.stack[this.stack.length - 1];
				const value = this.resume();
				const node = this.stack[this.stack.length - 1];
				this.data.inReference = true;
				if (node.type === "link") node.children = fragment.children;
				else node.alt = value;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitresourcedestinationstring() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.url = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitresourcetitlestring() {
				const data = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.title = data;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitresource() {
				this.data.inReference = void 0;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onenterreference() {
				this.data.referenceType = "collapsed";
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitreferencestring(token) {
				const label = this.resume();
				const node = this.stack[this.stack.length - 1];
				node.label = label;
				node.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
				this.data.referenceType = "full";
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcharacterreferencemarker(token) {
				this.data.characterReferenceType = token.type;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcharacterreferencevalue(token) {
				const data = this.sliceSerialize(token);
				const type = this.data.characterReferenceType;
				/** @type {string} */
				let value;
				if (type) {
					value = decodeNumericCharacterReference(data, type === "characterReferenceMarkerNumeric" ? 10 : 16);
					this.data.characterReferenceType = void 0;
				} else value = decodeNamedCharacterReference(data);
				const tail = this.stack[this.stack.length - 1];
				tail.value += value;
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitcharacterreference(token) {
				const tail = this.stack.pop();
				tail.position.end = point(token.end);
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitautolinkprotocol(token) {
				onexitdata.call(this, token);
				const node = this.stack[this.stack.length - 1];
				node.url = this.sliceSerialize(token);
			}
			/**
			* @this {CompileContext}
			* @type {Handle}
			*/
			function onexitautolinkemail(token) {
				onexitdata.call(this, token);
				const node = this.stack[this.stack.length - 1];
				node.url = "mailto:" + this.sliceSerialize(token);
			}
			/** @returns {Blockquote} */
			function blockQuote() {
				return {
					type: "blockquote",
					children: []
				};
			}
			/** @returns {Code} */
			function codeFlow() {
				return {
					type: "code",
					lang: null,
					meta: null,
					value: ""
				};
			}
			/** @returns {InlineCode} */
			function codeText() {
				return {
					type: "inlineCode",
					value: ""
				};
			}
			/** @returns {Definition} */
			function definition() {
				return {
					type: "definition",
					identifier: "",
					label: null,
					title: null,
					url: ""
				};
			}
			/** @returns {Emphasis} */
			function emphasis() {
				return {
					type: "emphasis",
					children: []
				};
			}
			/** @returns {Heading} */
			function heading() {
				return {
					type: "heading",
					depth: 0,
					children: []
				};
			}
			/** @returns {Break} */
			function hardBreak() {
				return { type: "break" };
			}
			/** @returns {Html} */
			function html() {
				return {
					type: "html",
					value: ""
				};
			}
			/** @returns {Image} */
			function image() {
				return {
					type: "image",
					title: null,
					url: "",
					alt: null
				};
			}
			/** @returns {Link} */
			function link() {
				return {
					type: "link",
					title: null,
					url: "",
					children: []
				};
			}
			/**
			* @param {Token} token
			* @returns {List}
			*/
			function list(token) {
				return {
					type: "list",
					ordered: token.type === "listOrdered",
					start: null,
					spread: token._spread,
					children: []
				};
			}
			/**
			* @param {Token} token
			* @returns {ListItem}
			*/
			function listItem(token) {
				return {
					type: "listItem",
					spread: token._spread,
					checked: null,
					children: []
				};
			}
			/** @returns {Paragraph} */
			function paragraph() {
				return {
					type: "paragraph",
					children: []
				};
			}
			/** @returns {Strong} */
			function strong() {
				return {
					type: "strong",
					children: []
				};
			}
			/** @returns {Text} */
			function text() {
				return {
					type: "text",
					value: ""
				};
			}
			/** @returns {ThematicBreak} */
			function thematicBreak() {
				return { type: "thematicBreak" };
			}
		}
		/**
		* Copy a point-like value.
		*
		* @param {Point} d
		*   Point-like value.
		* @returns {Point}
		*   unist point.
		*/
		function point(d) {
			return {
				line: d.line,
				column: d.column,
				offset: d.offset
			};
		}
		/**
		* @param {Config} combined
		* @param {Array<Array<Extension> | Extension>} extensions
		* @returns {undefined}
		*/
		function configure(combined, extensions) {
			let index = -1;
			while (++index < extensions.length) {
				const value = extensions[index];
				if (Array.isArray(value)) configure(combined, value);
				else extension(combined, value);
			}
		}
		/**
		* @param {Config} combined
		* @param {Extension} extension
		* @returns {undefined}
		*/
		function extension(combined, extension) {
			/** @type {keyof Extension} */
			let key;
			for (key in extension) if (own.call(extension, key)) switch (key) {
				case "canContainEols": {
					const right = extension[key];
					if (right) combined[key].push(...right);
					break;
				}
				case "transforms": {
					const right = extension[key];
					if (right) combined[key].push(...right);
					break;
				}
				case "enter":
				case "exit": {
					const right = extension[key];
					if (right) Object.assign(combined[key], right);
					break;
				}
			}
		}
		/** @type {OnEnterError} */
		function defaultOnError(left, right) {
			if (left) throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
				start: left.start,
				end: left.end
			}) + "): a different token (`" + right.type + "`, " + stringifyPosition({
				start: right.start,
				end: right.end
			}) + ") is open");
			else throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
				start: right.start,
				end: right.end
			}) + ") is still open");
		}
		//#endregion
		//#region src/reader.tsx
		const labels = {
			code: {
				copyLabel: "复制代码",
				copiedLabel: "已复制"
			},
			footnotes: "注释"
		};
		function withoutImages(text) {
			const ranges = [];
			const visit = (node) => {
				if (["image", "imageReference"].includes(node.type)) ranges.push({
					start: node.position.start.offset,
					end: node.position.end.offset
				});
				else node.children?.forEach(visit);
			};
			visit(fromMarkdown(text));
			for (const range of ranges.sort((a, b) => b.start - a.start)) text = text.slice(0, range.start) + "〔图片未加载〕" + text.slice(range.end);
			return text;
		}
		function ReadOnlyMarkdown({ text }) {
			const safe = (0, react.useMemo)(() => withoutImages(text), [text]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownDelegateProvider, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
				text: safe,
				labels
			}) });
		}
		function Transcript({ preview }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ecnu-transcript",
				"aria-label": "云端会话预览",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ecnu-history-start",
						children: [
							"来自 ChatECNU · ",
							preview.total,
							" 条消息"
						]
					}),
					preview.messages.map((message) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("article", {
						className: `ecnu-message ecnu-message-${message.role}`,
						"aria-label": message.role === "user" ? "你的消息" : "ChatECNU 的回答",
						children: message.role === "user" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.UserMessageBubble, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ecnu-user-text",
							children: message.text
						}) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ecnu-message-label",
							children: "ChatECNU"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReadOnlyMarkdown, { text: message.text })] })
					}, message.messageID)),
					!preview.messages.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ecnu-empty",
						children: "这段会话还没有消息"
					}),
					!preview.importable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ecnu-notice",
						children: "这段历史包含暂不支持导入的内容，可以先在这里阅读。"
					})
				]
			});
		}
		//#endregion
		//#region src/styles.ts
		const styles = `
.ecnu-project-status{display:inline-flex;align-items:center;justify-content:center;width:24px;flex:none;color:var(--ecnu-muted)}.ecnu-project-title>.ecnu-project-status{width:40px;height:40px}
.ecnu-conversation-row{display:flex;align-items:center;gap:2px}.ecnu-conversation-row>.ecnu-row{flex:1;min-width:0}.ecnu-conversation-row>.ecnu-row>svg{color:var(--ecnu-muted)}.ecnu-conversation-origin{width:28px;flex:none}.ecnu-cloud .ecnu-cloud-icon{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--ecnu-muted);cursor:pointer;height:28px;padding:0}.ecnu-cloud .ecnu-cloud-icon:hover{background:var(--ecnu-soft)}

.ecnu-draft{border:1px solid var(--ecnu-line);border-radius:16px;padding:12px 14px;background:var(--dsw-alias-bg-layer-1)}.ecnu-draft:focus-within{border-color:var(--ecnu-muted)}.ecnu-draft textarea{display:block;width:100%;resize:vertical;min-height:60px;max-height:180px;font:inherit;font-size:14px;line-height:1.6;color:inherit;border:0;outline:0;background:transparent;box-sizing:border-box}.ecnu-draft-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.ecnu-setup{font-size:13px;line-height:1.6;background:var(--ecnu-soft);padding:12px;border-radius:10px;margin-top:8px}.ecnu-setup p{margin:5px 0}.ecnu-draft .ecnu-workspace-pick{min-width:0;font-size:12px}.ecnu-draft .ecnu-caption{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ecnu-draft-actions>button{flex:none}
.ecnu-cloud .ecnu-continue-primary{color:var(--dsw-static-neutral-bluish-00,#fff)}
.ecnu-local-bindings{border-top:1px solid var(--ecnu-line);margin-top:28px;padding-top:20px}.ecnu-local-bindings summary{cursor:pointer;font-size:13px;color:var(--ecnu-muted)}.ecnu-local-bindings .ecnu-project-workspace-foot>span{min-width:0;overflow-wrap:anywhere}.ecnu-project-workspace{margin:24px 0 30px;padding:20px;border:1px solid var(--ecnu-line);border-radius:16px}.ecnu-project-workspace-main{display:flex;align-items:center;gap:14px}.ecnu-project-workspace-copy{flex:1;min-width:0}.ecnu-project-workspace-copy strong{font-weight:600;font-size:15px}.ecnu-project-workspace-copy p{margin:7px 0 0;color:var(--ecnu-muted);font-size:13px;line-height:1.6}.ecnu-project-workspace-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;color:var(--ecnu-muted);font-size:12px;line-height:1.6}.ecnu-project-workspace-foot button{flex-shrink:0}@media(max-width:640px){.ecnu-project-workspace-main{flex-wrap:wrap}.ecnu-project-workspace-copy{flex-basis:calc(100% - 60px)}.ecnu-project-workspace-main>button{width:100%}.ecnu-project-workspace-foot{align-items:flex-start;flex-direction:column}}
.ecnu-cloud{height:100%;min-width:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,inherit);font-size:14px;--ecnu-muted:var(--dsw-alias-label-secondary,#696662);--ecnu-line:var(--dsw-alias-border-l2,#e6e2df);--ecnu-soft:var(--dsw-alias-bg-layer-2,#f4f1ef);--ecnu-hover:var(--dsw-alias-bg-layer-3,#eeeae7)}
.ecnu-cloud *{box-sizing:border-box}.ecnu-row,.ecnu-tab{font:inherit;color:inherit}.ecnu-cloud button:focus-visible,.ecnu-cloud input:focus-visible{outline:2px solid currentColor;outline-offset:3px}.ecnu-cloud svg{flex-shrink:0}.ecnu-cloud h1,.ecnu-cloud h2,.ecnu-cloud p{margin-top:0}.ecnu-cloud h1:focus{outline:none}
.ecnu-topbar{min-height:62px;flex-shrink:0;display:flex;align-items:center;gap:12px;padding:12px 28px;padding-left:calc(24px + var(--dsh-frame-leading-clearance,0px));border-bottom:1px solid var(--ecnu-line)}
.ecnu-topbar h1{font-size:15px;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}.ecnu-topbar .ecnu-caption{flex-shrink:0}.ecnu-back svg{transform:rotate(180deg)}
.ecnu-scroll{overflow:auto;min-height:0;flex:1;scrollbar-gutter:stable}.ecnu-home{width:min(100%,920px);margin:auto;padding:42px 40px 48px}.ecnu-home-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:30px}.ecnu-home h1{font-size:28px;line-height:1.3;letter-spacing:-.5px;margin:0 0 8px}.ecnu-subtitle{color:var(--ecnu-muted);font-size:14px;line-height:1.6;margin:0}.ecnu-toolbar{display:flex;align-items:center;gap:20px;margin-bottom:30px}.ecnu-tabs{display:flex;gap:24px;border-bottom:1px solid var(--ecnu-line);flex:1}.ecnu-tab{background:none;border:0;border-bottom:2px solid transparent;padding:12px 0;cursor:pointer;color:var(--ecnu-muted)!important;white-space:nowrap}.ecnu-tab[aria-selected=true]{border-bottom-color:currentColor;color:inherit!important;font-weight:600}.ecnu-search{max-width:280px;flex:1}.ecnu-group-label{margin:24px 12px 8px;color:var(--ecnu-muted);font-size:12px;font-weight:500}.ecnu-list{list-style:none;padding:0;margin:0}.ecnu-list li{margin:3px 0}
.ecnu-row{display:flex;align-items:center;gap:14px;width:100%;text-align:left;border:0;background:transparent;border-radius:12px;padding:15px 12px;cursor:pointer;transition:background .15s}.ecnu-row:hover{background:var(--ecnu-soft)}.ecnu-row:disabled{cursor:wait;opacity:.55}.ecnu-row-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500}.ecnu-row-body{flex:1;min-width:0}.ecnu-row-meta{display:block;color:var(--ecnu-muted);font-size:12px;line-height:1.5;margin-top:4px}.ecnu-row-end{display:flex;align-items:center;gap:12px;color:var(--ecnu-muted);font-size:12px;flex-shrink:0}.ecnu-folder{display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:var(--ecnu-soft)}.ecnu-row:hover .ecnu-folder{background:var(--ecnu-hover)}.ecnu-caption{font-size:12px;color:var(--ecnu-muted)}
.ecnu-loadmore{display:flex;justify-content:center;padding:24px}.ecnu-empty{padding:72px 24px;text-align:center;color:var(--ecnu-muted);line-height:1.8}.ecnu-empty strong{display:block;color:inherit;font-weight:500;font-size:16px;margin-bottom:8px}.ecnu-notice{border-radius:10px;background:var(--ecnu-soft);padding:12px 16px;line-height:1.65;font-size:13px;margin:12px 0}.ecnu-error{padding:12px 24px;line-height:1.6;flex-shrink:0}.ecnu-error button{margin-left:12px}
.ecnu-transcript{max-width:800px;margin:auto;padding:24px 40px 50px}.ecnu-history-start{text-align:center;color:var(--ecnu-muted);font-size:12px;margin:4px 0 36px}.ecnu-message{margin:0 0 34px;line-height:1.75;overflow-wrap:anywhere}.ecnu-message-user{display:flex;justify-content:flex-end}.ecnu-message-user>div{max-width:85%}.ecnu-user-text{white-space:pre-wrap;line-height:1.7}.ecnu-message-label{font-size:12px;font-weight:600;color:var(--ecnu-muted);margin-bottom:14px}.ecnu-message pre{max-width:100%;overflow:auto}.ecnu-message table{max-width:100%}.ecnu-message p:last-child{margin-bottom:0}
.ecnu-continuation{flex-shrink:0;padding:14px 30px 20px;border-top:1px solid var(--ecnu-line);background:var(--dsw-alias-bg-base,transparent)}.ecnu-continuation-inner{max-width:720px;margin:auto}.ecnu-continue-line{display:flex;align-items:center;gap:12px}.ecnu-continue-copy{flex:1;min-width:0;line-height:1.6}.ecnu-continue-copy strong{font-size:14px;font-weight:500;display:block}.ecnu-workspace-pick{display:flex;align-items:center;gap:6px;margin-top:5px}.ecnu-continue-note{margin:10px 0 0;font-size:12px;color:var(--ecnu-muted);line-height:1.5}.ecnu-remember{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ecnu-muted);margin-top:10px}.ecnu-remember input{accent-color:currentColor}.ecnu-project-title{display:flex;align-items:center;gap:16px;margin-bottom:20px}.ecnu-project-title h1{font-size:25px;margin:0 0 6px}.ecnu-project-title .ecnu-folder{height:48px;width:48px}.ecnu-project-binding{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ecnu-muted);margin-bottom:24px}.ecnu-source-body{max-width:860px;margin:auto;padding:32px 40px}.ecnu-source-empty{padding:60px 24px;text-align:center;max-width:560px;margin:auto;line-height:1.8}.ecnu-source-empty h2{font-size:18px;font-weight:500}.ecnu-source-empty p{color:var(--ecnu-muted);font-size:14px}.ecnu-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ecnu-muted)}.ecnu-status:before{content:'';height:5px;width:5px;background:currentColor;border-radius:50%}
.ecnu-skeleton{padding:10px 12px}.ecnu-skeleton-line{height:14px;margin:14px 0;background:var(--ecnu-soft);border-radius:5px;width:70%;animation:ecnu-pulse 1.5s ease-in-out infinite}.ecnu-skeleton-line:nth-child(2n){width:43%;height:10px;margin-bottom:28px}@keyframes ecnu-pulse{50%{opacity:.4}}
@media(max-width:760px){.ecnu-home{padding:28px 22px}.ecnu-toolbar{align-items:stretch;flex-direction:column;gap:16px}.ecnu-search{max-width:none}.ecnu-topbar{padding:12px 18px}.ecnu-transcript{padding:24px 22px 35px}.ecnu-continuation{padding:14px 20px}.ecnu-row-end .ecnu-date{display:none}.ecnu-source-body{padding:24px}.ecnu-home h1{font-size:24px}}
@media(max-width:430px){.ecnu-home{padding:24px 16px}.ecnu-continue-line{align-items:stretch;flex-direction:column}.ecnu-topbar .ecnu-caption{display:none}.ecnu-continue-copy strong{display:none}.ecnu-workspace-pick{margin:0}.ecnu-row{gap:10px;padding:14px 8px}.ecnu-transcript{padding:20px 16px}.ecnu-message-user>div{max-width:94%}}
@media(prefers-reduced-motion:reduce){.ecnu-cloud *{animation:none!important;transition:none!important}}
`;
		//#endregion
		//#region src/navigation.tsx
		const empty = {
			lease: null,
			rows: [],
			projects: [],
			bindings: [],
			conversations: [],
			busy: false,
			error: "",
			projectError: "",
			route: null
		};
		function createCloudNavigation(api, watch, show) {
			let state = empty, generation = 0, pending, sequence = 0;
			const listeners = /* @__PURE__ */ new Set();
			const set = (patch) => {
				state = {
					...state,
					...patch
				};
				listeners.forEach((fn) => fn());
			};
			async function refresh() {
				if (pending) return pending;
				const g = generation;
				pending = (async () => {
					set({
						busy: true,
						error: ""
					});
					try {
						const identity = await api("cloudState");
						if (g !== generation) return;
						if (identity.state !== "available") {
							set({
								...empty,
								error: "请登录学校账号后查看云端内容。"
							});
							return;
						}
						if (identity.lease !== state.lease) set({
							...empty,
							busy: true,
							lease: identity.lease
						});
						const lease = identity.lease;
						const results = await Promise.allSettled([
							api("cloudList", {
								lease,
								page: 1
							}),
							api("cloudProjects", { lease }),
							api("cloudWorkspaceBindings", { lease })
						]);
						if (g !== generation || lease !== state.lease) return;
						const [chats, projects, local] = results.map((r) => r.status === "fulfilled" ? r.value : { state: "unavailable" });
						set({
							rows: chats.state === "available" ? chats.items : [],
							projects: projects.state === "available" ? projects.projects : [],
							bindings: local.state === "available" ? local.bindings : [],
							conversations: local.state === "available" ? local.conversations ?? [] : [],
							error: chats.state === "available" ? "" : "暂时无法读取云端会话，可重试。",
							projectError: projects.state === "available" ? "" : "暂时无法读取项目，可重试。"
						});
					} catch {
						if (g === generation) set({ error: "暂时无法读取云端内容，可重试。" });
					} finally {
						if (g === generation) {
							pending = void 0;
							set({ busy: false });
						}
					}
				})();
				return pending;
			}
			const stop = watch(async (reset) => {
				const g = generation;
				let identity;
				try {
					identity = reset ? null : await api("cloudState");
				} catch {
					identity = null;
				}
				if (g !== generation) return;
				if (!identity || identity.state !== "available" || identity.lease !== state.lease) {
					generation++;
					pending = void 0;
					set(empty);
					refresh();
				}
			});
			return {
				getSnapshot: () => state,
				subscribe: (fn) => {
					listeners.add(fn);
					return () => listeners.delete(fn);
				},
				refresh,
				go(kind, row, extra) {
					set({ route: {
						kind,
						row,
						...extra,
						seq: ++sequence,
						lease: state.lease
					} });
					show();
				},
				dispose() {
					generation++;
					stop();
					listeners.clear();
				}
			};
		}
		const useCloud = (store) => (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
		const collapseKey = "eduwork.ecnuCloud.sidebarExpanded.v1";
		function savedExpansion() {
			try {
				return localStorage.getItem(collapseKey) === "true";
			} catch {
				return false;
			}
		}
		function IconButton({ label, children, onClick, ...props }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				side: "right",
				delayMs: 350,
				portal: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ecnu-cloud-icon",
					"aria-label": label,
					onClick: (e) => {
						e.stopPropagation();
						onClick?.();
					},
					...props,
					children
				})
			});
		}
		const previewLimit = 3;
		function PreviewHeading({ title, hint, expanded, toggle, allLabel, openAll }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ecnu-nav-section-heading",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: "ecnu-nav-section",
					"aria-label": hint ? `${title}，${hint}` : title,
					"aria-expanded": expanded,
					onClick: toggle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 12 }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: title }),
						hint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ecnu-nav-preview-count",
							children: hint
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ecnu-nav-all",
					"aria-label": allLabel,
					onClick: openAll,
					children: allLabel
				})]
			});
		}
		function CloudSidebar({ children, wide, store, api, useWorkspaces, useSessions, usePanelInfo = (select) => select({ activePanelId: "ecnu-cloud" }) }) {
			const state = useCloud(store), [open, setOpen] = (0, react.useState)(savedExpansion), [sections, setSections] = (0, react.useState)({
				chats: true,
				projects: true
			});
			const [expanded, setExpanded] = (0, react.useState)({}), [details, setDetails] = (0, react.useState)({});
			const workspaces = useWorkspaces((s) => s.items), sessions = useSessions((s) => s.byId), archived = useWorkspaces((s) => s.archivedSessionIds);
			const panel = usePanelInfo((s) => s.activePanelId);
			const currentSession = panel === null ? Object.entries(sessions).find(([, row]) => (row.retainedBy?.mainView ?? 0) > 0)?.[0] : void 0;
			(0, react.useEffect)(() => {
				store.refresh();
			}, [store]);
			(0, react.useEffect)(() => {
				setDetails({});
				setExpanded({});
			}, [state.lease, state.projects]);
			function toggle() {
				setOpen((value) => {
					const next = !value;
					try {
						localStorage.setItem(collapseKey, String(next));
					} catch {}
					return next;
				});
			}
			async function expand(project) {
				const key = project.projectKey, lease = state.lease;
				setExpanded((old) => ({
					...old,
					[key]: !old[key]
				}));
				if (details[key] || expanded[key]) return;
				try {
					const result = await api("cloudProject", {
						lease,
						projectKey: key
					});
					if (store.getSnapshot().lease === lease) setDetails((old) => ({
						...old,
						[key]: result
					}));
				} catch {
					if (store.getSnapshot().lease === lease) setDetails((old) => ({
						...old,
						[key]: { state: "unavailable" }
					}));
				}
			}
			const entries = (project = null) => conversationEntries({
				cloudRows: project ? details[project.projectKey]?.conversations ?? [] : state.rows,
				bindings: state.conversations,
				workspaceBindings: state.bindings,
				workspaces,
				sessions,
				archived,
				project
			});
			const chatRow = (entry) => {
				const selected = panel === "ecnu-cloud" ? state.route?.kind === "conversation" && state.route.row.conversationID === entry.cloud?.conversationID : entry.sessionID === currentSession;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationRow, {
					entry,
					compact: true,
					selected,
					open: (row) => row.kind === "cloud" ? store.go("conversation", row.cloud) : store.go("local", row),
					original: (row) => store.go("conversation", row, { original: true })
				}, entry.key);
			};
			const recentChats = entries().slice(0, previewLimit);
			const previewProjects = state.projects.filter((row) => row.projectID).slice(0, previewLimit);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ecnu-workspace-flow",
				"data-sidebar-workspace-flow": wide ? "outer" : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: navigationStyles }),
					children,
					wide && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
						className: "ecnu-nav",
						"aria-label": "ChatECNU 会话与项目",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ecnu-nav-heading",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								className: "ecnu-nav-disclosure",
								"aria-label": "ChatECNU",
								"aria-expanded": open,
								"aria-controls": "ecnu-cloud-sidebar-content",
								onClick: toggle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ecnu-nav-leading",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, {
										size: 16,
										className: "ecnu-nav-globe"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
										size: 13,
										className: "ecnu-nav-chevron"
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "ecnu-nav-label",
									children: "ChatECNU"
								})]
							}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
								label: "刷新侧栏云端内容",
								disabled: state.busy,
								onClick: () => void store.refresh(),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
							})]
						}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							id: "ecnu-cloud-sidebar-content",
							className: "ecnu-nav-content",
							children: [
								state.busy && !state.lease && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "ecnu-nav-note",
									role: "status",
									children: "正在读取…"
								}),
								state.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "ecnu-nav-note",
									role: "status",
									children: state.error
								}),
								state.lease && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewHeading, {
										title: "会话",
										hint: recentChats.length ? `最近 ${recentChats.length} 条` : "",
										expanded: sections.chats,
										toggle: () => setSections((v) => ({
											...v,
											chats: !v.chats
										})),
										allLabel: "查看全部会话",
										openAll: () => store.go("home")
									}),
									sections.chats && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ecnu-nav-section-body",
										children: recentChats.map(chatRow)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewHeading, {
										title: "项目",
										hint: previewProjects.length ? `预览 ${previewProjects.length} 项` : "",
										expanded: sections.projects,
										toggle: () => setSections((v) => ({
											...v,
											projects: !v.projects
										})),
										allLabel: "查看全部项目",
										openAll: () => store.go("home", void 0, { tab: "projects" })
									}),
									sections.projects && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ecnu-nav-section-body",
										children: [state.projectError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ecnu-nav-note",
											children: state.projectError
										}), previewProjects.map((project) => {
											const status = projectStatus(project, state.bindings, workspaces);
											const projectChats = entries(project), shownChats = projectChats.slice(0, previewLimit);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ecnu-nav-project",
												"data-project-status": status.kind,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "ecnu-nav-project-head",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: "ecnu-cloud-icon",
														"aria-label": `展开项目 ${project.title}`,
														"aria-expanded": !!expanded[project.projectKey],
														onClick: () => void expand(project),
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 13 })
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
														label: status.label,
														side: "right",
														delayMs: 350,
														portal: true,
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
															className: "ecnu-nav-row",
															"aria-label": project.title,
															"aria-current": panel === "ecnu-cloud" && state.route?.kind === "project" && state.route.row.projectKey === project.projectKey ? "page" : void 0,
															onClick: () => store.go("project", project),
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "ecnu-nav-label",
																children: project.title
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectStatusIcon, {
																status,
																size: 14
															})]
														})
													})]
												}), expanded[project.projectKey] && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "ecnu-nav-project-chats",
													children: [
														!details[project.projectKey] ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: "ecnu-nav-note",
															children: "正在读取…"
														}) : details[project.projectKey].state !== "available" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
															className: "ecnu-nav-note",
															children: "读取失败，请打开项目重试。"
														}) : null,
														details[project.projectKey]?.state === "available" && shownChats.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "ecnu-nav-preview-note",
															children: projectChats.length > previewLimit ? `最近 ${shownChats.length} 条会话` : `${shownChats.length} 条会话`
														}),
														shownChats.map(chatRow),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "ecnu-nav-more",
															"aria-label": `查看 ${project.title} 的全部会话与资料`,
															onClick: () => store.go("project", project),
															children: "查看全部会话与资料"
														})
													]
												})]
											}, project.projectKey);
										})]
									})
								] })
							]
						})]
					})
				]
			});
		}
		function CloudWorkspaceLink({ workspaceID, store }) {
			const state = useCloud(store), binding = state.bindings.find((b) => b.workspaceID === workspaceID);
			if (!binding) return null;
			const project = state.projects.find((p) => p.projectKey === binding.projectKey);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
				label: `已关联 ChatECNU 项目「${binding.title}」，查看云端会话和资料`,
				onClick: () => store.go(project ? "project" : "home", project, { tab: "projects" }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, { size: 14 })
			});
		}
		function CloudSessionOrigin({ sessionId, store, useSessions }) {
			const state = useCloud(store), sessions = useSessions((s) => s.byId), binding = state.conversations.find((b) => b.sessionID === sessionId);
			if (!binding) return null;
			const row = {
				conversationID: binding.conversationID,
				title: sessions[sessionId]?.title || "ChatECNU 会话",
				projectID: binding.projectID
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
				label: "来自 ChatECNU，查看云端原会话",
				onClick: () => store.go("conversation", row, { original: true }),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { size: 14 })
			});
		}
		function ProjectContext({ sessionId, useWorkspaces, store }) {
			const state = useCloud(store);
			const workspace = useWorkspaces((s) => s.items).find((w) => w.sessionIds.includes(sessionId)), binding = state.bindings.find((b) => b.workspaceID === workspace?.workspaceId);
			if (!binding) return null;
			const project = state.projects.find((p) => p.projectKey === binding.projectKey);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: "此工作区可检索关联的 ChatECNU 项目资料，点击查看",
				side: "bottom",
				delayMs: 350,
				portal: true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					className: "ecnu-project-context",
					onClick: () => store.go(project ? "project" : "home", project, { tab: "projects" }),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, { size: 14 }), binding.title]
				})
			});
		}
		const navigationStyles = `
.ecnu-workspace-flow{display:contents}
.ecnu-nav{padding:6px 0 10px;font-size:inherit;flex:none;color:var(--dsw-alias-label-primary)}
.ecnu-nav-heading{display:flex;align-items:center;gap:4px}.ecnu-nav-disclosure{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,6px);flex:1;min-width:0;box-sizing:border-box;height:32px;border:0;border-inline:var(--dsh-sidebar-paint-inset,3px) solid transparent;background:none;background-clip:padding-box;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;padding:0 8px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) - var(--dsh-sidebar-paint-inset,3px));border-radius:var(--dsw-radius-md,8px);cursor:pointer}
.ecnu-nav-leading{display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;flex:none}.ecnu-nav-chevron{display:none}.ecnu-nav-disclosure[aria-expanded="true"] .ecnu-nav-chevron{transform:rotate(90deg)}.ecnu-nav-disclosure:focus-visible .ecnu-nav-globe{display:none}.ecnu-nav-disclosure:focus-visible .ecnu-nav-chevron{display:block}@media(hover:hover){.ecnu-nav-disclosure:hover .ecnu-nav-globe{display:none}.ecnu-nav-disclosure:hover .ecnu-nav-chevron{display:block}}
.ecnu-nav-content{padding:2px 0 4px}.ecnu-nav-section-heading{display:flex;align-items:center;gap:2px}.ecnu-nav-section-heading>.ecnu-nav-section{flex:1;min-width:0}.ecnu-nav-section{display:flex;align-items:center;gap:5px;background:none;border:0;color:var(--dsw-alias-label-secondary);text-align:left;font-size:12px;padding:7px 8px;cursor:pointer;white-space:nowrap}.ecnu-nav-section-body{padding-left:7px}.ecnu-nav-preview-count{font-size:12px;margin-left:3px}.ecnu-nav-all{flex:none;min-height:28px;padding:4px 6px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;white-space:nowrap;cursor:pointer}.ecnu-nav-all:hover{background:var(--dsw-alias-interactive-bg-hover,#8881);text-decoration:underline;text-underline-offset:3px}.ecnu-nav-preview-note{padding:5px 8px 2px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.ecnu-nav button[aria-expanded="true"]>svg:first-child{transform:rotate(90deg)}.ecnu-nav-row{display:flex;width:100%;align-items:center;gap:7px;border:0;background:transparent;color:inherit;padding:7px 8px;text-align:left;border-radius:7px;cursor:pointer;min-width:0;font:inherit}
.ecnu-nav-row[aria-current="page"],.ecnu-nav-row:hover,.ecnu-nav-more:hover,.ecnu-nav-disclosure:hover,.ecnu-cloud-icon:hover{background:var(--dsw-alias-interactive-bg-hover,#8881)}.ecnu-nav-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.ecnu-nav-more{border:0;background:none;color:var(--dsw-alias-label-secondary);font-size:12px;padding:7px 8px;cursor:pointer;border-radius:6px}
.ecnu-nav-note{font-size:12px;color:var(--dsw-alias-label-secondary);padding:0 8px;line-height:1.6}.ecnu-nav-project-head{display:flex;align-items:center}.ecnu-cloud-icon{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;width:26px;height:28px;flex:none;padding:0}.ecnu-cloud-icon:disabled{opacity:.45;cursor:default}.ecnu-nav-project-chats{margin-left:16px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-l2,#8883)}
.ecnu-nav-chat{display:flex;align-items:center}.ecnu-nav-chat>.ecnu-nav-row{flex:1}.ecnu-nav-project-head>.ecnu-nav-row{flex:1}
.ecnu-nav button:focus-visible,.ecnu-cloud-icon:focus-visible,.ecnu-project-context:focus-visible{outline:2px solid currentColor;outline-offset:1px}.ecnu-project-context{display:inline-flex;align-items:center;gap:5px;font-size:12px;background:transparent;border:1px solid var(--dsw-alias-border-l2,#8883);border-radius:7px;color:inherit;padding:4px 8px;cursor:pointer}
`;
		//#endregion
		//#region src/client.tsx
		const errors = {
			not_connected: "请先在左下角登录学校账号。",
			sign_in_required: "请先在左下角登录学校账号。",
			identity_unavailable: "当前登录组件尚不支持云端会话，请更新组件。",
			permission_denied: "当前学校账号暂时无法读取这项内容。",
			account_changed: "登录状态已变化，请刷新后重试。",
			not_configured: "云端服务尚未配置。",
			rate_limited: "请求较多，请稍后重试。",
			too_large: "内容超过当前可读取的范围。",
			history_changed: "云端内容已更新，请重新打开。",
			timeout: "读取超时，请稍后重试。",
			cancelled: "读取已取消，可以重新打开。"
		};
		const errorText = (state) => errors[state] ?? "暂时无法读取，请稍后重试。";
		function group(at) {
			const now = /* @__PURE__ */ new Date();
			now.setHours(0, 0, 0, 0);
			const days = Math.floor((now.getTime() - at) / 864e5);
			return days < 0 ? "今天" : days < 1 ? "昨天" : days < 7 ? "近 7 天" : "更早";
		}
		function Loading() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				role: "status",
				"aria-label": "正在读取",
				className: "ecnu-skeleton",
				children: Array.from({ length: 6 }, (_, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "ecnu-skeleton-line" }, i))
			});
		}
		function Tabs({ value, onChange, items, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ecnu-tabs",
				role: "tablist",
				"aria-label": label,
				children: items.map(([id, name], index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					className: "ecnu-tab",
					role: "tab",
					"aria-selected": value === id,
					tabIndex: value === id ? 0 : -1,
					id: `ecnu-tab-${label}-${id}`,
					"aria-controls": `ecnu-panel-${label}`,
					onClick: () => onChange(id),
					onKeyDown: (e) => {
						const next = e.key === "ArrowRight" ? (index + 1) % items.length : e.key === "ArrowLeft" ? (index + items.length - 1) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
						if (next >= 0) {
							e.preventDefault();
							onChange(items[next][0]);
							(e.currentTarget.parentElement?.children[next])?.focus();
						}
					},
					children: name
				}, id))
			});
		}
		function ConversationList({ rows, open, original, grouped = false }) {
			let last = "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
				className: "ecnu-list",
				"aria-label": "会话列表",
				children: rows.map((entry) => {
					const label = grouped ? group(entry.updatedAt) : "", show = label !== last;
					last = label;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [show && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ecnu-group-label",
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationRow, {
						entry,
						open,
						original
					})] }, entry.key);
				})
			});
		}
		function CloudPage({ api, watch, openSession, openWorkspace, sendSession, createSession, changed, useNavigation = () => null, useCloudState = () => null, renderFactorySlot, useWorkspaces, useSessions }) {
			const route = useNavigation(), routed = (0, react.useRef)(0);
			const cloudState = useCloudState();
			const archivedSessions = useWorkspaces((s) => s.archivedSessionIds);
			const localWorkspaces = useWorkspaces((s) => s.items), localSessions = useSessions ? useSessions((s) => s.byId) : {};
			const [list, setList] = (0, react.useState)(null), [preview, setPreview] = (0, react.useState)(null), [projectList, setProjectList] = (0, react.useState)(null);
			const [detail, setDetail] = (0, react.useState)(null), [source, setSource] = (0, react.useState)(null), [view, setView] = (0, react.useState)({ kind: "home" });
			const [busy, setBusy] = (0, react.useState)(false), [reading, setReading] = (0, react.useState)(false), [projectsBusy, setProjectsBusy] = (0, react.useState)(false);
			const [tab, setTab] = (0, react.useState)("recent"), [projectTab, setProjectTab] = (0, react.useState)("conversations"), [query, setQuery] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)(""), [projectError, setProjectError] = (0, react.useState)("");
			const generation = (0, react.useRef)(0), selection = (0, react.useRef)(0), projectGeneration = (0, react.useRef)(0), lease = (0, react.useRef)(null), heading = (0, react.useRef)(null);
			const projectRequest = (0, react.useRef)(null), detailRequest = (0, react.useRef)(null);
			const cancelReads = () => {
				projectRequest.current?.abort();
				detailRequest.current?.abort();
			};
			const projects = projectList?.projects ?? [];
			const clear = () => {
				cancelReads();
				++generation.current;
				++selection.current;
				++projectGeneration.current;
				lease.current = null;
				setList(null);
				setPreview(null);
				setDetail(null);
				setSource(null);
				setProjectList(null);
				setView({ kind: "home" });
				setQuery("");
				setError("");
				setProjectError("");
				setBusy(false);
				setReading(false);
				setProjectsBusy(false);
			};
			async function loadProjects(currentLease, g) {
				projectRequest.current?.abort();
				const controller = new AbortController();
				projectRequest.current = controller;
				const pg = ++projectGeneration.current;
				setProjectsBusy(true);
				setProjectError("");
				try {
					const value = await api("cloudProjects", { lease: currentLease }, controller.signal);
					if (g !== generation.current || pg !== projectGeneration.current) return;
					if (value.state !== "available") {
						setProjectError(errorText(value.state));
						return;
					}
					setProjectList(value);
				} catch {
					if (g === generation.current && pg === projectGeneration.current) setProjectError(errorText("unavailable"));
				} finally {
					if (g === generation.current && pg === projectGeneration.current) setProjectsBusy(false);
				}
			}
			async function load(page = 1) {
				const g = page === 1 ? ++generation.current : generation.current;
				if (page === 1) {
					cancelReads();
					++projectGeneration.current;
					++selection.current;
					setView({ kind: "home" });
					setPreview(null);
					setDetail(null);
					setSource(null);
					setReading(false);
					setProjectsBusy(false);
				}
				setBusy(true);
				setError("");
				try {
					const state = await api("cloudState");
					if (g !== generation.current) return;
					if (state.state !== "available") {
						clear();
						setError(errorText(state.state));
						return;
					}
					if (lease.current !== state.lease) {
						setList(null);
						setProjectList(null);
					}
					lease.current = state.lease;
					if (page === 1) loadProjects(state.lease, g);
					const value = await api("cloudList", {
						lease: state.lease,
						page
					});
					if (g !== generation.current) return;
					if (value.state !== "available") {
						setError(errorText(value.state));
						return;
					}
					setList((old) => ({
						...value,
						items: page === 1 ? value.items : [...new Map([...old?.items ?? [], ...value.items].map((r) => [r.conversationID, r])).values()]
					}));
				} catch {
					if (g === generation.current) setError(errorText("unavailable"));
				} finally {
					if (g === generation.current) setBusy(false);
				}
			}
			async function select(row, original = false) {
				detailRequest.current?.abort();
				const project = row.projectID && projects.find((p) => p.projectID === row.projectID);
				const s = ++selection.current, g = generation.current;
				setView({
					kind: "conversation",
					row,
					parent: project ? {
						kind: "project",
						row: project
					} : { kind: "home" }
				});
				setPreview(null);
				setReading(true);
				setError("");
				try {
					const input = {
						lease: lease.current,
						conversationID: row.conversationID
					}, destination = await api("cloudDestination", input);
					if (s !== selection.current || g !== generation.current) return;
					if (!original && destination?.state === "available" && destination.bindingState === "available") {
						await openSession(destination.sessionID, () => s === selection.current && g === generation.current);
						return;
					}
					const value = await api("cloudPreview", input);
					if (s !== selection.current || g !== generation.current) return;
					if (value.state !== "available") {
						setError(errorText(value.state));
						return;
					}
					setPreview(value);
				} catch {
					if (s === selection.current && g === generation.current) setError(errorText("unavailable"));
				} finally {
					if (s === selection.current && g === generation.current) setReading(false);
				}
			}
			async function selectProject(row) {
				detailRequest.current?.abort();
				const controller = new AbortController();
				detailRequest.current = controller;
				const s = ++selection.current, g = generation.current;
				setView({
					kind: "project",
					row
				});
				setDetail(null);
				setProjectTab("conversations");
				setReading(true);
				setError("");
				try {
					const value = await api("cloudProject", {
						lease: lease.current,
						projectKey: row.projectKey
					}, controller.signal);
					if (s !== selection.current || g !== generation.current) return;
					if (value.state !== "available") {
						setError(errorText(value.state));
						return;
					}
					setDetail(value);
				} catch {
					if (s === selection.current && g === generation.current) setError(errorText("unavailable"));
				} finally {
					if (s === selection.current && g === generation.current) setReading(false);
				}
			}
			async function selectSource(row) {
				detailRequest.current?.abort();
				const controller = new AbortController();
				detailRequest.current = controller;
				const s = ++selection.current, g = generation.current, parent = view;
				setView({
					kind: "source",
					row,
					parent
				});
				setSource(null);
				setReading(true);
				setError("");
				try {
					const value = await api("cloudSource", {
						lease: lease.current,
						projectKey: parent.row.projectKey,
						sourceID: row.sourceID
					}, controller.signal);
					if (s !== selection.current || g !== generation.current) return;
					if (value.state !== "available") {
						setError(errorText(value.state));
						return;
					}
					setSource(value);
				} catch {
					if (s === selection.current && g === generation.current) setError(errorText("unavailable"));
				} finally {
					if (s === selection.current && g === generation.current) setReading(false);
				}
			}
			function back() {
				detailRequest.current?.abort();
				++selection.current;
				setPreview(null);
				setSource(null);
				setReading(false);
				setError("");
				if (view.parent?.kind === "project") selectProject(view.parent.row);
				else setView({ kind: "home" });
			}
			(0, react.useEffect)(() => {
				let active = true, checks = 0;
				load();
				const stop = watch(async (reset) => {
					const check = ++checks;
					if (reset) {
						clear();
						load();
						return;
					}
					try {
						const state = await api("cloudState");
						if (!active || check !== checks) return;
						if (state.state !== "available" || state.lease !== lease.current) {
							clear();
							load();
						}
					} catch {
						if (active && check === checks) {
							clear();
							setError(errorText("unavailable"));
						}
					}
				});
				return () => {
					active = false;
					cancelReads();
					++generation.current;
					++selection.current;
					++projectGeneration.current;
					stop();
				};
			}, [api, watch]);
			(0, react.useEffect)(() => {
				heading.current?.focus({ preventScroll: true });
			}, [
				view.kind,
				view.row?.conversationID,
				view.row?.projectKey,
				view.row?.sourceID
			]);
			(0, react.useEffect)(() => {
				if (!route || !lease.current || route.seq === routed.current || route.lease !== lease.current) return;
				routed.current = route.seq;
				if (route.kind === "conversation") select(route.row, route.original);
				else if (route.kind === "project") selectProject(route.row);
				else if (route.kind === "local") openEntry(route.row);
				else {
					setView({ kind: "home" });
					setTab(route.tab ?? "recent");
					setQuery("");
				}
			}, [
				route,
				list,
				busy
			]);
			const matches = (value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
			const navigation = cloudState?.lease === lease.current ? cloudState : null;
			const entries = (cloudRows, project = null, workspaceID) => conversationEntries({
				cloudRows,
				bindings: navigation?.conversations,
				workspaceBindings: navigation?.bindings,
				workspaces: localWorkspaces,
				sessions: localSessions,
				archived: archivedSessions,
				project,
				workspaceID
			});
			const rows = lease.current ? entries(list?.items ?? []).filter((row) => matches(row.title)) : [];
			const projectRows = view.kind === "project" ? entries(detail?.conversations ?? [], view.row, detail?.workspaceID) : [];
			async function openEntry(entry) {
				if (entry.kind === "cloud") {
					await select(entry.cloud);
					return;
				}
				const g = generation.current, s = ++selection.current;
				const workspace = localWorkspaces.find((w) => w.workspaceId === entry.workspaceID);
				if (entry.kind === "continued" && !navigation?.conversations.some((row) => row.conversationID === entry.cloud.conversationID && row.sessionID === entry.sessionID && row.workspaceID === entry.workspaceID)) {
					setError("会话关联已变化，请刷新列表。");
					return;
				}
				if (!workspace?.sessionIds.includes(entry.sessionID) || archivedSessions.includes(entry.sessionID) || !localSessions[entry.sessionID] || localSessions[entry.sessionID].blank) {
					setError("这条本地会话已移动或归档，请刷新列表。");
					return;
				}
				try {
					await openSession(entry.sessionID, () => g === generation.current && s === selection.current);
				} catch {
					if (g === generation.current && s === selection.current) setError("暂时无法打开本地会话，请稍后重试。");
				}
			}
			const listProps = {
				open: openEntry,
				original: (row) => void select(row, true)
			};
			const filteredProjects = projects.filter((row) => matches(row.title));
			const statusFor = (row) => projectStatus(row, navigation?.bindings, localWorkspaces);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "ecnu-cloud",
				"aria-label": "ChatECNU 云端",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: styles }),
					view.kind !== "home" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "ecnu-topbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								className: "ecnu-back",
								"aria-label": view.parent?.kind === "project" ? "返回项目" : "返回云端列表",
								onClick: back,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 18 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
								ref: heading,
								tabIndex: -1,
								children: view.row.title
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: "正在预览 ChatECNU 云端内容；首次发送时在本地接续",
								side: "bottom",
								delayMs: 350,
								portal: true,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ecnu-caption",
									tabIndex: 0,
									"aria-label": "ChatECNU 云端预览",
									style: {
										display: "inline-flex",
										alignItems: "center",
										gap: 5
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { size: 14 }), "ChatECNU"]
								})
							})
						]
					}),
					error && (view.kind !== "home" || tab === "recent" || !lease.current) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						role: "alert",
						className: "ecnu-error",
						children: [error, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => void load(),
							children: "重新读取"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ecnu-scroll",
						children: [
							view.kind === "home" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ecnu-home",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ecnu-home-heading",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", {
											ref: heading,
											tabIndex: -1,
											children: tab === "recent" ? "会话" : "项目"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ecnu-subtitle",
											children: tab === "recent" ? "ChatECNU 与本地工作区的会话。" : "查看 ChatECNU 项目、资料和关联工作区。"
										})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "ghost",
											size: "sm",
											"aria-label": "刷新云端内容",
											disabled: busy || projectsBusy,
											onClick: () => void load(),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 17 })
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ecnu-toolbar",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
											className: "ecnu-search",
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 16 }),
											"aria-label": tab === "recent" ? "筛选已加载的会话" : "搜索项目",
											placeholder: tab === "recent" ? "查找会话" : "查找项目",
											value: query,
											onChange: (e) => setQuery(e.target.value)
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										role: "region",
										"aria-label": tab === "recent" ? "全部会话" : "全部项目",
										children: tab === "recent" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											busy && !list ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationList, {
												rows,
												...listProps,
												grouped: true
											}),
											!busy && !rows.length && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ecnu-empty",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: query ? "没有匹配的会话" : "还没有会话" }), query ? "试试其他标题关键词。" : "ChatECNU 普通会话和默认工作区的本地会话会出现在这里。"]
											}),
											query && list?.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "ecnu-caption",
												children: "正在筛选已加载的会话，可继续加载更早记录。"
											}),
											list?.hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "ecnu-loadmore",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
													variant: "ghost",
													disabled: busy,
													onClick: () => void load(list.page + 1),
													children: busy ? "正在读取…" : "加载更早的会话"
												})
											})
										] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [projectsBusy && !projectList ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											projectError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												role: "alert",
												className: "ecnu-notice",
												children: projectError
											}),
											projectList?.incomplete && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "ecnu-notice",
												children: "部分项目会话的关联暂未读取完整，可刷新后重试。资料仍按当前账号权限读取。"
											}),
											[true, false].map((linked) => {
												const items = filteredProjects.filter((p) => !!p.projectID === linked);
												return items.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "ecnu-group-label",
													children: linked ? "项目" : "其他资料库"
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
													className: "ecnu-list",
													children: items.map((row) => {
														const status = statusFor(row);
														return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
															label: status.label,
															side: "top",
															delayMs: 350,
															portal: true,
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
																className: "ecnu-row",
																"data-project-status": status.kind,
																"aria-label": row.title,
																onClick: () => void selectProject(row),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "ecnu-project-status",
																		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectStatusIcon, {
																			status,
																			size: 20
																		})
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: "ecnu-row-body",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "ecnu-row-title",
																			children: row.title
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			className: "ecnu-row-meta",
																			children: [row.projectID ? "云端知识库" : "查看云端资料", row.shared ? " · 已共享" : ""]
																		})]
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "ecnu-row-end",
																		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 15 })
																	})
																]
															})
														}) }, row.projectKey);
													})
												})] }, String(linked)) : null;
											}),
											!projectError && !filteredProjects.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "ecnu-empty",
												children: query ? "没有匹配的项目" : "还没有可读取的项目"
											})
										] }), lease.current && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceBindings, {
											lease: lease.current,
											api,
											useWorkspaces,
											changed
										}, lease.current + ":" + generation.current)] })
									})
								]
							}),
							view.kind === "conversation" && (reading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ecnu-transcript",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {})
							}) : preview && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Transcript, { preview })),
							view.kind === "project" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ecnu-home",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ecnu-project-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: statusFor(view.row).label,
											side: "top",
											delayMs: 350,
											portal: true,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ecnu-project-status",
												"data-project-status": statusFor(view.row).kind,
												tabIndex: 0,
												"aria-label": statusFor(view.row).label,
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectStatusIcon, {
													status: statusFor(view.row),
													size: 24
												})
											})
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h1", { children: view.row.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ecnu-subtitle",
											children: view.row.description || "以云端知识库为基础，在本地工作区开展工作。"
										})] })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ecnu-project-binding",
										children: detail?.workspaceID ? `已关联本地工作区 · 云端资料可检索` : "当前为云端预览。首次发送时设置本地项目工作区。"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tabs, {
										value: projectTab,
										onChange: setProjectTab,
										items: [["conversations", "会话"], ["sources", `云端资料${detail ? " " + detail.sources.length : ""}`]],
										label: "项目内容"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										role: "tabpanel",
										id: "ecnu-panel-项目内容",
										"aria-labelledby": `ecnu-tab-项目内容-${projectTab}`,
										children: reading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {}) : detail && (projectTab === "conversations" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConversationList, {
											rows: projectRows,
											...listProps
										}), !projectRows.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ecnu-empty",
											children: view.row.projectID ? "这个项目还没有会话，可以在下面开始。" : "暂未发现关联的项目会话，仍可查看资料。"
										})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
											className: "ecnu-list",
											children: detail.sources.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												className: "ecnu-row",
												onClick: () => void selectSource(row),
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "ecnu-folder",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
															path: row.title,
															size: 23
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "ecnu-row-body",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "ecnu-row-title",
															children: row.title
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "ecnu-row-meta",
															children: row.type === "file" ? "文件" : row.type || "资料"
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "ecnu-row-end",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "ecnu-status",
															children: row.status === "ready" ? "已就绪" : row.status === "processing" ? "处理中" : row.status
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 15 })]
													})
												]
											}) }, row.sourceID))
										}), !detail.sources.length && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ecnu-empty",
											children: "这个项目还没有资料"
										})] }))
									})
								]
							}),
							view.kind === "source" && (reading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ecnu-source-body",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, {})
							}) : source && (source.empty ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ecnu-source-empty",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "暂时无法读取正文" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "云端已收录这份资料，但目前没有返回可阅读的正文。你可以稍后重试，或返回项目查看其他资料。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										onClick: back,
										children: "返回项目资料"
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ecnu-source-body",
								children: [source.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "ecnu-notice",
									children: "内容较长，当前展示前 200,000 字符。"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReadOnlyMarkdown, { text: source.text })]
							})))
						]
					}, view.kind + (view.row?.conversationID ?? view.row?.sourceID ?? view.row?.projectKey ?? "")),
					view.kind === "conversation" && preview && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Continuation, {
						project: projects.find((p) => p.projectID === preview.summary.projectID && p.projectID),
						preview,
						api,
						openSession,
						sendSession,
						createSession,
						changed,
						renderFactorySlot,
						useWorkspaces
					}, preview.lease + ":" + preview.summary.conversationID + ":" + preview.snapshot),
					view.kind === "project" && detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Continuation, {
						project: view.row,
						preview: {
							lease: lease.current,
							summary: { projectID: view.row.projectID },
							importable: true
						},
						api,
						sendSession,
						createSession,
						changed,
						renderFactorySlot,
						useWorkspaces
					}, lease.current + ":" + view.row.projectKey)
				]
			});
		}
		const inject = [
			"slots",
			"remote",
			"layout",
			"sessions",
			"uiWorkspace",
			"conversation"
		];
		async function apply(ctx) {
			const unmount = await ctx.remote.$mount(typert_remote_client_default);
			const ui = ctx.inject(["remote.ecnuCloud"], (inner) => {
				const api = async (method, input, signal) => {
					const result = await inner.remote.ecnuCloud[method](...input ? [input] : [], ...signal ? [signal] : []);
					if (!result.ok) throw Error("Cloud request failed");
					return result.value;
				};
				const watch = (callback) => {
					const off = inner.remote.$on("credentials/reference-updated", () => callback(false)), reset = inner.on("connection/reset", () => callback(true));
					return () => {
						off();
						reset();
					};
				};
				const openSession = async (sessionID, current) => {
					await inner.sessions.refresh();
					if (current()) inner.uiWorkspace.openSession(sessionID);
				};
				const openWorkspace = async (workspaceID, current) => {
					if (current()) await inner.uiWorkspace.openWorkspace(workspaceID, () => {
						if (!current()) throw Error("Workspace selection expired");
					});
				};
				const store = createCloudNavigation(api, watch, () => inner.layout.selectPanel("ecnu-cloud"));
				inner.effect(() => () => store.dispose());
				const createSession = async (workspaceID, current) => {
					if (!current()) throw Error("Expired");
					return inner.uiWorkspace.connectWorkspace(workspaceID);
				};
				const sendSession = async (sessionID, prompt, current, lease) => {
					await inner.sessions.refresh();
					await inner.sessions.using(sessionID, { source: "workspaceOperation" }, async (ref) => {
						const identity = await api("cloudState");
						if (!current() || identity.state !== "available" || identity.lease !== lease) throw Error("Expired");
						if (inner.conversation.input.requestDraftInitialization(ref.binding, {
							prompt,
							whenDraftExists: "keep"
						}) !== "applied") throw Error("Draft already exists");
						const input = inner.conversation.input.for(ref.binding.ctx);
						inner.uiWorkspace.openSession(sessionID);
						input.submit("queue", "click");
					});
					store.refresh();
				};
				const common = () => ({
					api,
					watch,
					openSession,
					openWorkspace,
					sendSession,
					createSession,
					changed: () => void store.refresh(),
					useNavigation: () => useCloud(store).route,
					useCloudState: () => useCloud(store),
					store
				});
				inner.slots.inject("main", () => inner.slots.register({
					name: "main",
					key: "ecnu-cloud",
					inject: common
				}, CloudPage));
				inner.slots.inject("sidebar.workspaces.content", () => inner.slots.register({
					name: "sidebar.workspaces.content",
					id: "ecnu-cloud",
					inject: common
				}, CloudSidebar));
				inner.slots.inject("sidebar.workspaces.group.actions", () => inner.slots.register({
					name: "sidebar.workspaces.group.actions",
					id: "ecnu-cloud",
					inject: () => ({ store })
				}, CloudWorkspaceLink));
				inner.slots.inject("sidebar.session.row.trailing", () => inner.slots.register({
					name: "sidebar.session.row.trailing",
					id: "ecnu-cloud",
					inject: () => ({ store })
				}, CloudSessionOrigin));
				inner.slots.inject("conversation.session.header.actions", () => inner.slots.register({
					name: "conversation.session.header.actions",
					id: "ecnu-cloud-project",
					order: 50,
					inject: () => ({ store })
				}, ProjectContext));
			});
			return async () => {
				await ui.dispose();
				await unmount();
			};
		}
		//#endregion
		exports.CloudPage = CloudPage;
		exports.apply = apply;
		exports.errorText = errorText;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map