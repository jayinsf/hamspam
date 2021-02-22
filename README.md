# Hamspam <a href="#"><img src=".screenshot/icon.png" alt="Hamspam Logo" width=100 height=100 align="right"></a>

Hamspam is a cross-browser extension that injects visual feedback about spamminess of your emails into page. The name *hamspam* is a combination of two words _ham_ and _spam_, where _ham_ is an antonym for _spam_.

## Preview

Hamspam can scan various [checkpoints](#checkpoints "checkpoints") and display <img alt="" src=".screenshot/pass.png" width=24> Pass, <img alt="" src=".screenshot/warning.png" width=24> Warning, and <img alt="" src=".screenshot/fail.png" width=24> Fail indicators.

<p align="center">
  <img alt="" src=".screenshot/preview_1.png" width=49%> <img alt="" src=".screenshot/preview_2.png" width=49%><img alt="" src=".screenshot/preview_3.png" width=49%> <img alt="" src=".screenshot/preview_4.png" width=49%>
</p>

## Installation

Download and unzip [hamspam.zip](../../archive/master.zip "Hamspam zip file")

<a href="#"><img alt="Firefox Logo" src=".screenshot/firefox_logo.svg" width=20></a> Firefox:
1. Navigate to [about:debugging](about:debugging "Firefox Developer Tools")
2. Click **Load Temporary Add-on**, then select dist folder

<a href="#"><img alt="Chrome Logo" src=".screenshot/chrome_logo.svg" width=20></a> Chrome:
1. Open [chrome://extensions](chrome://extensions "Chrome Extensions")
2. Enable **Developer mode** at the top-right corner
3. Click **Load unpacked** button, then select dist folder

## Getting Started

### Prerequisites

* Node.js
```
$ yum install nodejs
$ yum install npm
```

* Install npm packages
```
npm install
```

### Development
* Watch for updates to code and compile automatically: `npm run develop`
* Build the optimized production: `npm run build`
* Run all unit tests: `npm run test`

## API

1. To use Hamspam on an email service, create two child classes extending AbstractEmail and AbstractView, respectively.

* Class template extending AbstractEmail

```typescript
'use strict';

import { AbstractEmail } from "./AbstractEmail";

export class Email extends AbstractEmail {
  
  constructor() {
    super();
  }

  public getBody(): HTMLElement { throw new Error('Not Implemented'); }

  public getSender(): HTMLElement { throw new Error('Not Implemented'); }

  public getSenderString(): string { throw new Error('Not Implemented'); }
  
  public getDeliveryTime(): HTMLElement { throw new Error('Not Implemented'); }

  public getDeliveryTimeString(): string { throw new Error('Not Implemented'); }

  public getLink(): Array<HTMLAnchorElement> { throw new Error('Not Implemented'); }
  
  public getLinkString(): Array<string> { throw new Error('Not Implemented'); }

  public getAttachment(): Array<HTMLElement> { throw new Error('Not Implemented'); }

  public getAttachmentString(): Array<string> { throw new Error('Not Implemented'); }
  
  public write(parent: Node, self: Node): void { throw new Error('Not Implemented'); }
}
```

* Class template extending AbstractView

```typescript
'use strict';

import { AbstractView } from "./AbstractView";

export class EmailView extends AbstractView {

  constructor() {
    super();
  }

  public showIsTrustedSender(): boolean { throw new Error('Not Implemented'); }
  
  public showDeliveredLateNight(): boolean { throw new Error('Not Implemented'); }

  public showIsMaliciousLink(): boolean { throw new Error('Not Implemented'); }

  public showIsSuspiciousFile(): boolean { throw new Error('Not Implemented'); }

  public showFindTriggerWord(): boolean { throw new Error('Not Implemented'); }
}
```

2. Make created classes public by exporting in [Lib.ts](src/Lib.ts "Lib.ts")
```
export * from './Email';
export * from './EmailView';
```

3. Add configuration in [config.yaml](dist/config.yaml "config.yaml")
```
email:
  ...
  - {name: Email, hostname: email.com, view: EmailView}
  ...
```

### AbstractEmail

Abstract Email class has algorithm for spam filtering.

#### Checkpoints

| Checkpoint | Method | Returns | Description |
|-|-|-|-|
| Sender | `isTrustedSender(<String> sender)` | `<Boolean>` | Check if an email address string exists in whitelist |
| Delivery timestamp | `deliveredLateNight(<String> deliveryTime)` | `<Boolean>` | Check if a timestamp string is within the configured range |
| Links | `isMaliciousLink(<String> uri)` | `Array of link types` | Check if a link falls under any of the following rules: <ul>   <li>Link uses the insecure HTTP connection.</li>   <li>Link is an IP address</li>   <li>Link redirects to another page</li>   <li>Link uses non-standard port like HTTPS over 80 and HTTP over 443</li>   <li>Link contains authentication credentials</li>   <li>Link is a path to files on one's own computer</li>   <li>Link uses a shady top-level domain</li>   <li>Link contains dash or %</li>   <li>Link is hosted on free web hosting providers</li> </ul> |
| Attachments | `isSuspiciousFile(<String> filename)` | `<Boolean>` | Check an attachment by file extension, including but not limited to: <ul>   <li>Executable file that may contain virus or malicious code</li>   <li>Script and command file</li>   <li>PDF and Microsoft suite that may contain macro malware</li> </ul> |
| Spam words | `findSpamWords(<HTMLElement> test)` | `Pairs of spam word and character position` | Find spam words and their character positions in a test string <ul>   <li>Convert emojis to text</li>   <li>Recognize text and characters from image</li> </ul> |

#### Parsing

| Method | Returns | Description |
|-|-|-|
| `getBody()` | `<HTMLElement>` | Get HTML container of email body |
| `getSender()` | `<HTMLElement>` | Get HTML container of sender email address |
| `getSenderString()` | `<String>` | Get sender email address |
| `getDeliveryTime()` | `<HTMLElement>` | Get HTML container of delivery timestamp |
| `getDeliveryTimeString()` | `<String>` | Get delivery timestamp |
| `getLink()` | `Array of HTML anchor elements` | Get all links in email |
| `getLinkString()` | `Array of linktext` | Get text of all links in email |
| `getAttachment()` | `Array of HTML containers of filenames` | Get containers of all attachment file names |
| `getAttachmentString()` | `Array of filenames` | Get all attachment file names |

### AbstractView

Once scan is complete, the Abstract View class displays a <img alt="" src=".screenshot/pass.png" width=24> Pass, <img alt="" src=".screenshot/warning.png" width=24> Warning, or <img alt="" src=".screenshot/fail.png" width=24> Fail indicator for each checkpoint. Override `getIndicator()` to use your custom indicator designs.

| Method | Returns | Description |
|-|-|-|
| `showIfIsTrustedSender(<HTMLElement> position, <Boolean>isTrustedSender)` | - | Display an indicator to sender email address |
| `showIfDeliveredLateNight(<HTMLElement> position, <Boolean>deliveredLateNight)` | - | Display an indicator to delivery timestamp |
| `showMaliciousLink(<HTMLElement> position, <MaliciousLinkType[]> maliciousLinkType` | - | Display indicator to each link |
| `showSuspiciousFile(<HTMLElement> position, <Boolean> isSuspiciousFile)` | - | Display indicator to each attachment |
| `showSpamWord(<String> triggerWord)` | `<String>` | Get indicator as HTML string for a spam word  |
| `getIndicator(<SecurityLevel> level)` | `<String>` | Get indicator as HTML string |
| `getIndicatorClass(<SecurityLevel> level)` | `<String>` | Get design for a pass, warning or fail indicator |

### Configuration

After creating child classes of AbstractEmail and AbstractView, add the child class names to `email` in [config.yaml](dist/config.yaml "config.yaml")

| Object | Tag | Description |
|-|-|-|
| `email` **(required)** | `name` - child class name of AbstractEmail<br>`hostname` - the host name of email service provider<br>`view` - child class name of AbstractView | Pairs of AbstractEmail, AbstractView and host name |
| `sender-whitelist` | Array of email addresses | List of the trusted email addresses<br>Allow regular expressions <ul><li> _e.g._ `\*@\*.sfsu.edu` will whitelist all email addresses ending with "@sfsu.edu" and "@mail.sfsu.edu"</li></ul> |
| `late-delivery` | `from (default: 300)` - start time of late delivery hours. Email was received late if delivery time is greater than this number<br>`to (default: 1320)` - end time of late delivery hours. Email was received late if delivery time is smaller than this number | Range of late night hours<br>Each hour since midnight is 60 <ul><li>_e.g._ 0=midnight, 540=9am, 720=noon, 930=3:30pm</li></ul> |
| `suspicious-file-extensions` | Array of file extensions | List of file extensions |
| `spam-words` | Array of spam words | List of spam words<br>Allow regular expressions <ul><li>_e.g._ `gift( card)?` flags "gift" and "gift card" as spam words</li></ul>Space between words matches strictly zero or more spaces <ul><li>_e.g._ `sign up` flags "sign &nbsp;up" (double spaces) and "signup" (no space) as spam word</li></ul> |

## Issues and Contributions

Contributions are welcome. If you have a bug or feature request, please create an [issue](../../issues "issue"). See the list of [contributors](../../graphs/contributors "contributors") who participated in this project.
