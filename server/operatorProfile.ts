/**
 * Operator identity used for commits created by SourceHub itself
 * (merges, agent commits, CI-triggered commits).
 *
 * Git refuses to create a commit when no `user.name` / `user.email` is
 * configured, which is the default state on a fresh server. Every commit
 * SourceHub creates therefore passes an explicit identity.
 */
import { db } from './db';

export interface OperatorIdentity {
  name: string;
  email: string;
}

const DEFAULT_IDENTITY: OperatorIdentity = {
  name: 'Forge Operator',
  email: 'operator@sourcehub.local',
};

/** Read the operator name/email from the persisted profile settings. */
export function getOperatorIdentity(): OperatorIdentity {
  try {
    const rows = db
      .prepare("SELECT key, value FROM system_settings WHERE key IN ('profile_name', 'profile_email')")
      .all() as { key: string; value: string }[];
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      name: (map.profile_name || '').trim() || DEFAULT_IDENTITY.name,
      email: (map.profile_email || '').trim() || DEFAULT_IDENTITY.email,
    };
  } catch {
    return { ...DEFAULT_IDENTITY };
  }
}

/**
 * `-c user.name=… -c user.email=…` arguments for a git invocation.
 * Both settings need their own `-c` flag.
 */
export function identityArgs(identity: OperatorIdentity = getOperatorIdentity()): string[] {
  return ['-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`];
}
