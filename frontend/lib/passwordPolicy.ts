export interface PasswordCheck {
  id: string;
  label: string;
  pass: boolean;
}

export function checkPasswordPolicy(password: string): PasswordCheck[] {
  return [
    {
      id: "minLength",
      label: "At least 8 characters",
      pass: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      pass: /[A-Z]/.test(password),
    },
    {
      id: "digit",
      label: "One number",
      pass: /\d/.test(password),
    },
    {
      id: "special",
      label: "One special character (!@#$%^&* etc.)",
      pass: /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string): boolean {
  return checkPasswordPolicy(password).every((c) => c.pass);
}
