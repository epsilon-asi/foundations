import { newId } from '@epsilon-asi/apps';
import { expect } from 'vitest';
import { CreateOffering, DeleteOffering, GetOffering } from '../../examples/crud-api/common/src/resources/Offering.js';
import { input, type OfferingIsolationOptions, organizationA, organizationB } from './offeringIsolation.fixture.js';

export async function verifyOfferingDeletion({ writer, reader = writer, responses }: OfferingIsolationOptions) {
  const editor = writer.as({ tenant: organizationA, role: 'EDITOR' });
  const viewer = reader.as({ tenant: organizationA, role: 'VIEWER' });
  const admin = writer.as({ tenant: organizationA, role: 'ADMINISTRATOR' });
  const other = writer.as({ tenant: organizationB, role: 'ADMINISTRATOR' });
  const target = await editor.call(CreateOffering, input);
  const retained = await editor.call(CreateOffering, { ...input, name: 'Keep this offering' });
  const otherTarget = await other.call(CreateOffering, input);
  if (target.code !== 201 || retained.code !== 201 || otherTarget.code !== 201) throw new Error('Expected three stored offerings');
  const { id } = target.data;
  const notFound = { code: 404, error: 'Resource.NOT_FOUND', traceId: expect.stringMatching(/.+/) };

  for (const member of [viewer, editor]) {
    expect(await member.call(DeleteOffering, { id })).toStrictEqual({
      code: 403, error: 'Auth.FORBIDDEN', traceId: expect.stringMatching(/.+/),
    });
  }
  for (const rowId of [id, newId()]) {
    expect(await other.call(DeleteOffering, { id: rowId })).toStrictEqual(notFound);
    expect(responses.at(-1)).toStrictEqual({
      method: 'DELETE', hasBody: false, path: '/offerings/' + rowId, tenant: organizationB, status: 404, body: notFound,
    });
  }
  expect(await viewer.call(GetOffering, { id })).toStrictEqual({ code: 200, data: target.data });

  expect(await admin.call(DeleteOffering, { id })).toStrictEqual({ code: 200 });
  expect(responses.at(-1)).toStrictEqual({
    method: 'DELETE', hasBody: false, path: '/offerings/' + id, tenant: organizationA, status: 200, body: { code: 200 },
  });
  const secondAdmin = reader.as({ tenant: organizationA, role: 'ADMINISTRATOR' });
  expect(await viewer.call(GetOffering, { id })).toStrictEqual(notFound);
  expect(await secondAdmin.call(DeleteOffering, { id })).toStrictEqual(notFound);
  expect(await viewer.call(GetOffering, { id: retained.data.id })).toStrictEqual({ code: 200, data: retained.data });

  const secondOther = reader.as({ tenant: organizationB, role: 'ADMINISTRATOR' });
  const own = { id: otherTarget.data.id };
  expect(await secondOther.call(GetOffering, own)).toStrictEqual({ code: 200, data: otherTarget.data });
  const concurrent = await Promise.all([other.call(DeleteOffering, own), secondOther.call(DeleteOffering, own)]);
  expect(concurrent).toEqual(expect.arrayContaining([{ code: 200 }, notFound]));
  expect(await secondOther.call(GetOffering, own)).toStrictEqual(notFound);
  return retained.data.id;
}
