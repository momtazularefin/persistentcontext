namespace FlowForge.Domain;

/// <summary>Outcome of a single task within a run. Recorded by the executor.</summary>
public sealed class TaskResult
{
    public string TaskId { get; init; } = "";
    public TaskState State { get; init; }
    public int Attempts { get; init; }
    public string? Error { get; init; }
    public DateTimeOffset? StartedAt { get; init; }
    public DateTimeOffset? FinishedAt { get; init; }
}
