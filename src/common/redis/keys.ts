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

export const usersNotificationCacheKeys = {
    USER_NOTIFICATION_OPTIONS: (userId: string, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USERS_NOTIFICATION_OPTIONS}:single`;
        return `${nameSpaces.USERS_NOTIFICATION_OPTIONS}:single:${userId}`;
    },

    USER_NOTIFICATION_OPTIONS_LIST: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USERS_NOTIFICATION_OPTIONS}:list`;
        return generateCacheKey(nameSpaces.USERS_NOTIFICATION_OPTIONS, 'list', query || {});
    },
}

export const userDeviceCacheKeys = {
    USER_BASE_DEVICE: (userId: string, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USER_DEVICE}:single`;
        return `${nameSpaces.USER_DEVICE}:single:${userId}`;
    },

    USER_BASE_DEVICES: (userId:string, isPrefix: boolean = false, query?:any) => {
        if (isPrefix) return `${nameSpaces.USER_DEVICE}:user-base:${userId}`;
        return generateCacheKey(nameSpaces.USER_DEVICE, `user-base:${userId}`, query || {});
    },

    USERS_DEVICES_LIST: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USER_DEVICE}:list`;
        return generateCacheKey(nameSpaces.USER_DEVICE, 'list', query || {});
    },
}

export const usersCacheKeys = {
    USERS_LIST: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USERS}:list`;
        return generateCacheKey(nameSpaces.USERS, 'list', query || {});
    },
    USERS_SINGLE: (userId: string, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USERS}:single`;
        return `${nameSpaces.USERS}:single:${userId}`;
    },

    USERS_LIST_FOR_DROPDOWN: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.USERS}:list-dropdown`;
        return generateCacheKey(nameSpaces.USERS, 'list-dropdown', query || {});
    },
}

export const fileCacheKeys = {
    FILE_SINGLE: (fileId: string | number, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.FILES}:single`;
        return `${nameSpaces.FILES}:single:${fileId}`;
    },

    USER_FILES: (uploaderId: string, query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.FILES}:list-user:${uploaderId}`;
        return generateCacheKey(nameSpaces.FILES, `list-user:${uploaderId}`, query || {});
    },

    FILES_LIST: (query?: any, isPrefix: boolean = false) => {
        if (isPrefix) return `${nameSpaces.FILES}:list`;
        return generateCacheKey(nameSpaces.FILES, 'list', query || {});
    },
}