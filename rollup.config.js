import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";
import clean from "rollup-plugin-clean";
import { string } from "rollup-plugin-string";
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/client/index.ts",
    output: {
      file: "dist/index.js",
      format: "cjs",
      exports: "default",
    },
    plugins: [
      typescript(),
      clean(),
      nodeResolve({
        preferBuiltins: true,
        moduleDirectories: ["node_modules", "fake_modules"],
      }),
      commonjs(),
      json(),
      copy({
        targets: [{ src: "src/client/config.js", dest: "dist" }],
      }),
      string({
        include: "**/*.njk",
      }),
    ],
  },
];
