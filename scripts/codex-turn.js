#!/usr/bin/env node
"use strict";
const policy = require("./lib/codex-turn-policy.js");

function run(argv, root = process.cwd()) {
  const [command = "help", ...args] = argv;
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--state", "--artifact", "--notes", "--target", "--category", "--reason", "--child", "--assignment", "--result", "--query"].includes(args[i]) || !args[i + 1] || options[args[i]]) throw new Error("Unknown, missing or duplicate option");
    options[args[i]] = args[i + 1];
  }
  if (command === "help") return { usage: [
    "node scripts/codex-turn.js status --state <request.json>",
    "node scripts/codex-turn.js refresh --state <request.json> [--query <focused Russian editorial question>]",
    "node scripts/codex-turn.js apply --state <request.json> --artifact <exact-final.txt> --notes <principles.json> [--target final|file]",
    "node scripts/codex-turn.js editorial-assignment --state <request.json> --artifact <draft.txt>",
    "node scripts/codex-turn.js review-accept --state <request.json> --artifact <draft.txt> --child <native-editor-id>",
    "node scripts/codex-turn.js integrate --state <request.json> --child <native-id> --assignment <contract.json> --result <integration evidence>",
    "node scripts/codex-turn.js fallback --state <request.json> --category host-unavailable|unsafe-split|judgment|coordination-cost --reason <concrete reason>"],
    notes: "Read packet.json primary passages. notes is an array of {sourceId,passageSha256,principle,effect}, one per passage. Save exactly the final message bytes (no automatic newline/normalization), apply, then send that text. For files use --target file. Notes require semantic self-check or risk-appropriate independent review. Fallback is visible, never verified Luna execution." };
  if (!options["--state"]) throw new Error("--state is required from native hook context");
  if (command === "status") {
    const record = policy.loadState(root, options["--state"]);
    const children = require("path").join(record.directory, "children");
    return { ...record.state, packet: record.directory + "/packet.json", children: require("fs").existsSync(children)
      ? require("fs").readdirSync(children).filter(x => x.endsWith(".json")).map(x => policy.readJson(require("path").join(children, x))) : [] };
  }
  if (command === "refresh") return policy.groundRequest(policy.loadState(root, options["--state"]), { refresh: true, query: options["--query"] });
  if (command === "editorial-assignment") {
    if (!options["--artifact"]) throw new Error("editorial-assignment requires --artifact");
    return policy.editorialAssignment(root, options["--state"], options["--artifact"]);
  }
  if (command === "review-accept") {
    if (!options["--artifact"] || !options["--child"]) throw new Error("review-accept requires --artifact and --child");
    return policy.acceptEditorialReview(root, options["--state"], options["--artifact"], options["--child"]);
  }
  if (command === "apply") {
    if (!options["--artifact"] || !options["--notes"] || ![undefined, "final", "file"].includes(options["--target"])) throw new Error("apply requires artifact, notes and valid target");
    return policy.application(root, options["--state"], options["--artifact"], options["--notes"], options["--target"]);
  }
  if (command === "fallback") return policy.fallback(root, options["--state"], options["--category"], options["--reason"]);
  if (command === "integrate") {
    const record = policy.loadState(root, options["--state"]);
    if (!options["--child"] || !options["--assignment"] || String(options["--result"] || "").length < 20) throw new Error("integrate requires native child id, bounded assignment JSON and concrete result reference");
    const assignment = policy.readJson(policy.localFile(root, options["--assignment"]));
    if (!assignment.scope?.length || !assignment.acceptance?.length) throw new Error("Assignment requires scope and acceptance");
    if (!assignment.scope.every(x => typeof x === "string" && x.trim()) || !assignment.acceptance.every(x => typeof x === "string" && x.trim())) throw new Error("Assignment scope/acceptance must be nonempty strings");
    policy.writeJson(require("path").join(record.directory, "integration-" + require("./lib/writing-library-store.js").sha256(options["--child"]) + ".json"), { requestId: record.state.requestId, childId: options["--child"], assignment, result: options["--result"] });
    return { state: "integration-recorded", childId: options["--child"], runtimeProfile: "checked separately from native child event and runtime metadata" };
  }
  throw new Error("Unknown command");
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { run };
