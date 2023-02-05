// deno-lint-ignore no-explicit-any
type Any = any;

const DEFAULT_PREFER_LINE_WIDTH_LIMIT = 160;
const RE_SUBST_CHARS_IN_STRING = /[\\"\r\n]|\p{C}/gu;
const RE_KEY = /^(?:\p{L}|_)(?:\p{L}|_|\d)*$/u;
const PADDER = '                ';
const C_TAB = '\t'.charCodeAt(0);

/**	Convert JavaScript value (object, array or other) to human-readable string similar to JSON with indentation.
	Includes class names together with object literals, and converts `Date` objects to string representation.
 **/
export function objfmt(value: unknown, options?: Options, indentAll: number|string='', copyKeysOrderFrom?: unknown)
{	if (typeof(indentAll) == 'number')
	{	indentAll = indentAll>=0 && indentAll<=10 ? ' '.repeat(indentAll) : '\t';
	}
	const serializer = new Serializer(options);
	objfmtWithSerializer(value, copyKeysOrderFrom, serializer, indentAll, -1, undefined);
	return serializer+'';
}

export interface Options
{	// Options:

	/**	string (that consists of spaces and/or tabs) that will be used to indent each nesting level, or number of spaces (from `0` to `10`, -1 for TAB).
		Default: `4`.
	 **/
	indentWidth?: number|string,

	/**	Style.
		Default: Kernighan & Ritchie.
	 **/
	indentStyle?: IndentStyle,

	/**	When printing arrays, print several numbers on line if the line remains not longer than this number.
		Default: `160`.
	 **/
	preferLineWidthLimit?: number,
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

function objfmtWithSerializer(value: unknown, copyKeysOrderFrom: unknown, serializer: Serializer, indent: string, index: number, key: string|undefined)
{	if (typeof(value)=='object' && value!=null && !(value instanceof Date))
	{	const isArray = Array.isArray(value) || (value as Any).buffer instanceof ArrayBuffer;
		const entries = isArray ? value as unknown[] : Object.keys(value);
		const {length} = entries;
		const className = value.constructor.name;
		const nextIndent = serializer.begin(isArray, length, className, indent, index, key);
		if (isArray)
		{	const fieldWidth = arrayFieldWidth(value as ArrayLike<unknown>);
			if (fieldWidth >= 0)
			{	serializer.arrayOfLimitedFields(entries, fieldWidth, nextIndent);
			}
			else if (Array.isArray(copyKeysOrderFrom))
			{	for (let i=0; i<length; i++)
				{	objfmtWithSerializer(entries[i], copyKeysOrderFrom[i], serializer, nextIndent, i, undefined);
				}
			}
			else
			{	for (let i=0; i<length; i++)
				{	objfmtWithSerializer(entries[i], undefined, serializer, nextIndent, i, undefined);
				}
			}
		}
		else
		{	let keys = entries as string[];
			if (typeof(copyKeysOrderFrom)=='object' && copyKeysOrderFrom!=null)
			{	const keys2 = [];
				for (const k of Object.keys(copyKeysOrderFrom))
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
					objfmtWithSerializer((value as Record<string, unknown>)[key], (copyKeysOrderFrom as Record<string, unknown>)[key], serializer, nextIndent, i, keys[i]);
				}
			}
			else
			{	for (let i=0; i<length; i++)
				{	const key = keys[i];
					objfmtWithSerializer((value as Record<string, unknown>)[key], undefined, serializer, nextIndent, i, keys[i]);
				}
			}
		}
		serializer.end(isArray, length, indent, index, key);
	}
	else
	{	serializer.stringifiedValue(stringifyValue(value), indent, index, key);
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

function stringifyValue(value: unknown)
{	let str = value+'';
	if (typeof(value) == 'bigint')
	{	str += 'n';
	}
	else if (typeof(value) == 'string')
	{	str = str.replace(RE_SUBST_CHARS_IN_STRING, substCharsInString);
		str = `"${str}"`;
	}
	else if (value instanceof Date)
	{	str = `Date "${str}"`;
	}
	return str;
}

function substCharsInString(c: string)
{	if (c == '\r')
	{	return '\\r';
	}
	else if (c == '\n')
	{	return '\\n';
	}
	else if (c=='\\' || c=='"')
	{	return '\\'+c;
	}
	else
	{	return Array.prototype.map.call(c, c => '\\u'+c.charCodeAt(0)).join('');
	}
}

class Serializer
{	protected addIndent: string;
	protected addIndentShort: string;
	protected indentStyle: IndentStyle;
	protected preferLineWidthLimit: number;
	protected result = '';

	constructor(options?: Options)
	{	const indentWidth = options?.indentWidth ?? 4;
		this.indentStyle = options?.indentStyle ?? IndentStyle.KR;
		this.preferLineWidthLimit = options?.preferLineWidthLimit ?? DEFAULT_PREFER_LINE_WIDTH_LIMIT;
		this.addIndent = typeof(indentWidth)=='string' ? indentWidth : indentWidth>=0 && indentWidth<=10 ? ' '.repeat(indentWidth) : '\t';
		this.addIndentShort = this.addIndent=='\t' || this.indentStyle!=IndentStyle.Horstmann ? this.addIndent : this.addIndent.slice(0, -1);
	}

	toString()
	{	return this.result;
	}

	begin(isArray: boolean, length: number, className: string, indent: string, index: number, key: string|undefined)
	{	const wantClassName = className.length!=0 && className!='Object' && className!='Array';
		if (length == 0)
		{	this.#key(true, indent, index, key);
			if (wantClassName)
			{	this.result += className+(isArray ? ' []' : ' {}');
			}
			else
			{	this.result += isArray ? '[]' : '{}';
			}
		}
		else
		{	this.#key(wantClassName, indent, index, key);
			if (wantClassName)
			{	this.result += className;
			}
			const wantNewLine = wantClassName || key!=undefined;
			switch (this.indentStyle)
			{	case IndentStyle.Allman:
					if (wantNewLine)
					{	this.result += '\n'+indent;
					}
					this.result += isArray ? '[' : '{';
					this.result += '\n'+indent;
					break;
				case IndentStyle.Horstmann:
					if (wantNewLine)
					{	this.result += '\n'+indent;
					}
					this.result += isArray ? '[' : '{';
					break;
				default:
					if (wantNewLine)
					{	this.result += ' ';
					}
					this.result += isArray ? '[' : '{';
					this.result += '\n'+indent;
			}
			indent += this.addIndent;
		}
		return indent;
	}

	end(isArray: boolean, length: number, indent: string, index: number, _key: string|undefined)
	{	if (length != 0)
		{	this.result += isArray ? indent+']' : indent+'}';
		}
		if (index != -1)
		{	this.result += ',\n';
		}
	}

	stringifiedValue(str: string, indent: string, index: number, key: string|undefined)
	{	this.#key(true, indent, index, key);
		this.result += str;
		if (index != -1)
		{	this.result += ',\n';
		}
	}

	arrayOfLimitedFields(entries: unknown[], fieldWidth: number, indent: string)
	{	const indentWidth = indent.charCodeAt(0)==C_TAB ? 4*indent.length : indent.length;
		let nFieldsOnLine = 1;
		while (indentWidth + (fieldWidth+1) + (fieldWidth+3) * (nFieldsOnLine*2-1) < this.preferLineWidthLimit)
		{	nFieldsOnLine *= 2;
		}
		for (let i=0, iEnd=entries.length; i<iEnd; i++)
		{	this.#key(true, indent, i, undefined);
			this.result += padStart(entries[i++], fieldWidth);
			this.result += ',';
			for (let j=1; j<nFieldsOnLine && i<iEnd; j++)
			{	this.result += padStart(entries[i++], fieldWidth+2);
				this.result += ',';
			}
			i--;
			this.result += '\n';
		}
	}

	#key(withSpace: boolean, indent: string, index: number, key: string|undefined)
	{	this.result += index!=0 ? indent : this.addIndentShort;
		if (key != undefined)
		{	this.result += RE_KEY.test(key) ? key : JSON.stringify(key);
			this.result += withSpace ? ': ' : ':';
		}
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
