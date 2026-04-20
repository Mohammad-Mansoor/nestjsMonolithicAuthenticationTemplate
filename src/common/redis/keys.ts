import { generateCacheKey } from "./generateCachekey.utils";
import { nameSpaces } from "./nameSpaces";

export const sessionCacheKeys = {
    SINGLE_SESSION: (sessionId: string, isPrefix: boolean = false) => 
        isPrefix ? `${nameSpaces.SESSIONS}:single` : `${nameSpaces.SESSIONS}:single:${sessionId}`,
    
    SESSIONS_LIST: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.SESSIONS}:list`;
        return generateCacheKey(nameSpaces.SESSIONS, 'list', query || {});
    },

    USER_SESSIONS: (userId: string, query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.SESSIONS}:list-user:${userId}`;
        return generateCacheKey(nameSpaces.SESSIONS, `list-user:${userId}`, query || {});
    },

    USER_SINGLE_SESSION: (userId: string, sessionId?: string, isPrefix: boolean = false) => {
        if (isPrefix) {
            return `${nameSpaces.SESSIONS}:single-user:${userId}`;
        }
        return `${nameSpaces.SESSIONS}:single-user:${userId}:${sessionId}`;
    },
}