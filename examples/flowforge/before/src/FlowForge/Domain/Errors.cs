namespace FlowForge.Domain;

/// <summary>Thrown when a task graph violates a domain invariant (unknown dep or cycle).</summary>
public sealed class GraphValidationException : Exception
{
    public GraphValidationException(string message) : base(message) { }
}
