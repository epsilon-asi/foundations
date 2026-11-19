import { toCamelCase, toKebabCase, toPascalCase, toScreamingSnakeCase, toSnakeCase } from '../../index.js';

describe('resource naming', () => {
  it.each(['ApiKey', 'apiKey', 'api-key', 'api_key', 'API_KEY'])('converts %s to each target case', (name) => {
    expect(toCamelCase(name)).toBe('apiKey');
    expect(toPascalCase(name)).toBe('ApiKey');
    expect(toKebabCase(name)).toBe('api-key');
    expect(toSnakeCase(name)).toBe('api_key');
    expect(toScreamingSnakeCase(name)).toBe('API_KEY');
  });

  it.each([
    ['HTTPServer2Port', 'httpServer2Port', 'HttpServer2Port', 'http_server2_port'],
    ['  user--display.name  ', 'userDisplayName', 'UserDisplayName', 'user_display_name'],
    ['crèmeBrûlée', 'crèmeBrûlée', 'CrèmeBrûlée', 'crème_brûlée'],
    ['id', 'id', 'Id', 'id'],
    ['---', '', '', ''],
    ['', '', '', ''],
  ])('handles %j', (name, camel, pascal, snake) => {
    expect(toCamelCase(name)).toBe(camel);
    expect(toPascalCase(name)).toBe(pascal);
    expect(toSnakeCase(name)).toBe(snake);
  });

  it.each([
    ['HTTPServer2Port', 'http-server2-port', 'HTTP_SERVER2_PORT'],
    ['  user--display.name  ', '-user--display.name-', 'USER_DISPLAY_NAME'],
    ['@scope/tool.js', '@scope/tool.js', 'SCOPE_TOOL_JS'],
    ['---', '---', ''],
    ['', '', ''],
  ])('preserves CLI conversions for %j', (name, kebab, screamingSnake) => {
    expect(toKebabCase(name)).toBe(kebab);
    expect(toScreamingSnakeCase(name)).toBe(screamingSnake);
  });
});
