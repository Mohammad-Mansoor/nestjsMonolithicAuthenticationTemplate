import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisCacheService
 * -----------------
 * A utility service for working with Redis cache in NestJS.
 * Features:
 *  - Namespaced keys
 *  - Automatic get-or-set pattern
 *  - Cache creation timestamps
 *  - Smart TTLs (permanent vs 5 minutes)
 *  - Prefix deletion and full reset
 */
@Injectable()
export class RedisCacheService implements OnModuleInit {
  private client: Redis;

  public get getClient(): Redis {
    return this.client;
  }

  constructor(private readonly configService: ConfigService) {}

  /**
   * Initialize Redis connection once the module starts
   */
  async onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);

    this.client.on('connect', () => console.log('✅ Redis connected'));
    this.client.on('error', (err) => console.error('❌ Redis Error:', err));
  }

  /**
   * Build a consistent Redis key with optional namespace.
   */
  private buildKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  /**
   * Store a value in Redis with optional TTL (seconds).
   * If TTL is not provided, data is stored permanently (until deleted manually).
   * Includes `__cachedAt` to track creation time.
   */
  async set(
    key: string,
    value: any,
    ttl?: number,
    namespace?: string,
  ): Promise<void> {
    const fullKey = this.buildKey(key, namespace);

    const payload = {
      data: value,
      __cachedAt: new Date().toISOString(),
    };

    const stringValue = JSON.stringify(payload);

    if (ttl && ttl > 0) {
      await this.client.setex(fullKey, ttl, stringValue);
    } else {
      await this.client.set(fullKey, stringValue);
    }
  }

  /**
   * Retrieve a cached value and its metadata.
   * Returns: { data, cachedAt, ageInMinutes, ageInHours }
   */
  async get<T = any>(
    key: string,
    namespace?: string,
  ): Promise<{
    data: T | null;
    cachedAt?: string | null;
    ageInMinutes?: number | null;
    ageInHours?: number | null;
    fromCache: boolean;
  }> {
    const fullKey = this.buildKey(key, namespace);
    const result = await this.client.get(fullKey);

    if (!result) {
      return {
        data: null,
        cachedAt: null,
        ageInMinutes: null,
        ageInHours: null,
        fromCache: false,
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch {
      parsed = { data: result };
    }

    const cachedAt = parsed.__cachedAt ? new Date(parsed.__cachedAt) : null;
    const now = new Date();

    const diffMs = cachedAt ? now.getTime() - cachedAt.getTime() : 0;
    const diffMinutes = diffMs / (1000 * 60);
    const diffHours = diffMinutes / 60;

    return {
      data: parsed.data ?? parsed,
      cachedAt: parsed.__cachedAt ?? null,
      ageInMinutes: diffMinutes ? +diffMinutes.toFixed(2) : null,
      ageInHours: diffHours ? +diffHours.toFixed(2) : null,
      fromCache: true,
    };
  }

  /**
   * Delete a specific cache key.
   */
  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    await this.client.del(fullKey);
  }

  /**
   * Check if a specific cache key exists.
   */
  async exists(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.buildKey(key, namespace);
    const result = await this.client.exists(fullKey);
    return result === 1;
  }

  /**
   * Increment a value in Redis.
   * If TTL is provided, it is set only if the key is new (result === 1).
   */
  async incr(
    key: string,
    ttl?: number,
    namespace?: string,
  ): Promise<number> {
    const fullKey = this.buildKey(key, namespace);
    const result = await this.client.incr(fullKey);
    if (result === 1 && ttl) {
      await this.client.expire(fullKey, ttl);
    }
    return result;
  }

  /**
   * Delete all cache keys that start with a given prefix.
   * Example: prefix = "auth:role:roles:list"
   */
  // async delByPrefix(prefix: string): Promise<void> {
  //   const keys = await this.client.keys(`${prefix}*`);
  //   if (keys.length > 0) {
  //     await this.client.del(keys);
  //   }
  // }
  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.client.scanStream({
      match: `${prefix}*`,
      count: 100, // Adjust batch size as needed
    });

    const pipeline = this.client.pipeline();

    stream.on('data', (keys: string[]) => {
      if (keys.length) {
        keys.forEach((key) => pipeline.del(key));
      }
    });

    return new Promise((resolve, reject) => {
      stream.on('end', async () => {
        await pipeline.exec();
        resolve();
      });

      stream.on('error', (err) => {
        console.error('❌ Redis SCAN error:', err);
        reject(err);
      });
    });
  }

  /**
   * Smart getOrSet helper:
   *  - If only `lang`, `limit`, `page` exist → cache permanently
   *  - Else → cache for 5 minutes (300s)
   */
  async getOrSet<T = any>(
    key: string,
    fetchFn: () => Promise<T>,
    query?: Record<string, any>,
    namespace?: string,
  ): Promise<{
    data: T;
    cached: boolean;
    cachedAt?: string;
    ageInMinutes?: number | null;
    ageInHours?: number | null;
  }> {
    const existing = await this.get<T>(key, namespace);

    // ✅ Return cached result if available
    if (existing.data !== null) {
      return {
        data: existing.data,
        cached: true,
        cachedAt: existing.cachedAt ?? undefined,
        ageInMinutes: existing.ageInMinutes,
        ageInHours: existing.ageInHours,
      };
    }

    // 🚀 Otherwise, fetch fresh data
    const freshData = await fetchFn();

    // ⏱ Determine if cache should be permanent or temporary
    const isPermanent = this.isPermanentQuery(query);
    const ttl = isPermanent ? 86400 : 300; // 5 min TTL

    await this.set(key, freshData, ttl, namespace);

    return { data: freshData, cached: false };
  }

  /**
   * Determines if query contains only: lang, limit, page.
   * These are considered "static" requests → cached permanently.
   */
  private isPermanentQuery(query: Record<string, any> = {}): boolean {
    const allowedKeys = ['lang', 'limit', 'page'];
    const keys = Object.keys(query);
    if (keys.length === 0) return true; // no filters = permanent
    return keys.every((k) => allowedKeys.includes(k));
  }

  /**
   * Flush ALL cache keys (use carefully).
   */
  async reset(): Promise<void> {
    await this.client.flushall();
  }
}