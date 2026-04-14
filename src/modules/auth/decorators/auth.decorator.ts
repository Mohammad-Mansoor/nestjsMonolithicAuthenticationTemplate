import { SetMetadata } from '@nestjs/common';

export enum AuthType {
  Bearer,
  Public,
  None,
}

export const AUTH_TYPE_KEY = 'authType';

export const Public = () => SetMetadata(AUTH_TYPE_KEY, [AuthType.Public]);
export const Auth = (...authTypes: AuthType[]) => SetMetadata(AUTH_TYPE_KEY, authTypes);
