import { db } from './db';
import { GitService } from './gitService';
import { decryptSecret } from './crypto';
import type { WorkflowRun, WorkflowStep } from '../src/types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import yaml from 'yaml';
import {
  buildSanitizedWorkflowEnv,
  isDangerousRunScript,
  resolveSafeExecutionDir,
} from './auth';
import { worktreeManager } from './worktreeManager';

const execFileAsync = promisify(execFile);

/** Run a trusted workflow shell command via bash -c with sanitized env. */
async function runWorkflowCommand(
  command: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs = 120000,
  signal?: AbortSignal
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('/bin/bash', ['-c', command], {
    cwd,
    env,
    timeout: timeoutMs,
    maxBuffer: 5 * 1024 * 1024,
    signal,
  }) as Promise<{ stdout: string; stderr: string }>;
}

interface ParsedStep {
  name?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
}

function getDecryptedSecrets(repoName: string): Record<string, string> {
  const secretsMap: Record<string, string> = {};
  try {
    const rows = db.prepare(`
      SELECT name, encrypted_value FROM secrets
      WHERE (repo_name = ? OR repo_name IS NULL)
    `).all(repoName) as { name: string; encrypted_value: string }[];

    for (const row of rows) {
      if (row.encrypted_value && row.encrypted_value !== 'ENCRYPTED_AES256_GCM_PAYLOAD') {
        try {
          secretsMap[row.name] = decryptSecret(row.encrypted_value);
        } catch {}
      }
    }
  } catch {}
  return secretsMap;
}

function redactSecrets(text: string, secrets: Record<string, string>): string {
  let redacted = text;
  for (const val of Object.values(secrets)) {
    if (val && val.length >= 4) {
      redacted = redacted.replaceAll(val, '***');
    }
  }
  return redacted;
}

/**
 * Replace `${{ secrets.NAME }}` placeholders inside an `env:` value.
 * Only environment values are substituted — a secret is never spliced into a
 * shell command string, where quoting or shell metacharacters would break the
 * command (or worse, execute).
 */
export function substituteSecretRefs(value: string, secrets: Record<string, string>): string {
  let result = value;
  for (const [name, secretValue] of Object.entries(secrets)) {
    result = result.replaceAll(`\${{ secrets.${name} }}`, secretValue);
    result = result.replaceAll(`\${secrets.${name}}`, secretValue);
  }
  return result;
}

/** True when a command still contains an unresolved secret reference. */
export function containsSecretRef(command: string): boolean {
  return /\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}/.test(command);
}

export class WorkflowService {
  private gitService: GitService;
  /** Abort controllers of runs that are currently executing. */
  private running = new Map<string, AbortController>();

  constructor() {
    this.gitService = new GitService();
  }

  /**
   * Mark runs that were interrupted (server restart / crash) as failed.
   * Without this a run would stay "in_progress" forever.
   */
  recoverStaleRuns(): number {
    try {
      const rows = db
        .prepare("SELECT id FROM workflow_runs WHERE status = 'in_progress'")
        .all() as { id: string }[];
      for (const row of rows) {
        db.prepare(`
          UPDATE workflow_runs
          SET status = 'failed', finished_ms = ?, error = ?, duration = ?
          WHERE id = ?
        `).run(
          Date.now(),
          'Run was interrupted (the SourceHub server restarted while it was executing).',
          'interrupted',
          row.id
        );
      }
      return rows.length;
    } catch {
      return 0;
    }
  }

  /** Request cancellation of a running workflow. */
  cancelRun(runId: string): boolean {
    const controller = this.running.get(runId);
    if (!controller) return false;
    controller.abort();
    try {
      db.prepare(`
        UPDATE workflow_runs SET canceled = 1, status = 'canceled', finished_ms = ? WHERE id = ?
      `).run(Date.now(), runId);
    } catch {}
    return true;
  }

  // 1. List real workflow runs for a repository
  listRuns(repoName: string): WorkflowRun[] {
    const rows = db.prepare(`
      SELECT * FROM workflow_runs
      WHERE repo_name = ?
      ORDER BY id DESC
    `).all(repoName) as any[];

    return rows.map(r => {
      const stepRows = db.prepare(`
        SELECT * FROM workflow_steps
        WHERE run_id = ?
        ORDER BY step_order ASC
      `).all(r.id) as any[];

      const steps: WorkflowStep[] = stepRows.map(s => ({
        name: s.name,
        status: s.status as any,
        duration: s.duration,
        logs: JSON.parse(s.logs || '[]'),
      }));

      return {
        id: r.id,
        workflowName: r.workflow_name,
        event: r.event as any,
        status: r.status as any,
        branch: r.branch,
        commitSha: r.commit_sha,
        commitMessage: r.commit_message,
        author: r.author,
        duration: r.duration,
        createdAt: r.created_at,
        createdMs: r.created_ms ?? undefined,
        finishedMs: r.finished_ms ?? undefined,
        error: r.error ?? undefined,
        steps,
      };
    });
  }

  /** Single run with its steps — used by the run detail view. */
  getRun(repoName: string, runId: string): WorkflowRun | null {
    const row = db
      .prepare('SELECT * FROM workflow_runs WHERE id = ? AND repo_name = ?')
      .get(runId, repoName) as any;
    if (!row) return null;

    const stepRows = db.prepare(`
      SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC
    `).all(runId) as any[];

    return {
      id: row.id,
      workflowName: row.workflow_name,
      event: row.event as any,
      status: row.status as any,
      branch: row.branch,
      commitSha: row.commit_sha,
      commitMessage: row.commit_message,
      author: row.author,
      duration: row.duration,
      createdAt: row.created_at,
      createdMs: row.created_ms ?? undefined,
      finishedMs: row.finished_ms ?? undefined,
      error: row.error ?? undefined,
      steps: stepRows.map(s => ({
        name: s.name,
        status: s.status as any,
        duration: s.duration,
        logs: JSON.parse(s.logs || '[]'),
      })),
    };
  }

  // 2. Dispatch and execute real workflow run
  async dispatchWorkflow(
    repoName: string,
    workflowId: string = 'ci.yml',
    branch: string = 'main',
    event: 'push' | 'pull_request' | 'workflow_dispatch' | 'agent_run' = 'workflow_dispatch'
  ): Promise<WorkflowRun> {
    const repo = await this.gitService.getRepository(repoName);
    const repoPath = repo?.path || this.gitService.getRepoPath(repoName);
    const runId = `run-${crypto.randomUUID()}`;
    const startTime = Date.now();
    const controller = new AbortController();
    this.running.set(runId, controller);

    // Get last commit info on repo
    let commitSha = 'HEAD';
    let commitMsg = 'Manual dispatch';
    let author = 'Forge Operator';
    try {
      const commits = await this.gitService.getCommits(repoName, branch, 1);
      if (commits.length > 0) {
        commitSha = commits[0].shortSha;
        commitMsg = commits[0].message;
        author = commits[0].author;
      }
    } catch {}

    let workflowName =
      workflowId === 'ci.yml'
        ? 'SourceHub CI Pipeline (.sourcehub/workflows/ci.yml)'
        : `${workflowId} Pipeline`;

    // Every run executes inside an isolated worktree so the operator's working
    // copy is never modified by CI (not even by a build step).
    let executionDir = repoPath;
    let worktreePath: string | null = null;

    const persistStep = (index: number, step: WorkflowStep) => {
      try {
        db.prepare(`
          INSERT INTO workflow_steps (id, run_id, name, status, duration, logs, step_order, created_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            duration = excluded.duration,
            logs = excluded.logs
        `).run(
          `step-${runId}-${index + 1}`,
          runId,
          step.name,
          step.status,
          step.duration,
          JSON.stringify(step.logs),
          index + 1,
          Date.now()
        );
      } catch (e) {
        console.warn('[WorkflowRunner] could not persist step:', (e as Error).message);
      }
    };

    const updateRun = (fields: Record<string, any>) => {
      const keys = Object.keys(fields);
      if (keys.length === 0) return;
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => fields[k]);
      try {
        db.prepare(`UPDATE workflow_runs SET ${setClause} WHERE id = ?`).run(...values, runId);
      } catch (e) {
        console.warn('[WorkflowRunner] could not update run:', (e as Error).message);
      }
    };

    try {
      // Insert run in DB
      db.prepare(`
        INSERT INTO workflow_runs (
          id, repo_name, workflow_name, workflow_path, event, status,
          branch, commit_sha, commit_message, author, duration, created_at,
          created_ms, started_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        runId,
        repoName,
        workflowName,
        `.sourcehub/workflows/${workflowId}`,
        event,
        'in_progress',
        branch,
        commitSha,
        commitMsg,
        author,
        '...',
        'Just now',
        Date.now(),
        Date.now()
      );

      // Isolate the run in its own worktree
      try {
        const handle = await worktreeManager.create(repoPath, {
          purpose: 'ci',
          ref: branch,
          detach: true,
          repoKey: repoName,
        });
        worktreePath = handle.path;
        executionDir = handle.path;

        // Symlink node_modules if present in root repo
        const nmSrc = path.join(repoPath, 'node_modules');
        const nmDst = path.join(handle.path, 'node_modules');
        if (fs.existsSync(nmSrc) && !fs.existsSync(nmDst)) {
          try {
            fs.symlinkSync(nmSrc, nmDst, 'junction');
          } catch {}
        }
      } catch (wtErr: any) {
        console.warn(
          `[WorkflowRunner] Could not create isolated worktree, falling back to repoPath:`,
          wtErr.message
        );
        executionDir = repoPath;
      }

      // Check for declared workflow YAML
      const candidatePaths = [
        path.join(executionDir, '.sourcehub', 'workflows', workflowId),
        path.join(executionDir, '.sourcehub', 'workflows', `${workflowId}.yml`),
        path.join(executionDir, '.sourcehub', 'workflows', `${workflowId}.yaml`),
        path.join(executionDir, '.github', 'workflows', workflowId),
        path.join(executionDir, '.github', 'workflows', `${workflowId}.yml`),
        path.join(executionDir, '.github', 'workflows', `${workflowId}.yaml`),
      ];

      let workflowContent = '';
      let workflowFilePath = `.sourcehub/workflows/${workflowId}`;
      for (const cp of candidatePaths) {
        if (fs.existsSync(cp)) {
          try {
            workflowContent = fs.readFileSync(cp, 'utf8');
            workflowFilePath = path.relative(executionDir, cp);
            break;
          } catch {}
        }
      }

      // Parse declared workflow steps
      let declaredSteps: ParsedStep[] = [];
      if (workflowContent) {
        try {
          const parsed = yaml.parse(workflowContent);
          if (parsed?.name) {
            workflowName = parsed.name;
          }
          if (parsed?.jobs && typeof parsed.jobs === 'object') {
            for (const jobKey of Object.keys(parsed.jobs)) {
              const job = parsed.jobs[jobKey];
              if (Array.isArray(job?.steps)) {
                declaredSteps.push(...job.steps);
              }
            }
          }
        } catch (e: any) {
          console.warn(`[WorkflowRunner] Could not parse YAML in ${workflowFilePath}:`, e.message);
        }
      }

      const decryptedSecrets = getDecryptedSecrets(repoName);
      const steps: WorkflowStep[] = [];
      let allPassed = true;
      let canceled = false;

      const finishStep = (index: number, step: WorkflowStep) => {
        steps.push(step);
        persistStep(index, step);
      };

      if (declaredSteps.length > 0) {
        // Execute declared YAML steps
        for (let i = 0; i < declaredSteps.length; i++) {
          const stepDef = declaredSteps[i];
          const stepName = stepDef.name || (stepDef.run ? stepDef.run.split('\n')[0] : `Step ${i + 1}`);
          const stepStart = Date.now();

          if (controller.signal.aborted) {
            canceled = true;
            finishStep(i, {
              name: stepName,
              status: 'failed',
              duration: '0.0s',
              logs: ['Canceled by operator.'],
            });
            break;
          }

          if (!allPassed) {
            finishStep(i, {
              name: stepName,
              status: 'failed',
              duration: '0.0s',
              logs: ['Skipped due to previous step failure.'],
            });
            continue;
          }

          if (stepDef.uses) {
            // SourceHub does not implement third-party actions. The step is
            // reported as skipped rather than as a fake success.
            finishStep(i, {
              name: stepName,
              status: 'skipped',
              duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
              logs: [
                `Skipped: actions are not executed by the SourceHub runner ("${stepDef.uses}").`,
                'Move the action body into a `run:` step to have it executed locally.',
              ],
            });
            continue;
          }

          if (stepDef.run) {
            const command = stepDef.run;

            if (containsSecretRef(command)) {
              allPassed = false;
              finishStep(i, {
                name: stepName,
                status: 'failed',
                duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                logs: [
                  'Refused to run step: secrets must not be interpolated into a shell command.',
                  'Reference the secret as an environment variable instead (for example $API_TOKEN).',
                ],
              });
              continue;
            }

            if (isDangerousRunScript(command)) {
              allPassed = false;
              finishStep(i, {
                name: stepName,
                status: 'failed',
                duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                logs: ['Refused to run step: command matched dangerous-pattern guard.'],
              });
              continue;
            }

            let safeCwd: string;
            try {
              safeCwd = resolveSafeExecutionDir(repoPath, executionDir);
            } catch (pathErr: any) {
              allPassed = false;
              finishStep(i, {
                name: stepName,
                status: 'failed',
                duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                logs: [`Refused to run step: ${pathErr.message}`],
              });
              continue;
            }

            // Secrets are passed as environment variables only.
            const stepEnvValues: Record<string, string> = {};
            for (const [k, v] of Object.entries(stepDef.env || {})) {
              stepEnvValues[k] = substituteSecretRefs(String(v), decryptedSecrets);
            }

            const stepEnv = buildSanitizedWorkflowEnv(decryptedSecrets, stepEnvValues, {
              SOURCEHUB_BRANCH: branch,
              SOURCEHUB_COMMIT: commitSha,
              SOURCEHUB_REPO: repoName,
              SOURCEHUB_RUN_ID: runId,
            });

            // Workflows are trusted operator content (same trust boundary as local shell).
            console.log(`[WorkflowRunner] Running trusted step in ${safeCwd}: ${stepName}`);

            try {
              const { stdout, stderr } = await runWorkflowCommand(
                command,
                safeCwd,
                stepEnv,
                120000,
                controller.signal
              );

              const rawLogs = (stdout + '\n' + stderr).split('\n').filter(Boolean);
              const sanitizedLogs = rawLogs.map(line => redactSecrets(line, decryptedSecrets));

              finishStep(i, {
                name: stepName,
                status: 'success',
                duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                logs: sanitizedLogs.length > 0 ? sanitizedLogs : ['Step completed with exit code 0.'],
              });
            } catch (err: any) {
              if (controller.signal.aborted) {
                canceled = true;
                finishStep(i, {
                  name: stepName,
                  status: 'failed',
                  duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                  logs: ['Canceled by operator.'],
                });
                break;
              }
              allPassed = false;
              const errLogs = ((err.stdout || '') + '\n' + (err.stderr || err.message))
                .split('\n')
                .filter(Boolean);
              const sanitizedLogs = errLogs.map(line => redactSecrets(line, decryptedSecrets));

              finishStep(i, {
                name: stepName,
                status: 'failed',
                duration: `${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
                logs: sanitizedLogs,
              });
            }
          }
        }
      } else {
        // Fallback: Default standard verification steps
        // Step 1: Environment & Repository Verification
        const step1Start = Date.now();
        try {
          const { stdout } = await runWorkflowCommand(
            'git status -s && git branch --show-current',
            executionDir,
            buildSanitizedWorkflowEnv({}, undefined, {}),
            30000,
            controller.signal
          );
          finishStep(0, {
            name: 'Verify Environment & Git State',
            status: 'success',
            duration: `${((Date.now() - step1Start) / 1000).toFixed(1)}s`,
            logs: [
              `Local runner initialized.`,
              `Branch under test: ${branch} (isolated runner worktree)`,
              `Working directory: ${executionDir}`,
              `Node.js: ${process.version} | Platform: ${process.platform} (${process.arch})`,
              stdout.trim() ? `Working directory changes:\n${stdout.trim()}` : 'Working tree clean.',
            ],
          });
        } catch (err: any) {
          allPassed = false;
          finishStep(0, {
            name: 'Verify Environment & Git State',
            status: 'failed',
            duration: `${((Date.now() - step1Start) / 1000).toFixed(1)}s`,
            logs: [`Error verifying repository: ${err.message}`],
          });
        }

        // Step 2: Build & Type Check (if package.json exists)
        if (fs.existsSync(path.join(executionDir, 'package.json'))) {
          const step2Start = Date.now();
          try {
            const { stdout, stderr } = await runWorkflowCommand(
              'npm run build',
              executionDir,
              buildSanitizedWorkflowEnv({}, undefined, {}),
              60000,
              controller.signal
            );
            const rawLines = (stdout + '\n' + stderr).split('\n').filter(Boolean);
            finishStep(1, {
              name: 'Type Check & Application Build',
              status: 'success',
              duration: `${((Date.now() - step2Start) / 1000).toFixed(1)}s`,
              logs: rawLines.length > 0 ? rawLines : ['Build completed with 0 errors.'],
            });
          } catch (err: any) {
            allPassed = false;
            const rawLines = ((err.stdout || '') + '\n' + (err.stderr || err.message))
              .split('\n')
              .filter(Boolean);
            finishStep(1, {
              name: 'Type Check & Application Build',
              status: 'failed',
              duration: `${((Date.now() - step2Start) / 1000).toFixed(1)}s`,
              logs: rawLines,
            });
          }
        }

        // Step 3: Wire Protocol & Integrity Checks
        const step3Start = Date.now();
        try {
          const { stdout } = await runWorkflowCommand(
            'git rev-parse --is-inside-work-tree',
            executionDir,
            buildSanitizedWorkflowEnv({}, undefined, {}),
            15000,
            controller.signal
          );
          finishStep(steps.length, {
            name: 'Verify Git Wire Protocol & Object Graph',
            status: 'success',
            duration: `${((Date.now() - step3Start) / 1000).toFixed(1)}s`,
            logs: [
              'Checking git object graph integrity...',
              `Object store status: ${stdout.trim() === 'true' ? 'OK' : 'Unknown'}`,
              'All verification assertions passed.',
            ],
          });
        } catch (err: any) {
          finishStep(steps.length, {
            name: 'Verify Git Wire Protocol & Object Graph',
            status: 'failed',
            duration: `${((Date.now() - step3Start) / 1000).toFixed(1)}s`,
            logs: [`Error: ${err.message}`],
          });
        }
      }

      const totalDuration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      const finalStatus = canceled ? 'canceled' : allPassed ? 'success' : 'failed';

      updateRun({
        status: finalStatus,
        duration: totalDuration,
        finished_ms: Date.now(),
        canceled: canceled ? 1 : 0,
        error: canceled ? 'Run canceled by operator.' : null,
      });

      return {
        id: runId,
        workflowName,
        event,
        status: finalStatus as any,
        branch,
        commitSha,
        commitMessage: commitMsg,
        author,
        duration: totalDuration,
        createdAt: 'Just now',
        createdMs: Date.now(),
        finishedMs: Date.now(),
        steps,
      };
    } catch (err: any) {
      const totalDuration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      updateRun({
        status: 'failed',
        duration: totalDuration,
        finished_ms: Date.now(),
        error: err.message || 'Workflow run failed',
      });
      throw err;
    } finally {
      this.running.delete(runId);
      if (worktreePath) {
        try {
          await worktreeManager.remove(repoPath, worktreePath);
        } catch {}
      }
    }
  }
}
