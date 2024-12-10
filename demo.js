// index.js

const puppeteer = require("puppeteer");
const fs = require("fs");
const { scrapeNewsObject } = require('./scraperFunctions');

const PATH = "https://meta.tagesschau.de";
const result = [];

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(PATH, { waitUntil: "networkidle2" });
  await page.waitForSelector(".views-row");

  // Extract all URLs from the views-rows
  const newsUrls = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('.views-row a.button--primary[data-component-id="tgm:button"]')
    )
    .map(a => a.getAttribute("href"))
    .filter(href => href); // Filter out any null or undefined
  });

  if (!newsUrls || newsUrls.length === 0) {
    console.error("No news URLs found.");
    await browser.close();
    return;
  }

  // Loop through all found news URLs
  for (const newsUrl of newsUrls) {
    const newsObject = await scrapeNewsObject(page, PATH, newsUrl);
    result.push(newsObject);
  }

  const outputFilePath = "comments.json";
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log(`Data written to ${outputFilePath}`);

  await browser.close();
})();
