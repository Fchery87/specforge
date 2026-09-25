import { findDangerousCommand } from "../dangerous-command.mjs";

describe("findDangerousCommand", () => {
  it.each([
    ["rm -rf node_modules", "recursive rm"],
    ["ls && rm -r build", "recursive rm"],
    ["rm --recursive dist", "recursive rm"],
    ["git push --force origin main", "force push"],
    ["git push -f", "force push"],
    ["git push --force-with-lease", "force push"],
    ["sh -c 'rm -rf /tmp/x'", "recursive rm"],
    ['bash -c "git push --force"', "force push"],
    ['eval "rm -rf build"', "recursive rm"],
    ['echo "$(rm -rf build)"', "recursive rm"],
    ['echo "`rm -rf build`"', "recursive rm"],
    ["cat <<EOF\n$(rm -rf build)\nEOF", "recursive rm"],
  ])("blocks %j", (command, reason) => {
    expect(findDangerousCommand(command)).toBe(reason);
  });

  it.each([
    "rm file.txt",
    "git push -u origin fix/claude-hooks",
    "echo 'rm -rf build'",
    'git commit -m "guard against git push --force"',
    'gh pr create --body "never run rm -rf here"',
    "gh pr create --body-file - <<'EOF'\nThe guard blocks `rm -rf`.\nEOF",
    "cat <<EOF\nplain text that mentions rm -rf\nEOF",
    'echo "it\'s \\"rm -rf\\" in quotes"',
  ])("allows %j", (command) => {
    expect(findDangerousCommand(command)).toBeNull();
  });
});
