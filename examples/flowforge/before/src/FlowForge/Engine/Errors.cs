namespace FlowForge.Engine;

/// <summary>Thrown when a pipeline run cannot proceed for an engine-level reason.</summary>
public sealed class PipelineFailedException : Exception
{
    public PipelineFailedException(string message) : base(message) { }
}
