import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

type Bucket = { timestamps: number[] };

/** In-memory per-org rate limit for Opportunity Circle public ingest endpoints. */
@Injectable()
export class OpportunityCircleRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs = 60_000;
  private readonly maxPerWindow = Number(process.env.OC_INGEST_RATE_LIMIT_PER_MINUTE || 120);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const integration = req.opportunityCircleIntegration as { orgId?: string } | undefined;
    const orgId = integration?.orgId ?? 'unknown';

    const now = Date.now();
    const bucket = this.buckets.get(orgId) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < this.windowMs);

    if (bucket.timestamps.length >= this.maxPerWindow) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Retry after a minute.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.timestamps.push(now);
    this.buckets.set(orgId, bucket);
    return true;
  }
}
