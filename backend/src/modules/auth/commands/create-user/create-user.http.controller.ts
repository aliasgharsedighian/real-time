import { ApiTags } from '@nestjs/swagger';
import { DocumentEndpoint } from '../../../../documentation/http';
import { envelope, object, ref } from '../../../../documentation/schemas';
import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { SignUpRequestDto } from './create-user.request.dto';
import { CreateUserService } from './create-user.service';

@ApiTags('Auth')
@Controller(routesV1.version)
export class CreateUserHttpController {
  constructor(private createAuth: CreateUserService) {}

  @Post(routesV1.auth.signup)
  @DocumentEndpoint(
    'Create an account',
    201,
    envelope(object({ token: ref('Tokens') }), 201),
    [400, 409],
  )
  signup(@Body() body: SignUpRequestDto) {
    return this.createAuth.execute(body);
  }
}
