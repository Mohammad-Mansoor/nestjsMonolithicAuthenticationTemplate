import { BadRequestException, Injectable } from "@nestjs/common";
import { RedisCacheService } from "src/common/redis/redis-cache.service";
import { Sessions } from "./entities/sessions.entity";
import { IsNull, MoreThan, Not, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { sessionCacheKeys } from "src/common/redis/keys";
import { nameSpaces } from "src/common/redis/nameSpaces";
import { UserDevice } from "./entities/user-device.entity";


@Injectable()
export class SessionsService{
    constructor(
        @InjectRepository(Sessions)
        private readonly sessionsRepository: Repository<Sessions>,
        private readonly redisCacheService: RedisCacheService,
        private readonly configService: ConfigService,

    ){}

    async createSession(sessionData: Partial<Sessions>): Promise<Sessions> {
        const session = this.sessionsRepository.create(sessionData);
        const cacheKey = sessionCacheKeys.SESSIONS_LIST
    if(!sessionData.userId ){
    throw new BadRequestException("User ID is required for session operations.")
}
        await this.redisCacheService.delByPrefix(sessionCacheKeys.SESSIONS_LIST(null, true));
        await this.redisCacheService.delByPrefix(sessionCacheKeys.USER_SESSIONS(sessionData.userId, null, true));


        return this.sessionsRepository.save(session);
    }

    async findSessionById(sessionId: string) {
        const cacheKey = sessionCacheKeys.SINGLE_SESSION(sessionId)
        const queryDb = async ()=>{
            const session = await this.sessionsRepository.findOne({where: {id: sessionId}})
            if(!session){
                return null;
            }
            return session;
        }
        return await this.redisCacheService.getOrSet(cacheKey, queryDb);
    }

    async findUserSessions(userId: string, query:any) {
        const cacheKey = sessionCacheKeys.USER_SESSIONS(userId, query)
        const queryDb = async ()=>{
            const sessions = await this.sessionsRepository.find({where: {userId}})
            if(!sessions){
                return [];
            }
            return sessions;
        }

        const response =  {
            message: "User sessions retrieved successfully.",
            data: await this.redisCacheService.getOrSet(cacheKey, queryDb),
        }
        return response;
    }
    async findUserSingleSession(userId: string, sessionId: string) {
        const cacheKey = sessionCacheKeys.USER_SINGLE_SESSION(userId, sessionId)
        const queryDb = async ()=>{
            const session = await this.sessionsRepository.findOne({where: {id: sessionId, userId}})
            if(!session){
                return null;
            }
            return session;
        }
        return await this.redisCacheService.getOrSet(cacheKey, queryDb);
    }

    /**
     * Performs a strict session validation by checking JWT details
     * against stored session state and the physical device identity.
     */
    async validateSession(sessionId: string, userId: string, deviceId?: string, fingerprint?: string) {
        // Cache Key is now simplified to just the sessionId. 
        // This makes invalidation during logout 100% reliable.
        const cacheKey = sessionCacheKeys.USER_SINGLE_SESSION(userId, sessionId);
        
        const queryDb = async () => {
            const session = await this.sessionsRepository.findOne({
                where: { id: sessionId, userId, isValid: true, expiresAt: MoreThan(new Date()), revokedAt: IsNull() }
            });

            if (!session) return null;

            // Fetch the hardware fingerprint associated with this device identity
            const knownDevice = await this.sessionsRepository.manager.getRepository(UserDevice).findOneBy({
                deviceId: session.deviceId,
                userId
            });
            
            // We cache the session AND the allowed fingerprint together
            return {
                ...session,
                allowedFingerprint: knownDevice?.fingerprint
            };
        };

        const session: any = await this.redisCacheService.getOrSet(cacheKey, queryDb);
        
        if (!session) return null;

        // --- IDENTITY LOCK CHECK ---
        // This check now runs on EVERY request, even if the session is cached.
        const isCookieMatch = session.deviceId === deviceId;
        const isFingerprintMatch = session.allowedFingerprint === fingerprint;

        if (!isCookieMatch && !isFingerprintMatch) {
            console.warn(`[SECURITY ALERT] Unauthorized device access attempt | User: ${userId} | Session: ${sessionId}`);
            return null;
        }

        return session;
    }

    async invalidateSession(sessionId: string, userId:string, revokeReason:string){
        const cacheKey = sessionCacheKeys.USER_SINGLE_SESSION(userId, sessionId)
       
            const session = await this.sessionsRepository.findOne({where: {id: sessionId, userId, revokedAt: IsNull(), isValid: true, expiresAt: MoreThan(new Date())}})
            if(!session){
                return null;
            }
            session.isValid = false;
            session.revokedAt = new Date();
            session.revokeReason = revokeReason || 'Session revoked via user logout';
            await this.sessionsRepository.save(session);
            await this.redisCacheService.del(cacheKey);
            await this.redisCacheService.delByPrefix(sessionCacheKeys.SESSIONS_LIST(null, true));
            await this.redisCacheService.delByPrefix(sessionCacheKeys.USER_SESSIONS(userId, null, true));
            return session;
        
        
    }

    async invalidateAllSessions(userId:string, revokeReason:string){
        const cacheKey = sessionCacheKeys.USER_SESSIONS(userId)
       
            const session = await this.sessionsRepository.find({where: {userId, revokedAt: IsNull(), isValid: true, expiresAt: MoreThan(new Date())}})
            if(!session){
                return null;
            }
            session.forEach((session) => {
                session.isValid = false;
                session.revokedAt = new Date();
                session.revokeReason = revokeReason || 'Session revoked via user logout';
            });
            await this.sessionsRepository.save(session);
            await this.redisCacheService.del(cacheKey);
            await this.redisCacheService.delByPrefix(sessionCacheKeys.SESSIONS_LIST(null, true));
            await this.redisCacheService.delByPrefix(sessionCacheKeys.USER_SESSIONS(userId, null, true));
            return session;
        
        
    }

    async invalidOtherSessions(userId:string, currentSessionId:string, revokeReason:string){
        const cacheKeyPrefix = sessionCacheKeys.USER_SINGLE_SESSION(userId, currentSessionId, true)

       
            const session = await this.sessionsRepository.find({where: {userId, revokedAt: IsNull(), isValid: true, expiresAt: MoreThan(new Date()), id: Not(currentSessionId)}})
            if(!session){
                return null;
            }
            session.forEach((session) => {
                session.isValid = false;
                session.revokedAt = new Date();
                session.revokeReason = revokeReason || 'Session revoked via user logout';
            });
            await this.sessionsRepository.save(session);
            await this.redisCacheService.delByPrefix(cacheKeyPrefix);
            await this.redisCacheService.delByPrefix(sessionCacheKeys.SESSIONS_LIST(null, true));
            await this.redisCacheService.delByPrefix(sessionCacheKeys.USER_SESSIONS(userId, null, true));
            return session;
        
        
    }

}