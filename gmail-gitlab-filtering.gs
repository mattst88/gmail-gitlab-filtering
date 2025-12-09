/* SPDX-License-Identifier: BSD-2-Clause */

const personalLabelName = "mattst88";
const unprocessedLabels = ["freedesktop"];
const maxThreads = 240;

let personalLabel;
function processInbox() {
  userLabels.update();
  personalLabel = GmailApp.getUserLabelByName(personalLabelName);

  for (const label of unprocessedLabels) {
    processLabel(userLabels.get(label));
  }
}

/* the GmailLabel.addToThreads/removeFromThreads functions
 * only process 100 threads at a time */
function processInChunks(threads, callback) {
  const chunkSize = 100;
  for (let i = 0; i < threads.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, threads.length);
    callback(threads.slice(i, end));
    Logger.log(`\t... ${end} done`);
  }
}

function processLabel(unprocessedLabel) {
  const toInboxThreads = [];
  const toRemoveThreads = new Map();
  const toAddThreads = new Map();

  const threads = GmailApp.search(`label:${unprocessedLabel.getName()}`, 0, maxThreads);
  if (threads.length < 1) {
    Logger.log(`No threads to process with label:${unprocessedLabel.getName()}`);
    return;
  }
  Logger.log(`Processing threads with label:${unprocessedLabel.getName()}`);

  function processThread(thread) {
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
      const label = userLabels.get(`${unprocessedLabel.getName()}/${labelName}`);

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

  for (const [i, thread] of threads.entries()) {
    Logger.log(`Processing thread ${i}`);

    processThread(thread);
  }

  /* Apply labels to threads */
  for (const [label, threads] of toAddThreads) {
    Logger.log(`Adding ${label.getName()} label to ${threads.length} threads`);
    processInChunks(threads, (chunk) => label.addToThreads(chunk));
  }

  /* Move threads to Inbox */
  if (toInboxThreads.length > 0) {
    Logger.log(`Moving ${toInboxThreads.length} to Inbox`);
    processInChunks(toInboxThreads, (chunk) => GmailApp.moveThreadsToInbox(chunk));
  }

  /* Remove labels from threads */
  for (const label of [personalLabel, unprocessedLabel]) {
    const threads = toRemoveThreads.get(label);
    if (!threads)
      continue;
    Logger.log(`Removing ${label.getName()} label from ${threads.length} threads`);
    processInChunks(threads, (chunk) => label.removeFromThreads(chunk));
  }
}

const userLabels = (() => {
  let cache = {};

  return {
    update() {
      cache = Object.fromEntries(GmailApp.getUserLabels().map(label => [label.getName(), label]));
    },
    get(name) {
      if (!cache[name]) {
        cache[name] = GmailApp.createLabel(name);
      }
      return cache[name];
    },
  };
})();
