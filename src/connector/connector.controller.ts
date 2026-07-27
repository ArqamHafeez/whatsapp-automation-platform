import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ConnectorService } from './connector.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateConnectionDto {
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
}
