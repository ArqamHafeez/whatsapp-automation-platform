import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { OpportunityCircleIntegrationService } from './opportunity-circle-integration.service';

@Injectable()
export class OpportunityCircleKeyGuard implements CanActivate {
  constructor(private readonly integrationService: OpportunityCircleIntegrationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer API key');
    }
    const rawKey = header.slice('Bearer '.length).trim();
    const integration = await this.integrationService.findByRawKey(rawKey);
    if (!integration || !integration.enabled) {
      throw new UnauthorizedException('Invalid or disabled integration key');
    }
    req.opportunityCircleIntegration = integration;
    return true;
  }
}
