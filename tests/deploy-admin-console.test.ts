import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin console reverse-proxy boundary", () => {
  it("guards the independent admin page before serving the SPA", () => {
    const source = readFileSync(
      new URL("../deploy/nginx-liang111.conf", import.meta.url),
      "utf8"
    );
    const start = source.indexOf("location ~ ^/admin/?$ {");
    const end = source.indexOf("\n    }", start);
    const adminLocation = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(adminLocation).toContain("auth_request /_auth/posture-admin;");
    expect(adminLocation).toContain("error_page 401 = @posture_login;");
    expect(adminLocation).toContain("error_page 403 = @posture_not_found;");
    expect(adminLocation).toContain("try_files /index.html =404;");
    expect(source).toContain("location @posture_not_found");
  });
});
