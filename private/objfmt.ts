// deno-lint-ignore no-explicit-any
type Any = any;

export const DEFAULT_PREFER_LINE_WIDTH_LIMIT = 160;
const DEFAULT_INDENT_WIDTH = 4;
const TAB_WIDTH = 4;
const RE_SUBST_CHARS_IN_STRING_QT = /[\\\r\n\t"]|\p{C}/gu;
const RE_SUBST_CHARS_IN_STRING_APOS = /[\\\r\n\t']|\p{C}/gu;
const RE_SUBST_CHARS_IN_STRING_BACKTICK = /[\\\r\n\t`]|\p{C}|\$\{/gu;
const RE_KEY = /^(?:\p{L}|_)(?:\p{L}|_|\d)*$/u;
const RE_ENDL = /[\r\n]+(?=[^\r\n])/g;
const PADDER = '                ';
const C_TAB = '\t'.charCodeAt(0);
const C_CR = '\r'.charCodeAt(0);
const C_LF = '\n'.charCodeAt(0);
const C_BACKSLASH = '\\'.charCodeAt(0);
const C_QUOT = '"'.charCodeAt(0);
const C_APOS = "'".charCodeAt(0);
const C_BACKTICK = '`'.charCodeAt(0);
const C_DOLLAR = '$'.charCodeAt(0);
const C_BRACE_OPEN = '{'.charCodeAt(0);

/**	Convert JavaScript value (object, array or other) to human-readable string similar to JSON with indentation.
	Includes class names together with object literals, and converts `Date` objects to string representation.
 **/
export function objfmt(value: unknown, options?: Options, indentAll: number|string='', copyKeysOrderFrom?: unknown)
{	if (typeof(indentAll) == 'number')
	{	indentAll = indentAll>=0 && indentAll<=10 ? ' '.repeat(indentAll) : '\t';
	}
	const serializer = new Serializer(options);
	const curIndentWidth = indentToWidth(indentAll);
	const addIndentWidth = indentToWidth(options?.indentWidth ?? DEFAULT_INDENT_WIDTH);
	objfmtWithSerializer(value, copyKeysOrderFrom, serializer, indentAll, curIndentWidth, addIndentWidth, -1, undefined);
	return serializer+'';
}

export interface Options
{	// Options:

	/**	String (that consists of spaces and/or tabs) that will be used to indent each nesting level, or number of spaces (from `0` to `10`, -1 for TAB).
		Default: `4`.
	 **/
	indentWidth?: number|string;

	/**	Style.
		Default: Kernighan & Ritchie.
	 **/
	indentStyle?: IndentStyle;

	/**	When printing arrays, print several numbers on line if the line remains not longer than this number.
		Default: `160`.
	 **/
	preferLineWidthLimit?: number;

	/**	Quote string literals also with apostrophes, if it requires less escaping.
		Default: `false`.
	 **/
	stringAllowApos?: boolean;

	/**	Quote string literals also with backticks, if it requires less escaping.
		Default: `false`.
	 **/
	stringAllowBacktick?: boolean;

	/**	Print long strings as multiline `String {... text ...}`, instead of string literals.
		Default: `false`.
	 **/
	longStringAsObject?: boolean;

	/**	Print also non-enumerable object properties (that appear as such in `Object.getOwnPropertyDescriptors()`).
		Default: `false`.
	 **/
	includeNonEnumerable?: boolean;

	/**	By default, when serializing an object that has `toJSON()` method, the result of calling this method is serialized, instead of the object itself (as `JSON.stringify()` does).
		This setting allows to avoid calling `toJSON()` at all (if set to `true`), or for certain class names.
		Default: `false`.
	 **/
	noCallToJSON?: boolean | string[];
}

export const enum IndentStyle
{	// Options:

	/** Kernighan & Ritchie
	 **/
	KR,

	/** Allman (BSD)
	 **/
	Allman,

	/** Horstmann
	 **/
	Horstmann,
}

function objfmtWithSerializer(value: unknown, copyKeysOrderFrom: unknown, serializer: Serializer, curIndent: string, curIndentWidth: number, addIndentWidth: number, index: number, key: string|undefined)
{	let className = '';
	if (typeof(value)=='object' && value!=null)
	{	// className
		className = value.constructor.name;
		if (className=='Object' || className=='Array')
		{	className = '';
		}
		// call toJSON?
		const {noCallToJSON} = serializer;
		if (noCallToJSON!==true && 'toJSON' in value && typeof(value.toJSON)=='function')
		{	if (typeof(noCallToJSON)=='boolean' || noCallToJSON.includes(className))
			{	value = value.toJSON(key ?? index);
			}
		}
		// convert Map to Object
		if (value instanceof Map)
		{	value = Object.fromEntries(value.entries());
		}
		else if (value instanceof Set)
		{	value = [...value.keys()];
		}
	}
	if (typeof(value)=='object' && value!=null && !(value instanceof Date))
	{	const isArray = Array.isArray(value) || (value as Any).buffer instanceof ArrayBuffer;
		const entries = isArray ? value as ArrayLike<unknown>
			: serializer.includeNonEnumerable ? Object.getOwnPropertyNames(value)
			: Object.keys(value);
		const {length} = entries;
		const nextIndent = serializer.begin(isArray, length, className, curIndent, index, key);
		const nextIndentWidth = curIndentWidth + addIndentWidth;
		if (isArray)
		{	const fieldWidth = arrayFieldWidth(value as ArrayLike<unknown>);
			if (fieldWidth >= 0)
			{	serializer.arrayOfLimitedFields(entries, fieldWidth, nextIndent, nextIndentWidth);
			}
			else if (Array.isArray(copyKeysOrderFrom))
			{	for (let i=0; i<length; i++)
				{	objfmtWithSerializer(entries[i], copyKeysOrderFrom[i], serializer, nextIndent, nextIndentWidth, addIndentWidth, i, undefined);
				}
			}
			else
			{	for (let i=0; i<length; i++)
				{	objfmtWithSerializer(entries[i], undefined, serializer, nextIndent, nextIndentWidth, addIndentWidth, i, undefined);
				}
			}
		}
		else
		{	let keys = entries as string[];
			if (typeof(copyKeysOrderFrom)=='object' && copyKeysOrderFrom!=null)
			{	const keys2 = [];
				for (const k of serializer.includeNonEnumerable ? Object.getOwnPropertyNames(copyKeysOrderFrom) : Object.keys(copyKeysOrderFrom))
				{	// deno-lint-ignore no-prototype-builtins
					if (value.hasOwnProperty(k))
					{	keys2[keys2.length] = k;
					}
				}
				for (const k of keys)
				{	// deno-lint-ignore no-prototype-builtins
					if (!copyKeysOrderFrom.hasOwnProperty(k))
					{	keys2[keys2.length] = k;
					}
				}
				keys = keys2;
				for (let i=0; i<length; i++)
				{	const key = keys[i];
					objfmtWithSerializer((value as Record<string, unknown>)[key], (copyKeysOrderFrom as Record<string, unknown>)[key], serializer, nextIndent, nextIndentWidth, addIndentWidth, i, key);
				}
			}
			else
			{	for (let i=0; i<length; i++)
				{	const key = keys[i];
					objfmtWithSerializer((value as Record<string, unknown>)[key], undefined, serializer, nextIndent, nextIndentWidth, addIndentWidth, i, key);
				}
			}
		}
		serializer.end(isArray, length, curIndent, index, key);
	}
	else
	{	serializer.stringifyValue(value, curIndent, curIndentWidth, index, key, className);
	}
}

function padStart(value: unknown, fieldWidth: number)
{	let str = value+'';
	while (true)
	{	const nPad = fieldWidth - str.length;
		if (nPad <= 0)
		{	break;
		}
		str = PADDER.slice(0, nPad) + str;
	}
	return str;
}

class Serializer
{	includeNonEnumerable: boolean;
	noCallToJSON: boolean | string[];
	#addIndent: string;
	#addIndentShort: string;
	#indentStyle: IndentStyle;
	#preferLineWidthLimit: number;
	#stringAllowApos: boolean;
	#stringAllowBacktick: boolean;
	#longStringAsObject: boolean;
	#result = '';

	constructor(options?: Options)
	{	const indentWidth = options?.indentWidth ?? DEFAULT_INDENT_WIDTH;
		this.includeNonEnumerable = options?.includeNonEnumerable ?? false;
		this.noCallToJSON = options?.noCallToJSON ?? false;
		this.#indentStyle = options?.indentStyle ?? IndentStyle.KR;
		this.#preferLineWidthLimit = options?.preferLineWidthLimit ?? DEFAULT_PREFER_LINE_WIDTH_LIMIT;
		this.#stringAllowApos = options?.stringAllowApos ?? false;
		this.#stringAllowBacktick = options?.stringAllowBacktick ?? false;
		this.#longStringAsObject = options?.longStringAsObject ?? false;
		this.#addIndent = typeof(indentWidth)=='string' ? indentWidth : indentWidth>=0 && indentWidth<=10 ? ' '.repeat(indentWidth) : '\t';
		this.#addIndentShort = this.#addIndent=='\t' || this.#indentStyle!=IndentStyle.Horstmann ? this.#addIndent : this.#addIndent.slice(0, -1);
	}

	toString()
	{	return this.#result;
	}

	begin(isArray: boolean, length: number, className: string, curIndent: string, index: number, key: string|undefined)
	{	const wantClassName = className.length != 0;
		if (length == 0)
		{	this.#key(true, curIndent, index, key);
			if (wantClassName)
			{	this.#result += className+(isArray ? ' []' : ' {}');
			}
			else
			{	this.#result += isArray ? '[]' : '{}';
			}
		}
		else
		{	this.#key(wantClassName, curIndent, index, key);
			if (wantClassName)
			{	this.#result += className;
			}
			const wantNewLine = wantClassName || key!=undefined;
			switch (this.#indentStyle)
			{	case IndentStyle.Allman:
					if (wantNewLine)
					{	this.#result += '\n'+curIndent;
					}
					this.#result += isArray ? '[' : '{';
					this.#result += '\n'+curIndent;
					break;
				case IndentStyle.Horstmann:
					if (wantNewLine)
					{	this.#result += '\n'+curIndent;
					}
					this.#result += isArray ? '[' : '{';
					break;
				default:
					if (wantNewLine)
					{	this.#result += ' ';
					}
					this.#result += isArray ? '[' : '{';
					this.#result += '\n'+curIndent;
			}
			curIndent += this.#addIndent;
		}
		return curIndent;
	}

	end(isArray: boolean, length: number, curIndent: string, index: number, _key: string|undefined)
	{	if (length != 0)
		{	this.#result += isArray ? curIndent+']' : curIndent+'}';
		}
		if (index != -1)
		{	this.#result += ',\n';
		}
	}

	stringifyValue(value: unknown, curIndent: string, curIndentWidth: number, index: number, key: string|undefined, className: string)
	{	if (className)
		{	className += ' ';
		}
		// 1. Key and Value
		if (value instanceof Date)
		{	value = value.toISOString();
		}
		if (typeof(value) == 'bigint')
		{	this.#key(true, curIndent, index, key);
			this.#result += className + value + 'n';
		}
		else if (typeof(value) == 'string')
		{	const str = this.#toStringLiteral(value);
			if (!this.#longStringAsObject || curIndentWidth+str.length+(!key ? 0 : key.length+3)<=this.#preferLineWidthLimit) // key.length + ': '.length + ','.length (here i ignore escape chars in `key`, and possible quote chars)
			{	this.#key(true, curIndent, index, key);
				this.#result += className + str;
			}
			else
			{	const nextIndent = this.begin(false, 1, className+'String', curIndent, index, key);
				this.#key(true, nextIndent, 0, undefined);
				this.#result += value.replace(RE_ENDL, m => m+nextIndent)+'\n';
				this.end(false, 1, curIndent, index, key);
				index = -1;
			}
		}
		else
		{	if (typeof(value) == 'function')
			{	value = 'Function';
			}
			this.#key(true, curIndent, index, key);
			this.#result += className + value;
		}
		// 2. Comma
		if (index != -1)
		{	this.#result += ',\n';
		}
	}

	arrayOfLimitedFields(entries: ArrayLike<unknown>, fieldWidth: number, curIndent: string, curIndentWidth: number)
	{	let nFieldsOnLine = 1;
		while (curIndentWidth + (fieldWidth+1) + (fieldWidth+3) * (nFieldsOnLine*2-1) <= this.#preferLineWidthLimit)
		{	nFieldsOnLine *= 2;
		}
		for (let i=0, iEnd=entries.length; i<iEnd; i++)
		{	this.#key(true, curIndent, i, undefined);
			this.#result += padStart(entries[i++], fieldWidth);
			this.#result += ',';
			for (let j=1; j<nFieldsOnLine && i<iEnd; j++)
			{	this.#result += padStart(entries[i++], fieldWidth+2);
				this.#result += ',';
			}
			i--;
			this.#result += '\n';
		}
	}

	#key(withSpace: boolean, curIndent: string, index: number, key: string|undefined)
	{	this.#result += index!=0 ? curIndent : this.#addIndentShort;
		if (key != undefined)
		{	this.#result += RE_KEY.test(key) ? key : this.#toStringLiteral(key);
			this.#result += withSpace ? ': ' : ':';
		}
	}

	#toStringLiteral(value: string)
	{	const qt = autoSelectQuoteChar(value, this.#stringAllowApos, this.#stringAllowBacktick);
		const str = value.replace(qt=='"' ? RE_SUBST_CHARS_IN_STRING_QT : qt=="'" ? RE_SUBST_CHARS_IN_STRING_APOS : RE_SUBST_CHARS_IN_STRING_BACKTICK, substCharsInString);
		return `${qt}${str}${qt}`;
	}
}

function arrayFieldWidth(array: ArrayLike<unknown>)
{	let max = 0;
	let min = 0;
	for (let i=0, iEnd=array.length; i<iEnd; i++)
	{	const v = array[i];
		if (typeof(v) == 'number')
		{	if (v >= 0)
			{	if (v > max)
				{	max = v;
				}
			}
			else
			{	if (v < min)
				{	min = v;
				}
			}
		}
		else if (typeof(v) == 'boolean')
		{	if (v === true)
			{	if (max < 1234)
				{	max = 1234;
				}
			}
			else
			{	if (max < 12345)
				{	max = 12345;
				}
			}
		}
		else
		{	return -1;
		}
	}
	if (!min)
	{	return max<=9 ? 1 : (''+max).length;
	}
	if (-min >= max)
	{	return (''+min).length;
	}
	return Math.max((''+max).length, (''+min).length);
}

function autoSelectQuoteChar(str: string, stringAllowApos: boolean, stringAllowBacktick: boolean)
{	let nQuot = 0;
	let nApos = 0;
	let nBacktickOrPlaceholder = 0;

	if (stringAllowApos || stringAllowBacktick)
	{	for (let i=0, iEnd=str.length; i<iEnd; i++)
		{	switch (str.charCodeAt(i))
			{	case C_QUOT:
					nQuot++;
					break;
				case C_APOS:
					nApos++;
					break;
				case C_BACKTICK:
					nBacktickOrPlaceholder++;
					break;
				case C_DOLLAR:
					if (str.charCodeAt(i+1) == C_BRACE_OPEN)
					{	nBacktickOrPlaceholder++;
						i++;
					}
					break;
			}
		}
	}

	if (nQuot<=nApos && nQuot<=nBacktickOrPlaceholder)
	{	return '"';
	}
	if (nApos<=nQuot && nApos<=nBacktickOrPlaceholder && stringAllowApos)
	{	return "'";
	}
	return '`';
}

function substCharsInString(str: string)
{	const c = str.charCodeAt(0);
	switch (c)
	{	case C_CR:
			return '\\r';
		case C_LF:
			return '\\n';
		case C_TAB:
			return '\\t';
		case C_BACKSLASH:
		case C_QUOT:
		case C_APOS:
		case C_BACKTICK:
		case C_DOLLAR:
			return '\\'+str;
		default:
			if (c<=0xFF && str.length==1)
			{	return '\\x'+c.toString(16).toUpperCase().padStart(2, '0');
			}
			else
			{	return Array.prototype.map.call(str, c => '\\u'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')).join('');
			}
	}
}

function indentToWidth(indent: number|string)
{	if (typeof(indent) == 'number')
	{	return indent>=0 && indent<=10 ? indent : TAB_WIDTH;
	}
	let nColumn = 0;
	for (let i=0, iEnd=indent.length; i<iEnd; i++)
	{	nColumn += indent.charCodeAt(i)==C_TAB ? TAB_WIDTH - nColumn%TAB_WIDTH : 1;
	}
	return nColumn;
}
