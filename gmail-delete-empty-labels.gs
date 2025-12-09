/* SPDX-License-Identifier: BSD-2-Clause */

const labelPrefixes = ["freedesktop"];

function deleteEmptyLabels() {
  const userLabels = GmailApp.getUserLabels();

  for (const label of userLabels) {
    for (const prefix of labelPrefixes) {
      if (label.getName().startsWith(`${prefix}/`)) {
        const threads = label.getThreads(0, 1);
        if (threads.length === 0) {
          Logger.log(`${label.getName()} is empty`);
          label.deleteLabel();
        }
      }
    }
  }
}
