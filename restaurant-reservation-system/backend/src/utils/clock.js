const realNow = () => new Date();

// Services call clock.now() instead of new Date() so tests can set the time.
export const clock = {
  now: realNow,
  reset() {
    this.now = realNow;
  },
};
