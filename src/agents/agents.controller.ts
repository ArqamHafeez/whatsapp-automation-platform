import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async listAgents() {
    return this.agentsService.listAgents();
  }

  @Post()
  async createAgent(@Body() body: any) {
    return this.agentsService.createAgent(body);
  }

  @Get(':id')
  async getAgent(@Param('id') id: string) {
    return this.agentsService.getAgent(id);
  }

  @Patch(':id')
  async updateAgent(@Param('id') id: string, @Body() body: any) {
    return this.agentsService.updateAgent(id, body);
  }
}
