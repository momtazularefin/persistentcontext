using FlowForge.Cli;
using FlowForge.Config;
using FlowForge.Engine;
using FlowForge.Storage;

// Usage: flowforge run <pipeline.json> [--stop-on-failure]
if (args.Length < 2 || args[0] != "run")
{
    Console.Error.WriteLine("Usage: flowforge run <pipeline.json> [--stop-on-failure]");
    return 2;
}

var specPath = args[1];
var stopOnFailure = args.Contains("--stop-on-failure");

PipelineSpec spec;
try
{
    spec = PipelineSpec.Load(specPath);
}
catch (Exception ex)
{
    Console.Error.WriteLine($"failed to load spec: {ex.Message}");
    return 2;
}

var graph = spec.ToGraph();
var executor = new Executor(new ExecutionOptions { StopOnFailure = stopOnFailure });
var run = await executor.RunAsync(graph);

Console.WriteLine($"pipeline: {spec.Name}");
Console.WriteLine($"order:    {string.Join(" -> ", run.Order)}");
foreach (var r in run.Results)
{
    var err = r.Error is null ? "" : $"  err={r.Error}";
    Console.WriteLine($"  {r.TaskId,-12} {r.State,-9} attempts={r.Attempts}{err}");
}
Console.WriteLine($"result:   {(run.Succeeded ? "SUCCESS" : "FAILED")} (failed={run.Failed}, skipped={run.Skipped})");

var config = FlowForgeConfig.FromEnvironment();
var store = new JsonRunStore(config.RunStoreDir);
store.Save(new RunRecord
{
    Pipeline = spec.Name,
    Succeeded = run.Succeeded,
    Results = run.Results.ToList()
});
Console.WriteLine($"history:  {config.RunStoreDir}");

return run.Succeeded ? 0 : 1;
