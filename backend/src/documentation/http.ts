import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import type {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { object, ref } from './schemas';

const errors: Record<number, string> = {
  400: 'Invalid request',
  401: 'Missing or invalid credentials',
  403: 'Permission denied',
  404: 'Resource unavailable',
  409: 'Resource already exists',
  413: 'File exceeds the upload limit',
  429: 'Rate limit exceeded',
  503: 'Media processing unavailable',
};

function documentError(status: number) {
  return ApiResponse({
    status,
    description: errors[status],
    content: {
      'application/json': {
        schema: ref('ErrorResponse'),
        example: { statusCode: status, message: errors[status] },
      },
    },
  });
}

export function DocumentEndpoint(
  summary: string,
  status: number,
  schema?: SchemaObject | ReferenceObject,
  errorStatuses: number[] = [],
) {
  return applyDecorators(
    ApiOperation({ summary }),
    ApiResponse({ status, description: summary, schema }),
    ...[...errorStatuses, 429].map(documentError),
  );
}

export function DocumentBearerAuth() {
  return applyDecorators(ApiBearerAuth(), documentError(401));
}

export function DocumentUpload() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: object({ file: { type: 'string', format: 'binary' } }),
    }),
  );
}
