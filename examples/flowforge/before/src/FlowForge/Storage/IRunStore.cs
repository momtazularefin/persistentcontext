namespace FlowForge.Storage;

/// <summary>Repository for run history. Implementations decide the backing store.</summary>
public interface IRunStore
{
    void Save(RunRecord record);
    IReadOnlyList<RunRecord> List();
}
