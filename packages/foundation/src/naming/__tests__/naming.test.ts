import { toCamelCase, toPascalCase, toSnakeCase } from '../../index';

describe('resource naming', () => {
  it.each(['ApiKey', 'apiKey', 'api-key', 'api_key', 'API_KEY'])('converts %s to each target case', (name) => {
    expect(toCamelCase(name)).toBe('apiKey');
    expect(toPascalCase(name)).toBe('ApiKey');
    expect(toSnakeCase(name)).toBe('api_key');
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
});
