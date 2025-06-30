import { Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { routesV1 } from 'src/config/app.routes';
import { GetMessagesService } from './polling.service';

@Controller(routesV1.version)
export class PollingController {
  constructor(private messageService: GetMessagesService) {}

  @Get(routesV1.polling.message)
  async getMessage() {
    const result = await this.messageService.getMessage();
    return {
      statusCode: HttpStatus.OK,
      message: 'get messages successfully',
      data: result,
    };
  }

  @Post(routesV1.polling.message)
  async sendMessage() {
    const result = await this.messageService.sendMessage();
    return {
      statusCode: 201,
      message: 'send messages successfully',
      data: result,
    };
  }
}
