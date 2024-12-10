const puppeteer = require("puppeteer");
const fs = require("fs");

const PATH = "https://meta.tagesschau.de/";
const result = [];

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

  let   = await page.evaluate(() => {
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

  const commentsData = await page.evaluate((newsUrl) => {
    return Array.from(
      document.querySelectorAll(
        ".comment__mainwrapper.cardwrapper.comment.comment"
      )
    ).map((comment) => {
      const article = comment.querySelector(
        'article[data-component-id="tgm:comment"]'
      );
      const id = article?.id || "";
      const commentId = id.replace("comment-", "");
      const kommentar_url = `${newsUrl}/comment/${commentId}#${id}`;

      const kommentator_name =
        article?.querySelector("span.username")?.innerText.trim() || "";
      const kommentator_datum =
        article?.querySelector("time")?.innerText.trim() || "";
      const kommentar =
        article?.querySelector(".comment__content").textContent.trim() || "";
      const antworten_anzahl =
        comment
          .querySelector(".comment__answers .hide_answers > span")
          ?.innerText.trim() || "0";

      let antworten = [];

      if (antworten_anzahl > 0) {
        antworten = Array.from(
          comment.querySelectorAll(
            "article.cardwrapper.comment.comment--answer"
          )
        ).map((answer) => {
          const answerId = answer.id.replace("comment-", "");
          const answer_url = `${newsUrl}/comment/${answerId}#${answer.id}`;

          const answer_kommentator_name =
            answer.querySelector("span.username")?.textContent?.trim() ||
            "Unknown";

          const answer_kommentar_datum =
            answer
              .querySelector("footer.comment__meta time")
              ?.textContent?.trim() || "Unknown";

          const answer_kommentar =
            answer.querySelector(".comment__content")?.textContent?.trim() ||
            "";

          return {
            antwort_kommentar_url: answer_url,
            antwort_kommentator_name: answer_kommentator_name,
            antwort__datum: answer_kommentar_datum,
            antwort_kommentar: answer_kommentar,
          };
        });
      }

      return {
        kommentar_url,
        kommentator_name,
        kommentator_datum,
        kommentar,
        antworten_anzahl,
        antworten,
      };
    });
  }, newsObject.nachrichten_url);

  newsObject.kommentare = commentsData;

  result.push(newsObject);
  console.log("hello world");
 
  const outputFilePath = "comments.json";
  fs.writeFileSync(outputFilePath, JSON.stringify(result, null, 2));
  console.log(`Data written to ${outputFilePath}`);

  await browser.close();
})();
