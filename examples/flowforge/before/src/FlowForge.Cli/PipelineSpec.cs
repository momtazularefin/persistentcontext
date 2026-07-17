using System.Text.Json;
using System.Text.Json.Serialization;
using FlowForge.Domain;

namespace FlowForge.Cli;

/// <summary>A JSON-defined pipeline and its translation into a domain TaskGraph.</summary>
public sealed class PipelineSpec
{
    [JsonPropertyName("name")] public string Name { get; set; } = "pipeline";
    [JsonPropertyName("tasks")] public List<TaskSpec> Tasks { get; set; } = new();

    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static PipelineSpec Load(string path)
    {
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<PipelineSpec>(json, Options)
               ?? throw new InvalidDataException("Empty or invalid pipeline spec.");
    }

    public TaskGraph ToGraph()
    {
        var graph = new TaskGraph();
        foreach (var task in Tasks)
            graph.Add(new TaskNode(task.Id, ActionFactory.Build(task), task.DependsOn, task.Retries));
        return graph;
    }
}

/// <summary>One task entry in a pipeline spec.</summary>
public sealed class TaskSpec
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("dependsOn")] public List<string> DependsOn { get; set; } = new();

    /// <summary>Demo action kind: noop | echo | sleep | fail.</summary>
    [JsonPropertyName("kind")] public string Kind { get; set; } = "noop";

    [JsonPropertyName("value")] public string? Value { get; set; }
    [JsonPropertyName("retries")] public int Retries { get; set; } = 0;
}
