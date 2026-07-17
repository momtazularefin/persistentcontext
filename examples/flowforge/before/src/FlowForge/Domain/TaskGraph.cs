namespace FlowForge.Domain;

/// <summary>
/// A directed graph of tasks. Enforces two invariants on Validate/TopologicalOrder:
/// every declared dependency exists, and the graph is acyclic (a DAG).
/// Ordering is deterministic (ties broken by ordinal id) for reproducible runs.
/// </summary>
public sealed class TaskGraph
{
    private readonly Dictionary<string, TaskNode> _nodes = new(StringComparer.Ordinal);

    public IReadOnlyCollection<TaskNode> Nodes => _nodes.Values;

    public TaskGraph Add(TaskNode node)
    {
        ArgumentNullException.ThrowIfNull(node);
        if (_nodes.ContainsKey(node.Id))
            throw new InvalidOperationException($"Duplicate task id '{node.Id}'.");
        _nodes[node.Id] = node;
        return this;
    }

    public TaskNode Get(string id) => _nodes[id];

    public bool Contains(string id) => _nodes.ContainsKey(id);

    /// <summary>Validate dependency existence and acyclicity. Throws on violation.</summary>
    public void Validate()
    {
        foreach (var node in _nodes.Values)
            foreach (var dep in node.DependsOn)
                if (!_nodes.ContainsKey(dep))
                    throw new GraphValidationException(
                        $"Task '{node.Id}' depends on unknown task '{dep}'.");

        // Cycle detection is a side effect of a successful topological sort.
        TopologicalOrder();
    }

    /// <summary>
    /// Return task ids in a valid execution order using Kahn's algorithm.
    /// Throws <see cref="GraphValidationException"/> if a cycle is present.
    /// </summary>
    public IReadOnlyList<string> TopologicalOrder()
    {
        var inDegree = _nodes.Keys.ToDictionary(id => id, _ => 0, StringComparer.Ordinal);
        foreach (var node in _nodes.Values)
            foreach (var _ in node.DependsOn)
                inDegree[node.Id]++; // edge: dep -> node, so node gains in-degree

        var dependents = BuildDependents();
        var ready = new SortedSet<string>(
            inDegree.Where(kv => kv.Value == 0).Select(kv => kv.Key), StringComparer.Ordinal);

        var order = new List<string>(_nodes.Count);
        while (ready.Count > 0)
        {
            var id = ready.Min!;
            ready.Remove(id);
            order.Add(id);
            foreach (var dependent in dependents[id])
                if (--inDegree[dependent] == 0)
                    ready.Add(dependent);
        }

        if (order.Count != _nodes.Count)
            throw new GraphValidationException("Task graph contains a cycle.");

        return order;
    }

    private Dictionary<string, List<string>> BuildDependents()
    {
        var dependents = _nodes.Keys.ToDictionary(id => id, _ => new List<string>(), StringComparer.Ordinal);
        foreach (var node in _nodes.Values)
            foreach (var dep in node.DependsOn)
                dependents[dep].Add(node.Id);
        return dependents;
    }
}
