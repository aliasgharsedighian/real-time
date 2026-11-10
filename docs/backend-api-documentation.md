# Maintaining backend API documentation

Run the backend with its normal environment and open `/v1/documentations` on
the backend origin. Swagger UI uses the generated OpenAPI document, also
available at `/v1/documentations/openapi.json` and
`/v1/documentations/openapi.yaml`. Sign in and paste the access token into
**Authorize** to call protected endpoints. The Socket.IO event reference is
linked from Swagger and served at `/v1/documentations/socket-io.md`.

Treat a change to the public contract as incomplete until the corresponding
documentation has been updated in the same change. This applies to new
controllers and gateway events, as well as service changes that affect an
existing request, response, error, authorization rule, or emitted event.

## HTTP endpoints

1. Use `@ApiTags` on the controller and `@DocumentEndpoint` on each route.
   Describe its purpose, actual HTTP success status, response schema and
   expected errors. For JWT-protected controllers or methods, add
   `@DocumentBearerAuth` alongside the actual guard.
2. Keep input fields and validation rules in the route's DTO. The Nest
   Swagger plugin reads DTO properties during the build. Use `@ApiProperty`,
   `@ApiBody`, `@ApiParam` or `@ApiQuery` when the types or constraints need
   explicit metadata. Use `@DocumentUpload` for a single multipart `file` field.
3. Reuse or update response models in
   [schemas.ts](../backend/src/documentation/schemas.ts). Match the exact
   response envelope, nullability, and array structure returned by the service.
   Document empty and binary responses explicitly. Keep HTTP status separate
   from any `statusCode` field in the body. Use sample data and placeholder
   tokens in examples.
4. Run `npm run build` from `backend/`. Start the backend and inspect the
   generated OpenAPI JSON or Swagger UI. Check required parameters, auth,
   success and error statuses, and the example response against the handler.

## Socket.IO events

1. Update [socket-io.md](../backend/src/documentation/socket-io.md) whenever
   a `@SubscribeMessage` handler, broadcast, handshake, room rule or
   acknowledgement changes.
2. For each client event, document its name, payload, validation and membership
   rules, acknowledgement and errors. For each server event, document its
   payload, trigger and audience. Check services that publish indirectly, such
   as presence, typing, notifications and calls.
3. Reference shared OpenAPI models where the serialized shape is identical.
   Include a Socket.IO client example for new multi-step flows and verify the
   behavior with a client or the relevant integration suite.
