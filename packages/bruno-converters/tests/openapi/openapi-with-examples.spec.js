import { describe, it, expect } from '@jest/globals';
import openApiToBruno from '../../src/openapi/openapi-to-bruno';
import * as fs from 'fs';
import * as path from 'path';

describe('OpenAPI with Examples', () => {
  const openApiWithExamples = fs.readFileSync(path.resolve(__dirname, '../../../../tests/import/openapi/fixtures/openapi-with-examples.yaml'),
    'utf8');

  it('should import OpenAPI collection with response examples', () => {
    const brunoCollection = openApiToBruno(openApiWithExamples);

    expect(brunoCollection).toBeDefined();
    expect(brunoCollection.name).toBe('API with Examples');
    expect(brunoCollection.items).toHaveLength(1); // Only POST /users remains

    // GET /users is excluded (no requestBody examples)
    const getUsersRequest = brunoCollection.items.find((item) => item.name === 'Get all users');
    expect(getUsersRequest).toBeUndefined();

    // POST /users becomes a folder with one item per named requestBody example
    const createUserFolder = brunoCollection.items.find((item) => item.name === 'Create a new user');
    expect(createUserFolder).toBeDefined();
    expect(createUserFolder.type).toBe('folder');
    expect(createUserFolder.items).toHaveLength(2);

    const validUserRequest = createUserFolder.items.find((item) => item.name === 'Valid User');
    expect(validUserRequest).toBeDefined();
    expect(validUserRequest.type).toBe('http-request');
    expect(JSON.parse(validUserRequest.request.body.json)).toEqual({ name: 'John Doe', email: 'john@example.com' });

    const invalidUserRequest = createUserFolder.items.find((item) => item.name === 'Invalid User');
    expect(invalidUserRequest).toBeDefined();
    expect(JSON.parse(invalidUserRequest.request.body.json)).toEqual({ name: '', email: 'invalid-email' });
  });

  it('should handle OpenAPI examples with different content types', () => {
    const openApiWithDifferentContentTypes = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Different Content Types'
paths:
  /data:
    post:
      summary: 'Post data'
      operationId: 'postData'
      requestBody:
        content:
          application/json:
            examples:
              json_request:
                summary: 'JSON Request'
                value:
                  message: 'Hello World'
          text/plain:
            examples:
              text_request:
                summary: 'Text Request'
                value: 'Hello World'
      responses:
        '200':
          description: 'OK'
servers:
  - url: 'https://api.example.com'
`;

    const brunoCollection = openApiToBruno(openApiWithDifferentContentTypes);
    const folder = brunoCollection.items[0];
    expect(folder.type).toBe('folder');
    expect(folder.items).toHaveLength(2);

    const jsonItem = folder.items.find((item) => item.name === 'JSON Request');
    expect(jsonItem).toBeDefined();
    expect(jsonItem.request.body.mode).toBe('json');
    expect(JSON.parse(jsonItem.request.body.json)).toEqual({ message: 'Hello World' });

    const textItem = folder.items.find((item) => item.name === 'Text Request');
    expect(textItem).toBeDefined();
    expect(textItem.request.body.mode).toBe('text');
    expect(textItem.request.body.text).toBe('Hello World');
  });

  it('should handle OpenAPI examples without summary or description', () => {
    const openApiWithMinimalExamples = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Minimal Examples'
paths:
  /test:
    post:
      summary: 'Test endpoint'
      operationId: 'test'
      requestBody:
        content:
          application/json:
            examples:
              example1:
                value:
                  message: 'test'
      responses:
        '200':
          description: 'OK'
servers:
  - url: 'https://api.example.com'
`;

    const brunoCollection = openApiToBruno(openApiWithMinimalExamples);
    const folder = brunoCollection.items[0];
    expect(folder.type).toBe('folder');
    expect(folder.items).toHaveLength(1);
    const item = folder.items[0];
    expect(item.name).toBe('example1');
    expect(JSON.parse(item.request.body.json)).toEqual({ message: 'test' });
  });

  it('should exclude operations without explicit request body examples', () => {
    const openApiWithoutExamples = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API without Examples'
paths:
  /test:
    get:
      summary: 'Test endpoint'
      operationId: 'test'
      responses:
        '200':
          description: 'OK'
          content:
            application/json:
              schema:
                type: object
servers:
  - url: 'https://api.example.com'
`;

    const brunoCollection = openApiToBruno(openApiWithoutExamples);
    expect(brunoCollection.items).toHaveLength(0);
  });

  it('should support path-based grouping when specified', () => {
    const openApiWithPathGrouping = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Path Grouping'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        content:
          application/json:
            examples:
              success:
                summary: 'Success Response'
                value:
                  users: []
      responses:
        '200': { description: 'OK' }
    put:
      summary: 'Update user'
      operationId: 'updateUser'
      requestBody:
        content:
          application/json:
            examples:
              created:
                summary: 'User Created'
                value:
                  id: 123
      responses:
        '201': { description: 'Created' }
  /products:
    post:
      summary: 'Create product'
      operationId: 'createProduct'
      requestBody:
        content:
          application/json:
            examples:
              success:
                summary: 'Products Response'
                value:
                  products: []
      responses:
        '200': { description: 'OK' }
servers:
  - url: 'https://api.example.com'
`;

    // Test with path-based grouping
    const brunoCollection = openApiToBruno(openApiWithPathGrouping, { groupBy: 'path' });

    expect(brunoCollection).toBeDefined();
    expect(brunoCollection.name).toBe('API with Path Grouping');

    // Should have 2 folders: users and products (without leading slash)
    expect(brunoCollection.items).toHaveLength(2);

    const usersFolder = brunoCollection.items.find((item) => item.name === 'users');
    expect(usersFolder).toBeDefined();
    expect(usersFolder.type).toBe('folder');
    expect(usersFolder.items).toHaveLength(2); // Two operations in /users path

    const productsFolder = brunoCollection.items.find((item) => item.name === 'products');
    expect(productsFolder).toBeDefined();
    expect(productsFolder.type).toBe('folder');
    expect(productsFolder.items).toHaveLength(1);

    // Each operation folder has one item per named requestBody example
    const createUserFolder = usersFolder.items.find((item) => item.name === 'Create user');
    expect(createUserFolder.type).toBe('folder');
    expect(createUserFolder.items).toHaveLength(1);
    expect(createUserFolder.items[0].name).toBe('Success Response');
  });

  it('should default to tag-based grouping when no groupBy option is specified', () => {
    const openApiWithTags = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Tags'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      tags: ['Users']
      requestBody:
        content:
          application/json:
            example: {}
      responses:
        '200': { description: 'OK' }
  /products:
    post:
      summary: 'Create product'
      operationId: 'createProduct'
      tags: ['Products']
      requestBody:
        content:
          application/json:
            example: {}
      responses:
        '200': { description: 'OK' }
servers:
  - url: 'https://api.example.com'
`;

    // Test with default grouping (tags)
    const brunoCollection = openApiToBruno(openApiWithTags);

    expect(brunoCollection).toBeDefined();
    expect(brunoCollection.name).toBe('API with Tags');

    // Should have 2 folders based on tags: Users and Products
    expect(brunoCollection.items).toHaveLength(2);

    const usersFolder = brunoCollection.items.find((item) => item.name === 'Users');
    expect(usersFolder).toBeDefined();
    expect(usersFolder.type).toBe('folder');
    expect(usersFolder.items).toHaveLength(1); // one request

    const productsFolder = brunoCollection.items.find((item) => item.name === 'Products');
    expect(productsFolder).toBeDefined();
    expect(productsFolder.type).toBe('folder');
    expect(productsFolder.items).toHaveLength(1);
  });

  describe('Request Body Examples', () => {
    it('should match request body examples by key when response example key matches', () => {
      const openApiWithMatchingKeys = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Matching Keys'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            examples:
              valid_user:
                summary: 'Valid User'
                value:
                  name: 'John Doe'
                  email: 'john@example.com'
              invalid_user:
                summary: 'Invalid User'
                value:
                  name: ''
                  email: 'invalid'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                valid_user:
                  summary: 'User Created'
                  value:
                    id: 123
                    name: 'John Doe'
                invalid_user:
                  summary: 'Validation Error'
                  value:
                    error: 'Invalid input'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithMatchingKeys);
      const folder = brunoCollection.items[0];

      expect(folder.type).toBe('folder');
      expect(folder.items).toHaveLength(2);

      // Items are named by request body example summary, not response example
      const validUserRequest = folder.items.find((item) => item.name === 'Valid User');
      expect(validUserRequest).toBeDefined();
      expect(validUserRequest.request.body.mode).toBe('json');
      expect(JSON.parse(validUserRequest.request.body.json)).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const invalidUserRequest = folder.items.find((item) => item.name === 'Invalid User');
      expect(invalidUserRequest).toBeDefined();
      expect(JSON.parse(invalidUserRequest.request.body.json)).toEqual({
        name: '',
        email: 'invalid'
      });
    });

    it('should create one item per request body example regardless of response examples', () => {
      const openApiWithNonMatchingKeys = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Non-Matching Keys'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            examples:
              valid_user:
                summary: 'Valid User'
                value:
                  name: 'John Doe'
                  email: 'john@example.com'
              invalid_user:
                summary: 'Invalid User'
                value:
                  name: ''
                  email: 'invalid'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                created:
                  summary: 'User Created'
                  value:
                    id: 123
        400:
          description: 'Bad Request'
          content:
            application/json:
              examples:
                error:
                  summary: 'Validation Error'
                  value:
                    error: 'Invalid input'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithNonMatchingKeys);
      const folder = brunoCollection.items[0];

      expect(folder.type).toBe('folder');
      // One item per named request body example — response examples are not cross-joined
      expect(folder.items).toHaveLength(2);

      const validUserRequest = folder.items.find((item) => item.name === 'Valid User');
      expect(validUserRequest).toBeDefined();
      expect(JSON.parse(validUserRequest.request.body.json)).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const invalidUserRequest = folder.items.find((item) => item.name === 'Invalid User');
      expect(invalidUserRequest).toBeDefined();
      expect(JSON.parse(invalidUserRequest.request.body.json)).toEqual({
        name: '',
        email: 'invalid'
      });
    });

    it('should use single request body example for all response examples', () => {
      const openApiWithSingleRequestBody = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Single Request Body'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            example:
              name: 'John Doe'
              email: 'john@example.com'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                created:
                  summary: 'User Created'
                  value:
                    id: 123
                duplicate:
                  summary: 'Duplicate User'
                  value:
                    error: 'User already exists'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithSingleRequestBody);
      const request = brunoCollection.items[0];

      // No named request body examples, stays as request with .examples
      expect(request.examples).toBeDefined();
      expect(request.examples).toHaveLength(2);

      // Both examples should have the same request body
      const createdExample = request.examples.find((ex) => ex.name === 'User Created');
      expect(createdExample).toBeDefined();
      expect(createdExample.request.body.mode).toBe('json');
      expect(JSON.parse(createdExample.request.body.json)).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const duplicateExample = request.examples.find((ex) => ex.name === 'Duplicate User');
      expect(duplicateExample).toBeDefined();
      expect(JSON.parse(duplicateExample.request.body.json)).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });
    });

    it('should exclude operations with schema-only request body (no explicit example)', () => {
      const openApiWithSchemaRequestBody = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Schema Request Body'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - email
              properties:
                name:
                  type: string
                  example: 'John Doe'
                email:
                  type: string
                  format: email
                  example: 'john@example.com'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                created:
                  summary: 'User Created'
                  value:
                    id: 123
                error:
                  summary: 'Error Response'
                  value:
                    error: 'Something went wrong'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithSchemaRequestBody);
      // schema-only requestBody means no explicit example → excluded
      expect(brunoCollection.items).toHaveLength(0);
    });

    it('should handle request body examples with different content types', () => {
      const openApiWithDifferentRequestBodyTypes = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Different Request Body Types'
paths:
  /data:
    post:
      summary: 'Post data'
      operationId: 'postData'
      requestBody:
        required: true
        content:
          application/json:
            examples:
              json_data:
                summary: 'JSON Data'
                value:
                  message: 'Hello'
          text/plain:
            examples:
              text_data:
                summary: 'Text Data'
                value: 'Hello World'
      responses:
        '200':
          description: 'OK'
          content:
            application/json:
              examples:
                success:
                  summary: 'Success'
                  value:
                    status: 'ok'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithDifferentRequestBodyTypes);
      const folder = brunoCollection.items[0];

      expect(folder.type).toBe('folder');
      // One item per named request body example — named by example summary
      expect(folder.items).toHaveLength(2);

      const jsonRequest = folder.items.find((item) => item.name === 'JSON Data');
      expect(jsonRequest).toBeDefined();
      expect(jsonRequest.request.body.mode).toBe('json');
      expect(JSON.parse(jsonRequest.request.body.json)).toEqual({ message: 'Hello' });

      const textRequest = folder.items.find((item) => item.name === 'Text Data');
      expect(textRequest).toBeDefined();
      expect(textRequest.request.body.mode).toBe('text');
      expect(textRequest.request.body.text).toBe('Hello World');
    });

    it('should handle mixed matching and non-matching request body examples', () => {
      const openApiWithMixedMatching = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Mixed Matching'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            examples:
              valid_user:
                summary: 'Valid User'
                value:
                  name: 'John Doe'
                  email: 'john@example.com'
              invalid_user:
                summary: 'Invalid User'
                value:
                  name: ''
                  email: 'invalid'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                valid_user:
                  summary: 'User Created'
                  value:
                    id: 123
                unmatched:
                  summary: 'Unmatched Response'
                  value:
                    id: 456
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithMixedMatching);
      const folder = brunoCollection.items[0];

      expect(folder.type).toBe('folder');
      // One item per named request body example — response examples are not cross-joined
      expect(folder.items).toHaveLength(2);

      const validUserRequest = folder.items.find((item) => item.name === 'Valid User');
      expect(validUserRequest).toBeDefined();
      expect(JSON.parse(validUserRequest.request.body.json)).toEqual({
        name: 'John Doe',
        email: 'john@example.com'
      });

      const invalidUserRequest = folder.items.find((item) => item.name === 'Invalid User');
      expect(invalidUserRequest).toBeDefined();
      expect(JSON.parse(invalidUserRequest.request.body.json)).toEqual({
        name: '',
        email: 'invalid'
      });
    });

    it('should exclude operations with no request body', () => {
      const openApiWithoutRequestBody = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API without Request Body'
paths:
  /users:
    get:
      summary: 'Get users'
      operationId: 'getUsers'
      responses:
        '200':
          description: 'OK'
          content:
            application/json:
              examples:
                success:
                  summary: 'Success'
                  value:
                    users: []
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithoutRequestBody);
      // No requestBody → excluded
      expect(brunoCollection.items).toHaveLength(0);
    });

    it('should handle request body with singular example and multiple response examples', () => {
      const openApiWithSingularExample = `
openapi: '3.0.0'
info:
  version: '1.0.0'
  title: 'API with Singular Example'
paths:
  /users:
    post:
      summary: 'Create user'
      operationId: 'createUser'
      requestBody:
        required: true
        content:
          application/json:
            example:
              name: 'Jane Doe'
              email: 'jane@example.com'
      responses:
        '201':
          description: 'Created'
          content:
            application/json:
              examples:
                created:
                  summary: 'User Created'
                  value:
                    id: 1
                duplicate:
                  summary: 'Duplicate'
                  value:
                    id: 2
        400:
          description: 'Bad Request'
          content:
            application/json:
              examples:
                error:
                  summary: 'Error'
                  value:
                    error: 'Bad request'
servers:
  - url: 'https://api.example.com'
`;

      const brunoCollection = openApiToBruno(openApiWithSingularExample);
      const request = brunoCollection.items[0];

      // Singular (non-named) request body example, stays as request with .examples
      expect(request.examples).toBeDefined();
      expect(request.examples).toHaveLength(3);

      // All examples should have the same request body
      const requestBodyValue = { name: 'Jane Doe', email: 'jane@example.com' };
      request.examples.forEach((example) => {
        expect(example.request.body.mode).toBe('json');
        expect(JSON.parse(example.request.body.json)).toEqual(requestBodyValue);
      });
    });
  });

  describe('x-bruno-var substitution', () => {
    it('should replace non-null example values with {{?field_name}} when x-bruno-var: true on schema property', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  x-bruno-var: true
                name:
                  type: string
                role:
                  type: string
                  x-bruno-var: true
            examples:
              validUser:
                summary: 'Valid User'
                value:
                  email: 'john@example.com'
                  name: 'John Doe'
                  role: 'admin'
      responses:
        '200':
          description: 'OK'
`;
      const brunoCollection = openApiToBruno(spec);
      const folder = brunoCollection.items[0];
      expect(folder.type).toBe('folder');
      const item = folder.items[0];
      const body = JSON.parse(item.request.body.json);
      // email and role have x-bruno-var: true and non-null example values → replaced
      expect(body.email).toBe('{{?email}}');
      expect(body.role).toBe('{{?role}}');
      // name has no x-bruno-var: true → kept as-is
      expect(body.name).toBe('John Doe');
    });

    it('should not replace null example values even when x-bruno-var: true', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Null Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  x-bruno-var: true
                nickname:
                  type: string
                  x-bruno-var: true
            examples:
              withNull:
                summary: 'With Null'
                value:
                  email: 'john@example.com'
                  nickname: null
      responses:
        '200':
          description: 'OK'
`;
      const brunoCollection = openApiToBruno(spec);
      const folder = brunoCollection.items[0];
      const item = folder.items[0];
      const body = JSON.parse(item.request.body.json);
      // email is non-null → replaced
      expect(body.email).toBe('{{?email}}');
      // nickname is null → kept as null
      expect(body.nickname).toBeNull();
    });

    it('should apply x-bruno-var substitution to each named example independently', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Multi-Example Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  x-bruno-var: true
                name:
                  type: string
            examples:
              alice:
                summary: 'Alice'
                value:
                  email: 'alice@example.com'
                  name: 'Alice'
              bob:
                summary: 'Bob'
                value:
                  email: 'bob@example.com'
                  name: 'Bob'
      responses:
        '200':
          description: 'OK'
`;
      const brunoCollection = openApiToBruno(spec);
      const folder = brunoCollection.items[0];
      expect(folder.items).toHaveLength(2);

      const aliceItem = folder.items.find((i) => i.name === 'Alice');
      const bobItem = folder.items.find((i) => i.name === 'Bob');

      // Both examples: email → {{?email}}, name kept as-is
      expect(JSON.parse(aliceItem.request.body.json)).toEqual({ email: '{{?email}}', name: 'Alice' });
      expect(JSON.parse(bobItem.request.body.json)).toEqual({ email: '{{?email}}', name: 'Bob' });
    });

    it('should apply x-bruno-var substitution for singular content.example', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Singular Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  x-bruno-var: true
                name:
                  type: string
            example:
              email: 'john@example.com'
              name: 'John Doe'
      responses:
        '200':
          description: 'OK'
`;
      const brunoCollection = openApiToBruno(spec);
      // singular example → single request (not a folder)
      const request = brunoCollection.items[0];
      expect(request.type).toBe('http-request');
      const body = JSON.parse(request.request.body.json);
      expect(body.email).toBe('{{?email}}');
      expect(body.name).toBe('John Doe');
    });

    it('should recurse into nested objects for x-bruno-var substitution', () => {
      const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Nested Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                address:
                  type: object
                  properties:
                    street:
                      type: string
                      x-bruno-var: true
                    city:
                      type: string
                name:
                  type: string
            examples:
              withAddress:
                summary: 'With Address'
                value:
                  address:
                    street: '123 Main St'
                    city: 'Springfield'
                  name: 'John Doe'
      responses:
        '200':
          description: 'OK'
`;
      const brunoCollection = openApiToBruno(spec);
      const folder = brunoCollection.items[0];
      const item = folder.items[0];
      const body = JSON.parse(item.request.body.json);
      expect(body.address.street).toBe('{{?street}}');
      expect(body.address.city).toBe('Springfield');
      expect(body.name).toBe('John Doe');
    });

    describe('request parameters', () => {
      it('should replace query, path, and header param values with {{?name}} when x-bruno-var: true and example is non-null', () => {
        const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Params Test'
  version: '1.0.0'
paths:
  /users/{userId}:
    post:
      summary: 'Get user'
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            x-bruno-var: true
          example: 'user-123'
        - name: apiKey
          in: header
          schema:
            type: string
            x-bruno-var: true
          example: 'secret-key'
        - name: page
          in: query
          schema:
            type: integer
            x-bruno-var: true
          example: 1
        - name: limit
          in: query
          schema:
            type: integer
          example: 10
      requestBody:
        content:
          application/json:
            example:
              name: 'John'
      responses:
        '200':
          description: 'OK'
`;
        const brunoCollection = openApiToBruno(spec);
        const request = brunoCollection.items[0];
        expect(request.type).toBe('http-request');

        const userId = request.request.params.find((p) => p.name === 'userId');
        expect(userId.value).toBe('{{?userId}}');

        const apiKey = request.request.headers.find((h) => h.name === 'apiKey');
        expect(apiKey.value).toBe('{{?apiKey}}');

        const page = request.request.params.find((p) => p.name === 'page');
        expect(page.value).toBe('{{?page}}');

        // limit has no x-bruno-var — keeps its example value
        const limit = request.request.params.find((p) => p.name === 'limit');
        expect(limit.value).toBe('10');
      });

      it('should not substitute param when example is absent or null', () => {
        const spec = `
openapi: '3.0.0'
info:
  title: 'Bruno Var Params Null Test'
  version: '1.0.0'
paths:
  /users:
    post:
      summary: 'Create user'
      parameters:
        - name: token
          in: header
          schema:
            type: string
            x-bruno-var: true
        - name: tag
          in: query
          schema:
            type: string
            x-bruno-var: true
          example: null
      requestBody:
        content:
          application/json:
            example:
              name: 'John'
      responses:
        '200':
          description: 'OK'
`;
        const brunoCollection = openApiToBruno(spec);
        const request = brunoCollection.items[0];

        // token has no example at all → no substitution
        const token = request.request.headers.find((h) => h.name === 'token');
        expect(token.value).not.toBe('{{?token}}');

        // tag example is explicitly null → no substitution
        const tag = request.request.params.find((p) => p.name === 'tag');
        expect(tag.value).not.toBe('{{?tag}}');
      });
    });
  });
});
