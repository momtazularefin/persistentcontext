namespace FlowForge.Engine;

/// <summary>Tunable behavior for a run.</summary>
public sealed class ExecutionOptions
{
    /// <summary>If true, stop starting new tasks once any task has failed.</summary>
    public bool StopOnFailure { get; init; } = false;
}
