import { parseOtpInput } from "./totp";

type test = { input: string; expected: string | null };

// python3
// import base64
// base64.b64encode(base64.b32decode("JBSWY3DPEHPK3PXP"))
// ...
const tests: Array<test> = [
  {
    input: "otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example",
    expected: "SGVsbG8h3q2+7w==",
  },
  {
    input:
      "otpauth://totp/ACME%20Co:john.doe@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30",
    expected: "PcbKpIJKbSiHZ7IzHiC0MWbLhdk=",
  },
  {
    input: "3MBGGW3M6DPUDTVZVW2UGULRYQYGJ7WR",
    expected: "2wJjW2zw30HOua21Q1FxxDBk/tE=",
  },
  {
    input: "",
    expected: null,
  },
  {
    input: "otpauth://hotp/Example:alice@google.com",
    expected: null,
  },
  {
    input: "999zzzz",
    expected: null,
  },
];

test("TextParseOtpInput", () => {
  tests.forEach(function (t) {
    const result = parseOtpInput(t.input);

    expect(result).toEqual(t.expected);
  });
});
