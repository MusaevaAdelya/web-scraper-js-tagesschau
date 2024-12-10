// index.js

const puppeteer = require("puppeteer");
const fs = require("fs");
const { scrapeAllNewsObjects } = require('./scraperFunctions');

const PATH = "https://meta.tagesschau.de/";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(PATH, { waitUntil: "networkidle2" });
  await page.waitForSelector(".views-row");

  // This returns the result array, and also total counts
  const { result, totalUrls, totalComments } = await scrapeAllNewsObjects(page, PATH);

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
})();
