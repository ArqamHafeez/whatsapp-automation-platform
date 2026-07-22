import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { RulesService } from './rules.service';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async listRules() {
    return this.rulesService.listRules();
  }

  @Post()
  async createRule(@Body() body: any) {
    return this.rulesService.createRule(body);
  }

  @Get(':id')
  async getRule(@Param('id') id: string) {
    return this.rulesService.getRule(id);
  }

  @Patch(':id')
  async updateRule(@Param('id') id: string, @Body() body: any) {
    return this.rulesService.updateRule(id, body);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string) {
    return this.rulesService.deleteRule(id);
  }
}
