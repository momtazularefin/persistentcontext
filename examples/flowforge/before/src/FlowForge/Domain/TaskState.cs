namespace FlowForge.Domain;

/// <summary>
/// Lifecycle states of a task within a single run.
/// Transitions: Pending -> Ready -> Running -> (Succeeded | Failed); or Pending -> Skipped.
/// </summary>
public enum TaskState
{
    Pending,
    Ready,
    Running,
    Succeeded,
    Failed,
    Skipped
}
