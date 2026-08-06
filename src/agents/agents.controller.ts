import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAgentDto, UpdateAgentDto } from './agents.dto';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async listAgents(@Req() req: any) {
    return this.agentsService.listAgents(req.user.userId);
  }

  @Post()
  async createAgent(@Body() body: CreateAgentDto, @Req() req: any) {
    return this.agentsService.createAgent(req.user.userId, body);
  }

  @Get(':id')
  async getAgent(@Param('id') id: string, @Req() req: any) {
    return this.agentsService.getAgent(req.user.userId, id);
  }

  @Patch(':id')
  async updateAgent(@Param('id') id: string, @Body() body: UpdateAgentDto, @Req() req: any) {
    return this.agentsService.updateAgent(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteAgent(@Param('id') id: string, @Req() req: any) {
    return this.agentsService.deleteAgent(req.user.userId, id);
  }
}
