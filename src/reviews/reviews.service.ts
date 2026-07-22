import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReviews() {
    return { message: 'Review list not implemented yet' };
  }

  async getReview(id: string) {
    return { message: 'Get review not implemented yet', id };
  }

  async approve(id: string, data: any) {
    return { message: 'Approve review not implemented yet', id, data };
  }

  async reject(id: string, data: any) {
    return { message: 'Reject review not implemented yet', id, data };
  }

  async updateReview(id: string, data: any) {
    return { message: 'Update review not implemented yet', id, data };
  }
}
