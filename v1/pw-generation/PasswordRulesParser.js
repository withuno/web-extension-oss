/* eslint-disable */
// Copyright (c) 2019 - 2021 Apple Inc. Licensed under MIT License.

"use strict";

if (!console) {
  console = {
    assert: function () {},
    error: function () {},
    warn: function () {},
  };
}

const Identifier = {
  ASCII_PRINTABLE: "ascii-printable",
  DIGIT: "digit",
  LOWER: "lower",
  SPECIAL: "special",
  UNICODE: "unicode",
  UPPER: "upper",
};

const RuleName = {
  ALLOWED: "allowed",
  MAX_CONSECUTIVE: "max-consecutive",
  REQUIRED: "required",
  MIN_LENGTH: "minlength",
  MAX_LENGTH: "maxlength",
};

const CHARACTER_CLASS_START_SENTINEL = "[";
const CHARACTER_CLASS_END_SENTINEL = "]";
const PROPERTY_VALUE_SEPARATOR = ",";
const PROPERTY_SEPARATOR = ";";
const PROPERTY_VALUE_START_SENTINEL = ":";

const SPACE_CODE_POINT = " ".codePointAt(0);

const SHOULD_NOT_BE_REACHED = "Should not be reached";

class Rule {
  constructor(name, value) {
    this._name = name;
    this.value = value;
  }
  get name() {
    return this._name;
  }
  toString() {
    return JSON.stringify(this);
  }
}

class NamedCharacterClass {
  constructor(name) {
    console.assert(_isValidRequiredOrAllowedPropertyValueIdentifier(name));
    this._name = name;
  }
  get name() {
    return this._name.toLowerCase();
  }
  toString() {
    return this._name;
  }
  toHTMLString() {
    return this._name;
  }
}

class CustomCharacterClass {
  constructor(characters) {
    console.assert(characters instanceof Array);
    this._characters = characters;
  }
  get characters() {
    return this._characters;
  }
  toString() {
    return `[${this._characters.join("")}]`;
  }
  toHTMLString() {
    return `[${this._characters.join("").replace('"', "&quot;")}]`;
  }
}

// MARK: Lexer functions

function _isIdentifierCharacter(c) {
  console.assert(c.length === 1);
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "-";
}

function _isASCIIDigit(c) {
  console.assert(c.length === 1);
  return c >= "0" && c <= "9";
}

function _isASCIIPrintableCharacter(c) {
  console.assert(c.length === 1);
  return c >= " " && c <= "~";
}

function _isASCIIWhitespace(c) {
  console.assert(c.length === 1);
  return c === " " || c === "\f" || c === "\n" || c === "\r" || c === "\t";
}

// MARK: ASCII printable character bit set and canonicalization functions

function _bitSetIndexForCharacter(c) {
  console.assert(c.length == 1);
  return c.codePointAt(0) - SPACE_CODE_POINT;
}

function _characterAtBitSetIndex(index) {
  return String.fromCodePoint(index + SPACE_CODE_POINT);
}

function _markBitsForNamedCharacterClass(bitSet, namedCharacterClass) {
  console.assert(bitSet instanceof Array);
  console.assert(namedCharacterClass.name !== Identifier.UNICODE);
  console.assert(namedCharacterClass.name !== Identifier.ASCII_PRINTABLE);
  if (namedCharacterClass.name === Identifier.UPPER) {
    bitSet.fill(
      true,
      _bitSetIndexForCharacter("A"),
      _bitSetIndexForCharacter("Z") + 1
    );
  } else if (namedCharacterClass.name === Identifier.LOWER) {
    bitSet.fill(
      true,
      _bitSetIndexForCharacter("a"),
      _bitSetIndexForCharacter("z") + 1
    );
  } else if (namedCharacterClass.name === Identifier.DIGIT) {
    bitSet.fill(
      true,
      _bitSetIndexForCharacter("0"),
      _bitSetIndexForCharacter("9") + 1
    );
  } else if (namedCharacterClass.name === Identifier.SPECIAL) {
    bitSet.fill(
      true,
      _bitSetIndexForCharacter(" "),
      _bitSetIndexForCharacter("/") + 1
    );
    bitSet.fill(
      true,
      _bitSetIndexForCharacter(":"),
      _bitSetIndexForCharacter("@") + 1
    );
    bitSet.fill(
      true,
      _bitSetIndexForCharacter("["),
      _bitSetIndexForCharacter("`") + 1
    );
    bitSet.fill(
      true,
      _bitSetIndexForCharacter("{"),
      _bitSetIndexForCharacter("~") + 1
    );
  } else {
    console.assert(false, SHOULD_NOT_BE_REACHED, namedCharacterClass);
  }
}

function _markBitsForCustomCharacterClass(bitSet, customCharacterClass) {
  for (let character of customCharacterClass.characters) {
    bitSet[_bitSetIndexForCharacter(character)] = true;
  }
}

function _canonicalizedPropertyValues(
  propertyValues,
  keepCustomCharacterClassFormatCompliant
) {
  let asciiPrintableBitSet = new Array(
    "~".codePointAt(0) - " ".codePointAt(0) + 1
  );

  for (let propertyValue of propertyValues) {
    if (propertyValue instanceof NamedCharacterClass) {
      if (propertyValue.name === Identifier.UNICODE) {
        return [new NamedCharacterClass(Identifier.UNICODE)];
      }

      if (propertyValue.name === Identifier.ASCII_PRINTABLE) {
        return [new NamedCharacterClass(Identifier.ASCII_PRINTABLE)];
      }

      _markBitsForNamedCharacterClass(asciiPrintableBitSet, propertyValue);
    } else if (propertyValue instanceof CustomCharacterClass) {
      _markBitsForCustomCharacterClass(asciiPrintableBitSet, propertyValue);
    }
  }

  let charactersSeen = [];

  function checkRange(start, end) {
    let temp = [];
    for (
      let i = _bitSetIndexForCharacter(start);
      i <= _bitSetIndexForCharacter(end);
      ++i
    ) {
      if (asciiPrintableBitSet[i]) {
        temp.push(_characterAtBitSetIndex(i));
      }
    }

    let result =
      temp.length ===
      _bitSetIndexForCharacter(end) - _bitSetIndexForCharacter(start) + 1;
    if (!result) {
      charactersSeen = charactersSeen.concat(temp);
    }
    return result;
  }

  let hasAllUpper = checkRange("A", "Z");
  let hasAllLower = checkRange("a", "z");
  let hasAllDigits = checkRange("0", "9");

  // Check for special characters, accounting for characters that are given special treatment (i.e. '-' and ']')
  let hasAllSpecial = false;
  let hasDash = false;
  let hasRightSquareBracket = false;
  let temp = [];
  for (
    let i = _bitSetIndexForCharacter(" ");
    i <= _bitSetIndexForCharacter("/");
    ++i
  ) {
    if (!asciiPrintableBitSet[i]) {
      continue;
    }

    let character = _characterAtBitSetIndex(i);
    if (keepCustomCharacterClassFormatCompliant && character === "-") {
      hasDash = true;
    } else {
      temp.push(character);
    }
  }
  for (
    let i = _bitSetIndexForCharacter(":");
    i <= _bitSetIndexForCharacter("@");
    ++i
  ) {
    if (asciiPrintableBitSet[i]) {
      temp.push(_characterAtBitSetIndex(i));
    }
  }
  for (
    let i = _bitSetIndexForCharacter("[");
    i <= _bitSetIndexForCharacter("`");
    ++i
  ) {
    if (!asciiPrintableBitSet[i]) {
      continue;
    }

    let character = _characterAtBitSetIndex(i);
    if (keepCustomCharacterClassFormatCompliant && character === "]") {
      hasRightSquareBracket = true;
    } else {
      temp.push(character);
    }
  }
  for (
    let i = _bitSetIndexForCharacter("{");
    i <= _bitSetIndexForCharacter("~");
    ++i
  ) {
    if (asciiPrintableBitSet[i]) {
      temp.push(_characterAtBitSetIndex(i));
    }
  }

  if (hasDash) {
    temp.unshift("-");
  }
  if (hasRightSquareBracket) {
    temp.push("]");
  }

  let numberOfSpecialCharacters =
    _bitSetIndexForCharacter("/") -
    _bitSetIndexForCharacter(" ") +
    1 +
    (_bitSetIndexForCharacter("@") - _bitSetIndexForCharacter(":") + 1) +
    (_bitSetIndexForCharacter("`") - _bitSetIndexForCharacter("[") + 1) +
    (_bitSetIndexForCharacter("~") - _bitSetIndexForCharacter("{") + 1);
  hasAllSpecial = temp.length === numberOfSpecialCharacters;
  if (!hasAllSpecial) {
    charactersSeen = charactersSeen.concat(temp);
  }

  let result = [];
  if (hasAllUpper && hasAllLower && hasAllDigits && hasAllSpecial) {
    return [new NamedCharacterClass(Identifier.ASCII_PRINTABLE)];
  }
  if (hasAllUpper) {
    result.push(new NamedCharacterClass(Identifier.UPPER));
  }
  if (hasAllLower) {
    result.push(new NamedCharacterClass(Identifier.LOWER));
  }
  if (hasAllDigits) {
    result.push(new NamedCharacterClass(Identifier.DIGIT));
  }
  if (hasAllSpecial) {
    result.push(new NamedCharacterClass(Identifier.SPECIAL));
  }
  if (charactersSeen.length) {
    result.push(new CustomCharacterClass(charactersSeen));
  }
  return result;
}

// MARK: Parser functions

function _indexOfNonWhitespaceCharacter(input, position = 0) {
  console.assert(position >= 0);
  console.assert(position <= input.length);

  let length = input.length;
  while (position < length && _isASCIIWhitespace(input[position])) ++position;

  return position;
}

function _parseIdentifier(input, position) {
  console.assert(position >= 0);
  console.assert(position < input.length);
  console.assert(_isIdentifierCharacter(input[position]));

  let length = input.length;
  let seenIdentifiers = [];
  do {
    let c = input[position];
    if (!_isIdentifierCharacter(c)) {
      break;
    }

    seenIdentifiers.push(c);
    ++position;
  } while (position < length);

  return [seenIdentifiers.join(""), position];
}

function _isValidRequiredOrAllowedPropertyValueIdentifier(identifier) {
  return (
    identifier && Object.values(Identifier).includes(identifier.toLowerCase())
  );
}

function _parseCustomCharacterClass(input, position) {
  console.assert(position >= 0);
  console.assert(position < input.length);
  console.assert(input[position] === CHARACTER_CLASS_START_SENTINEL);

  let length = input.length;
  ++position;
  if (position >= length) {
    console.error("Found end-of-line instead of character class character");
    return [null, position];
  }

  let initialPosition = position;
  let result = [];
  do {
    let c = input[position];
    if (!_isASCIIPrintableCharacter(c)) {
      ++position;
      continue;
    }

    if (c === "-" && position - initialPosition > 0) {
      // FIXME: Should this be an error?
      console.warn(
        "Ignoring '-'; a '-' may only appear as the first character in a character class"
      );
      ++position;
      continue;
    }

    result.push(c);
    ++position;
    if (c === CHARACTER_CLASS_END_SENTINEL) {
      break;
    }
  } while (position < length);

  if (
    (position < length && input[position] !== CHARACTER_CLASS_END_SENTINEL) ||
    (position == length && input[position - 1] == CHARACTER_CLASS_END_SENTINEL)
  ) {
    // Fix up result; we over consumed.
    result.pop();
    return [result, position];
  }

  if (position < length && input[position] == CHARACTER_CLASS_END_SENTINEL) {
    return [result, position + 1];
  }

  console.error("Found end-of-line instead of end of character class");
  return [null, position];
}

function _parsePasswordRequiredOrAllowedPropertyValue(input, position) {
  console.assert(position >= 0);
  console.assert(position < input.length);

  let length = input.length;
  let propertyValues = [];
  while (true) {
    if (_isIdentifierCharacter(input[position])) {
      let identifierStartPosition = position;
      var [propertyValue, position] = _parseIdentifier(input, position);
      if (!_isValidRequiredOrAllowedPropertyValueIdentifier(propertyValue)) {
        console.error(
          "Unrecognized property value identifier: " + propertyValue
        );
        return [null, identifierStartPosition];
      }
      propertyValues.push(new NamedCharacterClass(propertyValue));
    } else if (input[position] == CHARACTER_CLASS_START_SENTINEL) {
      var [propertyValue, position] = _parseCustomCharacterClass(
        input,
        position
      );
      if (propertyValue && propertyValue.length) {
        propertyValues.push(new CustomCharacterClass(propertyValue));
      }
    } else {
      console.error(
        "Failed to find start of property value: " + input.substr(position)
      );
      return [null, position];
    }

    position = _indexOfNonWhitespaceCharacter(input, position);
    if (position >= length || input[position] === PROPERTY_SEPARATOR) {
      break;
    }

    if (input[position] === PROPERTY_VALUE_SEPARATOR) {
      position = _indexOfNonWhitespaceCharacter(input, position + 1);
      if (position >= length) {
        console.error(
          "Found end-of-line instead of start of next property value"
        );
        return [null, position];
      }
      continue;
    }

    console.error(
      "Failed to find start of next property or property value: " +
        input.substr(position)
    );
    return [null, position];
  }
  return [propertyValues, position];
}

function _parsePasswordRule(input, position) {
  console.assert(position >= 0);
  console.assert(position < input.length);
  console.assert(_isIdentifierCharacter(input[position]));

  let length = input.length;

  var mayBeIdentifierStartPosition = position;
  var [identifier, position] = _parseIdentifier(input, position);
  if (!Object.values(RuleName).includes(identifier)) {
    console.error("Unrecognized property name: " + identifier);
    return [null, mayBeIdentifierStartPosition];
  }

  if (position >= length) {
    console.error("Found end-of-line instead of start of property value");
    return [null, position];
  }

  if (input[position] !== PROPERTY_VALUE_START_SENTINEL) {
    console.error(
      "Failed to find start of property value: " + input.substr(position)
    );
    return [null, position];
  }

  let property = { name: identifier, value: null };

  position = _indexOfNonWhitespaceCharacter(input, position + 1);
  // Empty value
  if (position >= length || input[position] === PROPERTY_SEPARATOR) {
    return [new Rule(property.name, property.value), position];
  }

  switch (identifier) {
    case RuleName.ALLOWED:
    case RuleName.REQUIRED: {
      var [propertyValue, position] =
        _parsePasswordRequiredOrAllowedPropertyValue(input, position);
      if (propertyValue) {
        property.value = propertyValue;
      }
      return [new Rule(property.name, property.value), position];
    }
    case RuleName.MAX_CONSECUTIVE: {
      var [propertyValue, position] = _parseMaxConsecutivePropertyValue(
        input,
        position
      );
      if (propertyValue) {
        property.value = propertyValue;
      }
      return [new Rule(property.name, property.value), position];
    }
    case RuleName.MIN_LENGTH:
    case RuleName.MAX_LENGTH: {
      var [propertyValue, position] = _parseMinLengthMaxLengthPropertyValue(
        input,
        position
      );
      if (propertyValue) {
        property.value = propertyValue;
      }
      return [new Rule(property.name, property.value), position];
    }
  }
  console.assert(false, SHOULD_NOT_BE_REACHED);
}

function _parseMinLengthMaxLengthPropertyValue(input, position) {
  return _parseInteger(input, position);
}

function _parseMaxConsecutivePropertyValue(input, position) {
  return _parseInteger(input, position);
}

function _parseInteger(input, position) {
  console.assert(position >= 0);
  console.assert(position < input.length);

  if (!_isASCIIDigit(input[position])) {
    console.error(
      "Failed to parse value of type integer; not a number: " +
        input.substr(position)
    );
    return [null, position];
  }

  let length = input.length;
  let initialPosition = position;
  let result = 0;
  do {
    result = 10 * result + parseInt(input[position], 10);
    ++position;
  } while (
    position < length &&
    input[position] !== PROPERTY_SEPARATOR &&
    _isASCIIDigit(input[position])
  );

  if (position >= length || input[position] === PROPERTY_SEPARATOR) {
    return [result, position];
  }

  console.error(
    "Failed to parse value of type integer; not a number: " +
      input.substr(initialPosition)
  );
  return [null, position];
}

function _parsePasswordRulesInternal(input) {
  let parsedProperties = [];
  let length = input.length;

  var position = _indexOfNonWhitespaceCharacter(input);
  while (position < length) {
    if (!_isIdentifierCharacter(input[position])) {
      console.warn(
        "Failed to find start of property: " + input.substr(position)
      );
      return parsedProperties;
    }

    var [parsedProperty, position] = _parsePasswordRule(input, position);
    if (parsedProperty && parsedProperty.value) {
      parsedProperties.push(parsedProperty);
    }

    position = _indexOfNonWhitespaceCharacter(input, position);
    if (position >= length) {
      break;
    }

    if (input[position] === PROPERTY_SEPARATOR) {
      position = _indexOfNonWhitespaceCharacter(input, position + 1);
      if (position >= length) {
        return parsedProperties;
      }

      continue;
    }

    console.error(
      "Failed to find start of next property: " + input.substr(position)
    );
    return null;
  }

  return parsedProperties;
}

function parsePasswordRules(input, formatRulesForMinifiedVersion) {
  let passwordRules = _parsePasswordRulesInternal(input) || [];

  // When formatting rules for minified version, we should keep the formatted rules
  // as similar to the input as possible. Avoid copying required rules to allowed rules.
  let suppressCopyingRequiredToAllowed = formatRulesForMinifiedVersion;

  let newPasswordRules = [];
  let newAllowedValues = [];
  let minimumMaximumConsecutiveCharacters = null;
  let maximumMinLength = 0;
  let minimumMaxLength = null;

  for (let rule of passwordRules) {
    switch (rule.name) {
      case RuleName.MAX_CONSECUTIVE:
        minimumMaximumConsecutiveCharacters =
          minimumMaximumConsecutiveCharacters
            ? Math.min(rule.value, minimumMaximumConsecutiveCharacters)
            : rule.value;
        break;

      case RuleName.MIN_LENGTH:
        maximumMinLength = Math.max(rule.value, maximumMinLength);
        break;

      case RuleName.MAX_LENGTH:
        minimumMaxLength = minimumMaxLength
          ? Math.min(rule.value, minimumMaxLength)
          : rule.value;
        break;

      case RuleName.REQUIRED:
        rule.value = _canonicalizedPropertyValues(
          rule.value,
          formatRulesForMinifiedVersion
        );
        newPasswordRules.push(rule);
        if (!suppressCopyingRequiredToAllowed) {
          newAllowedValues = newAllowedValues.concat(rule.value);
        }
        break;

      case RuleName.ALLOWED:
        newAllowedValues = newAllowedValues.concat(rule.value);
        break;
    }
  }

  newAllowedValues = _canonicalizedPropertyValues(
    newAllowedValues,
    suppressCopyingRequiredToAllowed
  );
  if (!suppressCopyingRequiredToAllowed && !newAllowedValues.length) {
    newAllowedValues = [new NamedCharacterClass(Identifier.ASCII_PRINTABLE)];
  }
  if (newAllowedValues.length) {
    newPasswordRules.push(new Rule(RuleName.ALLOWED, newAllowedValues));
  }

  if (minimumMaximumConsecutiveCharacters !== null) {
    newPasswordRules.push(
      new Rule(RuleName.MAX_CONSECUTIVE, minimumMaximumConsecutiveCharacters)
    );
  }

  if (maximumMinLength > 0) {
    newPasswordRules.push(new Rule(RuleName.MIN_LENGTH, maximumMinLength));
  }

  if (minimumMaxLength !== null) {
    newPasswordRules.push(new Rule(RuleName.MAX_LENGTH, minimumMaxLength));
  }

  return newPasswordRules;
}

function _scanSetFromCharacterClass(characterClass) {
  if (characterClass instanceof CustomCharacterClass)
    return characterClass.characters;
  console.assert(characterClass instanceof NamedCharacterClass);
  switch (characterClass.name) {
    case Identifier.ASCII_PRINTABLE:
    case Identifier.UNICODE:
      return SCAN_SET_ORDER.split("");
    case Identifier.DIGIT:
      return SCAN_SET_ORDER.substring(
        SCAN_SET_ORDER.indexOf("0"),
        SCAN_SET_ORDER.indexOf("9") + 1
      ).split("");
    case Identifier.LOWER:
      return SCAN_SET_ORDER.substring(
        SCAN_SET_ORDER.indexOf("a"),
        SCAN_SET_ORDER.indexOf("z") + 1
      ).split("");
    case Identifier.SPECIAL:
      return SCAN_SET_ORDER.substring(
        SCAN_SET_ORDER.indexOf("-"),
        SCAN_SET_ORDER.indexOf("]") + 1
      ).split("");
    case Identifier.UPPER:
      return SCAN_SET_ORDER.substring(
        SCAN_SET_ORDER.indexOf("A"),
        SCAN_SET_ORDER.indexOf("Z") + 1
      ).split("");
  }
  console.assert(false, SHOULD_NOT_BE_REACHED);
}

function _charactersFromCharactersClasses(characterClasses) {
  return characterClasses.reduce(
    (scanSet, currentCharacterClass) =>
      scanSet.concat(_scanSetFromCharacterClass(currentCharacterClass)),
    []
  );
}

const SCAN_SET_ORDER =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-~!@#$%^&*_+=`|(){}[:;\\\"'<>,.?/ ]";

function _canonicalizedScanSetFromCharacters(characters) {
  if (!characters.length) return "";
  let shadowCharacters = Array.prototype.slice.call(characters); // Make a copy so that we do not mutate |characters|.
  shadowCharacters.sort(
    (a, b) => SCAN_SET_ORDER.indexOf(a) - SCAN_SET_ORDER.indexOf(b)
  );
  let uniqueCharacters = [shadowCharacters[0]];
  for (let i = 1, length = shadowCharacters.length; i < length; ++i) {
    if (shadowCharacters[i] === shadowCharacters[i - 1]) continue;
    uniqueCharacters.push(shadowCharacters[i]);
  }
  return uniqueCharacters.join("");
}

export function safariQuirkFromPasswordRules(input) {
  let result = {};
  let passwordRules = parsePasswordRules(input);
  for (let rule of passwordRules) {
    if (rule.name === RuleName.ALLOWED) {
      console.assert(!("PasswordAllowedCharacters" in result));
      let scanSet = _canonicalizedScanSetFromCharacters(
        _charactersFromCharactersClasses(rule.value)
      );
      if (scanSet) result["PasswordAllowedCharacters"] = scanSet;
    } else if (rule.name === RuleName.MAX_CONSECUTIVE) {
      console.assert(!("PasswordRepeatedCharacterLimit" in result));
      result["PasswordRepeatedCharacterLimit"] = rule.value;
    } else if (rule.name === RuleName.REQUIRED) {
      let requiredCharacters = result["PasswordRequiredCharacters"];
      if (!requiredCharacters)
        requiredCharacters = result["PasswordRequiredCharacters"] = [];
      requiredCharacters.push(
        _canonicalizedScanSetFromCharacters(
          _charactersFromCharactersClasses(rule.value)
        )
      );
    } else if (rule.name === RuleName.MIN_LENGTH) {
      result["PasswordMinLength"] = rule.value;
    } else if (rule.name === RuleName.MAX_LENGTH) {
      result["PasswordMaxLength"] = rule.value;
    }
  }

  // Only include an allowed rule matching SCAN_SET_ORDER (all characters) when a required rule is also present.
  if (
    result["PasswordAllowedCharacters"] == SCAN_SET_ORDER &&
    !result["PasswordRequiredCharacters"]
  )
    delete result["PasswordAllowedCharacters"];

  // Fix up PasswordRequiredCharacters, if needed.
  if (
    result["PasswordRequiredCharacters"] &&
    result["PasswordRequiredCharacters"].length === 1 &&
    result["PasswordRequiredCharacters"][0] === SCAN_SET_ORDER
  )
    delete result["PasswordRequiredCharacters"];

  return Object.keys(result).length ? result : null;
}

var FormatAs = {
  HTML: 0,
  UIKit: 1,
};

function minifiedBasePasswordRules(input, formatAsType) {
  let pieces = [];
  let passwordRules = parsePasswordRules(input, true);
  for (rule of passwordRules) {
    let ruleValue;
    if (
      formatAsType == FormatAs.HTML &&
      (rule.name === RuleName.ALLOWED || rule.name === RuleName.REQUIRED)
    ) {
      ruleValue = rule.value.map((characterClass) =>
        characterClass.toHTMLString()
      );
    } else ruleValue = rule.value;
    pieces.push(`${rule.name}: ${ruleValue};`);
  }
  return pieces.join(" ");
}

const defaultUnambiguousCharacters =
  "abcdefghijkmnopqrstuvwxyzABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";

const defaultNumberOfCharactersForClassicPassword = 12;
const defaultClassicPasswordLength = 15;

const defaultNumberOfCharactersForMoreTypeablePassword = 18;
const defaultMoreTypeablePasswordLength = 20;
const defaultAllowedNumbers = "0123456789";
const defaultAllowedLowercaseConsonants = "bcdfghjkmnpqrstvwxz";
const defaultAllowedLowercaseVowels = "aeiouy";

var PasswordGenerationStyle = {
  Classic: 1,
  ClassicWithoutDashes: 2,
  MoreTypeable: 3,
  MoreTypeableWithoutDashes: 4,
};

function randomNumberWithUniformDistribution(range) {
  // Based on the algorithn described in https://pthree.org/2018/06/13/why-the-multiply-and-floor-rng-method-is-biased/
  var max = Math.floor(2 ** 32 / range) * range;
  do {
    var x = window.crypto.getRandomValues(new Uint32Array(1))[0];
  } while (x >= max);

  return x % range;
}

function randomConsonant() {
  var index = randomNumberWithUniformDistribution(
    defaultAllowedLowercaseConsonants.length
  );
  return defaultAllowedLowercaseConsonants[index];
}

function randomVowel() {
  var index = randomNumberWithUniformDistribution(
    defaultAllowedLowercaseVowels.length
  );
  return defaultAllowedLowercaseVowels[index];
}

function randomNumber() {
  var index = randomNumberWithUniformDistribution(defaultAllowedNumbers.length);
  return defaultAllowedNumbers[index];
}

function randomSyllable() {
  return randomConsonant() + randomVowel() + randomConsonant();
}

function _moreTypeablePassword() {
  var password =
    randomSyllable() +
    randomSyllable() +
    randomSyllable() +
    randomSyllable() +
    randomSyllable() +
    randomConsonant() +
    randomVowel();
  var length = password.length;
  while (true) {
    var index = randomNumberWithUniformDistribution(length);
    var lowercaseChar = password.charAt(index);
    if (lowercaseChar === "o") continue;

    var uppercaseChar = lowercaseChar.toUpperCase();
    password =
      password.substr(0, index) + uppercaseChar + password.substr(index + 1);

    var numberPos = randomNumberWithUniformDistribution(5);
    var passwordSegment1 = password.substr(0, 6);
    var passwordSegment2 = password.substr(6, 6);
    var passwordSegment3 = password.substr(12, 5);
    switch (numberPos) {
      case 0:
        return (
          passwordSegment3 +
          randomNumber() +
          passwordSegment1 +
          passwordSegment2
        );
      case 1:
        return (
          passwordSegment1 +
          randomNumber() +
          passwordSegment3 +
          passwordSegment2
        );
      case 2:
        return (
          passwordSegment1 +
          passwordSegment3 +
          randomNumber() +
          passwordSegment2
        );
      case 3:
        return (
          passwordSegment1 +
          passwordSegment2 +
          randomNumber() +
          passwordSegment3
        );
      case 4:
        return (
          passwordSegment1 +
          passwordSegment2 +
          passwordSegment3 +
          randomNumber()
        );
    }
  }
}

function _classicPassword(numberOfRequiredRandomCharacters, allowedCharacters) {
  var length = allowedCharacters.length;
  var randomCharArray = Array(numberOfRequiredRandomCharacters);
  for (var i = 0; i < numberOfRequiredRandomCharacters; i++) {
    var index = randomNumberWithUniformDistribution(length);
    randomCharArray[i] = allowedCharacters[index];
  }
  return randomCharArray.join("");
}

function _passwordHasNotExceededConsecutiveCharLimit(
  password,
  consecutiveCharLimit
) {
  var longestConsecutiveCharLength = 1;
  var firstConsecutiveCharIndex = 0;
  // Both "123" or "abc" and "321" or "cba" are considered consecutive.
  var isSequenceAscending;
  for (var i = 1; i < password.length; i++) {
    var currCharCode = password.charCodeAt(i);
    var prevCharCode = password.charCodeAt(i - 1);
    if (isSequenceAscending) {
      // If `isSequenceAscending` is defined, then we know that we are in the middle of an existing
      // pattern. Check if the pattern continues based on whether the previous pattern was
      // ascending or descending.
      if (
        (isSequenceAscending.valueOf() && currCharCode == prevCharCode + 1) ||
        (!isSequenceAscending.valueOf() && currCharCode == prevCharCode - 1)
      )
        continue;

      // Take into account the case when the sequence transitions from descending
      // to ascending.
      if (currCharCode == prevCharCode + 1) {
        firstConsecutiveCharIndex = i - 1;
        isSequenceAscending = Boolean(true);
        continue;
      }

      // Take into account the case when the sequence transitions from ascending
      // to descending.
      if (currCharCode == prevCharCode - 1) {
        firstConsecutiveCharIndex = i - 1;
        isSequenceAscending = Boolean(false);
        continue;
      }

      isSequenceAscending = null;
    } else if (currCharCode == prevCharCode + 1) {
      isSequenceAscending = Boolean(true);
      continue;
    } else if (currCharCode == prevCharCode - 1) {
      isSequenceAscending = Boolean(false);
      continue;
    }

    var currConsecutiveCharLength = i - firstConsecutiveCharIndex;
    if (currConsecutiveCharLength > longestConsecutiveCharLength)
      longestConsecutiveCharLength = currConsecutiveCharLength;

    firstConsecutiveCharIndex = i;
  }

  if (isSequenceAscending) {
    var currConsecutiveCharLength = password.length - firstConsecutiveCharIndex;
    if (currConsecutiveCharLength > longestConsecutiveCharLength)
      longestConsecutiveCharLength = currConsecutiveCharLength;
  }

  return longestConsecutiveCharLength <= consecutiveCharLimit;
}

function _passwordHasNotExceededRepeatedCharLimit(password, repeatedCharLimit) {
  var longestRepeatedCharLength = 1;
  var lastRepeatedChar = password.charAt(0);
  var lastRepeatedCharIndex = 0;
  for (var i = 1; i < password.length; i++) {
    var currChar = password.charAt(i);
    if (currChar === lastRepeatedChar) continue;

    var currRepeatedCharLength = i - lastRepeatedCharIndex;
    if (currRepeatedCharLength > longestRepeatedCharLength)
      longestRepeatedCharLength = currRepeatedCharLength;

    lastRepeatedChar = currChar;
    lastRepeatedCharIndex = i;
  }
  return longestRepeatedCharLength <= repeatedCharLimit;
}

function _passwordContainsRequiredCharacters(password, requiredCharacterSets) {
  var requiredCharacterSetsLength = requiredCharacterSets.length;
  var passwordLength = password.length;
  for (var i = 0; i < requiredCharacterSetsLength; i++) {
    var requiredCharacterSet = requiredCharacterSets[i];
    var hasRequiredChar = false;
    for (var j = 0; j < passwordLength; j++) {
      var char = password.charAt(j);
      if (requiredCharacterSet.indexOf(char) !== -1) {
        hasRequiredChar = true;
        break;
      }
    }
    if (!hasRequiredChar) return false;
  }
  return true;
}

function _defaultRequiredCharacterSets() {
  return [
    "abcdefghijklmnopqrstuvwxyz",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "0123456789",
  ];
}

function _stringContainsAllCharactersInString(string1, string2) {
  var length = string2.length;
  for (var i = 0; i < length; i++) {
    var character = string2.charAt(i);
    if (string1.indexOf(character) === -1) return false;
  }
  return true;
}

function _stringsHaveAtLeastOneCommonCharacter(string1, string2) {
  var string2Length = string2.length;
  for (var i = 0; i < string2Length; i++) {
    var char = string2.charAt(i);
    if (string1.indexOf(char) !== -1) return true;
  }

  return false;
}

function _canUseMoreTypeablePasswordFromRequirements(
  minPasswordLength,
  maxPasswordLength,
  allowedCharacters,
  requiredCharacterSets
) {
  if (
    minPasswordLength > defaultMoreTypeablePasswordLength ||
    (maxPasswordLength && maxPasswordLength < defaultMoreTypeablePasswordLength)
  )
    return false;

  if (
    allowedCharacters &&
    !_stringContainsAllCharactersInString(
      allowedCharacters,
      defaultUnambiguousCharacters
    )
  )
    return false;

  var requiredCharacterSetsLength = requiredCharacterSets.length;
  if (requiredCharacterSetsLength > defaultMoreTypeablePasswordLength)
    return false;

  // FIXME: This doesn't handle returning false to a password that requires two or more special characters.
  let numberOfDigitsThatAreRequired = 0;
  let numberOfUpperThatAreRequired = 0;
  for (let requiredCharacterSet of requiredCharacterSets) {
    if (requiredCharacterSet === "0123456789") numberOfDigitsThatAreRequired++;
    if (requiredCharacterSet === "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
      numberOfUpperThatAreRequired++;
  }

  if (numberOfDigitsThatAreRequired > 1) return false;
  if (numberOfUpperThatAreRequired > 1) return false;

  var defaultUnambiguousCharactersPlusDash = defaultUnambiguousCharacters + "-";
  for (var i = 0; i < requiredCharacterSetsLength; i++) {
    var requiredCharacterSet = requiredCharacterSets[i];
    if (
      !_stringsHaveAtLeastOneCommonCharacter(
        requiredCharacterSet,
        defaultUnambiguousCharactersPlusDash
      )
    )
      return false;
  }

  return true;
}

function _passwordGenerationParametersDictionary(requirements) {
  var minPasswordLength = requirements["PasswordMinLength"];
  var maxPasswordLength = requirements["PasswordMaxLength"];

  if (minPasswordLength > maxPasswordLength) {
    // Resetting invalid value of min length to zero means "ignore min length parameter in password generation".
    minPasswordLength = 0;
  }

  var allowedCharacters = requirements["PasswordAllowedCharacters"];

  var requiredCharacterArray = requirements["PasswordRequiredCharacters"];
  var requiredCharacterSets = _defaultRequiredCharacterSets();
  if (requiredCharacterArray) {
    var mutatedRequiredCharacterSets = [];
    var requiredCharacterArrayLength = requiredCharacterArray.length;
    for (var i = 0; i < requiredCharacterArrayLength; i++) {
      var requiredCharacters = requiredCharacterArray[i];
      if (
        _stringsHaveAtLeastOneCommonCharacter(
          requiredCharacters,
          allowedCharacters
        )
      )
        mutatedRequiredCharacterSets.push(requiredCharacters);
    }
    requiredCharacterSets = mutatedRequiredCharacterSets;
  }

  var canUseMoreTypeablePassword = _canUseMoreTypeablePasswordFromRequirements(
    minPasswordLength,
    maxPasswordLength,
    allowedCharacters,
    requiredCharacterSets
  );
  if (canUseMoreTypeablePassword) {
    var style = PasswordGenerationStyle.MoreTypeable;
    if (allowedCharacters && allowedCharacters.indexOf("-") === -1)
      style = PasswordGenerationStyle.MoreTypeableWithoutDashes;

    return { PasswordGenerationStyle: style };
  }

  // If requirements allow, we will generate the password in default format: "xxx-xxx-xxx-xxx".
  var style = PasswordGenerationStyle.Classic;
  var numberOfRequiredRandomCharacters =
    defaultNumberOfCharactersForClassicPassword;
  if (minPasswordLength && minPasswordLength > defaultClassicPasswordLength) {
    style = PasswordGenerationStyle.ClassicWithoutDashes;
    numberOfRequiredRandomCharacters = minPasswordLength;
  }

  if (maxPasswordLength && maxPasswordLength < defaultClassicPasswordLength) {
    style = PasswordGenerationStyle.ClassicWithoutDashes;
    numberOfRequiredRandomCharacters = maxPasswordLength;
  }

  if (allowedCharacters) {
    // We cannot use default format if dash is not an allowed character in the password.
    if (allowedCharacters.indexOf("-") === -1)
      style = PasswordGenerationStyle.ClassicWithoutDashes;
  } else allowedCharacters = defaultUnambiguousCharacters;

  // In default password format, we use dashes only as separators, not as symbols you can encounter at a random position.
  if (style == PasswordGenerationStyle.Classic)
    allowedCharacters = allowedCharacters.replace(/-/g, "");

  if (!requiredCharacterSets)
    requiredCharacterSets = _defaultRequiredCharacterSets();

  // If we have more requirements of the type "need a character from set" than the length of the password we want to generate, then
  // we will never be able to meet these requirements, and we'll end up in an infinite loop generating passwords. To avoid this,
  // reset required character sets if the requirements are impossible to meet.
  if (requiredCharacterSets.length > numberOfRequiredRandomCharacters) {
    requiredCharacterSets = null;
  }

  // Do not require any character sets that do not contain allowed characters.
  var requiredCharacterSetsLength = requiredCharacterSets.length;
  var mutatedRequiredCharacterSets = [];
  var allowedCharactersLength = allowedCharacters.length;
  for (var i = 0; i < requiredCharacterSetsLength; i++) {
    var requiredCharacterSet = requiredCharacterSets[i];
    var requiredCharacterSetContainsAllowedCharacters = false;
    for (var j = 0; j < allowedCharactersLength; j++) {
      var character = allowedCharacters.charAt(j);
      if (requiredCharacterSet.indexOf(character) !== -1) {
        requiredCharacterSetContainsAllowedCharacters = true;
        break;
      }
    }
    if (requiredCharacterSetContainsAllowedCharacters)
      mutatedRequiredCharacterSets.push(requiredCharacterSet);
  }
  requiredCharacterSets = mutatedRequiredCharacterSets;

  return {
    PasswordGenerationStyle: style,
    NumberOfRequiredRandomCharacters: numberOfRequiredRandomCharacters,
    PasswordAllowedCharacters: allowedCharacters,
    RequiredCharacterSets: requiredCharacterSets,
  };
}

export function generatedPasswordMatchingRequirements(requirements) {
  requirements = requirements ? requirements : {};

  var parameters = _passwordGenerationParametersDictionary(requirements);
  var style = parameters["PasswordGenerationStyle"];
  var numberOfRequiredRandomCharacters =
    parameters["NumberOfRequiredRandomCharacters"];
  var repeatedCharLimit = requirements["PasswordRepeatedCharacterLimit"];
  var allowedCharacters = parameters["PasswordAllowedCharacters"];
  var shouldCheckRepeatedCharRequirement = repeatedCharLimit ? true : false;

  while (true) {
    var password;
    switch (style) {
      case PasswordGenerationStyle.Classic:
      case PasswordGenerationStyle.ClassicWithoutDashes:
        password = _classicPassword(
          numberOfRequiredRandomCharacters,
          allowedCharacters
        );
        if (style === PasswordGenerationStyle.Classic)
          password =
            password.substr(0, 3) +
            "-" +
            password.substr(3, 3) +
            "-" +
            password.substr(6, 3) +
            "-" +
            password.substr(9, 3);

        if (
          !_passwordContainsRequiredCharacters(
            password,
            parameters["RequiredCharacterSets"]
          )
        )
          continue;

        break;
      case PasswordGenerationStyle.MoreTypeable:
      case PasswordGenerationStyle.MoreTypeableWithoutDashes:
        password = _moreTypeablePassword();
        if (style === PasswordGenerationStyle.MoreTypeable)
          password =
            password.substr(0, 6) +
            "-" +
            password.substr(6, 6) +
            "-" +
            password.substr(12, 6);

        if (shouldCheckRepeatedCharRequirement && repeatedCharLimit !== 1)
          shouldCheckRepeatedCharRequirement = false;

        break;
    }

    if (shouldCheckRepeatedCharRequirement) {
      if (
        repeatedCharLimit >= 1 &&
        !_passwordHasNotExceededRepeatedCharLimit(password, repeatedCharLimit)
      )
        continue;
    }

    var consecutiveCharLimit =
      requirements["PasswordConsecutiveCharacterLimit"];
    if (consecutiveCharLimit) {
      if (
        consecutiveCharLimit >= 1 &&
        !_passwordHasNotExceededConsecutiveCharLimit(
          password,
          consecutiveCharLimit
        )
      )
        continue;
    }

    return password;
  }
}
