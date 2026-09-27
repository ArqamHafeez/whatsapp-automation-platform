<<<<<<< HEAD
import { Controller, Get, Post, Body, Param, Req, UseGuards, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { ConnectorService } from './connector.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

@Controller('connections')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Post()
  async createConnection(@Body() body: CreateConnectionDto, @Req() req: any) {
    return this.connectorService.createConnection(req.user.userId, body);
  }

  @Get()
  async listConnections(@Req() req: any) {
    return this.connectorService.listConnections(req.user.userId);
  }

  @Get(':id/qr-image')
  async getQrImage(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const { buffer, mime } = await this.connectorService.getQrImage(req.user.userId, id);
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get(':id/qr-data')
  async getQrData(@Param('id') id: string, @Req() req: any) {
    const { buffer, mime } = await this.connectorService.getQrImage(req.user.userId, id);
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    };
  }

  @Get(':id')
  async getConnection(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.getConnection(req.user.userId, id);
  }

  @Post(':id/refresh-qr')
  async refreshQr(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.refreshQr(req.user.userId, id);
  }

  @Post(':id/disconnect')
  async disconnect(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.disconnect(req.user.userId, id);
  }

  @Post(':id/register-webhook')
  async registerWebhook(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.registerWebhook(req.user.userId, id);
  }
}
=======
import { Controller, Get, Post, Body, Param, Req, UseGuards, Res } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { ConnectorService } from './connector.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Post()
  async createConnection(@Body() body: CreateConnectionDto, @Req() req: any) {
    return this.connectorService.createConnection(req.user.userId, body);
  }

  @Get()
  async listConnections(@Req() req: any) {
    return this.connectorService.listConnections(req.user.userId);
  }

  @Get(':id/qr-image')
  async getQrImage(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const { buffer, mime } = await this.connectorService.getQrImage(req.user.userId, id);
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'no-store');
    res.send(buffer);
  }

  @Get(':id/qr-data')
  async getQrData(@Param('id') id: string, @Req() req: any) {
    const { buffer, mime } = await this.connectorService.getQrImage(req.user.userId, id);
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    };
  }

  @Get(':id')
  async getConnection(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.getConnection(req.user.userId, id);
  }

  @Post(':id/refresh-qr')
  async refreshQr(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.refreshQr(req.user.userId, id);
  }

  @Post(':id/disconnect')
  async disconnect(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.disconnect(req.user.userId, id);
  }

  @Post(':id/register-webhook')
  async registerWebhook(@Param('id') id: string, @Req() req: any) {
    return this.connectorService.registerWebhook(req.user.userId, id);
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
