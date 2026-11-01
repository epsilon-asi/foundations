import { InvalidArgumentError } from 'commander';

export interface NumberConstraints {
  integer?: boolean;
  min?: number;
  max?: number;
}

/** Commander argument parser for numeric options and arguments. Failures become commander's own usage errors. */
export function numberParser(constraints: NumberConstraints): (value: string) => number {
  return (value) => {
    const parsed = Number(value);

    if (value.trim() === '' || !Number.isFinite(parsed)) {
      throw new InvalidArgumentError(`"${value}" is not a number.`);
    }
    if (constraints.integer === true && !Number.isInteger(parsed)) {
      throw new InvalidArgumentError(`"${value}" is not an integer.`);
    }
    if (constraints.min !== undefined && parsed < constraints.min) {
      throw new InvalidArgumentError(`${value} is less than the minimum of ${constraints.min}.`);
    }
    if (constraints.max !== undefined && parsed > constraints.max) {
      throw new InvalidArgumentError(`${value} is greater than the maximum of ${constraints.max}.`);
    }

    return parsed;
  };
}
