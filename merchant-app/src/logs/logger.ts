interface LogContext {
  siteId?: number;
  merchantAdminId?: number;
}

let getContext: () => LogContext = () => ({});

export function setLogContextProvider(provider: () => LogContext): void {
  getContext = provider;
}

function prefix(scope: string): string {
  const ctx = getContext();
  return `[merchant-app:${scope}:site=${ctx.siteId ?? 0}:admin=${ctx.merchantAdminId ?? 0}]`;
}

export const logger = {
  info(scope: string, ...args: unknown[]) {
    if (__DEV__) console.info(prefix(scope), ...args);
  },
  warn(scope: string, ...args: unknown[]) {
    if (__DEV__) console.warn(prefix(scope), ...args);
  },
  error(scope: string, ...args: unknown[]) {
    console.error(prefix(scope), ...args);
  },
};
