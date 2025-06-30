import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { SignUpRequestDto } from './create-user.request.dto';
import { CreateUserService } from './create-user.service';

@Controller(routesV1.version)
export class CreateUserHttpController {
  constructor(private createAuth: CreateUserService) {}

  @Post(routesV1.auth.signup)
  signup(@Body() body: SignUpRequestDto) {
    return this.createAuth.execute(body);
  }
}
