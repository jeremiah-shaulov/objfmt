import {objfmt, IndentStyle} from '../mod.ts';
import {assertEquals} from "https://deno.land/std@0.176.0/testing/asserts.ts";

// deno-lint-ignore no-explicit-any
type Any = any;

class Class0
{
}

class Class1
{	constructor(public prop0: string, public prop1: number)
	{
	}
}

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
	b:
	[
		"b",
	],
}

---

{
	a: 10,
	b:
	[
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
+	b: CustomArray
+	[
+		"b",
+	],
}

---

{
	a: 10,
	b:
	[
		"b",
-		new Class0,
+		Class0 {},
	],
}

---

{
	a: 10,
	b:
	[
		"b",
-		new Class1('val0', 123),
+		Class1
+		{
+			prop0: "val0",
+			prop1: 123,
+		},
	],
}

---

{
	"*": 1,
}
`;

Deno.test
(	'All',
	() =>
	{	for (const indentWidth of [-1, 0, 1, 3, 4, 8, 9, 10, 11])
		{	for (const str of TESTS.split('---'))
			{	const testActual = str.replace(/\r?\n\+[^\r\n]*/g, '').replace(/[\r\n]\-/g, m => m[0]);
				let testExpected = str.replace(/\r?\n\-[^\r\n]*/g, '').replace(/[\r\n]\+/g, m => m[0]);
				if (indentWidth>=0 && indentWidth<=10)
				{	const addIndent = ' '.repeat(indentWidth);
					const addIndentSmall = indentWidth==0 ? '' : ' '.repeat(indentWidth-1);
					testExpected = testExpected.replace(/\S\t/g, m => m[0]+addIndentSmall).replace(/\t/g, addIndent);
				}
				assertEquals(objfmt(eval('('+testActual+')'), {indentWidth, indentStyle: IndentStyle.Allman}), testExpected.trim());
			}
		}
	}
);