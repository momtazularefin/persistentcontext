using System.Text.Json;

namespace FlowForge.Storage;

/// <summary>
/// Persists run records as indented JSON files under a directory.
/// File name pattern: {yyyyMMdd-HHmmss}-{runId}.json. Malformed files are ignored on read.
/// </summary>
public sealed class JsonRunStore : IRunStore
{
    private readonly string _dir;
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public JsonRunStore(string directory)
    {
        _dir = directory ?? throw new ArgumentNullException(nameof(directory));
        Directory.CreateDirectory(_dir);
    }

    public void Save(RunRecord record)
    {
        ArgumentNullException.ThrowIfNull(record);
        var fileName = $"{record.CreatedAt:yyyyMMdd-HHmmss}-{record.RunId}.json";
        File.WriteAllText(Path.Combine(_dir, fileName), JsonSerializer.Serialize(record, Json));
    }

    public IReadOnlyList<RunRecord> List()
    {
        if (!Directory.Exists(_dir))
            return Array.Empty<RunRecord>();

        var records = new List<RunRecord>();
        foreach (var file in Directory.EnumerateFiles(_dir, "*.json").OrderBy(f => f, StringComparer.Ordinal))
        {
            try
            {
                var record = JsonSerializer.Deserialize<RunRecord>(File.ReadAllText(file), Json);
                if (record is not null)
                    records.Add(record);
            }
            catch (JsonException)
            {
                // Skip malformed file; a corrupt record must not break history listing.
            }
        }
        return records;
    }
}
