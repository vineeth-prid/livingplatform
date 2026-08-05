/**
 * A Prisma stub that answers for ANY model, created on access.
 *
 * Boot smoke tests override `PrismaService` so the graph can initialise without
 * a database. A hand-written allowlist of models is the wrong shape for that:
 * it makes the suite fail whenever an `onModuleInit` touches a model nobody
 * remembered to add, and fail *config-dependently*, because such hooks commonly
 * early-return on a provider or feature flag.
 *
 * `WhatsAppSessionService` is the worked example. It returns immediately unless
 * the WhatsApp provider is `openwa`, so a three-method stub passed in dev and
 * failed only where `WHATSAPP_PROVIDER=openwa` — that is, on the deployment
 * that mattered, at deploy time, on a test gate.
 *
 * Auto-vivifying every model closes that class of failure. This is deliberately
 * NOT a database simulation: it exists so the graph can *initialise*, and reads
 * come back empty. Anything asserting real query behaviour belongs in the
 * owning service's own spec, where the shape of the data is the point.
 */
export function createPrismaStub(): Record<string, unknown> {
  const model = () =>
    new Proxy({} as Record<string, unknown>, {
      get(target, method) {
        if (typeof method === 'symbol') return undefined;
        // Never let the stub look like a promise: both Nest and Jest probe for
        // `then` when awaiting a value, and a jest.fn() there is treated as a
        // thenable that never settles.
        if (method === 'then' || method === 'catch' || method === 'finally') return undefined;
        target[method] ??= jest.fn().mockResolvedValue(
          method.startsWith('findMany') ? [] : method === 'count' ? 0 : {},
        );
        return target[method];
      },
    });

  const root: Record<string, unknown> = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $on: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(root)
        : Promise.resolve([])),
  };

  return new Proxy(root, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
      target[prop] ??= model();
      return target[prop];
    },
  });
}
