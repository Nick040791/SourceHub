import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'yaml';
import { substituteSecretRefs, containsSecretRef } from '../server/workflowService';

describe('WorkflowRunner: YAML Parsing & Step Evaluation', () => {
  const sampleWorkflowYaml = `
name: SourceHub CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Install and Build
        run: npm ci && npm run build
        env:
          NODE_ENV: production

      - name: Deploy Staging
        run: 'curl -H "Authorization: Bearer \${{ secrets.API_TOKEN }}" https://api.sourcehub.local/deploy'
        env:
          DEPLOY_TOKEN: \${{ secrets.API_TOKEN }}
`;

  test('parses workflow name and event triggers', () => {
    const parsed = yaml.parse(sampleWorkflowYaml);
    assert.equal(parsed.name, 'SourceHub CI');
    assert.ok(parsed.on.push);
    assert.ok(parsed.on.pull_request);
  });

  test('extracts job steps cleanly', () => {
    const parsed = yaml.parse(sampleWorkflowYaml);
    const steps = parsed.jobs.test.steps;
    assert.equal(steps.length, 3);
    assert.equal(steps[0].name, 'Checkout Code');
    assert.equal(steps[0].uses, 'actions/checkout@v4');
    assert.equal(steps[1].name, 'Install and Build');
    assert.equal(steps[1].run, 'npm ci && npm run build');
    assert.equal(steps[2].name, 'Deploy Staging');
  });

  test('substitutes secrets into environment values', () => {
    const secretsMap = { API_TOKEN: 'secret_live_token_xyz999' };
    const value = substituteSecretRefs('${{ secrets.API_TOKEN }}', secretsMap);
    assert.equal(value, 'secret_live_token_xyz999');
  });

  test('substitutes secrets without surrounding spaces', () => {
    const secretsMap = { API_TOKEN: 'abc123' };
    assert.equal(substituteSecretRefs('${secrets.API_TOKEN}', secretsMap), 'abc123');
  });

  test('detects secret references inside shell commands', () => {
    // A secret must never be interpolated into a shell command string: the
    // value could contain quotes or shell metacharacters.
    assert.equal(
      containsSecretRef('curl -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" https://x'),
      true
    );
    assert.equal(containsSecretRef('npm run build'), false);
  });
});
