# gmail-gitlab-filtering
`gmail-gitlab-filtering.gs` is a [Google Apps Script](https://developers.google.com/apps-script) for Gmail to sort and filter email from [GitLab](https://about.gitlab.com/).

[![BSD-2 license](https://img.shields.io/badge/License-BSD2-blue.svg)](LICENSE)

# The Problem
Receiving all messages from a mailing list and filtering by whether I am a direct recipient (in `To:` or `Cc:`) has been an effective strategy for me to both

 1. follow development at large
 2. not miss requests for my input

With mailing lists, I accomplish this with a combination of Gmail filters:

```
Matches: to:(mattst88@gmail.com)
Do this: Apply label "mattst88"
```
```
Matches: list:mesa-dev.lists.freedesktop.org
Do this: Apply label "mesa-dev"
```
```
Matches: -{to:mattst88@gmail.com}
Do this: Skip Inbox
```

Thus, mail from mailing lists is labeled appropriately and doesn't clutter my inbox. Any messages with me in `To:` or `Cc:` cause the thread to be labeled with a personal `mattst88` label and appear in the inbox.

I have not been able to replicate this with GitLab and Gmail, given the limitations of each.

Emails from GitLab contain [many headers](https://docs.gitlab.com/ee/user/profile/notifications.html#email-headers-you-can-use-to-filter-email) that can be used to filter the message. Of the headers GitLab uses, Gmail's filtering system can only filter on `List-Id`.

GitLab can be configured to email updates under different circumstances: any activity, only for threads you've participated in, only for comments that mention you, etc.

This leaves me with a choice of receiving notifications only for threads I'm involved in or for all threads but without the ability to easily find requests directed to me.

# The Solution
Google Apps Script provides a method of automating many operations on a Gmail account (sending email, searching, labeling, etc.) via the [GmailApp](https://developers.google.com/apps-script/reference/gmail) class. The `gmail-gitlab-filtering.gs` script is run every 10 minutes via a trigger on script.google.com and performs filtering and labeling based on the `X-GitLab` headers.

This allows me to appropriately label notifications that are directed to me, as well as dynamically create labels for notifications received from new projects.

## How
Email from GitLab is labeled using Gmail's default filtering with a top-level label and skips the inbox. In my case, all mail from `gitlab@gitlab.freedesktop.org` is given the `freedesktop` label:

```
Matches: from:(gitlab@gitlab.freedesktop.org)
Do this: Skip Inbox, Apply label "freedesktop"
```

Threads with this label are considered unprocessed.

The `gmail-gitlab-filtering.gs` script searches for threads with that label, and inspects the headers of each message using the [GmailMessage.getHeader()](https://developers.google.com/apps-script/reference/gmail/gmail-message#getHeader(String)) function.

The script records the value of all `X-GitLab-Project-Path` headers and whether any message in the thread contained a `X-GitLab-NotificationReason` header.

Threads containing a `X-GitLab-NotificationReason` header retain the personal label and are moved to the inbox. Threads without `X-GitLab-NotificationReason` header remain archived and the personal label is removed. All threads are labeled with `${unprocessedLabel}/${X-GitLab-Project-Path}`, and the label is dynamically created if needed. The unprocessed label is always removed as the final step, in case the script's runtime exceeds the allowed timelimit (see below).

For example, if I were to receive a notification of a merge request in the [mesa/shader-db](https://gitlab.freedesktop.org/mesa/shader-db/) project that mentioned me, the script would move the thread to the inbox, leave the `mattst88` label intact, label the mail `freedesktop/mesa/shader-db` (creating the label if needed), and remove the `freedesktop` label.

## Implementation notes and limitations
None of the limitations cause problems for my usage. I receive a few hundred GitLab notifications per day.

### Google Apps Scripts are [subject to quotas](https://developers.google.com/apps-script/guides/services/quotas).
While developing this script, I hit two quotas:

- Script runtime: 6 min / execution
- Email read/write (excluding send): 20,000 / day

To fit into the 6 minutes / execution limit, the script operates on a maximum of 240 threads per execution. See the `maxThreads` variable. I arrived at the 240 number empirically; it's not definitive.

I reached the 20,000 / day email read/write quota during development and expect to never reach it again now that the script functions.

To improve efficiency (and perhaps avoid hitting quotas), the script creates lists of [GmailThread](https://developers.google.com/apps-script/reference/gmail/gmail-thread)s so they can be passed in batches to [GmailApp.moveThreadsToInbox](https://developers.google.com/apps-script/reference/gmail/gmail-app#moveThreadsToInbox(GmailThread)), [GmailLabel.addToThreads](addToThreads), and [GmailLabel.removeFromThreads](https://developers.google.com/apps-script/reference/gmail/gmail-label#removeFromThreads(GmailThread))  †. It's unclear to me which functions use quota and how much they use.

† These functions accept only 100 threads per call, so the script calls them multiple times on `.slice()`s of the lists.

### Google Apps Scripts don't support async/await
I initially though I would be able to improve performance of the script by using [async/await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await). While the V8 Runtime [recognizes the keywords](https://developers.google.com/apps-script/guides/v8-runtime?hl=en#improved_function_detection) it does not make use of them. An upstream bug is filed [here](https://issuetracker.google.com/issues/149937257).

I found an interesting work-around: [Async.gs](https://gist.github.com/sdesalas/2972f8647897d5481fd8e01f03122805). It works by scheduling a script execution in the future. I did not experiment with it.

# Setup
1. Create a project on [script.google.com](https://script.google.com/)
2. Paste `gmail-gitlab-filtering.gs` into the default `Code.gs` file
3. Modify as needed for your particular filtering rules
4. Set up a trigger to run the script periodically. I followed the instructions from [Marcin Jasion](https://mjasion.pl/)'s [How to label GitLab notification in Gmail by headers?](https://mjasion.pl/label-gitlab-notifications/) article.

# I'm not a JavaScript developer
I muddled through writing the script with the help of the [Apps Script documentation](https://developers.google.com/apps-script/overview) and the Mozilla Web Docs [JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript). Improvements to the code are welcome.
