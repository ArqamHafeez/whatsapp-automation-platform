import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@Req() req: { user: { userId: string } }) {
    return this.usersService.listUsers(req.user.userId);
  }

  @Post()
  async createUser(@Body() body: CreateUserDto, @Req() req: { user: { userId: string } }) {
    return this.usersService.createUser(req.user.userId, body);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.usersService.updateUser(req.user.userId, id, body);
  }
}
