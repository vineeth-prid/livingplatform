import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Injects the authenticated principal (or one of its fields) into a handler:
 *   `@CurrentUser() user: AuthenticatedUser`
 *   `@CurrentUser('id') userId: string`
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
