import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';
import { schemas } from './schemas';

const documentationPath = '/v1/documentations';

export function setupApiDocumentation(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Real-time API')
    .setVersion('1')
    .setDescription(
      'HTTP API for authentication, chat and media. Sign in to obtain an access token and enter it under Authorize.\n\n' +
        '[Socket.IO event reference](/v1/documentations/socket-io.md)',
    )
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.components ??= {};
  document.components.schemas = { ...document.components.schemas, ...schemas };

  SwaggerModule.setup(documentationPath, app, document, {
    jsonDocumentUrl: documentationPath + '/openapi.json',
    yamlDocumentUrl: documentationPath + '/openapi.yaml',
  });

  const socketReference = readFileSync(join(__dirname, 'socket-io.md'), 'utf8');
  app
    .getHttpAdapter()
    .get(
      documentationPath + '/socket-io.md',
      (_request, response: Response) => {
        response.type('text/plain').send(socketReference);
      },
    );
}
