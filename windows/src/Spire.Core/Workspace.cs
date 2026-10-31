using System.Text.Json;

namespace Spire.Core;

// Preserve server records verbatim until typed adapters cover the complete protocol.
public sealed record WorkspaceState(int SchemaVersion, JsonElement? ServerSnapshot,
    IReadOnlyList<JsonElement> PendingMutations)
{
    public static WorkspaceState Empty => new(1, null, Array.Empty<JsonElement>());
}

public sealed class WorkspaceStore(string directory)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    public async Task<WorkspaceState> LoadAsync(CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        try
        {
            var file = Path.Combine(directory, "workspace.json");
            if (!File.Exists(file)) return WorkspaceState.Empty;
            await using var input = File.OpenRead(file);
            var state = await JsonSerializer.DeserializeAsync<WorkspaceState>(input, cancellationToken: cancellation)
                ?? throw new InvalidDataException("Workspace is empty or invalid; refusing to replace it.");
            if (state.SchemaVersion != 1) throw new InvalidDataException("Unsupported workspace schema.");
            return state;
        }
        finally { gate.Release(); }
    }
    public async Task SaveAsync(WorkspaceState state, CancellationToken cancellation = default)
    {
        await gate.WaitAsync(cancellation);
        string? temporary = null;
        try
        {
            Directory.CreateDirectory(directory);
            var destination = Path.Combine(directory, "workspace.json");
            temporary = Path.Combine(directory, $"workspace.{Guid.NewGuid():N}.tmp");
            await using (var output = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await JsonSerializer.SerializeAsync(output, state, cancellationToken: cancellation);
                await output.FlushAsync(cancellation);
                output.Flush(flushToDisk: true);
            }
            if (File.Exists(destination)) File.Replace(temporary, destination, destination + ".previous");
            else File.Move(temporary, destination);
            temporary = null;
        }
        finally
        {
            if (temporary is not null && File.Exists(temporary)) File.Delete(temporary);
            gate.Release();
        }
    }
}
