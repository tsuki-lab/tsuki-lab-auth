import { Hono } from "hono";
import { openAPISpecs, describeRoute } from "hono-openapi";
import { resolver, validator as vValidator } from "hono-openapi/valibot";
import * as v from "valibot";
import { apiReference } from "@scalar/hono-api-reference";
v.setGlobalConfig({ lang: "ja" });

const defaultResponseSchema = v.object({
  success: v.literal(true),
});

const validateErrorResponse = v.object({
  success: v.literal(false),
  issues: v.array(
    v.object({
      message: v.string(),
      path: v.array(
        v.object({
          key: v.string(),
          value: v.string(),
        })
      ),
    })
  ),
});

const app = new Hono();

app.post(
  "/auth/register",
  describeRoute({
    description: "ユーザー登録",
    responses: {
      200: {
        description: "登録成功",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                ...defaultResponseSchema.entries,
              })
            ),
          },
        },
      },
      400: {
        description: "入力エラー",
        content: {
          "application/json": {
            schema: resolver(validateErrorResponse),
          },
        },
      },
    },
  }),
  vValidator(
    "json",
    v.object({
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      email: v.pipe(v.string(), v.email(), v.minLength(1), v.maxLength(255)),
      password: v.pipe(v.string(), v.minLength(8), v.maxLength(16)),
    })
  ),
  (c) => {
    const body = c.req.valid("json");
    console.log(body);
    return c.json({ success: true });
  }
);

// ログイン
app.post(
  "/auth/login",
  vValidator(
    "json",
    v.object({
      email: v.pipe(v.string(), v.email(), v.minLength(1), v.maxLength(255)),
      password: v.pipe(v.string(), v.minLength(8), v.maxLength(16)),
    })
  ),
  describeRoute({
    description: "ログイン",
    responses: {
      200: {
        description: "ログイン成功",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                ...defaultResponseSchema.entries,
                token: v.string(),
              })
            ),
          },
        },
      },
      401: {
        description: "ログイン失敗",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                message: v.string(),
              })
            ),
          },
        },
      },
    },
  }),
  (c) => {
    const body = c.req.valid("json");
    if (body.email !== "" || body.password !== "") {
      return c.json(
        { message: "メールアドレスまたはパスワードが違います" },
        401
      );
    }
    return c.json({ success: true, token: "xxxxxxx" });
  }
);

// ログアウト
app.post(
  "/auth/logout",
  vValidator("json", v.object({ token: v.pipe(v.string(), v.minLength(1)) })),
  describeRoute({
    description: "ログアウト",
    responses: {
      200: {
        description: "ログアウト成功",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                ...defaultResponseSchema.entries,
              })
            ),
          },
        },
      },
      401: {
        description: "ログアウト失敗",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                message: v.string(),
              })
            ),
          },
        },
      },
    },
  }),
  (c) => {
    const body = c.req.valid("json");
    if (body.token !== "xxxxxxx") {
      return c.json({ message: "トークンが無効です" }, 401);
    }
    return c.json({ success: true });
  }
);

// トークンの更新
app.post(
  "/auth/refresh",
  vValidator("json", v.object({ token: v.pipe(v.string(), v.minLength(1)) })),
  describeRoute({
    description: "トークンの更新",
    responses: {
      200: {
        description: "更新成功",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                ...defaultResponseSchema.entries,
                token: v.string(),
              })
            ),
          },
        },
      },
      401: {
        description: "更新失敗",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                message: v.string(),
              })
            ),
          },
        },
      },
    },
  }),
  (c) => {
    const body = c.req.valid("json");
    if (body.token !== "xxxxxxx") {
      return c.json({ message: "トークンが無効です" }, 401);
    }
    return c.json({ success: true, token: "xxxxxxx" });
  }
);

// ユーザー情報の取得
app.get(
  "/users/me",
  vValidator("json", v.object({ token: v.pipe(v.string(), v.minLength(1)) })),
  describeRoute({
    validateResponse: true,
    description: "ユーザー情報の取得",
    responses: {
      200: {
        description: "取得成功",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                user: v.object({
                  id: v.number(),
                  name: v.string(),
                  email: v.string(),
                }),
              })
            ),
          },
        },
      },
      401: {
        description: "取得失敗",
        content: {
          "application/json": {
            schema: resolver(
              v.object({
                message: v.string(),
              })
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const body = c.req.valid("json");
    if (body.token !== "xxxxxxx") {
      return c.json({ message: "トークンが無効です" }, 401);
    }
    return c.json({
      success: true,
      user: { id: 1, name: "test", email: "test@example.com" },
    });
  }
);

// OpenAPI Specs
app.get(
  "/openapi",
  openAPISpecs(app, {
    documentation: {
      info: {
        title: "tsuki-lab-auth API",
        version: "1.0.0",
        description: "hanetsukiの個人開発 認証App API",
      },
      servers: [{ url: "http://localhost:8787", description: "Local Server" }],
    },
  })
);

// API Reference
app.get(
  "/ui",
  apiReference({
    theme: "saturn",
    spec: { url: "/openapi" },
  })
);

export default app;
