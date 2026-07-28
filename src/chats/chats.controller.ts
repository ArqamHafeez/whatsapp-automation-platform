import { Controller, Get, Patch, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class UpdateChatDto {
  isSource?: boolean;
  isDestination?: boolean;
}

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async listChats(@Query() query: any, @Req() req: any) {
    return this.chatsService.listChats(req.user.userId, query);
  }

  @Post('sync/:connectionId')
  async syncChats(@Param('connectionId') connectionId: string, @Req() req: any) {
    return this.chatsService.syncChats(req.user.userId, connectionId);
  }

  @Patch(':id')
  async updateChat(@Param('id') id: string, @Body() body: UpdateChatDto, @Req() req: any) {
    return this.chatsService.updateChat(req.user.userId, id, body);
  }
}
