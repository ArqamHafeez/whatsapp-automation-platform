import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  async listReviews() {
    return this.reviewsService.listReviews();
  }

  @Get(':id')
  async getReview(@Param('id') id: string) {
    return this.reviewsService.getReview(id);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body() body: any) {
    return this.reviewsService.approve(id, body);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body() body: any) {
    return this.reviewsService.reject(id, body);
  }

  @Patch(':id')
  async updateReview(@Param('id') id: string, @Body() body: any) {
    return this.reviewsService.updateReview(id, body);
  }
}
