// index.js
const puppeteer = require("puppeteer");
const fs = require("fs");
const { scrapeNewsObject } = require('./scraperFunctions');

const PATH = "https://meta.tagesschau.de";

(async () => {
  const startTime = Date.now(); // Start the timer
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(PATH, { waitUntil: "networkidle2" });
  await page.waitForSelector(".views-row");

  let result = [];
  let totalUrls = 0;
  let totalComments = 0;

  let currentPage = 0;

  let nextPageUrl=PATH;

  while (currentPage < 6) {
    // Extract all URLs from the current page
    const newsUrls = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll('.views-row a.button--primary[data-component-id="tgm:button"]')
      )
      .map(a => a.getAttribute("href"))
      .filter(href => href);
    });

    // If no URLs found on this page, break out
    if (!newsUrls || newsUrls.length === 0) {
      console.log("No news URLs found on this page.");
      break;
    }

    // Scrape each URL on the current page
    for (const newsUrl of newsUrls) {
      const { newsObject, totalComments: itemComments } = await scrapeNewsObject(page, PATH, newsUrl);
      result.push(newsObject);
      totalUrls += 1;
      totalComments += itemComments;
    }

    // If we've done 5 extra pages beyond the first, stop
    // This might be redundant if you are controlling with the while condition
    if (currentPage >= 5) {
      break;
    }

    await page.goto(nextPageUrl, { waitUntil: "networkidle2" });

    // Try to get the next page URL
    const nextPageHref = await page.evaluate(() => {
      const nextPageElement = document.querySelector(".pager__item.pager__item--next a");
      return nextPageElement ? nextPageElement.getAttribute('href') : null;
    });

    if (!nextPageHref) {
      // No next page
      console.log('No next page');
      break;
    }

    // Construct the absolute next page URL using the base PATH
    nextPageUrl = new URL(nextPageHref, PATH).href;

    // Go to the next page
    await page.goto(nextPageUrl, { waitUntil: "networkidle2" });
    await page.waitForSelector(".views-row");

    currentPage++;
  }

  if (result.length === 0) {
    console.log("No data was scraped.");
    await browser.close();
    return;
  }

  const outputFilePath = "comments.json";
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log(`Data written to ${outputFilePath}`);

  // At the end of the program, log the counters
  console.log(`Total URLs processed: ${totalUrls}`);
  console.log(`Total comments scraped: ${totalComments}`);

  await browser.close();

  const endTime = Date.now(); // End the timer
  const timeSpent = (endTime - startTime) / 1000; // Convert to seconds
  console.log(`Scraper completed in ${timeSpent.toFixed(2)} seconds.`);
})();
