using FlowForge.Domain;

namespace FlowForge.Storage;

/// <summary>A persisted record of one pipeline run.</summary>
public sealed class RunRecord
{
    public string RunId { get; init; } = Guid.NewGuid().ToString("N");
    public string Pipeline { get; init; } = "";
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
    public bool Succeeded { get; init; }
    public List<TaskResult> Results { get; init; } = new();
}
