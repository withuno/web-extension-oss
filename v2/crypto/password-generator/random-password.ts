import { Password, PasswordRequirement } from "./password-generator.types";
import { generatedPasswordMatchingRequirements, safariQuirkFromPasswordRules } from "./password-rules-parser";

/**
 * Generates a cryptographically-random, high-entropy, totally-garbled password.
 */
export function generateRandomPassword(
  size: number,
  requirements: Array<PasswordRequirement.Numbers | PasswordRequirement.Symbols> = [],
) {
  const quirks = [`minlength: ${size};`, `maxlength: ${size};`, "allowed: lower,upper;"];

  if (requirements?.includes(PasswordRequirement.Numbers)) {
    quirks.push("required: digit;");
  }

  if (requirements?.includes(PasswordRequirement.Symbols)) {
    quirks.push("required: special;");
  }

  return new Password(generatePasswordFromQuirkString(quirks.join(" ")), [
    PasswordRequirement.Lower,
    PasswordRequirement.Upper,
    ...requirements,
  ]);
}

/**
 * We're using code from Apple's developer resources to turn a
 * "passwordrules" attribute into a crypotgraphically-secure passwords.
 *
 * Technically, "passwordrules" is non-standard syntax, but has first-party
 * support in Safari and is gaining substantial momentum from web developers.
 *
 * @see https://developer.apple.com/password-rules/
 * @see https://github.com/apple/password-manager-resources
 * @see https://github.com/whatwg/html/issues/3518
 */
function generatePasswordFromQuirkString(quirkString: string) {
  // Turn "passwordrules" into a format that the password generator wants.
  const quirk = safariQuirkFromPasswordRules(quirkString);
  return generatedPasswordMatchingRequirements(quirk) ?? "";
}
