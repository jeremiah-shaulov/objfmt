import {objfmt, IndentStyle, Options} from '../mod.ts';
import {DEFAULT_PREFER_LINE_WIDTH_LIMIT} from '../private/objfmt.ts';
import {assertEquals} from "https://deno.land/std@0.176.0/testing/asserts.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

// deno-lint-ignore no-unused-vars
class Class0
{
}

// deno-lint-ignore no-unused-vars
class Class1
{	constructor(public prop0: string, public prop1: number)
	{
	}
}

// deno-lint-ignore no-unused-vars
class CustomArray extends Array<Any> {}

const TESTS =
`
null

---

undefined

---

"Text"

---

[]

---

{}

---

{	a: 1,
}

---

{	a: 10,
	b: 11,
}

---

{	a: 10,
	b: [],
}

---

{	a: 10,
-	b: new CustomArray(),
+	b: CustomArray [],
}

---

{	a: 10,
	b:
	[	"b",
	],
}

---

{	a: 10,
	b:
	[	[],
		[	"b0",
			"b1",
		],
	],
}

---

{	a: 10,
-	b: new CustomArray('b'),
+	b: CustomArray
+	[	"b",
+	],
}

---

{	a: 10,
	b:
	[	"b",
-		new Class0,
+		Class0 {},
	],
}

---

{	a: 10,
	b:
	[	"b",
-		new Class1('val0', 123),
+		Class1
+		{	prop0: "val0",
+			prop1: 123,
+		},
	],
}

---

{	"*": 1,
-	"\0\x1B😀": "\0\x1B😀",
+	"\\x00\\x1B😀": "\\x00\\x1B😀",
}

--- preferLineWidthLimit=13

{	arr:
	[	1,
		2,
		3,
		4,
		5,
	],
}

--- preferLineWidthLimit=14

{	arr:
	[	1,  2,
		3,  4,
		5,
	],
}

--- preferLineWidthLimit=21

{	arr:
	[	1,  2,
		3,  4,
		5,
	],
}

--- preferLineWidthLimit=22

{	arr:
	[	1,  2,  3,  4,
		5,
	],
}

---

-new Class1('Quote is: "', 123)
+Class1
+{	prop0: "Quote is: \\"",
+	prop1: 123,
+}

---

-'Quote is: "'
+"Quote is: \\""

---stringAllowApos=true

'Quote is: "'

--- stringAllowBacktick=true

\`Quote is: "\`

--- stringAllowApos=true, stringAllowBacktick=true

'Quote is: "'

--- preferLineWidthLimit=17, longStringAsObject=true

{	str: "12345",
}

--- preferLineWidthLimit=17, longStringAsObject=true

-{	str: "123456",
+{	str: String
+	{	123456
+	},
}
`;

Deno.test
(	'All',
	() =>
	{	for (const indentWidth of [-1, 0, 1, 3, 4, 8, 9, 10, 11])
		{	for (let str of TESTS.split('---'))
			{	const optionsStr = str.match(/^[^\r\n]*/)?.[0] ?? '';
				str = str.slice(optionsStr.length);

				const options: Options = {indentWidth, indentStyle: IndentStyle.Horstmann};
				optionsStr.replace(/stringAllowApos=(\w+)/, (_, w) => (options.stringAllowApos = w=='true')+'');
				optionsStr.replace(/stringAllowBacktick=(\w+)/, (_, w) => (options.stringAllowBacktick = w=='true')+'');
				optionsStr.replace(/longStringAsObject=(\w+)/, (_, w) => (options.longStringAsObject = w=='true')+'');
				optionsStr.replace(/preferLineWidthLimit=(\d+)/, (_, d) => (options.preferLineWidthLimit = +d)+'');
				if (options.preferLineWidthLimit!=DEFAULT_PREFER_LINE_WIDTH_LIMIT && indentWidth!=-1 && indentWidth!=4)
				{	continue;
				}

				const testActual = str.replace(/\r?\n\+[^\r\n]*/g, '').replace(/[\r\n]\-/g, m => m[0]);
				let testExpected = str.replace(/\r?\n\-[^\r\n]*/g, '').replace(/[\r\n]\+/g, m => m[0]);

				if (indentWidth>=0 && indentWidth<=10)
				{	const addIndent = ' '.repeat(indentWidth);
					const addIndentSmall = indentWidth==0 ? '' : ' '.repeat(indentWidth-1);
					testExpected = testExpected.replace(/\S\t/g, m => m[0]+addIndentSmall).replace(/\t/g, addIndent);
				}

				assertEquals(objfmt(eval('('+testActual+')'), options), testExpected.trim());
			}
		}
	}
);
