export const APP_PATHS = {
  home: '/',
  plan: '/plan/:planId',
  signIn: '/sign-in',
  signUp: '/sign-up',
  invite: '/invite/:token',
  legal: '/legal',
} as const;

export function planPath(planId: string): string {
  return `/plan/${planId}`;
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}
