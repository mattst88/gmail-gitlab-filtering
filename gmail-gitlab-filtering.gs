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

function processLabel(unprocessedLabel) {
  let threads = GmailApp.search("label:" + unprocessedLabel.getName(), 0, maxThreads);
  if (threads.length < 1) {
    Logger.log("No threads to process with label:" + unprocessedLabel.getName());
    return;
  } else {
    Logger.log("Processing threads with label:" + unprocessedLabel.getName());
  }

  for (const i in threads) {
    Logger.log("Processing thread " + i);

    processThread(unprocessedLabel, threads[i]);
  }

  /* the GmailLabel.addToThreads/removeFromThreads functions
   * only process 100 threads at a time */
  const chunk_size = 100;

  /* Apply labels to threads */
  for (const [label, threads] of toAddThreads) {
    Logger.log("Adding " + label.getName() + " label to " + threads.length + " threads");

    for (let i = 0; i < threads.length; i += chunk_size) {
      const end = Math.min(i+chunk_size, threads.length);
      label.addToThreads(threads.slice(i, end));
      Logger.log("\t... " + end + " done");
    }
  }

  /* Move threads to Inbox */
  Logger.log("Moving " + toInboxThreads.length + " to Inbox");
  for (let i = 0; i < toInboxThreads.length; i += chunk_size) {
    const end = Math.min(i+chunk_size, toInboxThreads.length);
    GmailApp.moveThreadsToInbox(toInboxThreads.slice(i, end));
    Logger.log("\t... " + end + " done")
  }

  /* Remove labels from threads */
  for (const label of [personalLabel, unprocessedLabel]) {
    const threads = toRemoveThreads.get(label);
    if (!threads)
      continue;
    Logger.log("Removing " + label.getName() + " label from " + threads.length + " threads");

    for (let i = 0; i < threads.length; i += chunk_size) {
      const end = Math.min(i+chunk_size, threads.length);
      label.removeFromThreads(threads.slice(i, end));
      Logger.log("\t... " + end + " done");
    }
  }
}

function processThread(unprocessedLabel, thread) {
  let moveToInbox = false;
  let labelNames = [];

  let messages = thread.getMessages();
  for (const message of messages) {
    /* If the X-GitLab-NotificationReason header exists in any message
     * in the thread, it was sent to us because we were mentioned, we participated, etc.
     * We want to move those threads to the Inbox. */
    let notificationReason = message.getHeader("X-GitLab-NotificationReason")
    if (notificationReason) {
      moveToInbox = true;
    }

    /* Push the project path to a list. We'll deduplicate later. */
    const projectPath = message.getHeader("X-GitLab-Project-Path");
    if (projectPath) {
      labelNames.push(projectPath);
    }
  }

  /* Deduplicate labels list */
  labelNames = labelNames.filter(onlyUnique);

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
  let table = [];
  for (const label of labels) {
    table[label.getName()] = label;
  }
  return table;
}

/* Cache of user labels, indexed by name string */
let userLabels = [];
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

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}
