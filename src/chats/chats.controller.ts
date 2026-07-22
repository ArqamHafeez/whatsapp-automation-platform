import { Controller, Get, Patch, Post, Body, Param, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async listChats(@Query() query: any) {
    return this.chatsService.listChats(query);
  }

  @Patch(':id')
  async updateChat(@Param('id') id: string, @Body() body: any) {
    return this.chatsService.updateChat(id, body);
  }
}
