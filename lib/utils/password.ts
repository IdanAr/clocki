export type PasswordRules = {
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

export type PasswordValidation = {
  lengthOk: boolean
  rules: PasswordRules
  rulesCount: number
  valid: boolean
}

export function validatePassword(password: string): PasswordValidation {
  const lengthOk = password.length >= 8 && password.length <= 16
  const rules: PasswordRules = {
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  const rulesCount = Object.values(rules).filter(Boolean).length
  return { lengthOk, rules, rulesCount, valid: lengthOk && rulesCount >= 3 }
}
