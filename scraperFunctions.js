async function scrapeComments(page, newsUrl, counter) {
  const { comments, counts } = await page.evaluate(async (newsUrl) => {
    let counts = { commentCount: 0, answerCount: 0 };
    const commentNodes = Array.from(
      document.querySelectorAll(".comment__mainwrapper.cardwrapper.comment.comment:not(.moderator)")
    );

    const comments = [];
    for (const comment of commentNodes) {
      counts.commentCount++;
      const article = comment.querySelector('article[data-component-id="tgm:comment"]');
      const id = article?.id || "";
      const commentId = parseInt(id.replace("comment-", ""));
      const kommentar_url = `${newsUrl}/comment/${commentId}#${id}`;

      const kommentator_name = article?.querySelector("span.username")?.innerText.trim() || "";


      const commentTimeElement = article?.querySelector("time")?.innerText.trim() || "";
      // Await the exposed function
      let kommentator_datum = commentTimeElement;
      try {
        kommentator_datum = await convertToISO8601(commentTimeElement);
      } catch (err) {
        // If it's not a recognizable format, leave it as is or handle the error
      }


      
      const kommentar = article?.querySelector(".comment__content")?.textContent.trim() || "";
      const antworten_anzahl_str =
        comment.querySelector(".comment__answers .hide_answers > span")?.innerText.trim() || "0";
      const antworten_anzahl = parseInt(antworten_anzahl_str, 10);

      let antworten = [];
      if (antworten_anzahl > 0) {
        const answerNodes = Array.from(
          comment.querySelectorAll("article.cardwrapper.comment.comment--answer")
        );

        for (const answer of answerNodes) {
          counts.answerCount++;
          const answerId = parseInt(answer.id.replace("comment-", ""));
          const answer_url = `${newsUrl}/comment/${answerId}#${answer.id}`;

          const answer_kommentator_name =
            answer.querySelector("span.username")?.textContent?.trim() || "Unknown";
          const raw_answer_datum = answer
            .querySelector("footer.comment__meta time")
            ?.textContent?.trim() || "Unknown";
          
          // Await the exposed function if it's a valid date (you can conditionally check)
          let antwort_datum = raw_answer_datum;
          try {
            antwort_datum = await convertToISO8601(raw_answer_datum);
          } catch (err) {
            // If it's not a recognizable format, leave it as is or handle the error
          }

          const answer_kommentar =
            answer.querySelector(".comment__content")?.textContent?.trim() || "";

          antworten.push({
            antwort_id:answerId,
            antwort_url: answer_url,
            antwort_name: answer_kommentator_name,
            antwort_datum,
            antwort_kommentar: answer_kommentar,
          });
        }
      }

      comments.push({
        kommentar_id:commentId,
        kommentar_url,
        kommentator_name,
        kommentator_datum,
        kommentar,
        antworten_anzahl,
        antworten,
      });
    }

    return { comments, counts };
  }, newsUrl);

  // Update the external counter
  counter += counts.commentCount + counts.answerCount;
  return { comments, counter };
}

async function scrapeAllComments(page, newsUrl) {
  let commentsData = [];
  let nextPageUrl = newsUrl;
  let counter = 0;

  while (nextPageUrl) {
    await page.goto(nextPageUrl, { waitUntil: "networkidle2" });
    let { comments: currentPageComments, counter: updatedCounter } =
      await scrapeComments(page, newsUrl, counter);
    counter = updatedCounter;
    commentsData.push(...currentPageComments);

    nextPageUrl = await page.evaluate(() => {
      const nextPageElement = document.querySelector(
        ".pager__item.pager__item--next a"
      );
      return nextPageElement ? nextPageElement.href : null;
    });
  }

  // Return both the data and the total count of comments + answers
  return { commentsData, totalComments: counter };
}

async function scrapeNewsObject(page, PATH, newsUrl) {
  await page.goto(PATH + newsUrl, { waitUntil: "networkidle2" });

  const result = await page.evaluate(async () => {
    const nachrichten_titel =
      document.querySelector(".field--name-title")?.innerText.trim() || "";
    const nachrichten_beschreibung =
      document.querySelector(".readmore__content p")?.innerText.trim() || "";
    const timeElement = document.querySelector(".story__footer time");

    // Await the function here as well
    const nachrichten_datum = timeElement
      ? await convertToISO8601(timeElement.innerText.trim())
      : "";

    let kommentar_anzahl =
      document.querySelector(".story__count .text-highlighted")?.innerText.trim() || "0";
    kommentar_anzahl = parseInt(kommentar_anzahl, 10);

    return {
      nachrichten_titel,
      nachrichten_beschreibung,
      nachrichten_datum,
      kommentar_anzahl,
    };
  });

  const newsObject = {
    nachrichten_id:parseInt(newsUrl.split('/')[2]),
    nachrichten_url: PATH + newsUrl,
    ...result,
  };

  // Scrape all comments and get the total comment count
  const { commentsData, totalComments } = await scrapeAllComments(
    page,
    newsObject.nachrichten_url
  );
  newsObject.kommentare = commentsData;

  // Return both the news object and total comments count for this news item
  return { newsObject, totalComments };
}

async function scrapeAllNewsObjects(page, PATH) {
  // Extract all URLs from the views-rows
  const newsUrls = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        '.views-row a.button--primary[data-component-id="tgm:button"]'
      )
    )
      .map((a) => a.getAttribute("href"))
      .filter((href) => href); // Filter out any null or undefined
  });

  if (!newsUrls || newsUrls.length === 0) {
    console.error("No news URLs found.");
    return { result: [], totalUrls: 0, totalComments: 0 };
  }

  let result = [];
  let totalComments = 0;

  for (const newsUrl of newsUrls) {
    const { newsObject, totalComments: itemComments } = await scrapeNewsObject(
      page,
      PATH,
      newsUrl
    );
    result.push(newsObject);
    totalComments += itemComments;
  }

  // Return all results along with counters
  return {
    result,
    totalUrls: newsUrls.length,
    totalComments,
  };
}

// Function to convert dates into ISO 8601
function convertToISO8601(dateString) {
  const basicDatePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
  if (basicDatePattern.test(dateString)) {
    const [, day, month, year] = dateString.match(basicDatePattern);
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return date.toISOString();
  }

  const detailedDatePattern =
    /^(\d{2})\.\s([a-zA-ZäöüÄÖÜß]+)\s(\d{4})\s•\s(\d{2}):(\d{2})\sUhr$/;
  const monthMap = {
    Januar: "01",
    Februar: "02",
    März: "03",
    April: "04",
    Mai: "05",
    Juni: "06",
    Juli: "07",
    August: "08",
    September: "09",
    Oktober: "10",
    November: "11",
    Dezember: "12",
  };
  if (detailedDatePattern.test(dateString)) {
    const [, day, monthName, year, hour, minute] =
      dateString.match(detailedDatePattern);
    const month = monthMap[monthName];
    if (!month) {
      throw new Error(`Unrecognized month name: ${monthName}`);
    }
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
    return date.toISOString();
  }

  throw new Error(`Unrecognized date format: ${dateString}`);
}

module.exports = {
  scrapeComments,
  scrapeAllComments,
  scrapeNewsObject,
  scrapeAllNewsObjects,
  convertToISO8601
};
