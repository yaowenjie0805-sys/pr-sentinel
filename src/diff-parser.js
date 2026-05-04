export function parseUnifiedDiff(diffText) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of String(diffText ?? "").split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ")) {
      if (currentFile) files.push(currentFile);
      currentFile = createFile(rawLine);
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    if (rawLine.startsWith("rename from ")) {
      currentFile.oldPath = rawLine.slice("rename from ".length);
      currentFile.status = "renamed";
      continue;
    }

    if (rawLine.startsWith("rename to ")) {
      currentFile.newPath = rawLine.slice("rename to ".length);
      currentFile.path = currentFile.newPath;
      currentFile.status = "renamed";
      continue;
    }

    if (rawLine.startsWith("new file mode ")) {
      currentFile.status = "added";
      continue;
    }

    if (rawLine.startsWith("deleted file mode ")) {
      currentFile.status = "deleted";
      continue;
    }

    if (rawLine.startsWith("Binary files ")) {
      currentFile.binary = true;
      continue;
    }

    if (rawLine.startsWith("--- ")) {
      currentFile.oldPath = normalizeDiffPath(rawLine.slice(4));
      continue;
    }

    if (rawLine.startsWith("+++ ")) {
      currentFile.newPath = normalizeDiffPath(rawLine.slice(4));
      currentFile.path = currentFile.newPath || currentFile.oldPath || currentFile.path;
      continue;
    }

    const hunkMatch = rawLine.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      currentHunk = { header: rawLine, lines: [] };
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    const marker = rawLine[0];
    const content = rawLine.slice(1);

    if (marker === "+") {
      const line = { type: "added", content, newLine, oldLine: null };
      currentHunk.lines.push(line);
      currentFile.addedLines.push(line);
      newLine += 1;
    } else if (marker === "-") {
      const line = { type: "removed", content, oldLine, newLine: null };
      currentHunk.lines.push(line);
      currentFile.removedLines.push(line);
      oldLine += 1;
    } else if (marker === " ") {
      currentHunk.lines.push({ type: "context", content, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else {
      currentHunk.lines.push({ type: "meta", content: rawLine, oldLine: null, newLine: null });
    }
  }

  if (currentFile) files.push(currentFile);
  return files;
}

function createFile(line) {
  const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
  const oldPath = match?.[1] ?? "";
  const newPath = match?.[2] ?? oldPath;

  return {
    path: newPath,
    oldPath,
    newPath,
    status: "modified",
    binary: false,
    hunks: [],
    addedLines: [],
    removedLines: [],
  };
}

function normalizeDiffPath(path) {
  if (path === "/dev/null") return null;
  return path.replace(/^[ab]\//, "");
}
