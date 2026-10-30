export interface BuildInfo {
  schemaVersion: 1;
  version: string;
  baseVersion: string;
  channel: 'nightly' | 'rc' | 'stable' | 'local';
  commit: string | null;
  builtAt: string;
  buildId: string;
  ref: string | null;
}

export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== 'object') return null;
  const info = value as Partial<BuildInfo>;
  if (info.schemaVersion !== 1 || !['nightly', 'rc', 'stable', 'local'].includes(info.channel ?? '')) return null;
  if (typeof info.version !== 'string' || !/^\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/.test(info.version)) return null;
  if (typeof info.builtAt !== 'string' || Number.isNaN(new Date(info.builtAt).valueOf())) return null;
  if (typeof info.buildId !== 'string' || !info.buildId || info.buildId.length > 160) return null;
  if (typeof info.baseVersion !== 'string') return null;
  if (info.ref !== null && typeof info.ref !== 'string') return null;
  if (info.commit !== null && (typeof info.commit !== 'string' || !/^[a-f0-9]{7,64}$/i.test(info.commit))) return null;
  return info as BuildInfo;
}

// Nightly and local builds carry their UTC build time, so two builds of the
// same version can be told apart at a glance.
export function footerVersion(info: BuildInfo): string {
  if (info.channel === 'rc' || info.channel === 'stable') return info.version;
  const timestamp = new Date(info.builtAt).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${info.version}-${info.channel}-${timestamp}`;
}
