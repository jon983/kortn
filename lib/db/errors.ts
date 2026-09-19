export class OptimisticLockError extends Error {
  constructor(message = 'Optimistic lock conflict') {
    super(message);
    this.name = 'OptimisticLockError';
  }
}
