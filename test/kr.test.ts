import {objfmt, IndentStyle, Options} from '../mod.ts';
import {DEFAULT_PREFER_LINE_WIDTH_LIMIT} from '../private/objfmt.ts';
import {assertEquals} from "https://deno.land/std@0.177.0/testing/asserts.ts";

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

{
	a: 1,
}

---

{
	a: 10,
	b: 11,
}

---

{
	a: 10,
	b: [],
}

---

{
	a: 10,
-	b: new CustomArray(),
+	b: CustomArray [],
}

---

{
	a: 10,
	b: [
		"b",
	],
}

---

{
	a: 10,
	b: [
		[],
		[
			"b0",
			"b1",
		],
	],
}

---

{
	a: 10,
-	b: new CustomArray('b'),
+	b: CustomArray [
+		"b",
+	],
}

---

{
	a: 10,
	b: [
		"b",
-		new Class0,
+		Class0 {},
	],
}

---

{
	a: 10,
	b: [
		"b",
-		new Class1('val0', 123),
+		Class1 {
+			prop0: "val0",
+			prop1: 123,
+		},
	],
}

---

{
	"*": 1,
-	"\0\x1B😀": "\0\x1B😀",
+	"\\x00\\x1B😀": "\\x00\\x1B😀",
}

--- preferLineWidthLimit=13

{
	arr: [
		1,
		2,
		3,
		4,
		5,
	],
}

--- preferLineWidthLimit=14

{
	arr: [
		1,  2,
		3,  4,
		5,
	],
}

--- preferLineWidthLimit=21

{
	arr: [
		1,  2,
		3,  4,
		5,
	],
}

--- preferLineWidthLimit=22

{
	arr: [
		1,  2,  3,  4,
		5,
	],
}

---

-new Class1('Quote is: "', 123)
+Class1 {
+	prop0: "Quote is: \\"",
+	prop1: 123,
+}

---

-'Quote is: "'
+"Quote is: \\""

--- stringAllowApos=true

'Quote is: "'

--- stringAllowBacktick=true

\`Quote is: "\`

--- stringAllowApos=true, stringAllowBacktick=true

'Quote is: "'

--- preferLineWidthLimit=17, longStringAsObject=true

{
	str: "12345",
}

--- preferLineWidthLimit=17, longStringAsObject=true

{
-	str: "123456",
+	str: string {
+		123456
+	},
}

---

{
-	set: new Set(['one', 'two']),
-	map: new Map([['one', 1], ['two', 2]]),
-	map2: new Map([[{key: 'one'}, 1], [{key: 'two'}, 2]]),
+	set: Set [
+		"one",
+		"two",
+	],
+	map: Map {
+		"one" => 1,
+		"two" => 2,
+	},
+	map2: Map {
+		{
+			key: "one",
+		} => 1,
+
+		{
+			key: "two",
+		} => 2,
+	},
}

--- preferLineWidthLimit=16, longStringAsObject=true

{
	"a&b": "a<b",
-	c: "a&b a<b",
+	c: string {
+		a&b a<b
+	},
}

--- preferLineWidthLimit=18, longStringAsObject=true, isHtml=true

{
-	"a&b": "a<b",
+	"a&amp;b": "a&lt;b",
-	c: "a&b a<b",
+	c: string {
+		a&amp;b a&lt;b
+	},
}
`;

Deno.test
(	'All',
	() =>
	{	for (const indentWidth of [-1, 0, 1, 3, 4, 8, 9, 10, 11])
		{	for (const str of TESTS.split('---'))
			{	const optionsStr = str.match(/^[^\r\n]*/)?.[0] ?? '';
				const code = str.slice(optionsStr.length);

				const options: Options = {indentWidth, indentStyle: IndentStyle.KR};
				optionsStr.replace(/stringAllowApos=(\w+)/, (_, w) => (options.stringAllowApos = w=='true')+'');
				optionsStr.replace(/stringAllowBacktick=(\w+)/, (_, w) => (options.stringAllowBacktick = w=='true')+'');
				optionsStr.replace(/longStringAsObject=(\w+)/, (_, w) => (options.longStringAsObject = w=='true')+'');
				optionsStr.replace(/isHtml=(\w+)/, (_, w) => (options.isHtml = w=='true')+'');
				optionsStr.replace(/preferLineWidthLimit=(\d+)/, (_, d) => (options.preferLineWidthLimit = +d)+'');
				if (options.preferLineWidthLimit!=DEFAULT_PREFER_LINE_WIDTH_LIMIT && indentWidth!=-1 && indentWidth!=4)
				{	continue;
				}

				const testActual = code.replace(/\r?\n\+[^\r\n]*/g, '').replace(/[\r\n]\-/g, m => m[0]);
				let testExpected = code.replace(/\r?\n\-[^\r\n]*/g, '').replace(/[\r\n]\+/g, m => m[0]);

				if (indentWidth>=0 && indentWidth<=10)
				{	const addIndent = ' '.repeat(indentWidth);
					const addIndentSmall = indentWidth==0 ? '' : ' '.repeat(indentWidth-1);
					testExpected = testExpected.replace(/\S\t/g, m => m[0]+addIndentSmall).replace(/\t/g, addIndent);
				}

				try
				{	assertEquals(objfmt(eval('('+testActual+')'), options), testExpected.trim());
				}
				catch (e)
				{	console.error(`Failed test: (indent width ${indentWidth})`);
					console.error(str.trim());
					console.error('------ Actual:');
					console.error(objfmt(eval('('+testActual+')'), options));
					console.error('------ Expected:');
					console.error(testExpected.trim());
					throw e;
				}
			}
		}
	}
);
