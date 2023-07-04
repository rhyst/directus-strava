import copy from "rollup-plugin-copy";
import { string } from "rollup-plugin-string";

export default {
  plugins: [
    copy({
      targets: [{ src: "src/config.js", dest: "dist" }],
    }),
    string({
      include: "**/*.njk",
    }),
  ],
};
