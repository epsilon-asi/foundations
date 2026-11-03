import {defineConfig} from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/types.ts",
                "src/index.ts",
                "src/examples.ts",
                "src/common/example/**/*.ts",
                "src/blogger/**/*.ts",
                "src/engineer/**/*.ts",
            ],
            thresholds: {
                branches: 90,
                functions: 90,
                lines: 90,
                statements: 90
            }
        }
    }
});
