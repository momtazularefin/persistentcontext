using FlowForge.Domain;

namespace FlowForge.Engine;

/// <summary>Aggregate outcome of a run: the execution order and per-task results.</summary>
public sealed class RunResult
{
    public IReadOnlyList<string> Order { get; init; } = Array.Empty<string>();
    public IReadOnlyList<TaskResult> Results { get; init; } = Array.Empty<TaskResult>();

    public bool Succeeded => Results.All(r => r.State == TaskState.Succeeded);
    public int Failed => Results.Count(r => r.State == TaskState.Failed);
    public int Skipped => Results.Count(r => r.State == TaskState.Skipped);
}
