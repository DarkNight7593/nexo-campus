import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/cdk.out*/**', '**/node_modules/**', 'outputs/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
