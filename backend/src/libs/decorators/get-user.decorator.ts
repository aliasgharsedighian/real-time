import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: any = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
