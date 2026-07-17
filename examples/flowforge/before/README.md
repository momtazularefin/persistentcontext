# FlowForge

A small, dependency-aware task (DAG) runner. Zero external dependencies.

FlowForge takes a set of tasks with declared dependencies, validates that they form
a directed acyclic graph, and runs them in a deterministic topological order with
retries and failure/skip propagation. Run history is persisted as JSON.

## Requirements

- .NET SDK 10.0+ (builds offline; no NuGet packages).

## Layout

- `src/FlowForge/` - core library.
  - `Domain/` - `TaskNode`, `TaskState`, `TaskResult`, `TaskGraph` (validation + topological order).
  - `Engine/` - `Scheduler`, `Executor`, `ExecutionOptions`, `RunResult`.
  - `Storage/` - `IRunStore`, `JsonRunStore`, `RunRecord`.
  - `Config/` - `FlowForgeConfig` (env + defaults).
- `src/FlowForge.Cli/` - command-line front end (`flowforge`).
- `tests/FlowForge.Tests/` - self-contained test runner (no test framework).
- `examples/pipeline.json` - sample pipeline.

## Build

```
dotnet build FlowForge.slnx
```

## Run

```
dotnet run --project src/FlowForge.Cli -- run examples/pipeline.json
```

Optional flag: `--stop-on-failure` stops scheduling new tasks after the first failure.

## Test

```
dotnet run --project tests/FlowForge.Tests
```

Exit code 0 means all tests passed.

## Configuration

- `FLOWFORGE_HOME` - base directory for run history. Defaults to `<LocalAppData>/flowforge`.

## Pipeline spec

A pipeline is JSON: a `name` and a list of `tasks`. Each task has:

- `id` - unique task id.
- `dependsOn` - list of task ids that must succeed first.
- `kind` - demo action: `noop`, `echo`, `sleep`, `fail`.
- `value` - text for `echo`/`fail`, milliseconds for `sleep`.
- `retries` - number of extra attempts on failure.
