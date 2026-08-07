import { Controller, Get, Patch, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ChatsService } from './chats.service';
import { UpdateChatDto } from './chats.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('chats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  async listChats(@Query() query: Record<string, string | undefined>, @Req() req: { user: { userId: string } }) {
    return this.chatsService.listChats(req.user.userId, query);
  }

  @Post('sync/:connectionId')
  async syncChats(@Param('connectionId') connectionId: string, @Req() req: { user: { userId: string } }) {
    return this.chatsService.syncChats(req.user.userId, connectionId);
  }

  @Patch(':id')
  async updateChat(
    @Param('id') id: string,
    @Body() body: UpdateChatDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.chatsService.updateChat(req.user.userId, id, body);
  }
}
