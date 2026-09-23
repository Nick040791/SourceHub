import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'yaml';

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

  test('substitutes secrets accurately into command strings', () => {
    const secretsMap = {
      API_TOKEN: 'secret_live_token_xyz999',
    };

    let command = 'curl -H "Authorization: Bearer ${{ secrets.API_TOKEN }}" https://api.sourcehub.local/deploy';
    for (const [key, val] of Object.entries(secretsMap)) {
      command = command.replaceAll(`\${{ secrets.${key} }}`, val);
    }

    assert.equal(command, 'curl -H "Authorization: Bearer secret_live_token_xyz999" https://api.sourcehub.local/deploy');
  });
});
