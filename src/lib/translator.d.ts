export interface SaosDiagnostic {
  line?: number;
  severity?: string;
  code?: string;
  message?: string;
  src_line?: string;
}

export interface SaosValidation {
  valid: boolean;
  message?: string;
  details?: SaosDiagnostic[];
  validatorVersion?: string;
}

export function validateSaosCli(options: {
  cli: string;
  saosVersion: string;
  platform: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  translatorUrl?: string;
}): Promise<SaosValidation>;
export const DEFAULT_TRANSLATOR_URL: string;
export const DEFAULT_SAOS_VERSION: string;
