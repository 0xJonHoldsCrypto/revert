import js from "@eslint/js";
import tseslint from "typescript-eslint";

const noComments = {
  meta: { type: "problem" },
  create(context) {
    return {
      Program() {
        for (const comment of context.getSourceCode().getAllComments()) {
          context.report({ loc: comment.loc, message: "Comments are banned. Rename symbols or add tests instead." });
        }
      },
    };
  },
};

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { local: { rules: { "no-comments": noComments } } },
    rules: {
      "local/no-comments": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      eqeqeq: "error",
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "formal/**", "server/**"],
  }
);
