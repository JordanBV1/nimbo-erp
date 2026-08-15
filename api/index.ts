import { app, registerApp } from "../server";

let ready: Promise<unknown> | null = null;

export default async function handler(req: any, res: any) {
  if (!ready) {
    ready = registerApp();
  }
  await ready;
  app(req, res);
}
