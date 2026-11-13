export type WorkspaceStartup = {
  cachedLocal: boolean;
  hasCachedWorkspace?: () => boolean;
  initLocal: () => Promise<void>;
  restoreConnections: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  reconcile: () => Promise<void>;
  refreshBootstrap: () => Promise<void>;
  reveal: () => void;
  failed: (error: unknown) => void;
};

/**
 * Opens a cached local workspace before optional Server/device work.
 * Hosted/server startup keeps its existing authoritative initialization gate.
 */
export async function initializeWorkspace(steps: WorkspaceStartup): Promise<void> {
  await steps.initLocal();

  const finish = async () => {
    await steps.restoreConnections();
    await steps.refreshDevices();
    await steps.reconcile();
    await steps.refreshBootstrap();
  };

  if (steps.cachedLocal || steps.hasCachedWorkspace?.()) {
    steps.reveal();
    void finish().catch(steps.failed);
    return;
  }

  await finish();
  steps.reveal();
}
