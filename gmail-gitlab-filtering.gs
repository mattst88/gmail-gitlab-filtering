/* SPDX-License-Identifier: BSD-2-Clause */

const personalLabelName = "mattst88";
const unprocessedLabels = ["freedesktop"];
const maxThreads = 240;

let personalLabel;
function processInbox() {
  updateUserLabels();
  personalLabel = GmailApp.getUserLabelByName(personalLabelName);

  for (const label of unprocessedLabels) {
    processLabel(userLabels[label]);
  }
}

let toInboxThreads = [];
let toRemoveThreads = new Map();
let toAddThreads = new Map();

/* the GmailLabel.addToThreads/removeFromThreads functions
 * only process 100 threads at a time */
function processInChunks(threads, callback) {
  const chunkSize = 100;
  for (let i = 0; i < threads.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, threads.length);
    callback(threads.slice(i, end));
    Logger.log("\t... " + end + " done");
  }
}

function processLabel(unprocessedLabel) {
  let threads = GmailApp.search("label:" + unprocessedLabel.getName(), 0, maxThreads);
  if (threads.length < 1) {
    Logger.log("No threads to process with label:" + unprocessedLabel.getName());
    return;
  } else {
    Logger.log("Processing threads with label:" + unprocessedLabel.getName());
  }

  for (const [i, thread] of threads.entries()) {
    Logger.log("Processing thread " + i);

    processThread(unprocessedLabel, thread);
  }

  /* Apply labels to threads */
  for (const [label, threads] of toAddThreads) {
    Logger.log("Adding " + label.getName() + " label to " + threads.length + " threads");
    processInChunks(threads, (chunk) => label.addToThreads(chunk));
  }

  /* Move threads to Inbox */
  if (toInboxThreads.length > 0) {
    Logger.log("Moving " + toInboxThreads.length + " to Inbox");
    processInChunks(toInboxThreads, (chunk) => GmailApp.moveThreadsToInbox(chunk));
  }

  /* Remove labels from threads */
  for (const label of [personalLabel, unprocessedLabel]) {
    const threads = toRemoveThreads.get(label);
    if (!threads)
      continue;
    Logger.log("Removing " + label.getName() + " label from " + threads.length + " threads");
    processInChunks(threads, (chunk) => label.removeFromThreads(chunk));
  }
}

function processThread(unprocessedLabel, thread) {
  let moveToInbox = false;
  const labelNames = new Set();

  const messages = thread.getMessages();
  for (const message of messages) {
    /* If the X-GitLab-NotificationReason header exists in any message
     * in the thread, it was sent to us because we were mentioned, we participated, etc.
     * We want to move those threads to the Inbox. */
    const notificationReason = message.getHeader("X-GitLab-NotificationReason");
    if (notificationReason) {
      moveToInbox = true;
    }

    /* Collect project paths in a Set to automatically deduplicate */
    const projectPath = message.getHeader("X-GitLab-Project-Path");
    if (projectPath) {
      labelNames.add(projectPath);
    }
  }

  for (const labelName of labelNames) {
    /* Get/create a label nested under our unprocessed label */
    const label = getLabel(unprocessedLabel.getName() + "/" + labelName);

    if (!toAddThreads.has(label)) {
      toAddThreads.set(label, []);
    }
    toAddThreads.get(label).push(thread);
  }

  if (moveToInbox) {
    toInboxThreads.push(thread);
  } else {
    if (!toRemoveThreads.has(personalLabel)) {
      toRemoveThreads.set(personalLabel, []);
    }
    toRemoveThreads.get(personalLabel).push(thread);
  }

  if (!toRemoveThreads.has(unprocessedLabel)) {
    toRemoveThreads.set(unprocessedLabel, []);
  }
  toRemoveThreads.get(unprocessedLabel).push(thread);
}

/* Makes a hash table of "name" -> label */
function makeNameToLabelTbl(labels) {
  let table = {};
  for (const label of labels) {
    table[label.getName()] = label;
  }
  return table;
}

/* Cache of user labels, indexed by name string */
let userLabels = {};
function updateUserLabels() {
  userLabels = makeNameToLabelTbl(GmailApp.getUserLabels());
}

/* Returns a GmailLabel given a name string.
 * If it doesn't exist, it creates it. */
function getLabel(name) {
  let label;
  if (!userLabels[name]) {
    label = GmailApp.createLabel(name);
    updateUserLabels();
  } else {
    label = userLabels[name];
  }
  return label;
}
