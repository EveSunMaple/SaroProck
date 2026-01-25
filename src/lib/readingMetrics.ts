const FRONTMATTER_REGEX = /^---[\s\S]*?\n---\s*\n/;
const CHINESE_WPM = 300;
const ENGLISH_WPM = 200;

export type ReadingStats = {
  words: number;
  readingMinutes: number;
};

export const stripFrontmatter = (body: string): string =>
  body.replace(FRONTMATTER_REGEX, "");

export const computeReadingStats = (body: string): ReadingStats => {
  const plainText = stripFrontmatter(body);
  const chineseChars = (plainText.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (plainText.match(/[a-zA-Z0-9'-]+/g) || []).length;

  const chineseMinutes = chineseChars / CHINESE_WPM;
  const englishMinutes = englishWords / ENGLISH_WPM;
  const readingMinutes = Math.max(
    1,
    Math.ceil(chineseMinutes + englishMinutes),
  );

  return {
    words: chineseChars + englishWords,
    readingMinutes,
  };
};

export const formatWordCount = (count: number): string => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }

  return count.toLocaleString("zh-CN");
};
