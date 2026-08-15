import { runSubscriptionReminders } from "../../server";

export const config = {
  cron: "0 */6 * * *",
};

function isAuthorized(req: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers?.["authorization"] || "";
  return auth === `Bearer ${secret}` || req.headers?.["x-cron-secret"] === secret;
}

export default async function handler(req: any, res: any) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  await runSubscriptionReminders();
  return res.json({ ok: true });
}
