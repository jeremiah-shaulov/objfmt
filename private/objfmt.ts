// deno-lint-ignore no-explicit-any
type Any = any;

const RE_SUBST_CHARS_IN_STRING = /[\\"\r\n]|\p{C}/gu;
const RE_KEY = /^(?:\p{L}|_)(?:\p{L}|_|\d)*$/u;

/**	Convert JavaScript value (object, array or other) to human-readable string similar to JSON with indentation.
	Includes class names together with object literals, and converts `Date` objects to string representation.
 **/
export function objfmt(value: unknown, options?: Options, indentAll='', copyKeysOrderFrom?: unknown)
{	const serializer = new Serializer(options);
	objfmtWithSerializer(value, copyKeysOrderFrom, serializer, indentAll, -1, undefined);
	return serializer+'';
}

export interface Options
{	// Options:

	/**	`-1` for TAB indent, and from `0` to `10` (inclusive) for number of spaces.
		Default: `4`.
	 **/
	indentWidth?: number,

	/**	Style.
		Default: Kernighan & Ritchie.
	 **/
	indentStyle?: IndentStyle,
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
		const entries = isArray ? value as Array<unknown> : Object.keys(value);
		const {length} = entries;
		const className = value.constructor.name;
		const nextIndent = serializer.begin(isArray, length, className, indent, index, key);
		if (isArray)
		{	if (Array.isArray(copyKeysOrderFrom))
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
	{	let str = value+'';
		if (typeof(value) == 'bigint')
		{	str += 'n';
		}
		else if (typeof(value) == 'string')
		{	str = str.replace(RE_SUBST_CHARS_IN_STRING, substCharsInString);
			str = `"${str}"`;
		}
		else if (value instanceof Date)
		{	str = str.replace(RE_SUBST_CHARS_IN_STRING, substCharsInString);
			str = `Date "${str}"`;
		}
		serializer.stringifiedValue(str, indent, index, key);
	}
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
	protected result = '';

	constructor(options?: Options)
	{	const indentWidth = options?.indentWidth ?? 4;
		this.indentStyle = options?.indentStyle ?? IndentStyle.KR;
		this.addIndent = indentWidth>=0 && indentWidth<=10 ? ' '.repeat(indentWidth) : '\t';
		this.addIndentShort = indentWidth<=0 || indentWidth>10 || this.indentStyle!=IndentStyle.Horstmann ? this.addIndent : this.addIndent.slice(0, -1);
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

	#key(withSpace: boolean, indent: string, index: number, key: string|undefined)
	{	this.result += index!=0 ? indent : this.addIndentShort;
		if (key != undefined)
		{	this.result += RE_KEY.test(key) ? key : JSON.stringify(key);
			this.result += withSpace ? ': ' : ':';
		}
	}
}
