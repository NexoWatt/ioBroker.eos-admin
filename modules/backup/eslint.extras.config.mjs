import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config({
 files:['modules/backup/src/extras.ts','modules/backup/src/notifications.ts'],
 extends:tseslint.configs.recommendedTypeChecked,
 languageOptions:{globals:globals.node,parserOptions:{project:'./modules/backup/tsconfig.json',tsconfigRootDir:import.meta.dirname+'/../..'}},
 rules:{
  // The MQTT constructor is synchronous; loading stays inside the isolated worker path.
  '@typescript-eslint/no-require-imports':'off',
  'no-eval':'error','no-implied-eval':'error','no-new-func':'error','no-proto':'error','no-extend-native':'error',
 },
});
