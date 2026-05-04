export function filterChangedFiles(files, paths = {}) {
  const include = paths.include ?? [];
  const exclude = paths.exclude ?? [];

  return files.filter((file) => {
    const path = normalizePath(file.path);
    const included = include.length === 0 || include.some((pattern) => matchGlob(path, pattern));
    const excluded = exclude.some((pattern) => matchGlob(path, pattern));
    return included && !excluded;
  });
}

export function matchGlob(path, pattern) {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);
  const regex = new RegExp(`^${globToRegex(normalizedPattern)}$`);

  return regex.test(normalizedPath);
}

function normalizePath(path) {
  return String(path ?? "").replaceAll("\\", "/");
}

function escapeRegex(value) {
  return String(value).replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(pattern) {
  let regex = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      regex += ".*";
      index += 1;
    } else if (char === "*") {
      regex += "[^/]*";
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += escapeRegex(char);
    }
  }

  return regex;
}
