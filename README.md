# objfmt
Convert JavaScript value (object, array or other) to human-readable string similar to JSON with indentation.
Includes class names together with object literals, and converts `Date` objects to string representation.

## Usage:

```ts
// To download and run this example:
// curl 'https://raw.githubusercontent.com/jeremiah-shaulov/objfmt/v0.0.6/README.md' | perl -ne '$y=$1 if /^```(ts\\b)?/;  print $_ if $y&&$m;  $m=$y&&($m||m~^// deno .*?/example1.ts~)' > /tmp/example1.ts
// deno run /tmp/example1.ts

import {objfmt, IndentStyle} from 'https://deno.land/x/objfmt@v0.0.6/mod.ts';

const value =
[	{	name: 'Product 1',
		price: 4.99,
		salePrice: 3.99,
		colors: ['green', 'white', 'crimson'],
		publishDate: new Date(2023, 0, 1),
	},
	{	name: 'Product 2',
		price: 9.99,
		colors: ['orange', 'purple'],
		publishDate: new Date(2024, 2, 3),
	},
];

// Default indentation style (Kernighan & Ritchie)
console.log('---------- Kernighan & Ritchie ----------');
console.log(objfmt(value));

// Allman (BSD)
console.log('\n---------- Allman (BSD) ----------');
console.log(objfmt(value, {indentStyle: IndentStyle.Allman}));

// Horstmann
console.log('\n---------- Horstmann ----------');
console.log(objfmt(value, {indentStyle: IndentStyle.Horstmann}));
```

## Interface

```ts
function objfmt(value: unknown, options?: Options, indentAll: number|string='', copyKeysOrderFrom?: unknown): string;

interface Options
{	indentWidth?: number|string;
	indentStyle?: IndentStyle;
	preferLineWidthLimit?: number;
	stringAllowApos?: boolean;
	stringAllowBacktick?: boolean;
	longStringAsObject?: boolean;
}

const enum IndentStyle
{	KR,
	Allman,
	Horstmann,
}
```

Arguments:

- `value` - a JavaScript value (object, array or other) to format.
- `options` - allows to specify `indentWidth`, `indentStyle` and `preferLineWidthLimit`.
	- `indentWidth` - string (that consists of spaces and/or tabs) that will be used to indent each nesting level, or number of spaces (from `0` to `10`, -1 for TAB). Default: `4`.
	- `indentStyle` - Style. Default: Kernighan & Ritchie.
	- `preferLineWidthLimit` - When printing arrays, print several numbers on line if the line remains not longer than this number. Default: `160`.
	- `stringAllowApos` - Quote string literals also with apostrophes, if it requires less escaping. Default: `false`.
	- `stringAllowBacktick` - Quote string literals also with backticks, if it requires less escaping. Default: `false`.
	- `longStringAsObject` - Print long strings as multiline `String {... text ...}`, instead of string literals. Default: `false`.
- `indentAll` - string (that consists of spaces and/or tabs) that will be used to indent the whole output, or number of spaces (from `0` to `10`, -1 for TAB). Default: empty string.
- `copyKeysOrderFrom` - optional object or array, that will be traversed in parallel with the `value` object, to copy keys order from it. `copyKeysOrderFrom` can have some or all of the keys in `value`, and it can contain more keys. This allows to generate 2 stringified objects ready for line-to-line comparison.
