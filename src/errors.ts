import type { PortErrorCode } from './types';

export class PortError extends Error {
  readonly code: PortErrorCode;

  constructor(code: PortErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PortError';
  }
}
