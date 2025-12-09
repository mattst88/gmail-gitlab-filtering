/* SPDX-License-Identifier: BSD-2-Clause */

const labelPrefixes = ["freedesktop"];

function deleteEmptyLabels() {
  const userLabels = GmailApp.getUserLabels();

  userLabels
    .filter(label => labelPrefixes.some(prefix => label.getName().startsWith(`${prefix}/`)))
    .forEach(label => {
      const threads = label.getThreads(0, 1);
      if (threads.length === 0) {
        Logger.log(`${label.getName()} is empty`);
        label.deleteLabel();
      }
    });
}
