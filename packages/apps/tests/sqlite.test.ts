import { MikroORM } from '@mikro-orm/sqlite';
import { expect, it } from 'vitest';

it('opens an in-memory database with the SQLite development driver', async () => {
  const orm = await MikroORM.init({
    dbName: ':memory:',
    discovery: { warnWhenNoEntities: false },
  });
  try {
    expect(await orm.em.getConnection().execute('select 1 as value')).toEqual([{ value: 1 }]);
  } finally {
    await orm.close();
  }
});
