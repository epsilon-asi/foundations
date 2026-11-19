import { createDecoratorRegistry } from '../../src/decorators/factory/index.js';

const registry = createDecoratorRegistry();
const Resource = registry.class('Resource');

@Resource()
class Offering {}

if (!registry.read(Offering).firstClass('Resource')) {
  throw new Error('Missing Resource metadata');
}
