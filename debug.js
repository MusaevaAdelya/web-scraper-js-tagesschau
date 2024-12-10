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

  const nextPageUrl = await page.evaluate(() => (document.querySelector(".pager__item.pager__item--next a").href));
  console.log(nextPageUrl)

  await browser.close();
})();
