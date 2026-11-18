// Isolated consumer verification can select fresh services without touching existing sessions.
export const chatbotOrigins = {
  baseline: process.env.DEMO_TEST_BASELINE_ORIGIN ?? "http://localhost:5180",
  integrated:
    process.env.DEMO_TEST_INTEGRATED_ORIGIN ?? "http://localhost:5181",
  host: process.env.DEMO_TEST_HOST_ORIGIN ?? "http://127.0.0.1:4183",
};
export const chatbotUrl = (port: number) =>
  port === 5180 ? chatbotOrigins.baseline : chatbotOrigins.integrated;
