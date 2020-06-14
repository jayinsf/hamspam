'use strict';

import { Config } from './Config';
const { createWorker, createScheduler } = require('tesseract.js');

/*
 * AbstractEmail - scans user's email with a set of predetermined rules created based on common spam attributes
 * 
 * @author  Juyoung
 * @version 1.0 2019-10
 */

export abstract class AbstractEmail {

  /**
   * Constructor for objects of AbstractEmail
   * @constructor
   * 
   */
  public constructor() { }

  /**
   * Checks whether sender is whitelisted
   *
   * @param  {string}  sender an email address
   * @return {boolean}        true if whitelist includes sender;
   *                          false otherwise.
   */
  public isTrustedSender(sender : string) : boolean {
    const whitelist = Config.getInstance().getConfigurationOf('sender-whitelist');
    if (whitelist !== undefined && whitelist.length === 0) {
      return false;
    }
    for (let whitelistItem of whitelist) {
      //wildcard * matches any number of characters pattern
      var regex = new RegExp('^' + whitelistItem.replace(/[+?^${}()|[\]\\]/ig, '\\$&').replace('*', '.*') + '$');
      if (regex.test(sender)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks whether email has been sent late at night
   * 
   * @param  {string}  deliveryTime time
   * @throws {Error}                if delivery time is an invalid date format
*                                   exception occurred
   * @return {boolean}              true if delivery time is not late at night;
   *                                false otherwise.
   */
  public deliveredLateNight(deliveryTime : string) : boolean {
    var date = new Date(deliveryTime);
    if (isNaN(date.getTime())) {
      //leading zero makes invalid date formats valid
      date = new Date('0' + deliveryTime);
    }
    //uses 24 hour format
    var hours = date.getHours();
    var minutes = date.getMinutes();
    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error("delivery datetime is an invalid format");
    }
    
    const deliveryTimeInMinute = (hours * 60) + minutes;
    const lateDeliveryFrom = Config.getInstance().getConfigurationOf('late-delivery').from;
    const lateDeliveryTo = Config.getInstance().getConfigurationOf('late-delivery').to;
    if (deliveryTimeInMinute < lateDeliveryFrom || deliveryTimeInMinute > lateDeliveryTo) {
      return true;
    }
    return false;
  }
  
  /**
   * Checks whether a link is malicious
   * 
   * @param  {string}              uri link address
   * @return {MaliciousLinkType[]}     zero or more rules link address falls under
   */
  public isMaliciousLink(uri : string) : AbstractEmail.MaliciousLinkType[] {
    var result : AbstractEmail.MaliciousLinkType[] = [];

    var anchor = document.createElement('a');
    anchor.href = uri;
    //insecure connection
    if (anchor.protocol === 'http:') {
      console.log('1');
      result.push(AbstractEmail.MaliciousLinkType.INSECURE_CONNECTION);
    }
    //contains dash or %
    if (anchor.hostname.indexOf('-' || '%') !== -1) {
      console.log('2');
      result.push(AbstractEmail.MaliciousLinkType.SPECIALCHAR);
    }
    //non-standard port number like https over 80 or http over 443
    if (anchor.port !== '' && anchor.protocol !== '') {
      if ((anchor.protocol === 'https:' && anchor.port === '80') || (anchor.protocol === 'http:' && anchor.port === '443')) {
        console.log('3');
        result.push(AbstractEmail.MaliciousLinkType.NONSTANDARD_PORT);
      }
    }
    //is ip address
    if (/^\d+\.\d+\.\d+\.\d+$/g.test(anchor.hostname)) {
      console.log('4');
      result.push(AbstractEmail.MaliciousLinkType.IP_ADDRESS);
    }
    //contains authentication credentials
    if (/.*\:\/\/.*@.*/g.test(anchor.href)) {
      console.log('5');
      result.push(AbstractEmail.MaliciousLinkType.AUTHENTICATION_CREDENTIAL);
    }
    //prefixed with file://
    if (anchor.protocol === 'file:') {
      console.log('6');
      result.push(AbstractEmail.MaliciousLinkType.FILE);
    }
    //is shady top-level domain
    if (['work', 'live', 'buzz', 'tk', 'fit', 'top', 'cn', 'rest'].indexOf(anchor.hostname.split('.').pop()) > -1) {
      console.log('7');
      result.push(AbstractEmail.MaliciousLinkType.TOP_LEVEL_DOMAIN);
    }
    //hosted on free web hosting providers
    for (let webHostingService of ['weebly.com', 'cognitoforms.com', '0000webhostapp.com', 'jigsy.com', 'jotform.com']) {
      if (anchor.hostname.includes(webHostingService)) {
        console.log('8');
        result.push(AbstractEmail.MaliciousLinkType.FREE_HOSTING);
      }
    }
    //redirects to another page, i.e. shortened url
    var request = new XMLHttpRequest();
    try {
      request.withCredentials = true;
      request.onreadystatechange = function() {
        if (request.readyState === 4 && request.status === 200) {
          if (anchor.href !== request.responseURL) {
            result.push(AbstractEmail.MaliciousLinkType.REDIRECT);
          }
        }
      }
      request.open('HEAD', anchor.href, false);
      request.send();
    } catch (e) {
      console.log(e);
    }

    if (anchor.textContent !== '' && result.length === 0) {
      //recursively tests a generated link that sets href to link text
      this.isMaliciousLink(anchor.textContent);
    }

    console.log('10');
    
    return result;
  }

  /**
   * Checks whether attachment file is suspicious
   * 
   * @param  {string}  filename file name
   * @return {boolean}          true if attachment is suspicious;
   *                            false otherwise.
   */
  public isSuspiciousFile(filename : string) : boolean {
    const suspiciousFileExtensions = Config.getInstance().getConfigurationOf('suspicious-file-extensions');
    if (suspiciousFileExtensions === undefined) {
      return false;
    }
    if (suspiciousFileExtensions.indexOf(filename.split('.').pop()) >= 0) {
      return true;
    }
    return false;
  }

  /**
   * Checks whether email contains spam words
   * 
   * @param  {HTMLElement}             test email body
   * @return {Array<[number, string]>}      pairs of spam word and character position
   */
  public findSpamWords(test : HTMLElement) : Array<[number, string]> {
    const emojiToString = {
      '🅰️': 'a',
      '🆎': 'ab',
      '🏧': 'atm',
      '🅱️': 'b',
      '©': 'c',
      '💳': 'card',
      '🆑': 'cl',
      '🆒': 'cool',
      '🆓': 'free',
      '🗽': 'freedom',
      'ℹ️': 'information',
      '🆔': 'id',
      '🃏': 'j',
      '🆕': 'new',
      '🆖': 'ng',
      '⛔': 'no',
      'Ⓜ️': 'm',
      '🅾️': 'o',
      '🆗': 'ok',
      '🅿️': 'p',
      '🚫': 'no',
      '🐊': 'SFSU',
      '®': 'r',
      '🎰': 'casino',
      '🆘': 'sos',
      '🎫': 'ticket',
      '🎟': 'ticket',
      '💲': '$',
      '💰': '$',
      '💸': '$',
      '💵': '$',
      '🆙': 'up',
      '🆚': 'vs',
      '🚾': 'wc',
      '❌': 'x',
      '❎': 'x',
      '💤': 'z',
      '#️⃣': '#',
      '*️⃣': '*',
      '0️⃣': 0,
      '1️⃣': 1,
      '2️⃣': 2,
      '3️⃣': 3,
      '4️⃣': 4,
      '5️⃣': 5,
      '6️⃣': 6,
      '7️⃣': 7,
      '8️⃣': 8,
      '🎱': 8,
      '9️⃣': 9,
      '🔟': 10,
      '❓': '?',
      '❔': '?',
      '❗️': '!',
      '❕': '!',
      '‼': '!!',
      '⁉': '!?',
      '〰': '~',
      '➕': '+',
      '➖': '-',
    };
    //makes a deep copy of test string and converts emojis to string
    var regex = new RegExp('(\\' + Object.keys(emojiToString).join('|\\') + ')', 'g');
    var testString : string = test.innerHTML.replace(regex, function(match : string) { return emojiToString[match]; });
    
    //converts test string to html
    var span : Element = document.createElement('span');
    var innerSpan : Element = document.createElement('span');
    span.appendChild(innerSpan);
    //adds test string within inner span
    innerSpan.innerHTML = testString;
    var htmlObj = span.firstChild;
    //stringfies and tests outer span
    for (let element of <Element[]><unknown>htmlObj.parentElement.querySelectorAll(`button.hamspam`)) {
      //replaces all characters in indicator tag and internal tags with spaces
      element.outerHTML = element.outerHTML.replace(/./g, ' ');
    }
    testString = (<Element>htmlObj).innerHTML;

    //stores spam word and its character position
    var tuple : Array<[number, string]> = new Array<[number, string]>();
    for (let spamWord of Config.getInstance().getConfigurationOf('spam-words')) {
      //matches word in paragraphs excluding html tags and attribute
      regex = new RegExp('\\b('+ spamWord.replace(' ', '(\\s+)?') + '(?![^<>]*>))\\b', 'gmi');
      var match : RegExpExecArray;
      while ((match = regex.exec(testString)) != null) {
        tuple.push([match.index, match[0]]);
      }
    }
    //returns 2-tuple of position sorted in ascending order and the spam words
    return tuple.sort((num1, num2) => num1[0] - num2[0]);
  }

  /**
   * Returns container of email body
   * 
   * @return {HTMLElement} container of email body
   */
  public abstract getBody() : HTMLElement;
                                                  
  /**
   * Returns container of sender email address
   * 
   * @return {HTMLElement} container of sender email addresss
   */
  public abstract getSender() : HTMLElement;

  /**
   * Returns string of sender email address
   * 
   * @return {string} sender email addresss
   */
  public abstract getSenderString() : string;

  /**
   * Returns container of delivery time
   * 
   * @return {HTMLElement} container of delivery time
   */
  public abstract getDeliveryTime(): HTMLElement;

  /**
   * Returns string of delivery time
   * 
   * @return {string} delivery time
   */
  public abstract getDeliveryTimeString() : string;

  /**
   * Returns an array of all links in email
   * 
   * @return {Array<HTMLAnchorElement>} array of anchor tags
   */
  public abstract getLink() : Array<HTMLAnchorElement>;

  /**
   * Returns an array of all link text in email
   * 
   * @return {Array<string>} array of link text
   */
  public abstract getLinkString() : Array<string>;

  /**
   * Returns an array of containers of all attachments
   * 
   * @return {Array<HTMLElement>} array of containers of attachments
   */
  public abstract getAttachment() : Array<HTMLElement>;

  /**
   * Returns an array of attachment file names
   * 
   * @return {Array<string>} array of attachment file names
   */
  public abstract getAttachmentString() : Array<string>;

  /**
   * Recognizes text in images
   * 
   * @param {Array<string>}    imageSources image sources
   * @return {Promise<object>}              promise object with the extracted text from images
   */
  public async imageToString(imageSources : Array<string>): Promise<object> {
    const scheduler = createScheduler();
    //creates workers
    var numWorkers = 3;
    while (numWorkers-- > 0) {
      var worker = createWorker();
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      scheduler.addWorker(worker);
    }
    //gets number of workers
    //console.log(scheduler.getNumWorkers());

    const results = await Promise.all(imageSources.map((oneImageSource) => (
      //console.log(oneImageSource),
      scheduler.addJob('recognize', oneImageSource)
    )));
    await scheduler.terminate();
  
    return results;
  }
}

/**
 * MaliciousLinkType - enum class for malicious link type
 * 
 */
export namespace AbstractEmail {
  export enum MaliciousLinkType {
    INSECURE_CONNECTION,
    SPECIALCHAR,
    NONSTANDARD_PORT,
    IP_ADDRESS,
    AUTHENTICATION_CREDENTIAL,
    FILE,
    REDIRECT,
    TOP_LEVEL_DOMAIN,
    FREE_HOSTING
  }
}