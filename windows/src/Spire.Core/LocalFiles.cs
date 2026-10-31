using System.Text.Json;
namespace Spire.Core;
public sealed record LocalFile(Guid Id, string Path, string Content, bool Deleted = false);
public static class LocalFiles
{
 public static string ValidatePath(string path)
 {
  ValidatePortablePath(path);
  var parts=path.Split('/');
  if(parts.Length<2 || !path.EndsWith(".md",StringComparison.Ordinal)) throw new ArgumentException("Use a portable folder and Markdown filename, such as Writing/Draft.md.");
  return path;
 }
 public static string ValidatePortablePath(string path)
 {
  var parts=path.Split('/');
  if(path.Length==0||path.Length>240||parts.Any(p=>string.IsNullOrWhiteSpace(p)||p is "." or ".."||p.StartsWith('.')||p.EndsWith('.')||p.EndsWith(' ')||p.Any(c=>c<32)||p.IndexOfAny(['\\', ':', '*', '?', '"', '<', '>', '|', '%'])>=0||System.Text.RegularExpressions.Regex.IsMatch(p,@"^(con|prn|aux|nul|com\d|lpt\d)(\.|$)",System.Text.RegularExpressions.RegexOptions.IgnoreCase)))throw new ArgumentException("Use a portable relative path without hidden, reserved or parent segments.");
  return path;
 }
 public static JsonElement Encode(IEnumerable<LocalFile> files) => JsonSerializer.SerializeToElement(files);
 public static List<LocalFile> Decode(JsonElement? data) => data is null ? [] : data.Value.Deserialize<List<LocalFile>>() ?? throw new InvalidDataException("Invalid local files.");
}
