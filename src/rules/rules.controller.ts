<<<<<<< HEAD
import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';
import { SimulateRuleDto } from './rules.simulate.dto';

@Controller('rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async listRules(@Req() req: any) {
    return this.rulesService.listRules(req.user.userId);
  }

  @Post()
  async createRule(@Body() body: CreateRuleDto, @Req() req: any) {
    return this.rulesService.createRule(req.user.userId, body);
  }

  @Get(':id')
  async getRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.getRule(req.user.userId, id);
  }

  @Patch(':id')
  async updateRule(@Param('id') id: string, @Body() body: UpdateRuleDto, @Req() req: any) {
    return this.rulesService.updateRule(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.deleteRule(req.user.userId, id);
  }

  @Post(':id/simulate')
  async simulateRule(@Param('id') id: string, @Body() body: SimulateRuleDto, @Req() req: any) {
    return this.rulesService.simulateRule(req.user.userId, id, body);
  }
}
=======
import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRuleDto, UpdateRuleDto } from './rules.dto';
import { SimulateRuleDto } from './rules.simulate.dto';

@Controller('rules')
@UseGuards(JwtAuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  async listRules(@Req() req: any) {
    return this.rulesService.listRules(req.user.userId);
  }

  @Post()
  async createRule(@Body() body: CreateRuleDto, @Req() req: any) {
    return this.rulesService.createRule(req.user.userId, body);
  }

  @Get(':id')
  async getRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.getRule(req.user.userId, id);
  }

  @Patch(':id')
  async updateRule(@Param('id') id: string, @Body() body: UpdateRuleDto, @Req() req: any) {
    return this.rulesService.updateRule(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteRule(@Param('id') id: string, @Req() req: any) {
    return this.rulesService.deleteRule(req.user.userId, id);
  }

  @Post(':id/simulate')
  async simulateRule(@Param('id') id: string, @Body() body: SimulateRuleDto, @Req() req: any) {
    return this.rulesService.simulateRule(req.user.userId, id, body);
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
