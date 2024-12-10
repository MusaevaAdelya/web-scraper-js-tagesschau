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

module.exports = {
  scrapeComments
};
