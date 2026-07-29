/**
 * Password rules, transcribed from the registration specification.
 *
 * Firebase Auth only enforces a six-character minimum of its own, so anything
 * stronger has to be checked here — and checked in one place, because a rule
 * the form enforces but the code does not is not a rule.
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (v) => v.length >= 8,
  },
  {
    id: 'upper',
    label: 'One uppercase letter',
    test: (v) => /[A-Z]/.test(v),
  },
  {
    id: 'lower',
    label: 'One lowercase letter',
    test: (v) => /[a-z]/.test(v),
  },
  {
    id: 'number',
    label: 'One number',
    test: (v) => /[0-9]/.test(v),
  },
  {
    id: 'special',
    label: 'One special character',
    // Anything that is not a letter, a digit, or whitespace. Listing specific
    // punctuation would reject a perfectly good password containing a character
    // that simply was not on the list.
    test: (v) => /[^A-Za-z0-9\s]/.test(v),
  },
];

export interface PasswordCheck {
  /** Which rules the value currently satisfies, for a live checklist. */
  results: Array<{ rule: PasswordRule; passed: boolean }>;
  valid: boolean;
  /** First unmet rule, phrased for a single error line. */
  firstProblem: string | null;
}

export function checkPassword(value: string): PasswordCheck {
  const results = PASSWORD_RULES.map((rule) => ({
    rule,
    passed: rule.test(value),
  }));
  const failed = results.find((r) => !r.passed);

  return {
    results,
    valid: !failed,
    firstProblem: failed ? failed.rule.label : null,
  };
}
