const puppeteer = require("puppeteer");
const fs = require("fs");

const { scrapeComments } = require('./scraperFunctions');

const PATH = "https://meta.tagesschau.de/";
const result = [];

async function scrapeAllComments(page, newsUrl) {
  let commentsData = [];
  let nextPageUrl = newsUrl;

  while (nextPageUrl) {
    // Navigate to the current page
    console.log(`Scraping page: ${nextPageUrl}`);
    await page.goto(nextPageUrl, { waitUntil: "networkidle2" });
    

    // Scrape comments on the current page
    const currentPageComments = await scrapeComments(page, newsUrl);
    commentsData.push(...currentPageComments);

    // Check for the "Next Page" button
    nextPageUrl = await page.evaluate(() => {
      const nextPageElement = document.querySelector(
        ".pager__item.pager__item--next a"
      );
      return nextPageElement ? nextPageElement.href : null;
    });
    
  }

  return commentsData;
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(PATH, { waitUntil: "networkidle2" });

  await page.waitForSelector(".views-row");

  const firstNewsUrl = await page.evaluate(() => {
    return document
      .querySelectorAll(
        '.views-row a.button--primary[data-component-id="tgm:button"]'
      )[1]
      ?.getAttribute("href");
  });

  if (!firstNewsUrl) {
    console.error("No news URL found.");
    await browser.close();
    return;
  }

  await page.goto(PATH + firstNewsUrl, { waitUntil: "networkidle2" });

  let newsObject = await page.evaluate(() => {
    const nachrichten_titel =
      document.querySelector(".field--name-title")?.innerText.trim() || "";
    const nachrichten_beschreibung =
      document.querySelector(".readmore__content p")?.innerText.trim() || "";
    const nachrichten_datum =
      document.querySelector(".story__footer time")?.innerText.trim() || "";
    const kommentar_anzahl =
      document
        .querySelector(".story__count .text-highlighted")
        ?.innerText.trim() || "";

    return {
      nachrichten_titel,
      nachrichten_beschreibung,
      nachrichten_datum,
      kommentar_anzahl,
    };
  });

  newsObject = {
    nachrichten_url: PATH + firstNewsUrl,
    ...newsObject,
  };

  const commentsData = await scrapeAllComments(page, newsObject.nachrichten_url);

  newsObject.kommentare = commentsData;

  result.push(newsObject);
 
  const outputFilePath = "comments.json";
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log(`Data written to ${outputFilePath}`);

  await browser.close();
})();
