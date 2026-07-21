// @ts-check
import { nestJsConfig } from "@repo/eslint-config/nestjs";

export default nestJsConfig({
  tsconfigRootDir: import.meta.dirname,
});