async function scrapeComments(page, newsUrl) {
  return await page.evaluate((newsUrl) => {
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
  }, newsUrl);
}

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

// This function now also scrapes all comments and returns the complete object
async function scrapeNewsObject(page, PATH, newsUrl) {
  await page.goto(PATH + newsUrl, { waitUntil: "networkidle2" });

  const result = await page.evaluate(() => {
    const nachrichten_titel =
      document.querySelector(".field--name-title")?.innerText.trim() || "";
    const nachrichten_beschreibung =
      document.querySelector(".readmore__content p")?.innerText.trim() || "";
    const nachrichten_datum =
      document.querySelector(".story__footer time")?.innerText.trim() || "";
    const kommentar_anzahl =
      document.querySelector(".story__count .text-highlighted")?.innerText.trim() || "";

    return {
      nachrichten_titel,
      nachrichten_beschreibung,
      nachrichten_datum,
      kommentar_anzahl,
    };
  });

  const newsObject = {
    nachrichten_url: PATH + newsUrl,
    ...result,
  };

  // After scraping the news data, also scrape all comments
  const commentsData = await scrapeAllComments(page, newsObject.nachrichten_url);
  newsObject.kommentare = commentsData;

  return newsObject;
}

// New function to extract and scrape all news objects from the main page
async function scrapeAllNewsObjects(page, PATH) {
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
    return [];
  }

  const result = [];
  for (const newsUrl of newsUrls) {
    const newsObject = await scrapeNewsObject(page, PATH, newsUrl);
    result.push(newsObject);
  }

  return result;
}

module.exports = {
  scrapeComments,
  scrapeAllComments,
  scrapeNewsObject,
  scrapeAllNewsObjects,
};
