# objfmt
Convert JavaScript value (object, array or other) to human-readable string similar to JSON with indentation.
Includes class names together with object literals, and converts `Date` objects to string representation.

## Usage:

```ts
import {objfmt, IndentStyle} from 'https://deno.land/x/objfmt@v0.0.1/mod.ts';

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
function objfmt(value: unknown, options?: Options, indentAll='', copyKeysOrderFrom?: unknown): string;

interface Options
{	indentWidth?: number,
	indentStyle?: IndentStyle,
}

const enum IndentStyle
{	KR,
	Allman,
	Horstmann,
}
```

Arguments:

- `value` - a JavaScript value (object, array or other) to format.
- `options` - allows to specify `indentWidth` and `indentStyle`
	- `indentWidth` - `-1` for TAB indent, and from `0` to `10` (inclusive) for number of spaces. Default: `4`.
	- `indentStyle` - Style. Default: Kernighan & Ritchie.
- `indentAll` - string (that consists of spaces and/or tabs) that will be used to indent the whole output string.
- `copyKeysOrderFrom` - optional object or array, that will be traversed in parallel with the `value` object, to copy keys order from it. `copyKeysOrderFrom` can have some or all of the keys in `value`, and it can contain more keys. This allows to generate 2 stringified objects ready for line-to-line comparison.
