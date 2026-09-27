<<<<<<< HEAD
import { Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewActionDto, UpdateReviewDto } from './reviews.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async listReviews(@Req() req: any, @Query('status') status?: string) {
    return this.reviewsService.listReviews(req.user.userId, status);
  }

  @Get(':id')
  async getReview(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.getReview(req.user.userId, id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: ReviewActionDto, @Req() req: any) {
    return this.reviewsService.approve(req.user.userId, id, body);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: ReviewActionDto, @Req() req: any) {
    return this.reviewsService.reject(req.user.userId, id, body);
  }

  @Patch(':id')
  async updateReview(@Param('id') id: string, @Body() body: UpdateReviewDto, @Req() req: any) {
    return this.reviewsService.updateReview(req.user.userId, id, body);
  }
}
=======
import { Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewActionDto, UpdateReviewDto } from './reviews.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async listReviews(@Req() req: any, @Query('status') status?: string) {
    return this.reviewsService.listReviews(req.user.userId, status);
  }

  @Get(':id')
  async getReview(@Param('id') id: string, @Req() req: any) {
    return this.reviewsService.getReview(req.user.userId, id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: ReviewActionDto, @Req() req: any) {
    return this.reviewsService.approve(req.user.userId, id, body);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: ReviewActionDto, @Req() req: any) {
    return this.reviewsService.reject(req.user.userId, id, body);
  }

  @Patch(':id')
  async updateReview(@Param('id') id: string, @Body() body: UpdateReviewDto, @Req() req: any) {
    return this.reviewsService.updateReview(req.user.userId, id, body);
  }
}
>>>>>>> bcea0d03553fdd833798e33a77097d8bfb44600a
