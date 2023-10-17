import { decodeString } from "./base32";

// https://golang.org/src/encoding/base32/base32_test.go

const pairs = [
  // RFC 4648 examples
  ["", ""],
  ["f", "MY======"],
  ["fo", "MZXQ===="],
  ["foo", "MZXW6==="],
  ["foob", "MZXW6YQ="],
  ["fooba", "MZXW6YTB"],
  ["foobar", "MZXW6YTBOI======"],

  // Wikipedia examples, converted to base32
  ["sure.", "ON2XEZJO"],
  ["sure", "ON2XEZI="],
  ["sur", "ON2XE==="],
  ["su", "ON2Q===="],
  ["leasure.", "NRSWC43VOJSS4==="],
  ["easure.", "MVQXG5LSMUXA===="],
  ["asure.", "MFZXK4TFFY======"],
  ["sure.", "ON2XEZJO"],
];

test("TestDecoder", () => {
  pairs.forEach(function (p) {
    const result = Array.from(decodeString(p[1], true));

    const expected = Array.from(p[0]).map(function (v) {
      return v.charCodeAt(0);
    });

    expect(result).toEqual(expected);
  });
});

test("TestDecoder no padding", () => {
  pairs.forEach(function (p) {
    const result = Array.from(decodeString(p[1].replace(/=/g, "")));

    const expected = Array.from(p[0]).map(function (v) {
      return v.charCodeAt(0);
    });

    expect(result).toEqual(expected);
  });
});

test("TestDecodeCorrupt", () => {
  const corruptPairs = [
    ["", -1],
    ["!!!!", 0],
    ["x===", 0],
    ["AA=A====", 2],
    ["AAA=AAAA", 3],
    ["MMMMMMMMM", 8],
    ["MMMMMM", 0],
    ["A=", 1],
    ["AA=", 3],
    ["AA==", 4],
    ["AA===", 5],
    ["AAAA=", 5],
    ["AAAA==", 6],
    ["AAAAA=", 6],
    ["AAAAA==", 7],
    ["A=======", 1],
    ["AA======", -1],
    ["AAA=====", 3],
    ["AAAA====", -1],
    ["AAAAA===", -1],
    ["AAAAAA==", 6],
    ["AAAAAAA=", -1],
    ["AAAAAAAA", -1],
  ];

  corruptPairs.forEach(function (p) {
    try {
      decodeString(p[0] as string, true);
      if (p[1] === -1) {
        return;
      }
    } catch (e) {
      // we don't return the offset of the error right now so catch()
      // is good enough!
      return;
    }

    throw new Error(`Expected input ${p[0]} to throw, but it didn't.`);
  });
});
