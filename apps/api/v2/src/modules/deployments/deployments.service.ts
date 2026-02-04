import { DeploymentsRepository } from "@/modules/deployments/deployments.repository";
import { RedisService } from "@/modules/redis/redis.service";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const CACHING_TIME = 86400000; // 24 hours in milliseconds

const getLicenseCacheKey = (key: string) => `api-v2-license-key-goblin-url-${key}`;

type LicenseCheckResponse = {
  status: boolean;
};
@Injectable()
export class DeploymentsService {
  constructor(
    private readonly deploymentsRepository: DeploymentsRepository,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async checkLicense() {
    // Dev bypass: always return true in non-production environments (local/dev/testing only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('Dev mode: License check bypassed');
      return true;
    }

    if (this.configService.get("e2e")) {
      return true;
    }

    let licenseKey = this.configService.get("api.licenseKey");

    if (!licenseKey) {
      /** We try to check on DB only if env is undefined */
      const deployment = await this.deploymentsRepository.getDeployment();
      licenseKey = deployment?.licenseKey ?? undefined;
    }

    if (!licenseKey) {
      return false;
    }

    const licenseKeyUrl = this.configService.get("api.licenseKeyUrl") + `/${licenseKey}`;

    const cachedData = await this.redisService.redis.get(getLicenseCacheKey(licenseKey));
    if (cachedData) {
      const parsed = JSON.parse(cachedData) as any;
      // Support both old .status and current .valid formats
      return parsed?.status ?? parsed?.valid ?? false;
    }

    try {
      const response = await fetch(licenseKeyUrl);
      if (!response.ok) {
        console.warn(`License validation fetch failed with status: ${response.status}`);
        return false;
      }
      const data = await response.json() as any;
      const cacheKey = getLicenseCacheKey(licenseKey);
      this.redisService.redis.set(cacheKey, JSON.stringify(data), "EX", CACHING_TIME);

      // Support both old .status and current .valid formats
      return data?.status ?? data?.valid ?? false;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }
}
