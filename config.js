/* ============================================================
   Idol Table — site configuration
   ------------------------------------------------------------
   The service name is not decided yet. It is written here once and
   every screen, the browser tab title and the ranking code prefix
   read it from this file. To rename the service, change `name`
   (and `nameKo` if the Korean screen should differ).
   ============================================================ */
window.SITE_CONFIG = {
  name: 'Idol Table',
  nameKo: 'Idol Table',
  tagline: {
    en: 'Where K-pop idols ate, what they ordered, and a daily quiz built from the reports.',
    ko: '최애가 앉았던 바로 그 식탁! 아이돌 단골 맛집 & 메뉴 퀴즈'
  },
  /* Shown in the footer and the sources panel. */
  disclaimer: {
    en: 'Based on published reports. Not affiliated with any artist, agency or restaurant. Place visits are described as reported, not as confirmed fact.',
    ko: '공개 보도에 근거합니다. 어떤 아티스트·소속사·가게와도 제휴 관계가 없습니다.'
  },
  /* Ranking codes are shared by copy/paste between friends; this prefix names them. */
  rankCodePrefix: 'IDOLTABLE1.',
  /* How many questions a daily set wants. If the bank is smaller, the set is smaller. */
  dailySize: 10,
  /* Contact for corrections. Empty string = the panel shows "opening soon" instead of a fake address. */
  correctionContact: '',
  defaultLang: 'ko'
};
