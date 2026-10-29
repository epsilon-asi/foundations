import { createDecoratorRegistry } from '../index';

type OrmDecorators = {
  class: {
    entity: {
      metadata: { table: string };
    };
  };
  property: {
    column: {
      metadata: { type: 'uuid' | 'varchar'; primary?: boolean };
      target: string;
    };
    serializable: {
      metadata: undefined;
      target: unknown;
    };
  };
  method: {};
  accessor: {};
};

type UserModelContract = {
  id: string;
  email: string;
};

const registry = createDecoratorRegistry<OrmDecorators>({ namespace: 'orm-example' });
const User = registry.for<UserModelContract>();

const Entity = User.class('entity');
const Column = User.property('column');
const Serializable = User.property('serializable');

@Entity({ table: 'users' })
class UserModel implements UserModelContract {
  @Column('id', { type: 'uuid', primary: true })
  @Serializable.on('id')
  id = 'user-1';

  @Column.on('email', { type: 'varchar' })
  @Serializable.on('email')
  email = 'ray@example.com';
}

export type TableColumn = {
  name: string | symbol;
  type: 'uuid' | 'varchar';
  primary: boolean;
};

export type TableSchema = {
  table: string;
  columns: TableColumn[];
  serializableFields: Array<string | symbol>;
};

export function buildUserTableSchema(): TableSchema {
  const snapshot = registry.read(UserModel);
  const entity = snapshot.firstClass('entity');
  if (entity === undefined) throw new Error('Missing @Entity metadata.');

  const tableMetadata = entity.metadata as { table: string };
  const columns = snapshot.propertyRecords('column').map((record) => {
    const metadata = record.metadata as { type: 'uuid' | 'varchar'; primary?: boolean };
    return {
      name: record.memberName ?? 'unknown',
      type: metadata.type,
      primary: metadata.primary ?? false,
    };
  });

  return {
    table: tableMetadata.table,
    columns,
    serializableFields: snapshot.propertyRecords('serializable').map((record) => {
      if (record.memberName === undefined) throw new Error('Serializable record missing member.');
      return record.memberName;
    }),
  };
}

export { UserModel, registry as ormRegistry };
