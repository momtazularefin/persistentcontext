using FlowForge.Domain;

namespace FlowForge.Engine;

/// <summary>
/// Owns ordering and readiness for a graph. Validates the graph on construction,
/// then exposes a deterministic execution order and a readiness query.
/// </summary>
public sealed class Scheduler
{
    private readonly TaskGraph _graph;

    public Scheduler(TaskGraph graph)
    {
        _graph = graph ?? throw new ArgumentNullException(nameof(graph));
        _graph.Validate();
        Order = _graph.TopologicalOrder();
    }

    /// <summary>A valid, deterministic execution order for the whole graph.</summary>
    public IReadOnlyList<string> Order { get; }

    /// <summary>
    /// Ids that may run now: still pending and with every dependency Succeeded.
    /// </summary>
    public IReadOnlyList<string> ReadyTasks(IReadOnlyDictionary<string, TaskState> states)
    {
        var ready = new List<string>();
        foreach (var id in Order)
        {
            var state = states.TryGetValue(id, out var s) ? s : TaskState.Pending;
            if (state is not TaskState.Pending and not TaskState.Ready)
                continue; // already running or terminal

            var node = _graph.Get(id);
            var depsSucceeded = node.DependsOn.All(
                d => states.TryGetValue(d, out var ds) && ds == TaskState.Succeeded);
            if (depsSucceeded)
                ready.Add(id);
        }
        return ready;
    }
}
