declare module "std/server" {
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare namespace Deno {
  interface Env {
    get(key: string): string | undefined;
  }
  const env: Env;
}
