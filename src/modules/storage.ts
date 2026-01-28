import {
  Article,
  ArticleContent,
  EntityWhoFoundArticle,
  NewsApiRequest,
  NewsArticleAggregatorSource,
} from "newsnexus10db";
import logger from "./logger";
import { RssItem } from "./rssFetcher";

export async function ensureAggregatorSourceAndEntity(nameOfOrg: string) {
  let source = await NewsArticleAggregatorSource.findOne({
    where: { nameOfOrg },
  });

  if (!source) {
    source = await NewsArticleAggregatorSource.create({
      nameOfOrg,
      isRss: true,
      isApi: false,
    });
  }

  let entity = await EntityWhoFoundArticle.findOne({
    where: { newsArticleAggregatorSourceId: source.id },
  });

  if (!entity) {
    entity = await EntityWhoFoundArticle.create({
      newsArticleAggregatorSourceId: source.id,
    });
  }

  return {
    newsArticleAggregatorSourceId: source.id,
    entityWhoFoundArticleId: entity.id,
  };
}

export async function storeRequestAndArticles(params: {
  requestUrl: string;
  andString: string | null;
  orString: string | null;
  notString: string | null;
  status: "success" | "error";
  items: RssItem[];
  newsArticleAggregatorSourceId: number;
  entityWhoFoundArticleId: number;
}) {
  const dateEndOfRequest = new Date().toISOString().split("T")[0];

  const request = await NewsApiRequest.create({
    newsArticleAggregatorSourceId: params.newsArticleAggregatorSourceId,
    dateEndOfRequest,
    countOfArticlesReceivedFromRequest: params.items.length,
    status: params.status,
    url: params.requestUrl,
    andString: params.andString,
    orString: params.orString,
    notString: params.notString,
    isFromAutomation: true,
  });

  let savedCount = 0;

  for (const item of params.items) {
    if (!item.link) {
      continue;
    }

    const existing = await Article.findOne({ where: { url: item.link } });
    if (existing) {
      continue;
    }

    const article = await Article.create({
      publicationName: item.source,
      title: item.title,
      description: item.description,
      url: item.link,
      publishedDate: item.pubDate,
      entityWhoFoundArticleId: params.entityWhoFoundArticleId,
      newsApiRequestId: request.id,
    });

    savedCount += 1;

    if (item.content) {
      await ArticleContent.create({
        articleId: article.id,
        content: item.content,
      });
    }
  }

  await request.update({
    countOfArticlesSavedToDbFromRequest: savedCount,
  });

  logger.info(
    `Stored ${savedCount} new articles for request ${request.id} (${params.items.length} received).`,
  );
}
