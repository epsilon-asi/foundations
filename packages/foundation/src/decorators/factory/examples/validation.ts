import { createDecoratorRegistry } from '../index';

type ValidationDecorators = {
  class: {
    schema: {
      metadata: { name: string };
    };
  };
  property: {
    field: {
      metadata: { type: 'string' | 'number' | 'email'; minLength?: number; min?: number };
      target: unknown;
    };
    required: {
      metadata: undefined;
      target: unknown;
    };
  };
  method: {};
  accessor: {};
};

type SignupInputContract = {
  email: string;
  displayName: string;
  age: number;
};

const registry = createDecoratorRegistry<ValidationDecorators>({ namespace: 'validation-example' });
const Signup = registry.for<SignupInputContract>();

const Schema = Signup.class('schema');
const Field = Signup.property('field');
const Required = Signup.property('required');

@Schema({ name: 'signup' })
class SignupInput implements SignupInputContract {
  @Required.on('email')
  @Field.on('email', { type: 'email' })
  email = 'ray@example.com';

  @Required.on('displayName')
  @Field.on('displayName', { type: 'string', minLength: 2 })
  displayName = 'Ray';

  @Field.on('age', { type: 'number', min: 13 })
  age = 42;
}

export type ValidationField = {
  name: string | symbol;
  type: 'string' | 'number' | 'email';
  required: boolean;
  minLength?: number;
  min?: number;
};

export type ValidationSchema = {
  name: string;
  fields: ValidationField[];
};

export function buildValidationSchema(): ValidationSchema {
  const snapshot = registry.read(SignupInput);
  const schema = snapshot.firstClass('schema');
  if (schema === undefined) throw new Error('Missing @Schema metadata.');

  const requiredMembers = new Set(
    snapshot.propertyRecords('required').map((record) => {
      if (record.memberName === undefined) throw new Error('Required record missing member.');
      return record.memberName;
    }),
  );

  const fields = snapshot.propertyRecords('field').map((record) => {
    if (record.memberName === undefined) throw new Error('Field record missing member.');
    const metadata = record.metadata as ValidationField;
    return {
      name: record.memberName,
      type: metadata.type,
      required: requiredMembers.has(record.memberName),
      ...(metadata.minLength !== undefined ? { minLength: metadata.minLength } : {}),
      ...(metadata.min !== undefined ? { min: metadata.min } : {}),
    };
  });

  return {
    name: (schema.metadata as { name: string }).name,
    fields,
  };
}

export { SignupInput, registry as validationRegistry };
