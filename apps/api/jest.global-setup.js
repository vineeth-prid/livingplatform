/**
 * Pin the test timezone.
 *
 * Runs before the workers fork, so every spec sees the same clock regardless of
 * the machine. Two failures reached a deploy gate because a spec read the
 * HOST's timezone and agreed with the developer's laptop but not the UTC
 * server. Rules that genuinely depend on a zone pass one explicitly (see
 * booking-timezone.spec.ts); nothing should depend on the ambient one.
 */
module.exports = () => {
  process.env.TZ = 'UTC';
};
