export enum PasswordRequirement {
  Upper = "upper",
  Lower = "lower",
  Numbers = "numbers",
  Symbols = "symbols",
}

export class Password {
  private static SCORED_PASSWORD_REQUIREMENTS = {
    [PasswordRequirement.Upper]: 26, // A-Z
    [PasswordRequirement.Lower]: 26, // a-Z
    [PasswordRequirement.Numbers]: 10, // 0-9
    [PasswordRequirement.Symbols]: 33, // -~!@#$%^&*_+=`|(){}[:;\"'<>,.?/ ]
  };

  private readonly value: string;
  private readonly requirements: Set<PasswordRequirement>;
  private readonly entropyBaseScore: number;

  constructor(value: string, requirements: PasswordRequirement[] = [], entropyBaseScore = 0) {
    this.value = value;
    this.requirements = new Set(requirements);
    this.entropyBaseScore = entropyBaseScore;
  }

  /**
   * @returns Calculate the approximate entropy of this password based on the
   * specified `requirements`.
   */
  calculateApproximateEntropy() {
    if (!this.value.length) {
      return 0;
    }

    const charsetScore = [...this.requirements.values()].reduce((score, key) => {
      return score + Password.SCORED_PASSWORD_REQUIREMENTS[key];
    }, this.entropyBaseScore);

    // Calculate the ideal Shannon entropy/relative entropy of the given password...
    // (this assumes the probabilty of each character is equal across the whole
    //  character set, so it's not perfectly accurate but we only need to surface
    //  an appoximate password strength to the end-user).
    return Math.round((this.value.length * Math.log(charsetScore)) / Math.LN2);
  }

  /**
   * @returns The number of seconds it would (theoretically) take to crack this
   * password.
   */
  calculateApproximateSecondsToHack(assumedGuessesPerSecond = 1e9) {
    const entropy = this.calculateApproximateEntropy();
    const numGuesses = 2 ** entropy;

    // By default: assume anyone with a super-computer can make up to 1 billion
    // guesses per second... this estimate is very much theoretical!
    return numGuesses / assumedGuessesPerSecond;
  }

  toString() {
    return this.value;
  }

  get [Symbol.toStringTag]() {
    return this.value;
  }
}
