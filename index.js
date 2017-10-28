const puppeteer = require('puppeteer');
const crypto = require('crypto');
const result = require('dotenv').config()

if (result.error) {
  throw result.error
}
console.log(result.parsed)
if (!process.env.ABC_USERNAME && !process.env.ABC_PASSWORD) {
  throw new Error('missing username or password!')
}

(async() => {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  // set page size
  await page.setViewport({width: 1920, height: 1080, isMobile: false});
  // load main page
  await page.goto('http://www.mysmartabc.com/', {waitUntil: 'networkidle'});
  // type username
  await page.focus('#txtAcc');
  await page.keyboard.type(process.env.ABC_USERNAME);
  // type pw
  await page.focus('#txtPw');
  await page.keyboard.type(process.env.ABC_PASSWORD);
  // login
  await page.click('#btnLogin');
  await page.waitForNavigation({waitUntil: 'networkidle'});

  // submit question when finish ex
  async function submitQuestion() {
    // click complete & submit
    await page.click('img#btnFinish')
    await page.waitForSelector('img[src$=\"btnSubmit.png\"]')
    await page.evaluate('window.btnSubmitThis_ClickHandler()')
    await page.waitForNavigation({waitUntil: 'networkidle'});
    await page.waitFor(1000);
    console.log("page submit complete...")
    await page.evaluate('window.btnHome_ClickHandler()');
    await page.waitForNavigation({waitUntil: 'networkidle'});
  }

  // do common questions type and pending submit
  async function doQuestion() {
    // do MC question
    const ansA = await page.$$('.SmartElement > table > tbody > tr:nth-child(3) a.radio-fx');
    console.log(`we have ${ansA.length} MC questions`)
    for (let ansHandle of ansA) {
      await ansHandle.click();
    }
    // do fill in the blank question
    const fills = await page.$$('.SmartElement > input')
    console.log(`we have ${fills.length} fill in the blank questions`)
    for (let fillHandle of fills) {
      await fillHandle.type('foobar');
      await fillHandle.press('Tab');
    }
    // do dictation
    const blanks = await page.$$('.ABCBody.HalfPageQ textarea')
    console.log(`we have ${blanks.length} fill in the dictation questions`)
    for (let blankHandle of blanks) {
      await blankHandle.type('foobar');
      await blankHandle.press('Tab');
    }

    console.log('question complete...')
    await page.waitForNavigation({waitUntil: 'networkidle'});
    await page.waitFor(1000);
  };

  async function hashPageContent() {
    return crypto.createHash('md5').update(await page.content()).digest("hex")
  }

  // just keep doing...
  while (true) {
    try {
      // click do practice
      await page.waitForSelector('#menuEx');
      await page.click('#menuEx');
      await page.waitFor(3000);
    } catch(err) {
      // console.log(`Timeout, going to reload page`)
      // await page.reload({waitUntil: 'load'})
      continue; // out from block
    }
    console.log(`try to find the first ex to click!`)

    await page.waitForSelector('img.ExIcon');
    const ex = await page.$('img.ExIcon[src$=\"O.png\"]');
    if (ex) {
      console.log(`going to click ex`)
      await ex.click()
      await page.waitForSelector('#FSPShowDivContent');
      await page.click('#FSPShowDivContent > div.popUpExOption img.ExIconL[src$=\"O.png\"]');
      await page.waitForNavigation({waitUntil: 'networkidle'});

      // btnGoNextPage2
      await page.waitForSelector('#btnGoNextPage2');
      const noPage2 = await page.$eval('#btnGoNextPage2', el => el.style.display == 'none');
      console.log(`noPage2=${noPage2}`)
      if (!noPage2) {
        await page.click('#btnGoNextPage2');
        await page.waitForSelector('#ABCQDiv')
      }

      const vocab = await page.$('#myVbGameOption');
      if (vocab) {
        console.log(`this is a vocab game!`)
        // await vocab.click()
        await page.evaluate(`window.goVocabGame(1)`)
        await page.waitForNavigation({waitUntil: 'networkidle'});
        await submitQuestion()
      } else {
        await doQuestion()
        await submitQuestion()
      }
      console.log("some how we are in here..")
    } else {
      console.log('no more exs left for this month!')
      // click back until no dom change!
      const htmlHashNow = await hashPageContent()
      console.log(htmlHashNow)
      console.log('go back a month...')
      await page.evaluate('JsCaGoPrev(\"JsCaContainer\",\"myJsCaTOC\",1)') // click prev months
      const htmlHashOld = await hashPageContent()
      console.log(htmlHashOld)
      if (htmlHashNow === htmlHashOld) {
        console.log("find same hash and all exs for all month should be done!")
        // take screenshot to debug
        await page.screenshot({path: 'example.png'});
        break;
      }
    }
  }
  browser.close();
})();
