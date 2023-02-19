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
	const serializer = new Serializer(options, indentAll);
	objfmtWithSerializer(value, copyKeysOrderFrom, serializer, indentAll, -1, undefined, false);
	return serializer+'';
}

export type Options =
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

	/**	Allows to colorize the output by providing strings that must be inserted where various literals start and end.
		These can be HTML strings or terminal escape sequences.
	 **/
	style?: Style;
};

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

export type Style =
{	stringBegin?: string;
	stringEnd?: string;
	keyBegin?: string;
	keyEnd?: string;
	numberBegin?: string;
	numberEnd?: string;
	keywordBegin?: string;
	keywordEnd?: string;
	typeBegin?: string;
	typeEnd?: string;
	structureBegin?: string;
	structureEnd?: string;
};

const enum What
{	ARRAY,
	OBJECT,
	MAP,
	MAP_DOUBLE_SPACE,
}

function objfmtWithSerializer(value: unknown, copyKeysOrderFrom: unknown, serializer: Serializer, curIndent: string, index: number, key: unknown, trimStart: boolean)
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
		// convert Set to Array
		if (value instanceof Set)
		{	value = [...value.keys()];
		}
	}
	else if (typeof(value) == 'function')
	{	className = 'Function';
	}
	if (typeof(value)=='object' && value!=null && !(value instanceof Date))
	{	let what = What.OBJECT;
		let keys: string[] | Map<unknown, unknown> | undefined;
		let length = 0;
		if (Array.isArray(value) || (value as Any).buffer instanceof ArrayBuffer)
		{	what = What.ARRAY;
			length = (value as Any).length;
		}
		else if (value instanceof Map)
		{	what = isMapDoubleSpace(value) ? What.MAP_DOUBLE_SPACE : What.MAP;
			keys = value;
			length = value.size;
		}
		else if (serializer.includeNonEnumerable)
		{	keys = Object.getOwnPropertyNames(value);
			length = keys.length;
		}
		else
		{	keys = Object.keys(value);
			length = keys.length;
		}
		const nextIndent = serializer.begin(what, length, className, curIndent, index, key, trimStart);
		if (what == What.ARRAY)
		{	const values = value as ArrayLike<unknown>;
			const fieldWidth = arrayFieldWidth(values);
			if (fieldWidth >= 0)
			{	serializer.arrayOfLimitedFields(values, fieldWidth, nextIndent);
			}
			else
			{	const rightKeys: unknown[]|undefined = Array.isArray(copyKeysOrderFrom) ? copyKeysOrderFrom : undefined;
				for (let i=0; i<length; i++)
				{	const item = values[i];
					objfmtWithSerializer(item, rightKeys?.[i], serializer, nextIndent, i, undefined, false);
				}
			}
		}
		else if (keys)
		{	if (typeof(copyKeysOrderFrom)=='object' && copyKeysOrderFrom!=null)
			{	const keys2 = new Array<unknown>();
				const it = copyKeysOrderFrom instanceof Map ? copyKeysOrderFrom.keys()
					: serializer.includeNonEnumerable ? Object.getOwnPropertyNames(copyKeysOrderFrom)
					: Object.keys(copyKeysOrderFrom);
				for (const k of it)
				{	// deno-lint-ignore no-prototype-builtins
					if (keys instanceof Map ? keys.has(k) : keys.hasOwnProperty(k))
					{	keys2[keys2.length] = k;
					}
				}
				for (const k of keys instanceof Map ? keys.keys() : keys)
				{	if (!keys2.includes(k))
					{	keys2[keys2.length] = k;
					}
				}
				for (let i=0; i<length; i++)
				{	const key = keys2[i];
					const leftValue = value instanceof Map ? value.get(key) : typeof(key)=='string' ? (value as Record<string, unknown>)[key] : undefined;
					const rightValue = copyKeysOrderFrom instanceof Map ? copyKeysOrderFrom.get(key) : typeof(key)=='string' ? (copyKeysOrderFrom as Record<string, unknown>)[key] : undefined;
					objfmtWithSerializer(leftValue, rightValue, serializer, nextIndent, i, key, false);
				}
			}
			else if (keys instanceof Map)
			{	let i = 0;
				for (const [key, v] of keys)
				{	objfmtWithSerializer(v, undefined, serializer, nextIndent, i++, key, false);
				}
			}
			else
			{	let i = 0;
				for (const key of keys)
				{	objfmtWithSerializer((value as Record<string, unknown>)[key], undefined, serializer, nextIndent, i++, key, false);
				}
			}
		}
		serializer.end(what, length, curIndent, index, key);
	}
	else
	{	serializer.stringifyValue(value, curIndent, index, key, className);
	}
}

class Serializer
{	includeNonEnumerable: boolean;
	noCallToJSON: boolean | string[];

	#curIndentWidth: number;
	#addIndentWidth: number;
	#indentStyle: IndentStyle;
	#addIndent: string;
	#addIndentShort: string;
	#preferLineWidthLimit: number;
	#stringAllowApos: boolean;
	#stringAllowBacktick: boolean;
	#longStringAsObject: boolean;

	#stringBegin: string;
	#stringEnd: string;
	#keyBegin: string;
	#keyEnd: string;
	#numberBegin: string;
	#numberEnd: string;
	#keywordBegin: string;
	#keywordEnd: string;
	#typeBegin: string;
	#typeEnd: string;
	#structureBegin: string;
	#structureEnd: string;

	#insideWhat = new Array<What>();
	#insideWhatLen = 0;
	#result = '';

	constructor(options: Options|undefined, indentAll: number|string)
	{	const indentWidth = options?.indentWidth ?? DEFAULT_INDENT_WIDTH;

		this.includeNonEnumerable = options?.includeNonEnumerable ?? false;
		this.noCallToJSON = options?.noCallToJSON ?? false;

		this.#curIndentWidth = indentToWidth(indentAll);
		this.#addIndentWidth = indentToWidth(indentWidth);
		this.#indentStyle = options?.indentStyle ?? IndentStyle.KR;
		this.#addIndent = typeof(indentWidth)=='string' ? indentWidth : indentWidth>=0 && indentWidth<=10 ? ' '.repeat(indentWidth) : '\t';
		this.#addIndentShort = this.#addIndent=='\t' || this.#indentStyle!=IndentStyle.Horstmann ? this.#addIndent : this.#addIndent.slice(0, -1);
		this.#preferLineWidthLimit = options?.preferLineWidthLimit ?? DEFAULT_PREFER_LINE_WIDTH_LIMIT;
		this.#stringAllowApos = options?.stringAllowApos ?? false;
		this.#stringAllowBacktick = options?.stringAllowBacktick ?? false;
		this.#longStringAsObject = options?.longStringAsObject ?? false;

		this.#stringBegin = options?.style?.stringBegin ?? '';
		this.#stringEnd = options?.style?.stringEnd ?? '';
		this.#keyBegin = options?.style?.keyBegin ?? '';
		this.#keyEnd = options?.style?.keyEnd ?? '';
		this.#numberBegin = options?.style?.numberBegin ?? '';
		this.#numberEnd = options?.style?.numberEnd ?? '';
		this.#keywordBegin = options?.style?.keywordBegin ?? '';
		this.#keywordEnd = options?.style?.keywordEnd ?? '';
		this.#typeBegin = options?.style?.typeBegin ?? '';
		this.#typeEnd = options?.style?.typeEnd ?? '';
		this.#structureBegin = options?.style?.structureBegin ?? '';
		this.#structureEnd = options?.style?.structureEnd ?? '';
	}

	toString()
	{	return this.#result;
	}

	begin(what: What, length: number, className: string, curIndent: string, index: number, key: unknown, trimStart: boolean)
	{	const wantClassName = className.length != 0;
		if (length == 0)
		{	this.#key(true, curIndent, index, key, trimStart);
			const structure = this.#structureBegin + (what==What.ARRAY ? '[]' : '{}') + this.#structureEnd;
			if (wantClassName)
			{	this.#result += this.#typeBegin + className + this.#typeEnd + ' ' + structure;
			}
			else
			{	this.#result += structure;
			}
		}
		else
		{	this.#key(wantClassName, curIndent, index, key, trimStart);
			if (wantClassName)
			{	this.#result += this.#typeBegin + className + this.#typeEnd;
			}
			const wantNewLine = wantClassName || key!=undefined;
			const structure = this.#structureBegin + (what==What.ARRAY ? '[' : '{') + this.#structureEnd;
			switch (this.#indentStyle)
			{	case IndentStyle.Allman:
					if (wantNewLine)
					{	this.#result += '\n'+curIndent;
					}
					this.#result += structure;
					this.#result += '\n'+curIndent;
					break;
				case IndentStyle.Horstmann:
					if (wantNewLine)
					{	this.#result += '\n'+curIndent;
					}
					this.#result += structure;
					break;
				default:
					if (wantNewLine)
					{	this.#result += ' ';
					}
					this.#result += structure;
					this.#result += '\n'+curIndent;
			}
			curIndent += this.#addIndent;
		}
		this.#insideWhat[this.#insideWhatLen++] = what;
		this.#curIndentWidth += this.#addIndentWidth;
		return curIndent;
	}

	end(what: What, length: number, curIndent: string, index: number, _key: unknown)
	{	if (length != 0)
		{	const structure = this.#structureBegin + (what==What.ARRAY ? ']' : '}') + this.#structureEnd;
			this.#result += curIndent + structure;
		}
		if (index != -1)
		{	this.#result += ',\n';
		}
		this.#insideWhatLen--;
		this.#curIndentWidth -= this.#addIndentWidth;
	}

	stringifyValue(value: unknown, curIndent: string, index: number, key: unknown, className: string)
	{	if (className)
		{	className = this.#typeBegin + className + this.#typeEnd + ' ';
		}
		// 1. Key and Value
		if (value instanceof Date)
		{	value = value.toISOString();
		}
		if (typeof(value) == 'number')
		{	this.#key(true, curIndent, index, key, false);
			this.#result += className + this.#numberBegin + value + this.#numberEnd;
		}
		else if (typeof(value) == 'bigint')
		{	this.#key(true, curIndent, index, key, false);
			this.#result += className + this.#numberBegin + value + 'n' + this.#numberEnd;
		}
		else if (typeof(value) == 'string')
		{	const str = this.#toStringLiteral(value);
			if (!this.#longStringAsObject || this.#curIndentWidth+str.length+(typeof(key)!='string' ? 0 : key.length+3)<=this.#preferLineWidthLimit) // key.length + ': '.length + ','.length (here i ignore escape chars in `key`, and possible quote chars)
			{	this.#key(true, curIndent, index, key, false);
				this.#result += className + this.#stringBegin + str + this.#stringEnd;
			}
			else
			{	const nextIndent = this.begin(What.OBJECT, 1, className+'String', curIndent, index, key, false);
				this.#key(true, nextIndent, 0, undefined, false);
				this.#result += this.#stringBegin + value.replace(RE_ENDL, m => m+nextIndent) + this.#stringEnd + '\n';
				this.end(What.OBJECT, 1, curIndent, index, key);
				index = -1;
			}
		}
		else if (typeof(value) == 'function')
		{	this.#key(true, curIndent, index, key, false);
			this.#result += className;
		}
		else
		{	// assume: false, true, null or undefined
			this.#key(true, curIndent, index, key, false);
			this.#result += className + this.#keywordBegin + value + this.#keywordEnd;
		}
		// 2. Comma
		if (index != -1)
		{	this.#result += ',\n';
		}
	}

	#simpleValueWithoutKey(value: unknown, fieldWidth: number)
	{	switch (typeof(value))
		{	case 'number':
				return this.#numberBegin + padStart(value, fieldWidth) + this.#numberEnd;
			case 'bigint':
				return this.#numberBegin + padStart(value+'m', fieldWidth) + this.#numberEnd;
			case 'string':
				return this.#stringBegin + padStart(this.#toStringLiteral(value), fieldWidth) + this.#stringEnd;
			default:
				// assume: false, true, null or undefined
				return this.#keywordBegin + padStart(value, fieldWidth) + this.#keywordEnd;
		}
	}

	arrayOfLimitedFields(entries: ArrayLike<unknown>, fieldWidth: number, curIndent: string)
	{	let nFieldsOnLine = 1;
		while (this.#curIndentWidth + (fieldWidth+1) + (fieldWidth+3) * (nFieldsOnLine*2-1) <= this.#preferLineWidthLimit)
		{	nFieldsOnLine *= 2;
		}
		for (let i=0, iEnd=entries.length; i<iEnd; i++)
		{	this.#key(true, curIndent, i, undefined, false);
			this.#result += this.#simpleValueWithoutKey(entries[i++], fieldWidth);
			this.#result += ',';
			for (let j=1; j<nFieldsOnLine && i<iEnd; j++)
			{	this.#result += this.#simpleValueWithoutKey(entries[i++], fieldWidth+2);
				this.#result += ',';
			}
			i--;
			this.#result += '\n';
		}
	}

	#key(withSpace: boolean, curIndent: string, index: number, key: unknown, trimStart: boolean)
	{	const insideWhat = this.#insideWhat[this.#insideWhatLen - 1];
		if (!trimStart)
		{	this.#result += index==0 ? this.#addIndentShort : insideWhat!=What.MAP_DOUBLE_SPACE ? curIndent : '\n'+curIndent;
		}
		if (key != undefined)
		{	if (typeof(key) == 'string')
			{	this.#result += this.#keyBegin;
				this.#result += insideWhat<What.MAP && RE_KEY.test(key) ? key : this.#toStringLiteral(key);
				this.#result += this.#keyEnd;
			}
			else
			{	objfmtWithSerializer(key, undefined, this, curIndent, -1, undefined, true);
			}
			this.#result += insideWhat>=What.MAP ? (withSpace ? ' => ' : ' =>') : (withSpace ? ': ' : ':');
		}
	}

	#toStringLiteral(value: string)
	{	const qt = autoSelectQuoteChar(value, this.#stringAllowApos, this.#stringAllowBacktick);
		const str = value.replace(qt=='"' ? RE_SUBST_CHARS_IN_STRING_QT : qt=="'" ? RE_SUBST_CHARS_IN_STRING_APOS : RE_SUBST_CHARS_IN_STRING_BACKTICK, substCharsInString);
		return `${qt}${str}${qt}`;
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
		else if (v === null)
		{	if (max < 1234)
			{	max = 1234;
			}
		}
		else if (v === undefined)
		{	if (max < 123456789)
			{	max = 123456789;
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

function isMapDoubleSpace(map: Map<unknown, unknown>)
{	for (const key of map.keys())
	{	if (typeof(key)=='object' && key!=null && !(key instanceof Date))
		{	return true;
		}
	}
	return false;
}
