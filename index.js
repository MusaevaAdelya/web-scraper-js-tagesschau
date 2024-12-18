const puppeteer = require("puppeteer");
const fs = require("fs");
const { scrapeAllNewsObjects, convertToISO8601 } = require('./scraperFunctions');

const PATH = "https://meta.tagesschau.de";

function parseNachrichtenDatum(dateStr) {
  // dateStr is assumed to be a valid ISO 8601 date string
  return new Date(dateStr);
}

(async () => {
  const startTime = Date.now();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Expose the function ONCE here
  await page.exposeFunction('convertToISO8601', convertToISO8601);

  let allResults = [];
  let totalUrls = 0;
  let totalComments = 0;

  // Conditions
  const minUrls = 200;
  const minComments = 20000;
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000; // approx. one month in ms

  // Start from the homepage
  let currentURL = PATH;
  await page.goto(currentURL, { waitUntil: "networkidle2" });
  await page.waitForSelector(".views-row");

  while (true) {
    // Scrape all news objects on the current page
    const { result, totalUrls: pageUrls, totalComments: pageComments } = await scrapeAllNewsObjects(page, PATH);

    if (result.length === 0) {
      console.log("No data scraped on this page. Stopping.");
      break;
    }

    // Append results
    allResults.push(...result);

    // Update counters
    totalUrls += pageUrls;
    totalComments += pageComments;

    // latestDate = top item, earliestDate = bottom item (since newest news appear at the top)
    const latestDate = parseNachrichtenDatum(allResults[0].nachrichten_datum);
    const earliestDate = parseNachrichtenDatum(allResults[allResults.length - 1].nachrichten_datum);

    const dateDiff = latestDate - earliestDate;
    console.log(`Current totals: URLs=${totalUrls}, Comments=${totalComments}, Date difference=${dateDiff}ms`);

    // Check conditions
    if (
      totalUrls >= minUrls &&
      totalComments >= minComments &&
      dateDiff > oneMonthMs
    ) {
      console.log("Conditions met. Stopping pagination.");
      break;
    }

    // After scrapeAllNewsObjects, we may be on a detail page.
    // Return to the current pagination page.
    await page.goto(currentURL, { waitUntil: "networkidle2" });

    // Check if there's a next page link
    const nextPageLink = await page.$('.pager__item.pager__item--next a');
    if (!nextPageLink) {
      console.log("No next page found. Stopping.");
      break;
    }

    // Get the href for the next page
    const nextHref = await page.evaluate(el => el.getAttribute('href'), nextPageLink);

    // Construct the full URL for the next page
    const nextPageURL = PATH + nextHref;

    // Go to the next page using goto instead of click
    await page.goto(nextPageURL, { waitUntil: "networkidle2" });

    // Update currentURL to reflect the new page
    currentURL = nextPageURL;
  }

  // Write all results to file
  const outputFilePath = "comments.json";
  fs.writeFileSync(outputFilePath, JSON.stringify(allResults, null, 2));
  console.log(`Data written to ${outputFilePath}`);

  // Log counters
  console.log(`Total URLs processed: ${totalUrls}`);
  console.log(`Total comments scraped: ${totalComments}`);

  await browser.close();
  const endTime = Date.now();
  const timeSpent = (endTime - startTime) / 1000;
  console.log(`Scraper completed in ${timeSpent.toFixed(2)} seconds.`);
})();
