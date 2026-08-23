import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { APP_VERSION } from './config.js';

describe('APP_VERSION', () => {
  it('reads the version from package.json', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const pkg: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
    expect(pkg).toEqual(expect.objectContaining({ version: expect.any(String) }));
    const version =
      pkg && typeof pkg === 'object' && 'version' in pkg && typeof pkg.version === 'string' ? pkg.version : '';
    expect(APP_VERSION).toBe(version);
  });
});
