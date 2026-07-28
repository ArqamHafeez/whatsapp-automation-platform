import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('rules')
@UseGuards(JwtAuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async listRules(@Req() req: any) {
    return this.rulesService.listRules(req.user.userId);
  }

  @Post()
  async createRule(@Body() body: any, @Req() req: any) {
    return this.rulesService.createRule(req.user.userId, body);
  }

  @Get(':id')
  async getRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.getRule(req.user.userId, id);
  }

  @Patch(':id')
  async updateRule(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.rulesService.updateRule(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.deleteRule(req.user.userId, id);
  }
}
