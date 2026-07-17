namespace FlowForge.Domain;

/// <summary>
/// A unit of work in a task graph, plus its dependency ids and retry budget.
/// Immutable. The action receives a CancellationToken and returns a Task.
/// </summary>
public sealed class TaskNode
{
    public string Id { get; }
    public IReadOnlyList<string> DependsOn { get; }
    public int MaxRetries { get; }
    public Func<CancellationToken, Task> Action { get; }

    public TaskNode(
        string id,
        Func<CancellationToken, Task> action,
        IEnumerable<string>? dependsOn = null,
        int maxRetries = 0)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Task id must be non-empty.", nameof(id));
        if (maxRetries < 0)
            throw new ArgumentOutOfRangeException(nameof(maxRetries), "maxRetries must be >= 0.");

        Id = id;
        Action = action ?? throw new ArgumentNullException(nameof(action));
        DependsOn = (dependsOn ?? Array.Empty<string>()).ToList();
        MaxRetries = maxRetries;
    }
}
